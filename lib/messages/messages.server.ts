/**
 * messages.server — Direct Messages: the gate, the reads and the writes.
 *
 * Server-only. A DM is PRIVATE: there is no plan to check against and no moderator. The plan
 * (plans/direct-messages.md) calls this the single gate `resolveDirectAccess`; it is realised here
 * as three narrow checks rather than one function with a mode flag, so a refusal names the rule it
 * failed instead of making the caller infer one:
 *
 *   1. `requireDirectMembership` — the caller must be in the organization at all.
 *   2. `requireDirectThreadAccess` — for an existing conversation, the caller must BE one of its
 *      two participants. There is NO admin override. This is the sharpest break from Comments,
 *      where `assertCanModerate` lets an Owner or Admin resolve or delete anybody's thread: a DM
 *      is not moderated by anyone, and an organization's owner cannot read a conversation between
 *      two of their own team.
 *   3. `requireDirectoryTarget` — opening a NEW conversation requires the other person to be
 *      directoryable by the caller, through the same predicate the picker lists
 *      (`canMessageUser`), so the offer and the refusal cannot disagree.
 *
 * `openDirectThread` is the ONLY writer that creates a thread, and it canonicalises the pair
 * (`userAId < userBId`) — the order the table's CHECK constraint enforces, because a unique index
 * alone would happily accept the swapped tuple and leave the pair with two half-conversations.
 * Every other writer finds a thread by id and re-checks participation.
 */

import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/notifications.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import { canMessageUser, isDirectOrgMember } from "./directory.server";
import {
  DIRECT_MESSAGE_NOTIFICATION_TYPE,
  DIRECT_PERSON_KIND_LABELS,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_DIRECT_MESSAGE_LENGTH,
  directAttachmentPrefix,
  directAttachmentThreadId,
  directMessageHref,
  type DirectAttachment,
  type DirectConversationView,
  type DirectMessageView,
  type DirectParticipantView,
  type DirectPersonKind,
  type DirectThreadView,
} from "./types";

/** How many conversations the inbox returns in one read. */
const CONVERSATION_LIMIT = 50;
/** How many messages one thread read returns before it has to page back. */
const THREAD_PAGE_SIZE = 50;
/** One refusal message for every "not yours" case, so a probe learns nothing from the wording. */
const NO_ACCESS = "You don't have access to this conversation.";

/* ───────────────────────────── Participant identity ───────────────────────────── */

/**
 * The other participant, as the rail renders them.
 *
 * A DM participant is a `User` — the login — but the ORGANIZATION's record of them is a
 * `TeammateProfile`, and the profile is what carries the seat `type` behind the badge. Both are
 * read, and the profile's own name wins, because that is the organization's record of the person
 * (the same preference the roster and the directory apply).
 */
async function loadParticipantViews(input: {
  organizationId: string;
  userIds: string[];
}): Promise<Map<string, DirectParticipantView>> {
  const ids = [...new Set(input.userIds.filter(Boolean))];
  const views = new Map<string, DirectParticipantView>();
  if (ids.length === 0) return views;

  const [users, organization, seats] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, headshot: true },
    }),
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { ownerUserId: true },
    }),
    prisma.teammateProfile.findMany({
      where: { organizationId: input.organizationId, loginUserId: { in: ids } },
      select: {
        loginUserId: true,
        type: true,
        firstName: true,
        lastName: true,
        headshot: true,
      },
    }),
  ]);

  const seatByUserId = new Map(seats.map((seat) => [seat.loginUserId, seat]));

  for (const user of users) {
    const seat = seatByUserId.get(user.id);
    const profileName = seat
      ? [seat.firstName, seat.lastName]
          .map((part) => (part ?? "").trim())
          .filter(Boolean)
          .join(" ")
      : "";

    // The Owner holds no seat, so ownership is read from the Organization first. A login with
    // neither (a removed teammate whose account survives) falls to `collaborator`: of the two
    // possible answers, the one that over-claims nothing is the right one to guess.
    const kind: DirectPersonKind =
      organization?.ownerUserId === user.id
        ? "owner"
        : seat?.type === "team_member"
          ? "team_member"
          : "collaborator";

    views.set(user.id, {
      userId: user.id,
      name: profileName || user.name?.trim() || user.email,
      email: user.email,
      headshot: user.headshot ?? seat?.headshot ?? null,
      kind,
      label: DIRECT_PERSON_KIND_LABELS[kind],
    });
  }

  return views;
}

