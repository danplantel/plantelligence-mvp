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
  resolvePlanAccess,
} from "@/lib/teammates/access.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import { createNotification } from "@/lib/notifications/notifications.server";
import { categoryToSlug } from "@/lib/benefit-category-slug";
import {
  COMMENT_NOTIFICATION_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_COMMENT_LENGTH,
  normalizeBenefitCategoryKey,
  type CommentAnchorInput,
  type CommentAttachment,
  type CommentAuthorView,
  type CommentMessageView,
  type CommentTargetType,
  type CommentThreadView,
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

/** Everyone in the organization a commenter could @mention. */
export async function listMentionableUsers(input: {
  organizationId: string;
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
  return users
    .map((user) => ({
      userId: user.id,
      name: user.name || user.email,
      email: user.email,
      headshot: user.headshot ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
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

async function actorName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return user?.name || "Someone";
}

/* ─────────────────────────────── Reads ─────────────────────────────── */

export async function listCommentThreads(input: {
  organizationId: string;
  userId: string;
  clientIdOrSlug: string;
  targetType: CommentTargetType;
  /** Real category, for a benefit surface. */
  category?: string | null;
}): Promise<{ clientId: string; threads: CommentThreadView[] }> {
  const access = await resolveCommentAccess({
    userId: input.userId,
    clientIdOrSlug: input.clientIdOrSlug,
    category: input.category,
  });

  const rows = await prisma.commentThread.findMany({
    where: {
      organizationId: input.organizationId,
      clientId: access.clientId,
      targetType: input.targetType,
      benefitCategory:
        input.targetType === "benefit"
          ? normalizeBenefitCategoryKey(input.category)
          : null,
    },
    orderBy: { createdAt: "asc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  const authorById = await loadAuthors(
    rows.flatMap((row) => row.messages.map((message) => message.authorUserId)),
  );
  return {
    clientId: access.clientId,
    threads: rows.map((row) => toThreadView(row, authorById)),
  };
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

  const candidates = await listMentionableUsers({
    organizationId: input.organizationId,
  });
  const mentions = parseMentions(body, candidates);

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

  const authorById = await loadAuthors([input.userId]);

  // Plan owner + anyone mentioned learn about a brand-new thread.
  const plan = await prisma.client.findUnique({
    where: { id: access.clientId },
    select: { userId: true, companyName: true },
  });
  const name = await actorName(input.userId);
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

  const candidates = await listMentionableUsers({
    organizationId: input.organizationId,
  });
  const mentions = parseMentions(body, candidates);

  const created = await prisma.commentMessage.create({
    data: {
      threadId: thread.id,
      authorUserId: input.userId,
      body,
      mentions,
      attachments: attachments.length > 0 ? (attachments as any) : undefined,
    },
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
  const name = await actorName(input.userId);
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

/** May this user resolve/reopen or delete the thread? */
async function assertCanModerate(input: {
  userId: string;
  organizationId: string;
  threadCreatedByUserId: string;
  isPlanOwner: boolean;
}): Promise<void> {
  if (input.threadCreatedByUserId === input.userId) return;
  if (input.isPlanOwner) return;
  const ownerOrAdmin = await isOwnerOrAdminOfOrganization({
    userId: input.userId,
    organizationId: input.organizationId,
  });
  if (ownerOrAdmin) return;
  throw new TeammateDataError(
    "Only the thread author or an owner/admin can do that.",
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
    threadCreatedByUserId: thread.createdByUserId,
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
    threadCreatedByUserId: message.authorUserId,
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
    threadCreatedByUserId: thread.createdByUserId,
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
