/**
 * comments.server — Plan/Benefit comment threads (Figma-style).
 *
 * Server-only. Commenting is IMPLICIT by View (decision 3 in
 * plans/plan-benefit-comments.md): anyone who can open the plan/benefit — owner,
 * teammate or Collaborator — may post and reply. Every read and write therefore
 * funnels through `resolvePlanAccess` at `level: "view"`, so the reachability rule
 * lives in one place and cannot be bypassed by a direct API call.
 *
 * Anchors are semantic, never DOM coordinates: a `sectionKey` names a region, and a
 * text anchor adds the field plus the selection offsets and the selected text.
 */

import prisma from "@/lib/prisma";
import {
  isOwnerOrAdminOfOrganization,
  listAccessiblePlanIds,
  normalizeCategory,
  parseR2Key,
  resolvePlanAccess,
} from "@/lib/teammates/access.server";
import { listPlanAssignments } from "@/lib/teammates/invites.server";
import { listManualTasks } from "@/lib/dashboard-tasks.server";
import {
  issueDestination,
} from "@/lib/plan-attention-actions";
import { listPlansNeedingAttention } from "@/lib/plan-needs-attention.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import { loadPersonIdentities } from "@/lib/teammates/identity.server";
import { createNotification } from "@/lib/notifications/notifications.server";
import { categoryToSlug } from "@/lib/benefit-category-slug";
import {
  COMMENT_NOTIFICATION_TYPES,
  COMMENT_TYPING_TTL_MS,
  GENERAL_SECTION_KEY,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_COMMENT_LENGTH,
  normalizeBenefitCategoryKey,
  type AssignableDerivedTask,
  type AssignableOwnTask,
  type AssignableStanding,
  type AssignableUser,
  type CommentAnchorInput,
  type CommentAttachment,
  type CommentAuthorView,
  type CommentMessageKind,
  type CommentMessageView,
  type CommentTaskView,
  type ThreadAssignable,
  type CommentSurfaceTyping,
  type CommentTargetType,
  type CommentThreadView,
  type CommentTypingByThread,
  type CommentTypingPerson,
  type MentionableUser,
  type SurfaceTeamMember,
} from "./types";

const NO_ACCESS = "You don't have access to this plan.";

/* ────────────────────────── Shapes read back from Prisma ────────────────────────── */

interface MessageRow {
  id: string;
  authorUserId: string;
  body: string;
  /** "comment" | "task_assignment" — see `CommentMessageKind`. */
  kind: string;
  /** The Task an assignment message announces; null for a comment. */
  taskId: string | null;
  mentions: string[];
  /** Prisma `Json` — parsed by `parseAttachments`. */
  attachments: unknown;
  deletedAt: Date | null;
  createdAt: Date;
}

interface ThreadRow {
  id: string;
  targetType: string;
  clientId: string;
  benefitCategory: string | null;
  anchorKind: string;
  sectionKey: string;
  fieldKey: string | null;
  rangeStart: number | null;
  rangeEnd: number | null;
  quote: string | null;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  messages: MessageRow[];
}

/* ─────────────────────────────── Mapping to views ─────────────────────────────── */

function toMessageView(
  row: MessageRow,
  authorById: Map<string, CommentAuthorView>,
  taskById: Map<string, CommentTaskView>,
): CommentMessageView {
  const deleted = Boolean(row.deletedAt);
  // An unknown kind from a newer writer degrades to an ordinary comment rather than vanishing.
  const kind: CommentMessageKind =
    row.kind === "task_assignment" ? "task_assignment" : "comment";
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    author: authorById.get(row.authorUserId) ?? null,
    // A withdrawn message keeps its place in the thread but gives up its text.
    body: deleted ? "" : row.body,
    mentions: row.mentions ?? [],
    attachments: deleted ? [] : parseAttachments(row.attachments),
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    kind,
    task:
      kind === "task_assignment" && row.taskId
        ? (taskById.get(row.taskId) ?? null)
        : null,
  };
}

function toThreadView(
  row: ThreadRow,
  authorById: Map<string, CommentAuthorView>,
  taskById: Map<string, CommentTaskView>,
): CommentThreadView {
  return {
    id: row.id,
    targetType: row.targetType as CommentTargetType,
    clientId: row.clientId,
    benefitCategory: row.benefitCategory,
    anchorKind: row.anchorKind === "text" ? "text" : "section",
    sectionKey: row.sectionKey,
    fieldKey: row.fieldKey,
    rangeStart: row.rangeStart,
    rangeEnd: row.rangeEnd,
    quote: row.quote,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolvedByUserId: row.resolvedByUserId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: row.messages.map((message) => toMessageView(message, authorById, taskById)),
  };
}

/**
 * Resolve the tasks behind a set of messages, for the cards that report on them.
 *
 * One batched read for a whole thread list, and this is exactly why the message KIND exists: only
 * messages that claim to announce a task are looked up, so a surface with no assignments pays
 * nothing and a busy one pays one query for all of its cards.
 *
 * A message whose task is absent from the result — withdrawn, or deleted with its plan — simply
 * gets no entry, and its card therefore has `task: null` and reads as withdrawn. That is what
 * actually happened, so nothing has to record "withdrawn" twice.
 */
async function loadTaskViews(
  organizationId: string,
  messages: MessageRow[],
): Promise<Map<string, CommentTaskView>> {
  const taskIds = [
    ...new Set(
      messages
        .filter((message) => message.kind === "task_assignment" && message.taskId)
        .map((message) => message.taskId as string),
    ),
  ];
  const views = new Map<string, CommentTaskView>();
  if (taskIds.length === 0) return views;

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: {
      id: true,
      title: true,
      done: true,
      doneAt: true,
      assignedByUserId: true,
      userId: true,
      derivedKind: true,
      benefitCategory: true,
      clientId: true,
      derivedGroupLabel: true,
    },
  });
  // The assignee's name travels with the card: resolved through the same identity resolver as every
  // byline in this panel, so a teammate reads the same here as they do on their own comments — and
  // the rail never has to parse a message body to render who was asked.
  const assignees = await loadAuthors(
    organizationId,
    tasks.map((task) => task.userId),
  );

  for (const task of tasks) {
    views.set(task.id, {
      id: task.id,
      title: task.title,
      done: task.done,
      doneAt: task.doneAt ? task.doneAt.toISOString() : null,
      // `assignedByUserId` is null on a self-authored task, and only an assignment message can hold
      // this id — falling back to the assignee means a card can never render a blank byline.
      assignedByUserId: task.assignedByUserId ?? task.userId,
      assignedToUserId: task.userId,
      assignedToName: assignees.get(task.userId)?.name || "a teammate",
      // Free: the same resolver call that produced the name already carried the picture.
      assignedToHeadshot: assignees.get(task.userId)?.headshot ?? null,
      derivedKind: task.derivedKind,
      benefitCategory: task.benefitCategory,
      clientId: task.clientId,
      derivedGroupLabel: task.derivedGroupLabel,
    });
  }
  return views;
}

/**
 * Batch-load author identities. A missing id simply yields no entry ("Removed user").
 *
 * The identities come from the ONE resolver in `lib/teammates/identity.server.ts`, which reads the
 * author's SEAT as well as their login. Reading the login alone is what made every Collaborator render
 * as a monogram in this panel while the DM rail drew their picture: a teammate's picture lives on their
 * profile, not on their account, and the organization's owner is the only member with no seat to look
 * at. The organization id is required for exactly that lookup.
 */
async function loadAuthors(
  organizationId: string,
  userIds: string[],
): Promise<Map<string, CommentAuthorView>> {
  const identities = await loadPersonIdentities({ organizationId, userIds });
  const map = new Map<string, CommentAuthorView>();
  for (const person of identities.values()) {
    map.set(person.userId, {
      userId: person.userId,
      // A comment is rendered with its author's name on a card a reader may not know at all, so an
      // absent name says so plainly rather than falling back to an email address.
      name: person.name || "Unknown user",
      headshot: person.headshot,
    });
  }
  return map;
}

/* ─────────────────────────────── Access resolution ─────────────────────────────── */

export interface CommentAccess {
  /** The real Client id, resolved from either an id or a slug. */
  clientId: string;
  kind: string | undefined;
}

/**
 * The one authorization gate. Throws a 403 (or 404 for an unknown plan) so routes
 * can map `status` straight onto the response.
 */
