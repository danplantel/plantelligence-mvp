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
  parseR2Key,
  resolvePlanAccess,
} from "@/lib/teammates/access.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import { createNotification } from "@/lib/notifications/notifications.server";
import { categoryToSlug } from "@/lib/benefit-category-slug";
import {
  COMMENT_NOTIFICATION_TYPES,
  COMMENT_TYPING_TTL_MS,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_COMMENT_LENGTH,
  normalizeBenefitCategoryKey,
  type CommentAnchorInput,
  type CommentAttachment,
  type CommentAuthorView,
  type CommentMessageView,
  type CommentSurfaceTyping,
  type CommentTargetType,
  type CommentThreadView,
  type CommentTypingByThread,
  type CommentTypingPerson,
  type MentionableUser,
} from "./types";

const NO_ACCESS = "You don't have access to this plan.";

/* ────────────────────────── Shapes read back from Prisma ────────────────────────── */

interface MessageRow {
  id: string;
  authorUserId: string;
  body: string;
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
): CommentMessageView {
  const deleted = Boolean(row.deletedAt);
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
  };
}

function toThreadView(
  row: ThreadRow,
  authorById: Map<string, CommentAuthorView>,
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
    messages: row.messages.map((message) => toMessageView(message, authorById)),
  };
}

/** Batch-load author identities. A missing id simply yields no entry ("Removed user"). */
async function loadAuthors(
  userIds: string[],
): Promise<Map<string, CommentAuthorView>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, headshot: true },
  });
  const map = new Map<string, CommentAuthorView>();
  for (const user of users) {
    map.set(user.id, {
      userId: user.id,
      name: user.name || "Unknown user",
      headshot: user.headshot ?? null,
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

  const users = await prisma.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, email: true, headshot: true },
  });
  const candidates = users
    .map((user) => ({
      userId: user.id,
      name: user.name || user.email,
      email: user.email,
      headshot: user.headshot ?? null,
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

  const authorById = await loadAuthors(
    rows.flatMap((row) => row.messages.map((message) => message.authorUserId)),
  );
  return {
    clientId: access.clientId,
    threads: rows.map((row) => toThreadView(row, authorById)),
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

  const authors = await loadAuthors(rows.map((row) => row.userId));

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
    loadAuthors([input.userId]),
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

  return toThreadView(row, authorById);
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

  const authorById = await loadAuthors([
    input.userId,
    ...thread.messages.map((message) => message.authorUserId),
  ]);
  const view = toThreadView(
    { ...thread, messages: [...thread.messages, created] },
    authorById,
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
  if (input.isPlanOwner) return;
  const ownerOrAdmin = await isOwnerOrAdminOfOrganization({
    userId: input.userId,
    organizationId: input.organizationId,
  });
  if (ownerOrAdmin) return;
  throw new TeammateDataError(
    "Only an owner or admin can resolve or delete comments.",
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
    updated.messages.map((message) => message.authorUserId),
  );
  return toThreadView(updated, authorById);
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