/* ──────────────────────────────── The gate ──────────────────────────────── */

/** Rule 1. */
async function requireDirectMembership(input: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  if (!(await isDirectOrgMember(input))) {
    throw new TeammateDataError(NO_ACCESS, 403, "not_a_member");
  }
}

interface ThreadRow {
  id: string;
  organizationId: string;
  userAId: string;
  userBId: string;
  aReadAt: Date | null;
  bReadAt: Date | null;
}

/**
 * Rule 2.
 *
 * Membership is checked first and existence second, so a caller outside the organization cannot
 * tell a real thread id from an invented one — both answers are the same refusal.
 */
async function requireDirectThreadAccess(input: {
  organizationId: string;
  userId: string;
  threadId: string;
}): Promise<ThreadRow> {
  await requireDirectMembership(input);

  const thread = await prisma.directThread.findFirst({
    where: { id: input.threadId, organizationId: input.organizationId },
    select: {
      id: true,
      organizationId: true,
      userAId: true,
      userBId: true,
      aReadAt: true,
      bReadAt: true,
    },
  });
  if (!thread) {
    throw new TeammateDataError(NO_ACCESS, 403, "not_a_participant");
  }
  if (thread.userAId !== input.userId && thread.userBId !== input.userId) {
    throw new TeammateDataError(NO_ACCESS, 403, "not_a_participant");
  }
  return thread;
}

/** Rule 3. */
async function requireDirectoryTarget(input: {
  organizationId: string;
  userId: string;
  otherUserId: string;
}): Promise<void> {
  if (!input.otherUserId) {
    throw new TeammateDataError("Who would you like to message?", 400, "missing_recipient");
  }
  if (input.otherUserId === input.userId) {
    throw new TeammateDataError("You cannot message yourself.", 400, "self_thread");
  }
  if (
    !(await canMessageUser({
      organizationId: input.organizationId,
      viewerUserId: input.userId,
      otherUserId: input.otherUserId,
    }))
  ) {
    throw new TeammateDataError(NO_ACCESS, 403, "not_in_directory");
  }
}

/**
 * Rule 2 for callers that need the check WITHOUT a read.
 *
 * The attachment presign is the reason this is public: it must establish participation before it
 * mints a key, not when the object is fetched later — otherwise an upload URL for somebody else's
 * conversation would already be in the wrong hands. The thread row stays private, so nothing
 * outside this module can read a watermark it has no business with.
 */
export async function assertDirectThreadAccess(input: {
  organizationId: string;
  userId: string;
  threadId: string;
}): Promise<void> {
  await requireDirectThreadAccess(input);
}

/* ─────────────────────────────── Validation ─────────────────────────────── */

/**
 * A message needs a body OR at least one attachment, exactly like a comment — "look at this" is a
 * complete message when it carries a file. The caller says whether attachments exist.
 */
function assertBody(body: unknown, hasAttachments: boolean): string {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text && !hasAttachments) {
    throw new TeammateDataError("Message cannot be empty.", 400, "message_empty");
  }
  if (text.length > MAX_DIRECT_MESSAGE_LENGTH) {
    throw new TeammateDataError(
      `Message is too long (max ${MAX_DIRECT_MESSAGE_LENGTH} characters).`,
      400,
      "message_too_long",
    );
  }
  return text;
}

/**
 * Validate the attachment descriptors a client sends with a message.
 *
 * Each `key` must live under THIS thread's prefix (`org/{organizationId}/messages/{threadId}/…`),
 * which also proves the file was uploaded for this conversation rather than borrowed from another
 * one. The upload itself is presigned separately.
 */