export async function resolveCommentAccess(input: {
  userId: string;
  clientIdOrSlug: string;
  /** Real category (not the slug), when the surface is a benefit. */
  category?: string | null;
}): Promise<CommentAccess> {
  const access = await resolvePlanAccess({
    userId: input.userId,
    clientIdOrSlug: input.clientIdOrSlug,
    category: input.category ?? null,
    level: "view",
  });
  if (!access.allowed) {
    const reason = (access as { reason?: string }).reason;
    const message = (access as { message?: string }).message ?? NO_ACCESS;
    throw new TeammateDataError(
      message,
      reason === "plan_not_found" ? 404 : 403,
      reason,
    );
  }
  const ok = access as { clientId?: string; kind?: string };
  return { clientId: ok.clientId ?? input.clientIdOrSlug, kind: ok.kind };
}

/**
 * May this user read this comment attachment?
 *
 * Comment keys go through the generic R2 proxy, which authorizes a plan-shaped key at PLAN level.
 * That is coarser than the comments API: a Collaborator scoped to one benefit category passes it
 * for any object under the plan — including an attachment on a thread in a category they do not
 * hold. The thread list is category-scoped, so they would have to already hold the key; this
 * closes that residue by resolving the message that owns the key and re-checking with the
 * thread's own scope, so the bytes follow the same rule as the thread they belong to.
 *
 * Returns `null` when no message claims the key, which is the caller's cue to fall back to the
 * generic plan-level check. That fallback is required, not a hole: a file is uploaded before the
 * comment is posted, and the composer renders its thumbnail from the optimistic message during
 * exactly that window, when no row references the key yet. Residue — an upload never attached, or
 * an attachment cleared by a soft delete — falls back to today's plan-level rule too, so this
 * narrows access for every attachment actually visible on a thread and changes nothing for bytes
 * that no row points at.
 */
export async function resolveCommentAttachmentAccess(input: {
  userId: string;
  key: string;
}): Promise<{ allowed: boolean; reason?: string } | null> {
  // Only comment keys have a message to resolve; anything else keeps the generic plan check.
  if (parseR2Key(input.key).folder !== "comments") return null;

  const message = await prisma.commentMessage.findFirst({
    where: { attachments: { array_contains: [{ key: input.key }] } },
    select: { thread: { select: { clientId: true, benefitCategory: true } } },
  });
  if (!message) return null;

  try {
    await resolveCommentAccess({
      userId: input.userId,
      clientIdOrSlug: message.thread.clientId,
      category: message.thread.benefitCategory,
    });
    return { allowed: true };
  } catch (error) {
    const mapped = mapCommentError(error);
    return { allowed: false, reason: mapped.code ?? "comment_forbidden" };
  }
}

/* ─────────────────────────────── Validation ─────────────────────────────── */

/**
 * A comment needs a body OR at least one attachment — "look at this" is a complete
 * comment when it carries a file — so the caller says whether attachments exist.
 */
function assertBody(body: unknown, hasAttachments: boolean): string {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text && !hasAttachments) {
    throw new TeammateDataError("Comment cannot be empty.", 400, "comment_empty");
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new TeammateDataError(
      `Comment is too long (max ${MAX_COMMENT_LENGTH} characters).`,
      400,
      "comment_too_long",
    );
  }
  return text;
}

/**
 * Validate the attachment descriptors a client sends with a new message.
 *
 * Each `key` must live under THIS plan's comment prefix
 * (`org/{ownerUserId}/plans/{clientId}/comments/…`) or it is refused — that stops a key
 * being attached to the wrong plan, and keeps every key inside the prefix the R2 read
 * proxy already authorizes. The upload itself is presigned separately (see the
 * `/api/clients/[id]/comments/attachments` route).
 */
function sanitizeAttachments(input: unknown, clientId: string): CommentAttachment[] {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new TeammateDataError(
      "Attachments must be a list.",
      400,
      "comment_bad_attachment",
    );
  }
  if (input.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new TeammateDataError(
      `Too many attachments (max ${MAX_ATTACHMENTS_PER_MESSAGE}).`,
      400,
      "comment_too_many_attachments",
    );
  }

  const escaped = clientId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expected = new RegExp(`^org/[^/]+/plans/${escaped}/comments/`);

  return input.map((raw) => {
    const item = (raw ?? {}) as Partial<CommentAttachment>;
    const key = typeof item.key === "string" ? item.key.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const size = typeof item.size === "number" ? item.size : 0;
    if (!key || !name) {
      throw new TeammateDataError(
        "An attachment is missing its key or name.",
        400,
        "comment_bad_attachment",
      );
    }
    if (!expected.test(key)) {
      throw new TeammateDataError(
        "An attachment does not belong to this plan.",
        400,
        "comment_bad_attachment",
      );
    }
    if (!(size > 0) || size > MAX_ATTACHMENT_BYTES) {
      throw new TeammateDataError(
        "An attachment is larger than the limit.",
        400,
        "comment_attachment_too_large",
      );
    }
    return {
      key,
      name: name.slice(0, 200),
      type:
        typeof item.type === "string" && item.type.trim()
          ? item.type.trim().slice(0, 120)
          : "application/octet-stream",
      size,
    };
  });
}

/** Read the stored attachment array back out of the Prisma `Json` column. */
function parseAttachments(value: unknown): CommentAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const item = (raw ?? {}) as Partial<CommentAttachment>;
    if (typeof item.key !== "string" || typeof item.name !== "string") return [];
    return [
      {
        key: item.key,
        name: item.name,
        type:
          typeof item.type === "string" && item.type
            ? item.type
            : "application/octet-stream",
        size: typeof item.size === "number" ? item.size : 0,
      },
    ];
  });
}

function assertAnchor(anchor: CommentAnchorInput | undefined): CommentAnchorInput {
  if (!anchor || (anchor.anchorKind !== "section" && anchor.anchorKind !== "text")) {
    throw new TeammateDataError(
      "A comment must be anchored to a section or a text range.",
      400,
      "comment_bad_anchor",
    );
  }
  const sectionKey = String(anchor.sectionKey ?? "").trim();
  if (!sectionKey) {
    throw new TeammateDataError("A comment needs a section.", 400, "comment_bad_anchor");
  }
  if (anchor.anchorKind === "section") {
    return { anchorKind: "section", sectionKey };
  }
  const fieldKey = String(anchor.fieldKey ?? "").trim();
  const rangeStart = Number.isInteger(anchor.rangeStart) ? anchor.rangeStart! : null;
  const rangeEnd = Number.isInteger(anchor.rangeEnd) ? anchor.rangeEnd! : null;
  if (!fieldKey || rangeStart === null || rangeEnd === null) {
    throw new TeammateDataError(
      "A text comment needs a field and a selection range.",
      400,
      "comment_bad_anchor",
    );
  }
  const quote = typeof anchor.quote === "string" ? anchor.quote.slice(0, 500) : null;
  return { anchorKind: "text", sectionKey, fieldKey, rangeStart, rangeEnd, quote };
}

/* ─────────────────────────────── Mentions ─────────────────────────────── */

/**
 * Match `@Name` tokens against the organization's mentionable people, longest name
 * first so "@Mary Jane" wins over "@Mary". Ids are de-duplicated.
 */
export function parseMentions(
  body: string,
  candidates: MentionableUser[],
): string[] {
  const lower = body.toLowerCase();
  const matched = new Set<string>();
  const sorted = [...candidates].sort((a, b) => b.name.length - a.name.length);
  for (const candidate of sorted) {
    if (!candidate.name) continue;
    if (lower.includes(`@${candidate.name.toLowerCase()}`)) {
      matched.add(candidate.userId);
    }
  }
  return [...matched];
}

/**
 * Everyone who can be @mentioned on this surface.
 *
 * The roster is organization-wide — an advisor's own team is a small set, so it is loaded and
 * filtered rather than joined — but the RESULT is restricted to the people who can actually open
 * the thread. A mention notifies, and the notification carries the comment's own text plus a deep
 * link; sending that to someone who cannot open the plan would leak the content and hand them a
 * link that refuses them.
 *
 * Filtering HERE, rather than at notification time, is the point: this one list feeds both the
 * @mention picker and `parseMentions`, so a person outside the surface cannot be offered in the
 * autocomplete, cannot be recognised in typed text, and therefore cannot be notified. There is no
 * second place to keep in step.
 *
 * The per-candidate check reuses `resolvePlanAccess` — the same decision function the rest of the
 * feature authorizes with — instead of re-deriving the category rule, which is exactly the second
 * implementation that would drift from it. It costs a parallel check per candidate, paid once per
 * rail open (the caller caches this list).
 */
