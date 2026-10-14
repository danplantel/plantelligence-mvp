/**
 * types — the shared contract for Direct Messages.
 *
 * Deliberately dependency-free (no Prisma, no React) so the rail, the API routes and the server
 * module can all import it. See plans/direct-messages.md.
 *
 * Where a shape is genuinely the same as a comment's it is IMPORTED rather than copied: an
 * attachment record is `{ key, name, type, size }` in both features, and a second copy would
 * guarantee the two drift. What genuinely differs between the two features is the KEY PREFIX and
 * the guard that authorizes a read, and both of those are defined here as functions.
 */

import { PERSON_TYPE_LABELS, PRESET_ROLE_LABELS } from "@/types/teammate";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_COMMENT_LENGTH,
  commentAttachmentDownloadUrl,
  commentAttachmentInlineUrl,
  formatAttachmentSize,
  isImageAttachment,
  isPdfAttachment,
  type CommentAttachment,
} from "@/lib/comments/types";

/**
 * A file attached to a direct message.
 *
 * The SAME record as a comment's, on purpose: the attachment viewer and the composer's chip list
 * are shared between the two features, so this is an alias rather than a second interface that
 * could quietly diverge from it.
 */
export type DirectAttachment = CommentAttachment;

export {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  commentAttachmentDownloadUrl as directAttachmentDownloadUrl,
  commentAttachmentInlineUrl as directAttachmentInlineUrl,
  formatAttachmentSize,
  isImageAttachment,
  isPdfAttachment,
};

/**
 * The longest accepted message body.
 *
 * The same number as a comment's, deliberately. There is ONE body limit in the product, and two
 * limits a reader has to remember separately is one too many. Enforced in two places exactly as
 * the comment limit is — `maxLength` on the textarea stops the keystroke and the server refuses
 * the request — because the limit is a server rule and the attribute is only being helpful.
 */
export const MAX_DIRECT_MESSAGE_LENGTH = MAX_COMMENT_LENGTH;

/* ─────────────────────────── "Currently typing" ─────────────────────────── */

/**
 * How long a typing ping stays live, shared by the writer and the reader.
 *
 * The signal is a TIMESTAMP, so this is the only thing that ends it: the reader reports "typing"
 * only while the peer's timestamp is newer than this. That is what makes the indicator
 * self-healing — there is no "stopped typing" event to lose.
 *
 * Long enough to bridge the gap between keystrokes (a pause to think should not flicker the dots
 * off and on) and short enough that the dots cannot plausibly outlive the typing.
 */
export const TYPING_TTL_MS = 6000;

/** How often the OPEN conversation asks whether the other person is typing. */
export const TYPING_POLL_MS = 2500;

/**
 * The floor between two typing pings from the same writer.
 *
 * A fast typist fires an input event per keystroke; without this every one of them would be a
 * request. The TTL covers the gap, so a ping every couple of seconds is indistinguishable from
 * one per key while being two orders of magnitude cheaper.
 */
export const TYPING_PING_THROTTLE_MS = 2000;

/* ─────────────────────────────── Wire types ─────────────────────────────── */

/**
 * What kind of member the other person is, in the PRODUCT's vocabulary.
 *
 *  - `owner` — the organization's `ownerUserId`, who holds no seat at all.
 *  - `team_member` / `collaborator` — the seat's own `type`.
 *
 * Deliberately NOT the permission preset: a Collaborator is a Collaborator whether they hold
 * Contributor, Reviewer or Viewer. That is the same rule the header badge applies (see
 * lib/teammates/viewer-role.server.ts), and it is why the badge and this list can never call the
 * same person two different things.
 */
export type DirectPersonKind = "owner" | "team_member" | "collaborator";

export const DIRECT_PERSON_KIND_LABELS: Record<DirectPersonKind, string> = {
  owner: PRESET_ROLE_LABELS.owner,
  team_member: PERSON_TYPE_LABELS.team_member,
  collaborator: PERSON_TYPE_LABELS.collaborator,
};

/** The other person, as the rail renders them. */
export interface DirectParticipantView {
  userId: string;
  name: string;
  email: string;
  headshot: string | null;
  kind: DirectPersonKind;
  /** "Owner" | "Team Member" | "Collaborator" — the badge word. */
  label: string;
}