function sanitizeAttachments(
  input: unknown,
  organizationId: string,
  threadId: string,
): DirectAttachment[] {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new TeammateDataError("Attachments must be a list.", 400, "message_bad_attachment");
  }
  if (input.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new TeammateDataError(
      `Too many attachments (max ${MAX_ATTACHMENTS_PER_MESSAGE}).`,
      400,
      "message_too_many_attachments",
    );
  }

  const expected = directAttachmentPrefix(organizationId, threadId);

  return input.map((raw) => {
    const item = (raw ?? {}) as Partial<DirectAttachment>;
    const key = typeof item.key === "string" ? item.key.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const size = typeof item.size === "number" ? item.size : 0;
    if (!key || !name) {
      throw new TeammateDataError(
        "An attachment is missing its key or name.",
        400,
        "message_bad_attachment",
      );
    }
    if (!key.startsWith(expected)) {
      throw new TeammateDataError(
        "An attachment does not belong to this conversation.",
        400,
        "message_bad_attachment",
      );
    }
    if (!(size > 0) || size > MAX_ATTACHMENT_BYTES) {
      throw new TeammateDataError(
        "An attachment is larger than the limit.",
        400,
        "message_attachment_too_large",
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
function parseAttachments(value: unknown): DirectAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const item = (raw ?? {}) as Partial<DirectAttachment>;
    if (typeof item.key !== "string" || typeof item.name !== "string") return [];
    return [
      {
        key: item.key,
        name: item.name,
        type: typeof item.type === "string" ? item.type : "application/octet-stream",
        size: typeof item.size === "number" ? item.size : 0,
      },
    ];
  });
}

/** One line, for a list row and a notification body. */
function snippet(body: string, limit = 140): string {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 3)}...` : clean;
}

/** What a thread's preview becomes for a message that carries only files. */
const ATTACHMENT_PREVIEW = "Sent an attachment";

/* ──────────────────────────── The inbox (read) ──────────────────────────── */

export interface DirectInbox {
  conversations: DirectConversationView[];
  /** Unread messages across every conversation — the header badge's number. */
  unreadTotal: number;
}

/**
 * The reader's conversations, newest activity first.
 *
 * Deliberately ONE query for the rows: `lastMessageAt` and `lastMessagePreview` are denormalised
 * onto the thread precisely so this read never touches `DirectMessage`. The unread counts are a
 * second pass, and only for the threads that can possibly have any — a thread whose newest message
 * is the reader's own, or which they have already read up to, contributes no query at all.
 */
export async function listDirectThreads(input: {
  organizationId: string;
  userId: string;
}): Promise<DirectInbox> {
  await requireDirectMembership(input);

  const rows = await prisma.directThread.findMany({
    where: {
      organizationId: input.organizationId,
      OR: [{ userAId: input.userId }, { userBId: input.userId }],
    },
    orderBy: { lastMessageAt: "desc" },
    take: CONVERSATION_LIMIT,
    select: {
      id: true,
      userAId: true,
      userBId: true,
      aReadAt: true,
      bReadAt: true,
      lastMessageAt: true,
      lastMessageByUserId: true,
      lastMessagePreview: true,
    },
  });
  if (rows.length === 0) return { conversations: [], unreadTotal: 0 };

  const watermarkOf = (row: (typeof rows)[number]): Date | null =>
    row.userAId === input.userId ? row.aReadAt : row.bReadAt;

  // Only these can have unread messages: the newest one is not mine, and it is newer than my
  // watermark. Everything else is provably read, so it costs no query.
  const needsCount = rows.filter((row) => {
    if (row.lastMessageByUserId === input.userId) return false;
    const watermark = watermarkOf(row);
    return !watermark || row.lastMessageAt > watermark;
  });

  const counts = new Map<string, number>();
  if (needsCount.length > 0) {
    const results = await Promise.all(
      needsCount.map(async (row) => ({
        threadId: row.id,
        count: await prisma.directMessage.count({
          where: {
            threadId: row.id,
            authorUserId: { not: input.userId },
            deletedAt: null,
            // `gt` needs a value; a null watermark means "never opened", i.e. everything.
            ...(watermarkOf(row) ? { createdAt: { gt: watermarkOf(row)! } } : {}),
          },
        }),
      })),
    );
    for (const result of results) counts.set(result.threadId, result.count);
  }

  const participants = await loadParticipantViews({
    organizationId: input.organizationId,
    userIds: rows.map((row) => (row.userAId === input.userId ? row.userBId : row.userAId)),
  });

  const conversations: DirectConversationView[] = [];
  let unreadTotal = 0;

  for (const row of rows) {
    const otherUserId = row.userAId === input.userId ? row.userBId : row.userAId;
    const participant = participants.get(otherUserId);
    // A participant whose login no longer exists cannot be rendered; the thread is dropped rather
    // than shown as a nameless row (account deletion also cascades the thread away, so this is
    // the belt to that braces).
    if (!participant) continue;
    const unreadCount = counts.get(row.id) ?? 0;
    unreadTotal += unreadCount;
    conversations.push({
      threadId: row.id,
      participant,
      lastMessageAt: row.lastMessageAt.toISOString(),
      lastMessagePreview: row.lastMessagePreview ?? null,
      lastMessageByUserId: row.lastMessageByUserId ?? null,
      unreadCount,
    });
  }

  return { conversations, unreadTotal };
}

/* ──────────────────────────── The thread (read) ──────────────────────────── */

export async function getDirectThread(input: {
  organizationId: string;
  userId: string;
  threadId: string;
  /** Only messages strictly older than this ISO timestamp — the "load earlier" cursor. */
  before?: string | null;
}): Promise<DirectThreadView> {
  const thread = await requireDirectThreadAccess(input);

  const before = input.before ? new Date(input.before) : null;
  const rows = await prisma.directMessage.findMany({
    where: {
      threadId: thread.id,
      ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    // One extra row, purely to answer "is there more?" without a second count.
    take: THREAD_PAGE_SIZE + 1,
    select: {
      id: true,
      authorUserId: true,
      body: true,
      attachments: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  const hasEarlier = rows.length > THREAD_PAGE_SIZE;
  const page = (hasEarlier ? rows.slice(0, THREAD_PAGE_SIZE) : rows).reverse();

  const otherUserId = thread.userAId === input.userId ? thread.userBId : thread.userAId;
  const participants = await loadParticipantViews({
    organizationId: input.organizationId,
    userIds: [otherUserId],
  });
  const participant = participants.get(otherUserId);
  if (!participant) {
    throw new TeammateDataError(NO_ACCESS, 403, "not_a_participant");
  }

  const watermark = thread.userAId === input.userId ? thread.aReadAt : thread.bReadAt;

  return {
    threadId: thread.id,
    participant,
    messages: page.map(toMessageView),
    hasEarlier,
    readAt: watermark ? watermark.toISOString() : null,
  };
}

function toMessageView(row: {
  id: string;
  authorUserId: string;
  body: string;
  attachments: unknown;
  createdAt: Date;
  deletedAt: Date | null;
}): DirectMessageView {
  const withdrawn = row.deletedAt !== null;
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    body: withdrawn ? "" : row.body,
    attachments: withdrawn ? [] : parseAttachments(row.attachments),
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

/* ─────────────────────────────── Writes ─────────────────────────────── */

/**
 * Open the conversation between the caller and `otherUserId`, creating it if it does not exist.
 *
 * THE canonicalisation happens here, in the one writer that creates a thread. Sorting the two ids
 * means the upsert addresses the compound unique; the table's CHECK enforces the same order, so a
 * future writer that forgets is refused by the database rather than silently creating a second
 * thread for the pair.
 */
export async function openDirectThread(input: {
  organizationId: string;
  userId: string;
  otherUserId: string;
}): Promise<{ threadId: string }> {
  await requireDirectMembership(input);
  await requireDirectoryTarget(input);

  const [userAId, userBId] = [input.userId, input.otherUserId].sort();

  const thread = await prisma.directThread.upsert({
    where: {
      organizationId_userAId_userBId: {
        organizationId: input.organizationId,
        userAId,
        userBId,
      },
    },
    create: { organizationId: input.organizationId, userAId, userBId },
    // Nothing to change: an existing conversation is simply opened, and opening it must never
    // touch its read watermarks or its last-message fields.
    update: {},
    select: { id: true },
  });

  return { threadId: thread.id };
}

export async function sendDirectMessage(input: {
  organizationId: string;
  userId: string;
  threadId: string;
  body: unknown;
  attachments?: unknown;
}): Promise<DirectMessageView> {
  const thread = await requireDirectThreadAccess(input);
  const attachments = sanitizeAttachments(
    input.attachments,
    input.organizationId,
    thread.id,
  );
  const body = assertBody(input.body, attachments.length > 0);

  const message = await prisma.directMessage.create({
    data: {
      threadId: thread.id,
      authorUserId: input.userId,
      body,
      // `as any` mirrors the comment writer: Prisma types a `Json` column as
      // `InputJsonValue`, which a plain interface array does not structurally satisfy without an
      // index signature. `undefined` (rather than `[]`) keeps the column NULL when there is
      // nothing attached, so "no attachments" is one value rather than two.
      attachments: attachments.length > 0 ? (attachments as any) : undefined,
    },
    select: {
      id: true,
      authorUserId: true,
      body: true,
      attachments: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  const now = message.createdAt;
  await prisma.directThread.update({
    where: { id: thread.id },
    data: {
      lastMessageAt: now,
      lastMessageByUserId: input.userId,
      lastMessagePreview: body ? snippet(body) : ATTACHMENT_PREVIEW,
      // Sending is also reading: the sender's own watermark moves with their message, so the
      // message they just wrote is never counted as unread for them.
      ...(thread.userAId === input.userId ? { aReadAt: now } : { bReadAt: now }),
    },
  });

  await coalesceDirectNotification({
    organizationId: input.organizationId,
    recipientUserId:
      thread.userAId === input.userId ? thread.userBId : thread.userAId,
    actorUserId: input.userId,
    threadId: thread.id,
    preview: body ? snippet(body) : ATTACHMENT_PREVIEW,
  });

  return toMessageView(message);
}

/**
 * Move the reader's watermark, and clear the conversation's Bell row with it.
 *
 * The watermark is the whole unread model (see the schema), and the Bell row is found by the href
 * this module writes — `directMessageHref` is the only constructor of that string, so the writer
 * and this reader cannot drift.
 */
export async function markDirectThreadRead(input: {
  organizationId: string;
  userId: string;
  threadId: string;
}): Promise<void> {
  const thread = await requireDirectThreadAccess(input);
  const now = new Date();

  await prisma.directThread.update({
    where: { id: thread.id },
    data: thread.userAId === input.userId ? { aReadAt: now } : { bReadAt: now },
  });

  await prisma.notification
    .updateMany({
      where: {
        userId: input.userId,
        type: DIRECT_MESSAGE_NOTIFICATION_TYPE,
        href: directMessageHref(thread.id),
        readAt: null,
      },
      data: { readAt: now },
    })
    .catch(() => undefined);
}

/**
 * Withdraw a message. Author only — there is no moderator on a private thread, which is why this
 * checks the author rather than a role.
 */
export async function withdrawDirectMessage(input: {
  organizationId: string;
  userId: string;
  messageId: string;
}): Promise<void> {
  const message = await prisma.directMessage.findUnique({
    where: { id: input.messageId },
    select: { id: true, threadId: true, authorUserId: true, createdAt: true },
  });
  if (!message) {
    throw new TeammateDataError("That message does not exist.", 404, "message_not_found");
  }

  const thread = await requireDirectThreadAccess({
    organizationId: input.organizationId,
    userId: input.userId,
    threadId: message.threadId,
  });

  if (message.authorUserId !== input.userId) {
    throw new TeammateDataError(
      "You can only delete your own messages.",
      403,
      "not_the_author",
    );
  }

  // Soft delete, and the message gives up its text AND its files — the same rule the comment
  // withdrawal applies, so a withdrawn message cannot leave its attachments readable behind it.
  await prisma.directMessage.update({
    where: { id: message.id },
    data: { deletedAt: new Date(), body: "", attachments: [] },
  });

  // The ONLY case in which the denormalised preview goes stale: the withdrawn message is the
  // newest one, so it has to be replaced by whatever precedes it.
  const newest = await prisma.directMessage.findFirst({
    where: { threadId: thread.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, body: true, attachments: true, deletedAt: true },
  });
  if (newest?.id === message.id) {
    await prisma.directThread.update({
      where: { id: thread.id },
      data: {
        lastMessagePreview:
          newest.deletedAt || !newest.body
            ? newest.deletedAt
              ? "Message deleted"
              : ATTACHMENT_PREVIEW
            : snippet(newest.body),
      },
    });
  }
}

/* ──────────────────────────── Notifications ──────────────────────────── */

/**
 * ONE unread Bell row per conversation.
 *
 * A DM is chatty and the Bell is not, so this updates the existing unread row for the thread — the
 * title becomes "New messages from …", the body the newest preview, and `createdAt` is refreshed so
 * it floats to the top — instead of inserting a row per message. Five messages from one person
 * therefore cost one row, and the plan and team notifications are never buried underneath a
 * conversation.
 *
 * Best effort, like the comment fan-out: a notification that fails must never fail the message the
 * reader just sent.
 */
async function coalesceDirectNotification(input: {
  organizationId: string;
  recipientUserId: string;
  actorUserId: string;
  threadId: string;
  preview: string;
}): Promise<void> {
  if (!input.recipientUserId || input.recipientUserId === input.actorUserId) return;

  const href = directMessageHref(input.threadId);

  try {
    const author = await prisma.user.findUnique({
      where: { id: input.actorUserId },
      select: { name: true },
    });
    const title = `New messages from ${author?.name?.trim() || "a teammate"}`;

    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.recipientUserId,
        type: DIRECT_MESSAGE_NOTIFICATION_TYPE,
        href,
        readAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.notification.update({
        where: { id: existing.id },
        data: { title, body: input.preview, createdAt: new Date() },
      });
      return;
    }

    await createNotification({
      organizationId: input.organizationId,
      userId: input.recipientUserId,
      type: DIRECT_MESSAGE_NOTIFICATION_TYPE,
      title,
      body: input.preview,
      href,
      actorUserId: input.actorUserId,
    });
  } catch {
    // Best effort. See the comment above.
  }
}

/* ─────────────────────── Attachment reads (the guard) ─────────────────────── */

/**
 * May this user be issued a URL for this object?
 *
 * Returns `null` when the key is not a direct-message key, which is the caller's cue to fall back
 * to the generic object check. For a DM key it ALWAYS answers, and that is not an optimisation but
 * a requirement: `parseR2Key` does not recognise this key shape, so a DM key falls into its
 * org-level fallback, which authorizes the ORGANIZATION OWNER — the one third party who is
 * expressly not allowed to read a private conversation's files. There is therefore no "no opinion"
 * path for these keys.
 *
 * No fallback is needed for the upload window either, because the THREAD id is in the key: the
 * thread exists before anything can be uploaded into it, so participation is always resolvable.
 */
export async function resolveDirectAttachmentAccess(input: {
  userId: string;
  key: string;
}): Promise<{ allowed: boolean; reason?: string } | null> {
  const threadId = directAttachmentThreadId(input.key);
  if (!threadId) return null;

  const thread = await prisma.directThread.findUnique({
    where: { id: threadId },
    select: { userAId: true, userBId: true },
  });

  // A key naming no thread is refused rather than passed along: the generic check would hand it to
  // the organization owner on the strength of the `org/{organizationId}` segment alone.
  if (!thread) return { allowed: false, reason: "not_a_participant" };

  const isParticipant =
    thread.userAId === input.userId || thread.userBId === input.userId;

  return isParticipant
    ? { allowed: true }
    : { allowed: false, reason: "not_a_participant" };
}

/* ────────────────────────── Route error mapping ────────────────────────── */

/** Map a thrown error to `{ status, error, code }` for a NextResponse. */
export function mapDirectError(error: unknown): {
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
      : (error as { message?: string } | null)?.message ?? "Internal server error";
  return { status, error: message };
}