export async function listMentionableUsers(input: {
  organizationId: string;
  /** The plan (id or slug) the comment is attached to. */
  clientIdOrSlug: string;
  /** Real category (not a slug), when the surface is a benefit. */
  category?: string | null;
}): Promise<MentionableUser[]> {
  const [organization, profiles] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { ownerUserId: true },
    }),
    prisma.teammateProfile.findMany({
      where: {
        organizationId: input.organizationId,
        state: "active",
        deactivatedAt: null,
        loginUserId: { not: null },
      },
      select: { loginUserId: true },
    }),
  ]);

  const ids = new Set<string>();
  if (organization?.ownerUserId) ids.add(organization.ownerUserId);
  for (const profile of profiles) {
    if (profile.loginUserId) ids.add(profile.loginUserId);
  }
  if (ids.size === 0) return [];

  // The state filter above decides WHO is a candidate; the shared resolver decides what each one looks
  // like, so a seat's picture and name reach this list exactly as they reach a thread card. It used to
  // read `user.headshot` alone while already holding the profile rows — the same gap as `loadAuthors`.
  const identities = await loadPersonIdentities({
    organizationId: input.organizationId,
    userIds: [...ids],
  });
  const candidates = [...identities.values()]
    .map((person) => ({
      userId: person.userId,
      name: person.name || person.email,
      email: person.email,
      headshot: person.headshot,
      // The rail identifies the signed-in reader from this same list, so the
      // person's standing rides along rather than needing a second lookup.
      roleLabel: person.isOrganizationOwner
        ? "Owner"
        : person.seatType === "team_member"
          ? "Team Member"
          : person.seatType === "collaborator"
            ? "Collaborator"
            : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Parallel, because each check is independent and the org is small. A refusal reason is not
  // needed here — "can they open it" is the whole question.
  const decisions = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      allowed: (
        await resolvePlanAccess({
          userId: candidate.userId,
          clientIdOrSlug: input.clientIdOrSlug,
          category: input.category ?? null,
          level: "view",
        })
      ).allowed,
    })),
  );
  return decisions
    .filter((decision) => decision.allowed)
    .map((decision) => decision.candidate);
}

/* ─────────────────────── Assigning work from a thread ─────────────────────── */

/**
 * Who may be handed work in THIS thread.
 *
 * Built on `listMentionableUsers` rather than on a fresh roster, because that list already answers
 * the harder question — "can this person open this surface?" — by resolving plan access at the
 * thread's own category scope. What it does not answer is the assignment rule, which is narrower:
 *
 *  - a PLAN thread is internal work, so a Collaborator is never a candidate, whatever they can see;
 *  - a BENEFIT-category thread may be handed to a Collaborator — but only one who holds that
 *    category, which is exactly the set the mentionable list has just resolved.
 *
 * Standing comes from `loadPersonIdentities`, the resolver both rails already share, so the picker
 * cannot disagree with the thread's own bylines about who somebody is.
 *
 * The assigner is left out: handing yourself work you already own is a no-op with extra steps, and
 * the dashboard's own Add Task field is one click away.
 */
export async function listAssignableUsers(input: {
  organizationId: string;
  userId: string;
  clientIdOrSlug: string;
  targetType: CommentTargetType;
  /** Real category, for a benefit surface. */
  category?: string | null;
}): Promise<AssignableUser[]> {
  const mentionable = await listMentionableUsers({
    organizationId: input.organizationId,
    clientIdOrSlug: input.clientIdOrSlug,
    category: input.category,
  });
  const candidates = mentionable.filter((person) => person.userId !== input.userId);
  const identities = await loadPersonIdentities({
    organizationId: input.organizationId,
    userIds: candidates.map((person) => person.userId),
  });

  const assignable: AssignableUser[] = [];
  for (const person of candidates) {
    const identity = identities.get(person.userId);
    const kind: AssignableStanding = identity?.isOrganizationOwner
      ? "owner"
      : identity?.seatType === "team_member"
        ? "team_member"
        : "collaborator";
    // The rule the whole matrix turns on, in one line: a plan thread is internal work.
    if (kind === "collaborator" && input.targetType !== "benefit") continue;
    assignable.push({
      userId: person.userId,
      name: person.name,
      email: person.email,
      headshot: person.headshot,
      kind,
    });
  }
  return assignable;
}

/**
 * The TEAM behind a comments surface — everyone who works on this plan, or on this benefit.
 *
 * This is a wider read than `listAssignableUsers` on purpose: the rail's Team dialog answers
 * "who is on this benefit?", not "who may I hand work to?". It merges two sources:
 *
 *  1. `listMentionableUsers` — the owner plus the organization's ACTIVE team members and
 *     collaborators who can open this plan (and this category, for a benefit). That is the same
 *     access-filtered list the @mention picker uses, so a person shown here can genuinely open the
 *     surface.
 *  2. `listPlanAssignments` — EVERY assignment on the plan, including invitations that have not
 *     been accepted yet. Those people are deliberately absent from the mentionable list (it needs a
 *     login), but they are exactly the collaborators an advisor sees on the benefit's Contacts tab —
 *     which is why the roster looked empty while a pending collaborator was plainly listed there.
 *
 * The two are merged by email (a person can appear in both) and labelled with the assignment's
 * category scope, so the dialog can distinguish a pending invite from an active member. The caller's
 * own view access is checked first, through the same `resolveCommentAccess` every comment read uses.
 */
export async function listSurfaceTeam(input: {
  organizationId: string;
  userId: string;
  clientIdOrSlug: string;
  targetType: CommentTargetType;
  /** Real category, for a benefit surface. */
  category?: string | null;
}): Promise<SurfaceTeamMember[]> {
  const category =
    input.targetType === "benefit" ? (input.category ?? null) : null;
  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: input.clientIdOrSlug,
    category,
  });

  const [mentionable, assignments] = await Promise.all([
    listMentionableUsers({
      organizationId: input.organizationId,
      clientIdOrSlug: access.clientId,
      category,
    }),
    listPlanAssignments({
      organizationId: input.organizationId,
      clientId: access.clientId,
    }),
  ]);

  // The assignment that puts each person on this surface, keyed by email so a mentionable person
  // (who has a login) inherits the scope of the very assignment that gave them access.
  const wanted = category ? normalizeCategory(category) : null;
  const matchesSurface = (row: {
    categoryScope: string;
    categories: string[];
  }) =>
    !wanted ||
    row.categoryScope === "all" ||
    row.categories.some((value) => normalizeCategory(value) === wanted);

  const assignmentByEmail = new Map(
    assignments
      .filter((row) => !row.deactivatedAt && matchesSurface(row))
      .map((row) => [row.email.trim().toLowerCase(), row]),
  );

  const identities = await loadPersonIdentities({
    organizationId: input.organizationId,
    userIds: mentionable.map((person) => person.userId),
  });

  const seen = new Set<string>();
  const team: SurfaceTeamMember[] = [];
  const add = (member: SurfaceTeamMember) => {
    const key = member.email.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    team.push(member);
  };

  // 1. Everyone the access-filtered list offers. Standing comes from the shared identity resolver,
  //    exactly as it does for the assign picker.
  for (const person of mentionable) {
    const identity = identities.get(person.userId);
    const assignment = assignmentByEmail.get(
      person.email.trim().toLowerCase(),
    );
    add({
      userId: person.userId,
      name: person.name,
      email: person.email,
      headshot: person.headshot,
      kind: identity?.isOrganizationOwner
        ? "owner"
        : identity?.seatType === "team_member"
          ? "team_member"
          : "collaborator",
      state: "active",
      categories:
        assignment?.categoryScope === "all"
          ? "all"
          : (assignment?.categories ?? []),
    });
  }

  // 2. Assignment rows with no login yet — pending invitations, and stored contacts that were
  //    given a plan scope. They belong on the roster; they simply cannot be opened as profiles.
  for (const assignment of assignments) {
    if (assignment.deactivatedAt || !matchesSurface(assignment)) continue;
    add({
      userId: assignment.loginUserId,
      name: assignment.name,
      email: assignment.email,
      headshot: assignment.headshot,
      kind:
        assignment.personType === "team_member"
          ? "team_member"
          : "collaborator",
      state: assignment.state,
      categories:
        assignment.categoryScope === "all" ? "all" : assignment.categories,
    });
  }

  // Owner first, then team members, then collaborators; alphabetical inside each group.
  const rank: Record<AssignableStanding, number> = {
    owner: 0,
    team_member: 1,
    collaborator: 2,
  };
  team.sort(
    (a, b) => rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name),
  );
  return team;
}

