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

/**
 * Longest accepted comment body, in characters.
 *
 * 10,000 — deliberately below Slack's ~12,000, and roughly 1,500 words: long enough for a
 * genuinely detailed comment (a walkthrough of what is wrong, a pasted block of copy, a
 * summary of a call) without inviting essay-length back-and-forth inside a side panel.
 *
 * Enforced in two places on purpose: `maxLength` on the textarea stops the keystroke, and
 * `assertBody` refuses the request. The limit is a server rule; the textarea is only being
 * helpful, and a client that ignores it still gets a 400.
 */
export const MAX_COMMENT_LENGTH = 10000;

/**
 * The implicit whole-surface target. When the rail's persistent composer posts with no
 * section or text range chosen, the thread is stored as a section anchor under this key —
 * a "General" comment on the whole plan/benefit. It is an ordinary `sectionKey`, so it
 * needs no schema or API change.
 */
export const GENERAL_SECTION_KEY = "general";

/** Largest number of files a single comment may carry. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

/** Largest single attachment, in bytes (15 MB). */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** One file attached to a comment message. */
export interface CommentAttachment {
  /**
   * R2 object key, under `org/{ownerUserId}/plans/{clientId}/comments/…`, so
   * `/api/r2/object` authorizes reads against the caller's plan assignment.
   */
  key: string;
  name: string;
  /** MIME type, e.g. "image/png". */
  type: string;
  /** Size in bytes. */
  size: number;
}

export function isImageAttachment(type: string): boolean {
  return type.startsWith("image/");
}

export function isPdfAttachment(type: string): boolean {
  return type === "application/pdf";
}

/** Same-origin URL that streams the attachment inline (auth checked by the route). */
export function commentAttachmentInlineUrl(key: string): string {
  return `/api/r2/object?key=${encodeURIComponent(key)}`;
}

/**
 * Same-origin URL that downloads the attachment as a file.
 *
 * `name` (optional) is sent as the disposition filename — otherwise the browser names the
 * saved file after the timestamped storage key, e.g. "1760000000000-report.pdf".
 */
export function commentAttachmentDownloadUrl(key: string, name?: string): string {
  const base = `/api/r2/signed-url?key=${encodeURIComponent(
    key,
  )}&disposition=attachment&redirect=1`;
  return name ? `${base}&filename=${encodeURIComponent(name)}` : base;
}