export interface DirectMessageView {
  id: string;
  authorUserId: string;
  /** Empty when the message was withdrawn, or when it carries only files. */
  body: string;
  attachments: DirectAttachment[];
  createdAt: string;
  /** Non-null when withdrawn; `body` and `attachments` are empty then. */
  deletedAt: string | null;
}

/** One row of the conversation list. */
export interface DirectConversationView {
  threadId: string;
  participant: DirectParticipantView;
  lastMessageAt: string;
  /** The newest message, flattened and truncated for a list row. Null before the first one. */
  lastMessagePreview: string | null;
  lastMessageByUserId: string | null;
  /** Messages after this reader's watermark, excluding their own. */
  unreadCount: number;
}

/** The open conversation. */
export interface DirectThreadView {
  threadId: string;
  participant: DirectParticipantView;
  /** Oldest first, so the rail can render top-to-bottom without reversing. */
  messages: DirectMessageView[];
  /** True when older messages exist before `messages[0]`. */
  hasEarlier: boolean;
  /** This reader's own watermark, ISO, or null when they have never opened it. */
  readAt: string | null;
  /**
   * Is the OTHER participant typing right now, per the TTL.
   *
   * Always about the other person and never about the caller — the server resolves it from the
   * side opposite the reader — so the rail can render it unconditionally without a self-check.
   * The dedicated typing endpoint is the fast path; this field is the thread read's answer, and
   * a stale-but-recent true here simply means the dots survive one poll cycle.
   */
  peerTyping: boolean;
}

/**
 * One candidate in the picker.
 *
 * `selectable: false` is the seat with no login yet — an invitation that has been sent but not
 * accepted. It is listed rather than hidden so the advisor can see why the person cannot be
 * messaged, instead of wondering whether the directory is broken.
 */
export interface DirectDirectoryEntry {
  /** The login to open a thread with. Null for a seat with no login. */
  userId: string | null;
  name: string;
  email: string;
  headshot: string | null;
  kind: DirectPersonKind;
  label: string;
  selectable: boolean;
}

/* ───────────────────────────── Notification ───────────────────────────── */

/**
 * The notification `type` this feature emits.
 *
 * ONE ROW PER CONVERSATION, never one per message: a DM is chatty and the Bell is not, so the
 * writer updates an existing unread row for the same thread rather than inserting a second. See
 * `coalesceDirectNotification`.
 */
export const DIRECT_MESSAGE_NOTIFICATION_TYPE = "direct_message";

/** Where a DM notification sends the reader: the rail, opened on that thread. */
export function directMessageHref(threadId: string): string {
  return `/?messages=${encodeURIComponent(threadId)}`;
}

/* ────────────────────────────── R2 key scheme ────────────────────────────── */

/**
 * Where a direct message's files live: `org/{organizationId}/messages/{threadId}/…`.
 *
 * Two deliberate differences from a comment's key, and the second one is load-bearing:
 *
 *  - the segment after `org/` is the ORGANIZATION, not an owner User id, because a DM has no plan
 *    and therefore no single owner to namespace under;
 *  - the THREAD id is in the key rather than a message id. That is what lets the read guard answer
 *    from participation alone, with no window in which an uploaded-but-not-yet-attached file has to
 *    fall back to a coarser rule: the thread exists before any upload into it can happen.
 *
 * `parseR2Key` does NOT recognise this shape — it matches `org/{x}/plans/{y}/{folder}/` — so these
 * keys land in its org-level fallback, which authorizes the ORGANIZATION OWNER. The guard in
 * `messages.server` therefore answers for every key under this prefix and never returns "no
 * opinion"; see `resolveDirectAttachmentAccess`.
 */
export function directAttachmentPrefix(
  organizationId: string,
  threadId: string,
): string {
  return `org/${organizationId}/messages/${threadId}/`;
}

/** Is this key a direct-message key? */
export function isDirectAttachmentKey(key: string): boolean {
  return /^org\/[^/]+\/messages\/[^/]+\//.test(key ?? "");
}

/** The thread a direct-message key belongs to, or null when it is not one. */
export function directAttachmentThreadId(key: string): string | null {
  const match = /^org\/([^/]+)\/messages\/([^/]+)\//.exec(key ?? "");
  return match ? match[2] : null;
}