/**
 * The plan's DERIVED tasks, as they may be handed to somebody from this thread.
 *
 * Scoped to the thread's own plan — `listSystemTasks` is asked for exactly one plan, so nothing
 * from anywhere else can be offered — and, on a benefit thread, narrowed to the category the thread
 * is about. That narrowing is the same rule as the assignee list: a category-scoped person can only
 * act on that category's work, so offering them "Categorize the documents" would be handing them a
 * page they cannot open.
 *
 * **`ready-to-publish` is deliberately NOT offered.** Every other derived task is work someone can
 * do with the access they have; publishing is a CAPABILITY — Owner/Admin, with its own attestation
 * dialog — so a task row for it would be a promise the assignee could not keep. Work only the
 * assigner can do is not work to delegate.
 */
export async function listAssignableNeedsAttention(input: {
  organizationId: string;
  userId: string;
  /**
   * Narrow the offer to plans THIS person can reach, once one has been picked.
   *
   * The whole point of handing work over is that the other person can act on it, so a task whose plan
   * they cannot open is a dead end dressed up as a choice. That is why the dialog re-asks the moment
   * the assignee changes.
   */
  assigneeUserId?: string | null;
}): Promise<AssignableDerivedTask[]> {
  const [mine, theirs] = await Promise.all([
    listAccessiblePlanIds(input.userId),
    input.assigneeUserId
      ? listAccessiblePlanIds(input.assigneeUserId)
      : Promise.resolve(null),
  ]);
  const planIds = theirs ? mine.filter((id) => theirs.includes(id)) : mine;
  if (planIds.length === 0) return [];

  // The dashboard's OWN Needs Attention read — the same one behind the tile and the detail panel —
  // so the dialog offers what the panel is already showing rather than a second derivation of it.
  const flagged = await listPlansNeedingAttention(planIds);

  const items: AssignableDerivedTask[] = [];
  for (const plan of flagged) {
    for (const issue of plan.details.issues) {
      // The issue's own identity, which is what the assigned row stores as `derivedKind` +
      // `benefitCategory`: the dashboard's de-duplication keys on the ISSUE, so two inner tasks of
      // one issue still replace that issue's single derived row rather than adding to it.
      const issueId = `system-${issue.kind}-${plan.id}-${issue.category ?? ""}`;
      const fields = issue.missing ?? [];
      // Each missing FIELD is its own unit of work. "Incomplete benefit: Group Life" is a heading;
      // "No support contact assigned" is the job somebody can actually be handed. An issue with
      // nothing to enumerate is offered as itself, or it would be impossible to assign at all.
      const units = fields.length > 0 ? fields : [issue.label];
      for (const field of units) {
        items.push({
          id: `${issueId}::${field}`,
          title: field,
          groupLabel: issue.label,
          planName: plan.companyName,
          clientId: plan.id,
          href: issueDestination(plan.id, issue).href,
          kind: issue.kind,
          category: issue.category ?? null,
        });
      }
    }
  }
  return items;
}

/**
 * Everything the assign dialog needs for ONE thread, behind a single refusal.
 *
 * The thread is resolved first so the surface (plan or benefit category) comes from the row rather
 * than from the caller: a request cannot ask for a plan-scoped candidate list while naming a benefit
 * thread, and the category scope is the thread's own. The permission gate is then the same
 * `assertCanAssign` the write will use, so an offer can never be made by someone the write would
 * refuse — the picker lists exactly what the API accepts.
 */
export async function listAssignable(input: {
  organizationId: string;
  userId: string;
  clientIdOrSlug: string;
  targetType: CommentTargetType;
  /** Real category, for a benefit surface. */
  category?: string | null;
  /** Whose reachability the automated tasks are narrowed by, once a person has been picked. */
  assigneeUserId?: string | null;
}): Promise<ThreadAssignable> {
  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: input.clientIdOrSlug,
    category: input.category,
  });
  await assertCanAssign({
    userId: input.userId,
    organizationId: input.organizationId,
    isPlanOwner: access.kind === "owner",
  });

  const [users, derivedTasks, myTasks] = await Promise.all([
    listAssignableUsers({
      organizationId: input.organizationId,
      userId: input.userId,
      clientIdOrSlug: access.clientId,
      targetType: input.targetType,
      category: input.category,
    }),
    listAssignableNeedsAttention({
      organizationId: input.organizationId,
      userId: input.userId,
      assigneeUserId: input.assigneeUserId ?? null,
    }),
    listAssignableOwnTasks(input.userId),
  ]);

  return { users, derivedTasks, myTasks };
}

/**
 * The assigner's OWN manual tasks on this plan — the rows the DASHBOARD shows for it.
 *
 * Read through `listManualTasks`, the same function the dashboard uses, so the dialog offers the same
 * tasks rather than a second opinion about which exist. Only rows they wrote THEMSELVES are offered:
 * one already assigned to them is somebody else's request already, and mirroring it would put the same
 * work on two dashboards under one name.
 */
async function listAssignableOwnTasks(
  userId: string,
): Promise<AssignableOwnTask[]> {
  const tasks = await listManualTasks(userId, await listAccessiblePlanIds(userId));
  return tasks
    // Every task the reader wrote, from the WHOLE dashboard To-Do list rather than this one plan —
    // that is the list they are looking at when they decide to hand something over. Rows assigned TO
    // them are excluded: those are already somebody else's request.
    .filter((task) => task.assignedByUserId === null)
    .map((task) => ({
      id: task.id,
      title: task.title,
      done: task.done,
      planName: task.planName,
    }));
}

/** Matches the dashboard's own limit, so a title typed here is one that surface would accept. */
const MAX_TASK_TITLE_LENGTH = 200;

/**
 * Hand work to somebody from this thread.
 *
 * Four things happen, and the ORDER of them is the point:
 *
 *  1. the thread's surface is resolved and the caller must be an Owner or Admin — `assertCanAssign`,
 *     the same predicate the picker was gated on;
 *  2. the assignee must be somebody this thread's own candidate list OFFERS, not merely somebody who
 *     exists. That single membership test IS the collaborator rule: a Collaborator is absent from a
 *     plan thread's list, so the write refuses them with no second copy of the rule to keep in step
 *     with the picker;
 *  3. a `derivedTaskId` is accepted verbatim and looked up in the freshly derived list — so a forged
 *     id, or one this thread may not hand over, is refused rather than turned into a task row;
 *  4. the task, its message and the notification are written together, and the message is written
 *     against a task that already exists. A failure can therefore leave unannounced work — visible on
 *     a dashboard, completable — but never an announcement of work that was never created.
 */