/** "1.2 MB" — for attachment chips and the viewer. */
export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${index === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)} ${
    units[index]
  }`;
}

/** Notification `type` values this feature emits (consumed by the header bell). */
export const COMMENT_NOTIFICATION_TYPES = {
  threadCreated: "comment_thread_created",
  reply: "comment_reply",
  mention: "comment_mention",
  /**
   * A task was handed to you from a comment thread.
   *
   * Its own type rather than `reply`, because it is about WORK rather than about the conversation:
   * the bell has to be able to say "you have been given something to do" and deep-link to the thread
   * it came from, and a reader scanning the list should be able to tell the two apart without
   * opening either.
   */
  taskAssigned: "comment_task_assigned",
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
  /** Files attached to this message, oldest first. Empty when there are none. */
  attachments: CommentAttachment[];
  createdAt: string;
  /** Non-null when the message was withdrawn; `body` is empty then. */
  deletedAt: string | null;
  /**
   * What this message IS.
   *
   * A `"task_assignment"` renders as a CARD rather than as prose, which is the whole reason the
   * kind exists: the rail must not have to recognise an assignment by reading English.
   */
  kind: CommentMessageKind;
  /**
   * The task this message announces, with its LIVE state — read at thread-read time, so a card
   * reports the work rather than freezing the moment it was assigned.
   *
   * Null on an ordinary comment, and equally null on an assignment whose task is GONE: withdrawn,
   * or deleted along with its plan. One value rather than a flag plus a payload, on purpose — the
   * card reads "withdrawn" precisely because there is nothing left to report on.
   */
  task: CommentTaskView | null;
}

/* ─────────────────── Assigning work from a thread ─────────────────── */

export type CommentMessageKind = "comment" | "task_assignment";

/**
 * The three standings a person can hold in an organization.
 *
 * The same three words the messages module calls `DirectPersonKind`, kept as its own name here
 * because the dependency runs ONE way — `lib/messages/types.ts` imports from this module, so
 * importing back would make the two features a cycle. Two names for one vocabulary is the lesser
 * evil against that, and the words are asserted to match where it matters: the assignee rule.
 */
export type AssignableStanding = "owner" | "team_member" | "collaborator";

/** One person an assignment may be handed to on a given surface. */
export interface AssignableUser {
  userId: string;
  name: string;
  email: string;
  headshot: string | null;
  /** The standing that decided their eligibility, so the picker can explain itself. */
  kind: AssignableStanding;
}

/**
 * A task's live state, as a comment card shows it.
 *
 * Deliberately a projection of `Task` rather than the row: the card needs to name the work, who
 * asked for it, who owns it and whether it is done — and nothing about how the dashboard stores it.
 */
export interface CommentTaskView {
  id: string;
  title: string;
  done: boolean;
  doneAt: string | null;
  assignedByUserId: string;
  assignedToUserId: string;
  /**
   * The assignee's display name.
   *
   * Resolved server-side with the rest of the card, because the alternative is the rail parsing the
   * message body — and this whole feature introduced a MESSAGE KIND precisely so that reading an
   * assignment would never mean reading English.
   */
  assignedToName: string;
  /** The derived row this stands in for, when it was assigned from one. */
  derivedKind: string | null;
  benefitCategory: string | null;
  clientId: string | null;
}

/**
 * One of the plan's DERIVED tasks, as the assigner is offered it.
 *
 * `id` is the synthetic id the dashboard module produced, handed back verbatim and never taken
 * apart — the server re-derives the list and matches on it, so a client cannot describe a task the
 * module would not have offered. See `plans/comment-task-assignment.md` §8.
 */
export interface AssignableDerivedTask {
  id: string;
  title: string;
  /** The plan's name, so the picker can name the work without a second lookup. */
  planName: string;
  /** The destination that resolves it, carried onto the assignee's dashboard row. */
  href: string;
  /** "incomplete-benefit" | "uncategorized-documents" | "missing-disclaimers". */
  kind: string;
  category: string | null;
}

/** Everything the assign dialog is offered, for one thread. */
export interface ThreadAssignable {
  users: AssignableUser[];
  derivedTasks: AssignableDerivedTask[];
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

/* ─────────────────────────── "Currently typing" ─────────────────────────── */

/**
 * The typing cadence, in ONE place for the whole product.
 *
 * The Direct Messages feature reads these same three numbers (re-exported under its own names in
 * `lib/messages/types.ts`) rather than declaring its own, on the same principle that gives the two
 * features one body limit: a reader should not have to remember that "typing" lasts six seconds in
 * one panel and eight in the other.
 *
 * `TTL` is the whole mechanism — a ping older than this is simply not typing — which is what lets
 * the signal expire with no "stopped typing" event. It is long enough to bridge a pause for thought
 * (the dots should not flicker off and on) and short enough that it cannot outlive the typing.
 */
export const COMMENT_TYPING_TTL_MS = 6000;

/** How often an open comments rail asks who is typing across the threads it is showing. */
export const COMMENT_TYPING_POLL_MS = 2500;

/**
 * The floor between two pings from the same writer in the same thread.
 *
 * A fast typist fires an input event per keystroke; without this every one of them would be a
 * request. The TTL covers the gap, so one ping every couple of seconds is indistinguishable from
 * one per key while being two orders of magnitude cheaper.
 */
export const COMMENT_TYPING_PING_THROTTLE_MS = 2000;

/** One person currently typing in a comment thread. */
export interface CommentTypingPerson {
  userId: string;
  name: string;
  headshot: string | null;
  /**
   * When this person last said they were typing — ISO, on the SERVER's clock.
   *
   * The server has already applied the TTL before sending this (a person in the list is live), so
   * this is not a second expiry check: it is carried so the reader can tell whether a message of
   * theirs has overtaken the mark. See `typingMarkStands`.
   */
  typingAt: string;
}

/**
 * Who is typing, keyed by thread id.
 *
 * A whole surface in one map, because the rail shows every thread on it at once: one request per
 * thread would be a request per card, every couple of seconds.
 *
 * The reader is NEVER in here. The server resolves the map from the caller's own id, so neither the
 * card nor the composer has to filter themselves out — and a mistake in the UI cannot make you appear
 * to be typing to yourself.
 */
export type CommentTypingByThread = Record<string, CommentTypingPerson[]>;

/**
 * "Dana is typing" / "Dana and Carl are typing" / "3 people are typing".
 *
 * A comment thread can have MANY participants, which is the one place this diverges from the DM
 * indicator: "typing…" alone would be ambiguous on a card that several people share, so the line
 * names whoever it can. Over two names it stops listing them — a card two lines tall to say "typing"
 * is worse than the ambiguity.
 */
export function commentTypingLabel(people: CommentTypingPerson[]): string {
  const names = people.map((person) => person.name).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names.length} people are typing`;
}

