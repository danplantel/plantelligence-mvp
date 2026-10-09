/**
 * types — the shared contract for Plan/Benefit comments.
 *
 * Deliberately dependency-free (no Prisma, no React) so the client rail, the API
 * routes and the server module can all import it without pulling server code into
 * the bundle. See plans/plan-benefit-comments.md.
 */

/** Which surface a thread belongs to: a plan, or one category of a benefit. */
export type CommentTargetType = "plan" | "benefit";

/**
 * How a thread is pinned. "section" highlights a whole region; "text" pins a
 * selection inside one field. Never a DOM coordinate — see `sectionKey`.
 */
export type CommentAnchorKind = "section" | "text";

/** Longest accepted comment body, in characters. */
export const MAX_COMMENT_LENGTH = 5000;

/** Notification `type` values this feature emits (consumed by the header bell). */
export const COMMENT_NOTIFICATION_TYPES = {
  threadCreated: "comment_thread_created",
  reply: "comment_reply",
  mention: "comment_mention",
} as const;

export type CommentNotificationType =
  (typeof COMMENT_NOTIFICATION_TYPES)[keyof typeof COMMENT_NOTIFICATION_TYPES];

/**
 * The same normalization the Benefit API and `lib/benefit-draft` use for category
 * keys, so a thread stored for "Group Health" matches regardless of casing or
 * whitespace. Kept here (not in the client-only draft module) so the server can use
 * it without importing a Zustand store.
 */
export function normalizeBenefitCategoryKey(
  category: string | null | undefined,
): string {
  return String(category ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** The anchor a thread is created from. */
export interface CommentAnchorInput {
  anchorKind: CommentAnchorKind;
  sectionKey: string;
  /** Text anchors only: the field the range lives in. */
  fieldKey?: string | null;
  rangeStart?: number | null;
  rangeEnd?: number | null;
  /** Text anchors only: the selected text, shown in the rail and used to re-locate. */
  quote?: string | null;
}

/** The display identity of a comment author, or null when the login was removed. */
export interface CommentAuthorView {
  userId: string;
  name: string;
  headshot: string | null;
}

export interface CommentMessageView {
  id: string;
  authorUserId: string;
  /** Null when the authoring `User` no longer exists. */
  author: CommentAuthorView | null;
  body: string;
  mentions: string[];
  createdAt: string;
  /** Non-null when the message was withdrawn; `body` is empty then. */
  deletedAt: string | null;
}

export interface CommentThreadView {
  id: string;
  targetType: CommentTargetType;
  clientId: string;
  benefitCategory: string | null;

  anchorKind: CommentAnchorKind;
  sectionKey: string;
  fieldKey: string | null;
  rangeStart: number | null;
  rangeEnd: number | null;
  quote: string | null;

  resolvedAt: string | null;
  resolvedByUserId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;

  messages: CommentMessageView[];
}

/** One candidate for an @mention in the composer. */
export interface MentionableUser {
  userId: string;
  name: string;
  email: string;
  headshot: string | null;
}