export async function assignTask(input: {
  organizationId: string;
  userId: string;
  /**
   * The thread to assign into.
   *
   * Omitted when the assigner works from the PANEL with nothing open, and then the assignment MAKES a
   * thread — work somebody is being asked for needs somewhere to be discussed, and that is exactly
   * what the main panel's button is for. The card becomes the thread's opening message.
   */
  threadId?: string | null;
  /** Required when there is no `threadId`: the surface to create the thread on. */
  surface?: {
    clientIdOrSlug: string;
    targetType: CommentTargetType;
    category?: string | null;
  };
  assigneeUserId: string;
  /** Free text. Ignored when the work is named by `derivedTaskId` or mirrored from `sourceTaskId`. */
  title?: unknown;
  /** The picker's opaque id for one of the plan's derived tasks. Never taken apart. */
  derivedTaskId?: unknown;
  /** The assigner's OWN dashboard task this mirrors, when the work was picked from their list. */
  sourceTaskId?: unknown;
}): Promise<CommentThreadView> {
  // The surface comes from the THREAD when there is one — so a caller cannot name a benefit thread and
  // ask for a plan-scoped candidate list — and from the caller only when there is no thread yet.
  const existingThread = input.threadId
    ? await prisma.commentThread.findFirst({
        where: { id: input.threadId, organizationId: input.organizationId },
        select: { id: true, clientId: true, targetType: true, benefitCategory: true },
      })
    : null;
  if (input.threadId && !existingThread) {
    throw new TeammateDataError("Comment thread not found.", 404, "thread_not_found");
  }

  const surface = existingThread
    ? {
        clientIdOrSlug: existingThread.clientId,
        targetType: existingThread.targetType as CommentTargetType,
        category: existingThread.benefitCategory as string | null,
      }
    : input.surface;
  if (!surface) {
    throw new TeammateDataError(
      "An assignment needs a thread, or a surface to create one on.",
      400,
      "surface_required",
    );
  }

  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: surface.clientIdOrSlug,
    category: surface.category,
  });
  await assertCanAssign({
    userId: input.userId,
    organizationId: input.organizationId,
    isPlanOwner: access.kind === "owner",
  });

  const targetType = surface.targetType;
  const [candidates, offered] = await Promise.all([
    listAssignableUsers({
      organizationId: input.organizationId,
      userId: input.userId,
      clientIdOrSlug: access.clientId,
      targetType,
      category: surface.category,
    }),
    listAssignableNeedsAttention({
      organizationId: input.organizationId,
      userId: input.userId,
      // Narrowed by the ASSIGNEE: the point of handing work over is that they can act on it, and the
      // write is the last place that can be sure of that.
      assigneeUserId: input.assigneeUserId,
    }),
  ]);

  const assignee = candidates.find((person) => person.userId === input.assigneeUserId);
  if (!assignee) {
    throw new TeammateDataError(
      "That person cannot be assigned work on this comment.",
      400,
      "assignee_not_allowed",
    );
  }

  const derivedTaskId =
    typeof input.derivedTaskId === "string" ? input.derivedTaskId.trim() : "";
  const derived = derivedTaskId
    ? offered.find((task) => task.id === derivedTaskId)
    : undefined;
  if (derivedTaskId && !derived) {
    throw new TeammateDataError(
      "That task cannot be handed over from this comment.",
      400,
      "derived_task_not_offered",
    );
  }

  // A task picked from the assigner's OWN list is MIRRORED, never moved: only their own rows on this
  // plan qualify, and the copy simply takes the title. Nothing is stored to link the two, because
  // there is nothing to keep in sync — the assignee's row is theirs, and the assigner's stays put.
  const sourceTaskId =
    typeof input.sourceTaskId === "string" ? input.sourceTaskId.trim() : "";
  const mirrored = sourceTaskId
    ? await prisma.task.findFirst({
        where: {
          id: sourceTaskId,
          userId: input.userId,
          // Any plan: the modal offers the reader's WHOLE To-Do list, so the copy keeps the plan the
          // source was filed against rather than being forced onto this thread's.
          assignedByUserId: null,
        },
        select: { title: true, clientId: true },
      })
    : null;
  if (sourceTaskId && !mirrored) {
    throw new TeammateDataError(
      "That task is not one of yours on this plan.",
      400,
      "source_task_not_yours",
    );
  }

  const title = derived
    ? derived.title
    : mirrored
      ? mirrored.title
      : typeof input.title === "string"
        ? input.title.trim()
        : "";
  if (!title) {
    throw new TeammateDataError("A task title is required.", 400, "title_required");
  }
  if (title.length > MAX_TASK_TITLE_LENGTH) {
    throw new TeammateDataError(
      `Task titles are limited to ${MAX_TASK_TITLE_LENGTH} characters.`,
      400,
      "title_too_long",
    );
  }

  /**
   * Written in a deliberate ORDER rather than in one transaction.
   *
   * An interactive transaction looked tidier, but against a pooled connection with this project's
   * retry-on-transient layer it is worse than useless: a retried statement comes back to a transaction
   * the pooler has already closed (`P2028`), so a momentary blip fails the whole assignment. Ordered
   * writes fail softly instead, and the order is chosen so every partial state is survivable:
   *
   *  1. the thread, if there is not one — an empty thread is invisible (nothing renders a thread with
   *     no messages), so a crash here costs nothing;
   *  2. the task — unannounced work, which the assignee can still see and complete;
   *  3. the message, LAST, against a task that already exists — so nothing is ever announced that
   *     somebody cannot do.
   */
  const thread = existingThread
    ? existingThread
    : await prisma.commentThread.create({
        data: {
          organizationId: input.organizationId,
          clientId: access.clientId,
          targetType,
          benefitCategory:
            targetType === "benefit"
              ? normalizeBenefitCategoryKey(surface.category)
              : null,
          // The same anchor the panel's persistent composer uses: an assignment is not about a
          // section of the page, and this thread exists for the WORK rather than for a spot on it.
          anchorKind: "section",
          sectionKey: GENERAL_SECTION_KEY,
          createdByUserId: input.userId,
        },
        select: { id: true },
      });

  {
    const task = await prisma.task.create({
      data: {
        userId: assignee.userId,
        title,
        // The plan link puts the work in the assignee's own plan context. On a benefit thread the
        // category rides along too, which is what lets the dashboard recognise the derived row this
        // stands in for and show one row instead of two.
        clientId: access.clientId,
        assignedByUserId: input.userId,
        sourceThreadId: thread.id,
        derivedKind: derived?.kind ?? null,
        benefitCategory: derived?.category ?? null,
        // The HEADING, so the card can say which problem the inner task belongs to. Not derivable from
        // the two above: a heading carries the category, a count, or a different phrase per kind.
        derivedGroupLabel: derived?.groupLabel ?? null,
      },
    });

    const created = await prisma.commentMessage.create({
      data: {
        threadId: thread.id,
        authorUserId: input.userId,
        // The plain-text fallback. It is what the notification shows, what any consumer that does not
        // know what an assignment card is will render, and what the suite asserts on — so the card's
        // structured detail never has to be the only way to read what happened.
        body: `Assigned a task to ${assignee.name}: ${title}`,
        kind: "task_assignment",
        taskId: task.id,
      },
    });

    // The back-reference is for audit and for the withdrawal path; the message's `taskId` is the
    // link the reads actually travel.
    await prisma.task.update({
      where: { id: task.id },
      data: { sourceMessageId: created.id },
    });
  }

  // Re-read for the view. The thread now exists with the card in it, and every author on it — the
  // assigner among them, since they wrote the card — comes from one pass, so no byline falls back to
  // nothing. The thread is what the rail reconciles against, created or pre-existing alike.
  const assigned = await prisma.commentThread.findFirstOrThrow({
    where: { id: thread.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  const authorById = await loadAuthors(
    input.organizationId,
    assigned.messages.map((message) => message.authorUserId),
  );

  const assignerName = authorById.get(input.userId)?.name || "Someone";
  await notifyEvent({
    organizationId: input.organizationId,
    actorUserId: input.userId,
    recipients: [assignee.userId],
    type: COMMENT_NOTIFICATION_TYPES.taskAssigned,
    title: `${assignerName} assigned you a task`,
    body: snippet(title),
    href: commentHref(assigned),
  });

  return toThreadView(
    assigned,
    authorById,
    await loadTaskViews(input.organizationId, assigned.messages),
  );
}

/**
 * Take an assignment back.
 *
 * The TASK is deleted and the message stays. That pairing is the whole design: the message is the
 * history — "Dana asked Carl for this" is a true thing that happened in this conversation — while the
 * task is the work, and work nobody is doing any more should not sit on somebody's dashboard. It is
 * also what makes the card read as withdrawn with nothing stored to say so: the read finds no task to
 * report on and says exactly that.
 *
 * The assigner may always take back their own request. Anyone else needs the standing it took to make
 * it in the first place, so an Admin can tidy up after a colleague and a Viewer cannot tidy up at all.
 */
export async function withdrawAssignment(input: {
  organizationId: string;
  userId: string;
  messageId: string;
}): Promise<{ threadId: string }> {
  const message = await prisma.commentMessage.findFirst({
    where: {
      id: input.messageId,
      kind: "task_assignment",
      thread: { organizationId: input.organizationId },
    },
    include: { thread: true },
  });
  if (!message || !message.taskId) {
    throw new TeammateDataError("Assignment not found.", 404, "assignment_not_found");
  }

  const [task, access] = await Promise.all([
    prisma.task.findUnique({
      where: { id: message.taskId },
      select: { assignedByUserId: true },
    }),
    resolveCommentAccess({
      userId: input.userId,
      clientIdOrSlug: message.thread.clientId,
      category: message.thread.benefitCategory,
    }),
  ]);

  if (task?.assignedByUserId !== input.userId) {
    await assertCanAssign({
      userId: input.userId,
      organizationId: input.organizationId,
      isPlanOwner: access.kind === "owner",
    });
  }

  // `deleteMany` rather than `delete`: withdrawing twice is not an error, and a task that a plan
  // deletion already took should not turn a tidy-up into a crash.
  await prisma.task.deleteMany({ where: { id: message.taskId } });

  return { threadId: message.thread.id };
}

/* ─────────────────────────────── Notifications ─────────────────────────────── */

function snippet(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > 140 ? `${clean.slice(0, 137)}...` : clean;
}

function commentHref(thread: {
  id: string;
  clientId: string;
  targetType: string;
  benefitCategory: string | null;
}): string {
  if (thread.targetType === "benefit" && thread.benefitCategory) {
    return `/edit-benefit/${thread.clientId}/${categoryToSlug(
      thread.benefitCategory,
    )}?comment=${thread.id}`;
  }
  return `/edit-client/${thread.clientId}?comment=${thread.id}`;
}

/**
 * Best-effort notification fan-out. A failure here must never fail the comment
 * write, so every call is swallowed.
 */
async function notifyEvent(input: {
  organizationId: string;
  actorUserId: string;
  recipients: string[];
  type: string;
  title: string;
  body: string;
  href: string;
}): Promise<void> {
  const recipients = [...new Set(input.recipients)].filter(
    (id) => id && id !== input.actorUserId,
  );
  if (recipients.length === 0) return;
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        organizationId: input.organizationId,
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
        actorUserId: input.actorUserId,
      }).catch(() => undefined),
    ),
  );
}