/**
 * "Dana is typing a comment" — the SURFACE-level wording, for the rail's persistent composer.
 *
 * The noun is the whole difference: a thread line is about a reply ("is typing"), this one is about
 * composing a brand-new comment, and on a panel showing both at once the two must not read alike —
 * the reader needs to know whether to look at a card or at the composer.
 */
export function commentComposerTypingLabel(
  people: CommentTypingPerson[],
): string {
  const names = people.map((person) => person.name).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing a comment`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names.length} people are typing`;
}

/**
 * Everything one surface's typing poll answers: the per-thread replies, and the surface's own
 * composer.
 *
 * Two shapes because they are shown in two places — a thread's line belongs on that thread's card or
 * at the foot of its open view, while the composer's belongs once, above the list. `composers` is an
 * array rather than a map because a surface has exactly one composer no matter how many threads hang
 * off it.
 */
export interface CommentSurfaceTyping {
  byThread: CommentTypingByThread;
  composers: CommentTypingPerson[];
}

/* ─────────────── When a typing mark stops being true ─────────────── */

/** The two fields of a message that decide whether a typing mark is still believable. */
export interface TypingEvidenceMessage {
  authorUserId: string;
  createdAt: string;
}

/**
 * The newest `createdAt` among ONE person's messages, or `0` when they have posted none.
 *
 * `0` rather than `null` so the comparison below needs no special case: an empty set of messages
 * cannot overtake anything.
 */
export function newestMessageAt(
  messages: TypingEvidenceMessage[],
  authorUserId: string,
): number {
  let newest = 0;
  for (const message of messages) {
    if (message.authorUserId !== authorUserId) continue;
    const at = new Date(message.createdAt).getTime();
    if (at > newest) newest = at;
  }
  return newest;
}

/**
 * Is a typing mark still believable, or has a message of theirs overtaken it?
 *
 * A mark is a claim about NOW — "I am typing" — and a message created after it retires the claim on
 * the spot: whatever they were writing, they have sent it. That is a comparison of two SERVER
 * timestamps, not a longer TTL and not a guess about anything else.
 *
 * This has to happen in the reader's render because the pill and the typing line arrive on two
 * DIFFERENT polls — comments: a 10s message poll against a 2.5s typing poll; DMs: the thread read
 * against its own fast poll. Each is a snapshot, so the reader can hold a message that landed after
 * the snapshot that still shows its author typing, and nothing at the WRITE end can fix a reader
 * holding two stale reads. The render is the one place both snapshots meet, so it is where the
 * contradiction has to be resolved. On the server the signal is already right — a post clears the
 * row — and this closes the gap between two correct answers read at two different moments.
 *
 * It is an ADDITIONAL reason to stop showing dots, never the only one: callers pair it with the
 * server's own boolean, which is what still applies the TTL.
 *
 * Both timestamps are written server-side, so this assumes only that the application's clock and
 * the database's agree to well within the gap between someone's last keystroke and their send.
 */
export function typingMarkStands(
  mark: string | null | undefined,
  newestAuthored: number,
): boolean {
  if (!mark) return false;
  return new Date(mark).getTime() >= newestAuthored;
}

/**
 * The typing marks worth rendering: everyone whose own messages have not overtaken them.
 *
 * `messages` is every message the caller holds for the surface or thread the marks belong to. A mark
 * whose owner posted somewhere not in this list simply stands — the filter can only retire on
 * evidence it actually has.
 */
export function liveTypingPeople(
  people: CommentTypingPerson[],
  messages: TypingEvidenceMessage[],
): CommentTypingPerson[] {
  return people.filter((person) =>
    typingMarkStands(person.typingAt, newestMessageAt(messages, person.userId)),
  );
}