/* ─────────────────────────────── Reads ─────────────────────────────── */

/**
 * The threads belonging to ONE comments surface — a plan, or one benefit category of it.
 *
 * Shared by the thread read and the typing poll so the two can never disagree about which threads a
 * surface contains. That matters more than usual here: the typing read is scoped by the same
 * predicate as the list, so a thread the reader can see is exactly the set of threads whose typing
 * they can be told about.
 */
function surfaceThreadWhere(input: {
  organizationId: string;
  clientId: string;
  targetType: CommentTargetType;
  category?: string | null;
}) {
  return {
    organizationId: input.organizationId,
    clientId: input.clientId,
    targetType: input.targetType,
    benefitCategory:
      input.targetType === "benefit"
        ? normalizeBenefitCategoryKey(input.category)
        : null,
  };
}

export async function listCommentThreads(input: {
  organizationId: string;
  userId: string;
  clientIdOrSlug: string;
  targetType: CommentTargetType;
  /** Real category, for a benefit surface. */
  category?: string | null;
}): Promise<{
  clientId: string;
  threads: CommentThreadView[];
  /** May this viewer resolve/reopen or delete — Owner/Admin only. Drives the rail's controls. */
  canModerate: boolean;
}> {
  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: input.clientIdOrSlug,
    category: input.category,
  });

  // Moderation rights are resolved HERE, where access is already computed, so the rail can
  // hide the Resolve/Delete controls instead of offering buttons the API would refuse. The
  // `kind: "owner"` short-circuit keeps the plan's own owner off the teammate lookup.
  const canModerate =
    access.kind === "owner" ||
    (await isOwnerOrAdminOfOrganization({
      userId: input.userId,
      organizationId: input.organizationId,
    }));

  const rows = await prisma.commentThread.findMany({
    where: surfaceThreadWhere({
      organizationId: input.organizationId,
      clientId: access.clientId,
      targetType: input.targetType,
      category: input.category,
    }),
    orderBy: { createdAt: "asc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  const [authorById, taskById] = await Promise.all([
    loadAuthors(
      input.organizationId,
      rows.flatMap((row) => row.messages.map((message) => message.authorUserId)),
    ),
    // Assignment cards report the work's LIVE state, so the tasks are resolved alongside the
    // authors — one batched read for the whole surface rather than one query per card.
    loadTaskViews(
      input.organizationId,
      rows.flatMap((row) => row.messages),
    ),
  ]);
  return {
    clientId: access.clientId,
    threads: rows.map((row) => toThreadView(row, authorById, taskById)),
    canModerate,
  };
}

/* ───────────────────────── "Currently typing" ───────────────────────── */

/**
 * The two scopes a typing signal can have, as the single `scopeKey` the table is uniquely keyed by.
 *
 * A reply is scoped to its THREAD. The rail's persistent composer is scoped to the SURFACE, because
 * it is composing a NEW thread and there is no thread id to attribute the signal to — the case the
 * first pass missed, which left the indicator invisible in the one box a reader actually types in.
 *
 * The surface key joins the client id, the target type and the category with `:`. It is only ever
 * compared for equality, never parsed back, so the separator cannot be ambiguous: two different
 * surfaces would need a colon inside a benefit category, and those come from the fixed controlled
 * vocabulary in `config/onboarding/service-categories`.
 */
function threadTypingKey(threadId: string): string {
  return `thread:${threadId}`;
}

function surfaceTypingKey(input: {
  clientId: string;
  targetType: CommentTargetType;
  category?: string | null;
}): string {
  return `surface:${input.clientId}:${input.targetType}:${input.category ?? ""}`;
}

/**
 * Record that the caller is typing a REPLY in this thread.
 *
 * Gated by the SAME `resolveCommentAccess` as posting a reply, resolved through the thread's own plan
 * and category — so the signal can only be raised in a thread the caller could actually reply to, and
 * a Collaborator scoped to one benefit category cannot announce themselves in another.
 *
 * An upsert on `(scopeKey, userId)`, so a ping moves one row rather than adding one per keystroke.
 */
export async function markCommentTyping(input: {
  organizationId: string;
  userId: string;
  threadId: string;
}): Promise<void> {
  const thread = await prisma.commentThread.findFirst({
    where: { id: input.threadId, organizationId: input.organizationId },
    select: { id: true, clientId: true, benefitCategory: true },
  });
  if (!thread) {
    throw new TeammateDataError("Comment thread not found.", 404, "thread_not_found");
  }
  await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: thread.clientId,
    category: thread.benefitCategory,
  });

  const scopeKey = threadTypingKey(thread.id);
  const now = new Date();
  await prisma.commentTyping.upsert({
    where: { scopeKey_userId: { scopeKey, userId: input.userId } },
    create: { scopeKey, threadId: thread.id, userId: input.userId, pingedAt: now },
    update: { pingedAt: now, threadId: thread.id },
  });
}

/**
 * Record that the caller is typing a NEW comment on this surface — the rail's persistent composer.
 *
 * There is no thread to hang the signal on, so it is scoped to the surface (the plan, or one benefit
 * category) and rendered once, above the thread list, rather than against any card. Gated exactly the
 * way creating a thread is: `resolveCommentAccess` on the surface itself.
 */
export async function markSurfaceTyping(input: {
  organizationId: string;
  userId: string;
  clientIdOrSlug: string;
  targetType: CommentTargetType;
  category?: string | null;
}): Promise<void> {
  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: input.clientIdOrSlug,
    category: input.category,
  });

  const scopeKey = surfaceTypingKey({
    clientId: access.clientId,
    targetType: input.targetType,
    category: input.category,
  });
  const now = new Date();
  await prisma.commentTyping.upsert({
    where: { scopeKey_userId: { scopeKey, userId: input.userId } },
    create: { scopeKey, threadId: null, userId: input.userId, pingedAt: now },
    update: { pingedAt: now },
  });
}

/**
 * Drop one person's typing rows for a surface-and-thread pair.
 *
 * Called when their comment LANDS: the message is what the signal promised, so leaving either row
 * behind would show the rail its own author still typing for the rest of the TTL after their words
 * are visibly on screen. BOTH scopes go, because an author may have been composing either a reply or
 * a new comment and the caller cannot know which — and a stale row in the other scope is invisible to
 * the person who created it but visible to everyone else.
 *
 * Never throws — a failure here is not worth failing an otherwise successful post over.
 */
export async function clearCommentTyping(input: {
  threadId: string;
  userId: string;
  clientId: string;
  targetType: CommentTargetType;
  category?: string | null;
}): Promise<void> {
  await prisma.commentTyping
    .deleteMany({
      where: {
        userId: input.userId,
        scopeKey: {
          in: [
            threadTypingKey(input.threadId),
            surfaceTypingKey({
              clientId: input.clientId,
              targetType: input.targetType,
              category: input.category,
            }),
          ],
        },
      },
    })
    .catch(() => undefined);
}

/**
 * Who is typing on one comments surface: the per-thread replies, plus the surface's own composer.
 *
 * ONE query for the whole surface, because the rail renders every thread on it at once — a request
 * per card every couple of seconds is precisely what to avoid. The caller is excluded in the WHERE,
 * so the UI never has to filter itself out and cannot accidentally show you typing to yourself.
 *
 * The surface scope is queried even when the surface has NO threads yet, which is exactly the moment
 * someone is composing the first comment.
 *
 * Stale rows are deleted on the way through. That is what keeps the table proportional to who is
 * typing NOW rather than to everyone who ever did: nothing else would ever remove a row, because the
 * signal is deliberately eventless. The delete is scoped to the same keys and cutoff as the read, so
 * the two cannot disagree about what counts as live.
 */
export async function listCommentTyping(input: {
  organizationId: string;
  userId: string;
  clientIdOrSlug: string;
  targetType: CommentTargetType;
  category?: string | null;
}): Promise<CommentSurfaceTyping> {
  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: input.clientIdOrSlug,
    category: input.category,
  });

  const threads = await prisma.commentThread.findMany({
    where: surfaceThreadWhere({
      organizationId: input.organizationId,
      clientId: access.clientId,
      targetType: input.targetType,
      category: input.category,
    }),
    select: { id: true },
  });

  const scopeKey = surfaceTypingKey({
    clientId: access.clientId,
    targetType: input.targetType,
    category: input.category,
  });
  const keys = [...threads.map((thread) => threadTypingKey(thread.id)), scopeKey];
  const cutoff = new Date(Date.now() - COMMENT_TYPING_TTL_MS);

  await prisma.commentTyping
    .deleteMany({ where: { scopeKey: { in: keys }, pingedAt: { lt: cutoff } } })
    .catch(() => undefined);

  const rows = await prisma.commentTyping.findMany({
    where: {
      scopeKey: { in: keys },
      pingedAt: { gt: cutoff },
      userId: { not: input.userId },
    },
    orderBy: { pingedAt: "asc" },
    select: { scopeKey: true, threadId: true, userId: true, pingedAt: true },
  });
  if (rows.length === 0) return { byThread: {}, composers: [] };

  const authors = await loadAuthors(
    input.organizationId,
    rows.map((row) => row.userId),
  );

  const byThread: CommentTypingByThread = {};
  const composers: CommentTypingPerson[] = [];
  for (const row of rows) {
    const author = authors.get(row.userId);
    // A row for a login that no longer exists has nothing to render. Skipped rather than shown as a
    // nameless "Someone is typing", which is worse than silence.
    if (!author) continue;
    const person: CommentTypingPerson = {
      userId: author.userId,
      name: author.name,
      headshot: author.headshot,
      // The mark travels with the name so the rail can retire it the moment a message of theirs
      // arrives — the polls are not in step, so "still typing" can otherwise outlive "has spoken".
      typingAt: row.pingedAt.toISOString(),
    };
    if (row.scopeKey === scopeKey) {
      composers.push(person);
      continue;
    }
    // Defensive: a thread-scoped key always carries a threadId, so this cannot happen — but dropping
    // the row is better than failing the whole poll over it.
    if (!row.threadId) continue;
    (byThread[row.threadId] ??= []).push(person);
  }

  return { byThread, composers };
}

/* ─────────────────────────────── Writes ─────────────────────────────── */

export async function createCommentThread(input: {
  organizationId: string;
  userId: string;
  clientIdOrSlug: string;
  targetType: CommentTargetType;
  category?: string | null;
  anchor: CommentAnchorInput;
  body: string;
  attachments?: unknown;
}): Promise<CommentThreadView> {
  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: input.clientIdOrSlug,
    category: input.category,
  });
  const attachments = sanitizeAttachments(input.attachments, access.clientId);
  const body = assertBody(input.body, attachments.length > 0);
  const anchor = assertAnchor(input.anchor);

  /**
   * Mention candidates are only needed when the body mentions someone.
   *
   * That lookup is three round-trips (the organization, its active profiles, then those users)
   * and the great majority of comments contain no `@` at all, so it is skipped unless there is
   * something to resolve. Against a remote database this is the single most wasteful thing the
   * write did: ~1.5s of a ~10s POST, spent on comments with nobody to notify.
   */
  const mentions = body.includes("@")
    ? parseMentions(
        body,
        await listMentionableUsers({
          organizationId: input.organizationId,
          clientIdOrSlug: access.clientId,
          category: input.category,
        }),
      )
    : [];

  const row = await prisma.commentThread.create({
    data: {
      organizationId: input.organizationId,
      clientId: access.clientId,
      targetType: input.targetType,
      benefitCategory:
        input.targetType === "benefit"
          ? normalizeBenefitCategoryKey(input.category)
          : null,
      anchorKind: anchor.anchorKind,
      sectionKey: anchor.sectionKey,
      fieldKey: anchor.fieldKey ?? null,
      rangeStart: anchor.rangeStart ?? null,
      rangeEnd: anchor.rangeEnd ?? null,
      quote: anchor.quote ?? null,
      createdByUserId: input.userId,
      messages: {
        create: {
          authorUserId: input.userId,
          body,
          mentions,
          attachments: attachments.length > 0 ? (attachments as any) : undefined,
        },
      },
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  /**
   * The comment IS what the typing signal promised, so the signal goes with it — the same clear the
   * reply path does, and the one this path was missing.
   *
   * Without it a NEW comment leaves the rail's surface row behind for the rest of the TTL, and the two
   * panels contradict each other on screen: the pill counts the new thread (the count spans the whole
   * surface) while the composer line still names its author as typing. BOTH keys are cleared, because
   * the author may have been composing in either box, and a stale row in the other scope is invisible
   * to whoever created it but visible to everyone else.
   */
  await clearCommentTyping({
    threadId: row.id,
    userId: input.userId,
    clientId: access.clientId,
    targetType: input.targetType,
    category: input.category,
  });

  // The author's own row and the plan's name are both needed only for the notification titles,
  // and the author's row doubles as the message's byline, so the two reads go out together
  // instead of one after the other.
  const [authorById, plan] = await Promise.all([
    loadAuthors(input.organizationId, [input.userId]),
    prisma.client.findUnique({
      where: { id: access.clientId },
      select: { userId: true, companyName: true },
    }),
  ]);
  const name = authorById.get(input.userId)?.name || "Someone";
  const planName = plan?.companyName || "a plan";
  const href = commentHref(row);
  if (mentions.length > 0) {
    await notifyEvent({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      recipients: mentions,
      type: COMMENT_NOTIFICATION_TYPES.mention,
      title: `${name} mentioned you in a comment on ${planName}`,
      body: snippet(body),
      href,
    });
  }
  if (plan?.userId) {
    await notifyEvent({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      recipients: [plan.userId],
      type: COMMENT_NOTIFICATION_TYPES.threadCreated,
      title: `${name} started a comment thread on ${planName}`,
      body: snippet(body),
      href,
    });
  }

  return toThreadView(
    row,
    authorById,
    await loadTaskViews(input.organizationId, row.messages),
  );
}

export async function addCommentMessage(input: {
  organizationId: string;
  userId: string;
  threadId: string;
  body: string;
  attachments?: unknown;
}): Promise<CommentThreadView> {
  const thread = await prisma.commentThread.findFirst({
    where: { id: input.threadId, organizationId: input.organizationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread) {
    throw new TeammateDataError("Comment thread not found.", 404, "thread_not_found");
  }
  await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: thread.clientId,
    category: thread.benefitCategory,
  });
  const attachments = sanitizeAttachments(input.attachments, thread.clientId);
  const body = assertBody(input.body, attachments.length > 0);

  // Only pay for the mention candidates when there is a mention to resolve — see the note in
  // `createCommentThread`. A reply that mentions nobody costs no extra round-trips.
  const mentions = body.includes("@")
    ? parseMentions(
        body,
        await listMentionableUsers({
          organizationId: input.organizationId,
          clientIdOrSlug: thread.clientId,
          category: thread.benefitCategory,
        }),
      )
    : [];

  const created = await prisma.commentMessage.create({
    data: {
      threadId: thread.id,
      authorUserId: input.userId,
      body,
      mentions,
      attachments: attachments.length > 0 ? (attachments as any) : undefined,
    },
  });

  // The reply IS what the typing signal promised, so it goes with it.
  await clearCommentTyping({
    threadId: thread.id,
    userId: input.userId,
    clientId: thread.clientId,
    targetType: thread.targetType as CommentTargetType,
    category: thread.benefitCategory,
  });

  const authorById = await loadAuthors(input.organizationId, [
    input.userId,
    ...thread.messages.map((message) => message.authorUserId),
  ]);
  const view = toThreadView(
    { ...thread, messages: [...thread.messages, created] },
    authorById,
    // The task map comes with it: this view is handed straight back to the rail, so a card inside it
    // must report the work rather than read "withdrawn" because the response did not look.
    await loadTaskViews(input.organizationId, [...thread.messages, created]),
  );

  // Participants (minus the author) are told a reply landed; those mentioned get the
  // mention wording instead, so a single event never fires twice for one person.
  const participants = thread.messages.map((message) => message.authorUserId);
  const mentionedSet = new Set(mentions);
  // The author's row is already in hand from the map loaded above — no second read just to get
  // a name for the notification title.
  const name = authorById.get(input.userId)?.name || "Someone";
  const href = commentHref(thread);
  if (mentions.length > 0) {
    await notifyEvent({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      recipients: mentions,
      type: COMMENT_NOTIFICATION_TYPES.mention,
      title: `${name} mentioned you in a comment`,
      body: snippet(body),
      href,
    });
  }
  await notifyEvent({
    organizationId: input.organizationId,
    actorUserId: input.userId,
    recipients: participants.filter((id) => !mentionedSet.has(id)),
    type: COMMENT_NOTIFICATION_TYPES.reply,
    title: `${name} replied in a comment thread`,
    body: snippet(body),
    href,
  });

  return view;
}

/**
 * May this user resolve/reopen a thread, or delete a thread or a message?
 *
 * **Owner and Admin only — deliberately NOT the author.** Anyone with View access can
 * comment and reply (that is the whole point of implicit-by-View), but closing a thread
 * or destroying it is *moderation*, not authorship, so it is gated on identity and role
 * for the same reason seats are:
 *
 * - `isPlanOwner` — the caller owns the plan (`Client.userId`) or its Organization, which
 *   `resolveCommentAccess` already computed, so the common owner case costs no extra query.
 * - `isOwnerOrAdminOfOrganization` — a teammate holding the Owner or Admin preset.
 *
 * The author clause was removed on purpose. It made the rule read as "anyone can tidy up
 * after themselves", which is not the rule: an Editor or Viewer keeps every other ability
 * and simply cannot moderate. Authorship must not be a privilege escalation, since a
 * Viewer who starts a thread would otherwise be able to destroy it and its history.
 */
async function assertCanModerate(input: {
  userId: string;
  organizationId: string;
  isPlanOwner: boolean;
}): Promise<void> {
  if (await isModerator(input)) return;
  throw new TeammateDataError(
    "Only an owner or admin can resolve or delete comments.",
    403,
    "comment_forbidden",
  );
}

/**
 * Does this user hold moderator standing on this surface?
 *
 * ONE predicate, read by moderation AND by assignment. They are the same standing — Owner or Admin,
 * never authorship, which would be a privilege escalation the moment a Viewer starts a thread — and
 * the two refusals differ only in what they say, not in what they allow. A predicate like this is
 * exactly the kind of rule that quietly grows a second opinion if it is written out twice.
 */
async function isModerator(input: {
  userId: string;
  organizationId: string;
  isPlanOwner: boolean;
}): Promise<boolean> {
  // The owner's own plan short-circuits the teammate lookup: `resolveCommentAccess` already proved
  // ownership, so the common case costs no query.
  if (input.isPlanOwner) return true;
  return isOwnerOrAdminOfOrganization({
    userId: input.userId,
    organizationId: input.organizationId,
  });
}

/**
 * May this user hand work to somebody from this thread?
 *
 * Deliberately the SAME standing and the same refusal code as moderation: from the caller's side,
 * "you may not moderate this panel" and "you may not assign from it" are one answer — this is not
 * your plan to direct. It follows that the thread payload's `canModerate` is also what shows or
 * hides the Assign control, and no second capability has to be sent to the rail.
 */
export async function assertCanAssign(input: {
  userId: string;
  organizationId: string;
  isPlanOwner: boolean;
}): Promise<void> {
  if (await isModerator(input)) return;
  throw new TeammateDataError(
    "Only an owner or admin can assign tasks from a comment.",
    403,
    "comment_forbidden",
  );
}

export async function setCommentThreadResolved(input: {
  organizationId: string;
  userId: string;
  threadId: string;
  resolved: boolean;
}): Promise<CommentThreadView> {
  const thread = await prisma.commentThread.findFirst({
    where: { id: input.threadId, organizationId: input.organizationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread) {
    throw new TeammateDataError("Comment thread not found.", 404, "thread_not_found");
  }
  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: thread.clientId,
    category: thread.benefitCategory,
  });
  await assertCanModerate({
    userId: input.userId,
    organizationId: input.organizationId,
    isPlanOwner: access.kind === "owner",
  });

  const updated = await prisma.commentThread.update({
    where: { id: thread.id },
    data: {
      resolvedAt: input.resolved ? new Date() : null,
      resolvedByUserId: input.resolved ? input.userId : null,
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  const authorById = await loadAuthors(
    input.organizationId,
    updated.messages.map((message) => message.authorUserId),
  );
  return toThreadView(
    updated,
    authorById,
    await loadTaskViews(input.organizationId, updated.messages),
  );
}

export async function deleteCommentMessage(input: {
  organizationId: string;
  userId: string;
  messageId: string;
}): Promise<{ threadId: string }> {
  const message = await prisma.commentMessage.findFirst({
    where: { id: input.messageId, thread: { organizationId: input.organizationId } },
    include: { thread: true },
  });
  if (!message) {
    throw new TeammateDataError("Comment not found.", 404, "comment_not_found");
  }
  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: message.thread.clientId,
    category: message.thread.benefitCategory,
  });
  await assertCanModerate({
    userId: input.userId,
    organizationId: input.organizationId,
    isPlanOwner: access.kind === "owner",
  });

  // Soft delete: the thread keeps its shape; the message gives up its text AND its files.
  await prisma.commentMessage.update({
    where: { id: message.id },
    data: { deletedAt: new Date(), body: "", attachments: [] },
  });
  return { threadId: message.threadId };
}

export async function deleteCommentThread(input: {
  organizationId: string;
  userId: string;
  threadId: string;
}): Promise<void> {
  const thread = await prisma.commentThread.findFirst({
    where: { id: input.threadId, organizationId: input.organizationId },
  });
  if (!thread) {
    throw new TeammateDataError("Comment thread not found.", 404, "thread_not_found");
  }
  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: thread.clientId,
    category: thread.benefitCategory,
  });
  await assertCanModerate({
    userId: input.userId,
    organizationId: input.organizationId,
    isPlanOwner: access.kind === "owner",
  });

  // Messages cascade with the thread.
  await prisma.commentThread.delete({ where: { id: thread.id } });
}

/* ─────────────────────────────── Route error mapping ─────────────────────────────── */

/** Map a thrown error to `{ status, error, code }` for a NextResponse. */
export function mapCommentError(error: unknown): {
  status: number;
  error: string;
  code?: string;
} {
  if (error instanceof TeammateDataError) {
    return { status: error.status, error: error.message, code: error.code };
  }
  const status = (error as { status?: number } | null)?.status ?? 500;
  const message =
    status === 401
      ? "Unauthorized"
      : (error as { message?: string } | null)?.message ??
        "Internal server error";
  return { status, error: message };
}
