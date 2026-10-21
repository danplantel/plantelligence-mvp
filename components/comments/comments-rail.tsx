"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ClipboardList,
  Loader2,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  Paperclip,
  RotateCcw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Headshot } from "@/components/ui/headshot";
import { cn } from "@/lib/utils";
import {
  GENERAL_SECTION_KEY,
  commentAttachmentInlineUrl,
  commentComposerTypingLabel,
  commentTypingLabel,
  formatAttachmentSize,
  isImageAttachment,
  liveTypingPeople,
  type CommentAttachment,
  type CommentMessageView,
  type CommentThreadView,
  type CommentTypingPerson,
} from "@/lib/comments/types";
import { scrollToBottom } from "@/lib/scroll-to-bottom";
import { NewMessagesPill } from "@/components/new-messages-pill";
import { useNewMessages } from "@/hooks/useNewMessages";
import { useCommentTyping } from "@/hooks/useCommentTyping";
import { useCommentMode } from "./comment-mode-provider";
import { CommentAttachmentModal } from "./comment-attachment-modal";
import { CommentComposer } from "./comment-composer";
import { CommentTaskCard } from "./comment-task-card";
import { AssignTaskDialog } from "./assign-task-dialog";
import { TeamMembersDialog } from "./team-members-dialog";
import { UserProfileProvider, useUserProfile } from "./user-profile-context";
import { AttachmentThumbnail } from "./attachment-thumbnail";
import { RailPanelSwitch } from "./rail-panel-switch";

type ThreadFilter = "open" | "resolved" | "all";

/**
 * Enter transitions for the two views the panel's body can show. `tailwindcss-animate` is
 * already this project's plugin (the dialogs and sheets use the same `animate-in` utilities),
 * so this needs no new dependency and no new CSS.
 *
 * Note what these are NOT: animation state. They are plain classes on the element React
 * creates when the branch swaps, so the transition plays on the navigation (a real unmount and
 * remount) and can never replay on a poll-driven re-render — a reply arriving three seconds
 * later changes children, not the branch. There is nothing to keep in sync and nothing to
 * clean up. Forward slides in from the panel's own edge, and Back brings the list in from the
 * left, so the direction of travel matches the direction of the navigation.
 */
const VIEW_ENTER_FORWARD =
  "animate-in fade-in-0 slide-in-from-right-4 duration-200 ease-out";

/**
 * How long the panel stays mounted after it is closed, so the slide OUT can finish.
 *
 * Must match the `duration-200` on the aside — the panel is unmounted when this elapses, and a
 * shorter timer would cut the animation off mid-flight while a longer one would leave an invisible
 * fixed element swallowing clicks.
 */
const RAIL_TRANSITION_MS = 200;
const VIEW_ENTER_BACK =
  "animate-in fade-in-0 slide-in-from-left-4 duration-200 ease-out";

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function messageAuthorName(
  message: CommentMessageView,
  currentUserId: string | null,
): string {
  if (message.author) return message.author.name;
  if (message.authorUserId === "pending" || message.authorUserId === currentUserId) {
    return "You";
  }
  return "Removed user";
}

function MessageRow({
  message,
  currentUserId,
  onOpenAttachment,
}: {
  message: CommentMessageView;
  currentUserId: string | null;
  onOpenAttachment: (attachment: CommentAttachment) => void;
}) {
  const { canModerate, withdrawAssignment } = useCommentMode();
  const { open: openProfile } = useUserProfile();
  const name = messageAuthorName(message, currentUserId);
  // Defensive against a stale SWR cache written before attachments existed.
  const attachments = message.attachments ?? [];
  const task = message.task;
  // Offered only where it would actually succeed: the assigner taking back their own request, or a
  // moderator tidying up after a colleague. A placeholder task — one still in flight — has no server
  // row to withdraw yet, so the control waits for the real one.
  const mayWithdraw =
    Boolean(task) &&
    task?.id !== "pending-task" &&
    (canModerate || task?.assignedByUserId === currentUserId);

  // A name is a door only when there is somebody behind it: never the reader's own (there is nothing
  // to look up), never a `"pending"` author or assignee (an optimistic placeholder that has no
  // account yet), and never a comment whose login was deleted — that one resolves no author at all,
  // which is why `message.author` is checked rather than assumed.
  const authorProfileId =
    message.author && message.authorUserId !== currentUserId
      ? message.authorUserId
      : null;
  const assigneeProfileId =
    task &&
    task.assignedToUserId !== currentUserId &&
    task.assignedToUserId !== "pending"
      ? task.assignedToUserId
      : null;

  return (
    <li className="flex gap-2">
      <span className="mt-0.5 h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted">
        <Headshot
          src={message.author?.headshot ?? null}
          alt={name}
          monogramName={name}
          wrapperClassName="rounded-full"
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {authorProfileId ? (
            <button
              type="button"
              onClick={() => openProfile(authorProfileId)}
              title={`View ${name}'s profile`}
              className="truncate rounded-sm text-xs font-medium underline-offset-2 transition-colors hover:text-accent-blue hover:underline"
            >
              {name}
            </button>
          ) : (
            <span className="truncate text-xs font-medium">{name}</span>
          )}
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {relativeTime(message.createdAt)}
          </span>
        </div>

        {message.kind === "task_assignment" ? (
          <CommentTaskCard
            task={task}
            body={message.body}
            assignedByName={name}
            mayWithdraw={mayWithdraw}
            onWithdraw={() => void withdrawAssignment(message.id)}
            onOpenAssignee={
              assigneeProfileId ? () => openProfile(assigneeProfileId) : null
            }
            className="mt-1"
          />
        ) : null}

        {message.deletedAt ? (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs italic text-muted-foreground">
            This message was deleted.
          </p>
        ) : // An assignment's body is its FALLBACK text, and the card above owns it — rendering both
        // would say the same thing twice.
        message.body && message.kind !== "task_assignment" ? (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs">
            {message.body}
          </p>
        ) : null}

        {/* Attachments: images render as thumbnails, other files as a labelled chip. Either
            one opens the viewer modal. */}
        {!message.deletedAt && attachments.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {attachments.map((attachment) => (
              <li key={attachment.key}>
                <button
                  type="button"
                  onClick={() => onOpenAttachment(attachment)}
                  className="block max-w-[12rem] text-left"
                  title={attachment.name}
                >
                  {isImageAttachment(attachment.type) ? (
                    // Sized by its own aspect ratio inside a 12rem x 6rem box, so the WHOLE image
                    // shows — no object-cover crop. Reserving that space while the bytes stream in
                    // from R2 is the thumbnail's own job.
                    <AttachmentThumbnail
                      src={commentAttachmentInlineUrl(attachment.key)}
                      alt={attachment.name}
                    />
                  ) : (
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] transition-colors hover:bg-muted">
                      <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{attachment.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatAttachmentSize(attachment.size)}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Resolve/Reopen + Delete, shared by the list card and the thread header so a moderator has
 * the same two controls wherever they are looking. Renders nothing for anyone else: the API
 * refuses a non-Owner/Admin (see `assertCanModerate`), and the old per-author delete is gone,
 * so this is the only moderation UI in the rail.
 */
function ThreadModerationControls({ thread }: { thread: CommentThreadView }) {
  const { setResolved, deleteThread, canModerate } = useCommentMode();
  const [busy, setBusy] = useState(false);
  /**
   * Deleting a thread takes its replies and any assignment it carries with it, and cannot be undone —
   * so it asks first. The question lives HERE, next to the only control that can ask it, rather than
   * at a call site that a future caller could forget.
   */
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!canModerate) return null;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-full text-muted-foreground hover:text-accent-blue"
        disabled={busy}
        onClick={() =>
          void run(
            () => setResolved(thread.id, !thread.resolvedAt),
            "Could not update the thread.",
          )
        }
        aria-label={thread.resolvedAt ? "Reopen this thread" : "Resolve this thread"}
        title={thread.resolvedAt ? "Reopen" : "Resolve"}
      >
        {thread.resolvedAt ? (
          <RotateCcw className="h-3.5 w-3.5" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-full text-muted-foreground hover:text-red-600"
        disabled={busy}
        onClick={() => setConfirmOpen(true)}
        aria-label="Delete this thread"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this thread?</AlertDialogTitle>
            <AlertDialogDescription>
              Every reply goes with it, and any task assigned from it stops being anybody&rsquo;s
              work. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() =>
                void run(
                  () => deleteThread(thread.id),
                  "Could not delete the thread.",
                )
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * A thread as the LIST sees it: the parent comment, plus how many replies it has and who
 * wrote them. The replies themselves are NOT rendered here — they live in the thread view.
 *
 * That split is the whole point of the Slack model, and it is what keeps the list scannable:
 * a thread with twenty replies is one card, not twenty rows, so the next thread is still
 * findable. The face pile is the "who is in this conversation" signal Slack puts on the
 * "N replies" line.
 */
/**
 * The "currently typing" line — the comments take on the DM's dots.
 *
 * Two deliberate differences from the DM bubble, both forced by the shape of a comment thread:
 *
 *  - it NAMES whoever is typing, because a thread has no fixed pair of participants and a bare
 *    "typing…" on a card several people share would be ambiguous; and
 *  - it is a LINE rather than a bubble, because it has to sit inside a compact card as well as at the
 *    bottom of an open thread — a bubble would be a second message-shaped thing on a card that is
 *    already showing one.
 *
 * The dots are decorative and the label is the accessible content, so the line is read as plain text
 * wherever it appears.
 */
function TypingLine({
  people,
  className,
}: {
  people: CommentTypingPerson[];
  className?: string;
}) {
  const label = commentTypingLabel(people);
  if (!label) return null;
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-[11px] font-medium text-accent-blue",
        className,
      )}
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="typing-dot h-1 w-1 rounded-full bg-accent-blue"
            style={{ animationDelay: `${index * 160}ms` }}
          />
        ))}
      </span>
      {label}
    </p>
  );
}

function ThreadCard({
  thread,
  typing,
  onOpenThread,
  onOpenAttachment,
}: {
  thread: CommentThreadView;
  /** People typing in this thread right now — never the reader. */
  typing: CommentTypingPerson[];
  onOpenThread: (threadId: string) => void;
  onOpenAttachment: (attachment: CommentAttachment) => void;
}) {
  const { currentUserId, canModerate } = useCommentMode();
  const [parent, ...replies] = thread.messages;
  const lastReply = replies[replies.length - 1];

  // Distinct reply authors, capped at three, for the face pile.
  const participants: CommentMessageView[] = [];
  for (const message of replies) {
    if (!participants.some((seen) => seen.authorUserId === message.authorUserId)) {
      participants.push(message);
    }
    if (participants.length === 3) break;
  }

  if (!parent) return null;

  return (
    <div
      data-comment-thread-id={thread.id}
      className="rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent-blue/40"
    >
      {/* Card toolbar — Resolve/Reopen + Delete, top-right, for Owners/Admins only. A
          non-moderator on an unresolved thread gets no toolbar at all rather than an empty
          row where a control used to be. Everyone still sees the Resolved badge: the
          thread's state is information, moderating it is not. */}
      {canModerate || thread.resolvedAt ? (
        <div className="flex items-center justify-end gap-0.5">
          {thread.resolvedAt ? (
            <span className="mr-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Resolved
            </span>
          ) : null}
          <ThreadModerationControls thread={thread} />
        </div>
      ) : null}

      <ul className="mt-2">
        <MessageRow
          message={parent}
          currentUserId={currentUserId}
          onOpenAttachment={onOpenAttachment}
        />
      </ul>

      {/* Where the next reply will land, above the reply summary — so the card shows that the
          conversation is live without having to be opened to find out. */}
      <TypingLine people={typing} className="mt-2 px-1" />

      {/* The only way into the thread — deliberately its own control rather than a click on
          the card, so the moderation buttons above cannot end up nested in a click target. */}
      <button
        type="button"
        onClick={() => onOpenThread(thread.id)}
        className="mt-2 flex w-full items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted"
      >
        {replies.length > 0 && lastReply ? (
          <>
            <span className="flex shrink-0 -space-x-1.5">
              {participants.map((message) => {
                const name = messageAuthorName(message, currentUserId);
                return (
                  <span
                    key={message.authorUserId}
                    className="h-4 w-4 overflow-hidden rounded-full border border-background bg-muted"
                  >
                    <Headshot
                      src={message.author?.headshot ?? null}
                      alt={name}
                      monogramName={name}
                      wrapperClassName="rounded-full"
                    />
                  </span>
                );
              })}
            </span>
            <span className="text-[11px] font-medium text-accent-blue">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {relativeTime(lastReply.createdAt)}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">Reply in thread</span>
        )}
      </button>
    </div>
  );
}

/**
 * One thread's own surface, the Slack shape: the parent comment set apart at the top, its
 * replies below a count divider, and the reply composer pinned to the bottom of the panel.
 *
 * Back is just clearing `activeThreadId` — the same value the `?comment=` deep link sets, so
 * arriving from a notification opens straight into this view.
 */
function ThreadView({
  thread,
  typing,
  onTyping,
  scrollSignal,
  onOpenAttachment,
}: {
  thread: CommentThreadView;
  /** People typing in this thread right now — never the reader. */
  typing: CommentTypingPerson[];
  /** Tells the thread its reader has started typing. Throttled upstream. */
  onTyping: (threadId: string) => void;
  /**
   * Increments when the rail's new-comments pill is clicked.
   *
   * A counter and not a boolean: the rail owns the notification (it watches every thread at once)
   * while this view owns its own scroller, and a counter lets repeated clicks each fire. It also
   * keeps the two decoupled — no shared ref to keep in step.
   */
  scrollSignal: number;
  onOpenAttachment: (attachment: CommentAttachment) => void;
}) {
  const { currentUserId, reply, setActiveThreadId } = useCommentMode();
  const [parent, ...replies] = thread.messages;

  const scrollRef = useRef<HTMLDivElement>(null);
  /**
   * Set when the READER sends, so the next render scrolls to the bottom.
   *
   * A flag rather than "scroll whenever the list grows" on purpose: replies arrive on the 10s poll
   * too, and scrolling for those would yank the reader away from the middle of a thread they were
   * reading. Only their own send deserves that.
   */
  const stickRef = useRef(false);

  // Opening a thread starts at its end — the newest reply — which is where a chat is read from and
  // where a send is about to land. Same behaviour as the DM thread, and a JUMP rather than a glide:
  // arriving on a panel that animates itself downward reads as a glitch, not as feedback.
  useEffect(() => {
    scrollToBottom(scrollRef.current);
  }, [thread.id]);

  useEffect(() => {
    if (!stickRef.current) return;
    stickRef.current = false;
    // The reader's own reply, so this is the one scroll worth animating. Runs after paint, so the
    // optimistic reply is already in the DOM and counted in `scrollHeight`.
    scrollToBottom(scrollRef.current, true);
  }, [thread.messages.length]);

  // The rail's pill asked for the newest reply. Guarded on zero so mounting does not count as a click.
  useEffect(() => {
    if (!scrollSignal) return;
    scrollToBottom(scrollRef.current, true);
  }, [scrollSignal]);

  if (!parent) return null;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", VIEW_ENTER_FORWARD)}>
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border px-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-muted-foreground"
          onClick={() => setActiveThreadId(null)}
          aria-label="Back to all comments"
          title="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">Thread</span>
        {thread.resolvedAt ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Resolved
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5">
          <ThreadModerationControls thread={thread} />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="comment-scroll min-h-0 flex-1 overflow-y-auto"
      >
        <div className="p-3">
          {/* The parent, marked off with a left accent the way Slack marks off the message a
              thread hangs off. */}
          <div className="rounded-lg border-l-2 border-accent-blue/60 bg-muted/30 py-2 pl-3 pr-2">
            <ul>
              <MessageRow
                message={parent}
                currentUserId={currentUserId}
                onOpenAttachment={onOpenAttachment}
              />
            </ul>
          </div>

          {replies.length > 0 ? (
            <>
              <div className="mt-3 flex items-center gap-2 px-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {replies.length} {replies.length === 1 ? "reply" : "replies"}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="mt-3 space-y-3">
                {replies.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    currentUserId={currentUserId}
                    onOpenAttachment={onOpenAttachment}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-6 px-1 text-center text-xs text-muted-foreground">
              No replies yet — start the thread below.
            </p>
          )}

          {/* At the bottom of the replies, where the next one will land, so the arrival replaces
              the line rather than shifting the thread. */}
          <TypingLine people={typing} className="mt-3 px-1" />
        </div>
      </div>

      {/* The thread's composer, pinned to the bottom of the panel just like the list's. */}
      <div className="shrink-0 border-t border-border p-3">
        <CommentComposer
          placeholder="Reply…"
          submitLabel="Reply"
          onTyping={() => onTyping(thread.id)}
          onSubmit={async (body, attachments) => {
            // Re-arm the pin so the reader watches their reply land, even from further up the
            // thread. `scrollToBottom` runs on the next render, once the optimistic reply exists.
            stickRef.current = true;
            await reply(thread.id, body, attachments);
          }}
        />
      </div>

    </div>
  );
}

/**
 * The rail's PERSISTENT composer: always visible while the panel is open, so adding a
 * comment starts here rather than from a floating button on the page. Comments are not
 * anchored to a page section, so every post is a plain comment on the whole plan/benefit.
 */
function RailComposer({
  onTyping,
  onSendStart,
}: {
  onTyping: () => void;
  /** Called the instant the reader submits, so the list can re-pin before the card appears. */
  onSendStart: () => void;
}) {
  const { createThread } = useCommentMode();

  return (
    <CommentComposer
      placeholder="Write a comment…"
      submitLabel="Comment"
      onTyping={onTyping}
      onSubmit={async (body, attachments) => {
        onSendStart();
        await createThread(
          { anchorKind: "section", sectionKey: GENERAL_SECTION_KEY },
          body,
          attachments,
        );
      }}
    />
  );
}

/**
 * The right-hand Comments rail: a PERSISTENT composer, an open/resolved filter, and a
 * thread card per thread (messages, reply, resolve/reopen, delete). The composer is the
 * single entry point for new comments; comments are not anchored to a page section.
 *
 * Wrapped in the profile provider rather than plumbing a callback down through every card, thread
 * and reply that can draw a name. The panel owns ONE profile dialog, and any name inside it — a
 * message's author, an assignment's assignee — can ask for it. See `user-profile-context`.
 */
interface CommentsRailProps {
  /**
   * Human-readable context for the conversation, e.g. "Acme Corp · Retirement".
   * The portal supplies it from the page it is docked to; the dashboard omits it
   * and the panel falls back to its target.
   */
  surfaceLabel?: string | null;
  /**
   * Show the signed-in reader's headshot, name and role above the thread list.
   * The portal turns this on; the dashboard's rail already has that identity in
   * its surrounding chrome.
   */
  showViewer?: boolean;
  /**
   * Render the Comments / Messages tabs in the panel header. The portal turns
   * this on; the dashboard keeps its separate header toggles.
   */
  showPanelSwitch?: boolean;
}

export function CommentsRail({
  surfaceLabel,
  showViewer = false,
  showPanelSwitch = false,
}: CommentsRailProps = {}) {
  return (
    <UserProfileProvider>
      <CommentsPanel
        surfaceLabel={surfaceLabel}
        showViewer={showViewer}
        showPanelSwitch={showPanelSwitch}
      />
    </UserProfileProvider>
  );
}

/**
 * The rail itself.
 *
 * Split from `CommentsRail` so the provider can wrap the tree WITHOUT re-indenting four hundred
 * lines of JSX around it — the panel's markup is unchanged, only its ancestor is new.
 */
function CommentsPanel({
  surfaceLabel,
  showViewer = false,
  showPanelSwitch = false,
}: {
  surfaceLabel?: string | null;
  showViewer?: boolean;
  showPanelSwitch?: boolean;
}) {
  const {
    canComment,
    mode,
    setMode,
    target,
    threads,
    isLoading,
    error,
    errorStatus,
    activeThreadId,
    refresh,
    setActiveThreadId,
    currentUserId,
    // Assignment reads the same standing moderation does, so the panel asks the context that already
    // knows it rather than deriving a second answer.
    canModerate,
    assignTask,
    mentionable,
  } = useCommentMode();

  // The reader's own identity for the context band. `mentionable` is the same
  // roster the @mention picker uses and already carries the current user with
  // their seat's name, headshot and role — no extra request.
  const viewer = showViewer && currentUserId
    ? mentionable.find((person) => person.userId === currentUserId) ?? null
    : null;
  const contextLabel =
    surfaceLabel ||
    (target?.targetType === "benefit" && target.category
      ? `Benefit · ${target.category}`
      : target
        ? "Plan chat"
        : null);

  // Who is typing across every thread on this surface, in ONE poll — the rail shows all of them at
  // once, so a fetch per card is the thing to avoid. Enabled only while the panel is actually open
  // and the viewer may comment at all: a 2.5s request for a closed panel is pure waste.
  const {
    byThread: typingByThread,
    composers: composerTypers,
    notifyTyping,
    notifyComposerTyping,
  } = useCommentTyping({
    enabled: canComment && mode === "on",
    clientId: target?.clientId ?? null,
    targetType: target?.targetType ?? "plan",
    category: target?.category ?? null,
  });

  const [filter, setFilter] = useState<ThreadFilter>("open");
  // The attachment currently open in the viewer modal; null keeps it closed.
  const [viewing, setViewing] = useState<CommentAttachment | null>(null);
  // Wide reading mode. Local on purpose: it is a per-visit preference, not a stored one.
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(
    () =>
      threads.filter(
        (thread) =>
          filter === "all" ||
          (filter === "open"
            ? !thread.resolvedAt
            : Boolean(thread.resolvedAt)),
      ),
    [threads, filter],
  );

  const listScrollRef = useRef<HTMLDivElement>(null);
  /** Set when the reader posts a NEW comment, so the list scrolls to the thread it just created. */
  const stickListRef = useRef(false);

  // A new comment appends a thread card to the END of the list (threads are oldest-first), so a send
  // scrolls there — otherwise the reader has to hunt for the thread they just started. Keyed on the
  // visible count so it fires once the card is actually rendered, and never on a poll: an incoming
  // comment from somebody else must not move the list under the reader.
  useEffect(() => {
    if (!stickListRef.current) return;
    stickListRef.current = false;
    // Animated, for the same reason as a reply: the reader posted, and the card travelling into view
    // is what tells them where their comment went.
    scrollToBottom(listScrollRef.current, true);
  }, [visible.length]);

  // Keep relative timestamps honest ("just now" must not freeze), and reveal a selected
  // thread even when the current filter would hide it — e.g. a resolved thread opened
  // from a notification's `?comment=` deep link.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!activeThreadId) return;
    if (!visible.some((thread) => thread.id === activeThreadId)) {
      setFilter("all");
    }
  }, [activeThreadId, visible]);

  /**
   * Every comment on this surface, oldest first — what the new-comments pill counts.
   *
   * Flattened ACROSS threads on purpose: the pill is about the surface, not one conversation, so a
   * reply on any thread here can raise it. That is also why it needs no scroll position at all — it
   * reports what arrived, which is the one thing the panel can know for certain without guessing at
   * the reader's viewport. (The earlier attempt inferred "am I scrolled up?" from the open thread's
   * scroller, which made the whole feature depend on that one element behaving.)
   *
   * Declared up here WITH the other hooks, never below the early return: a hook that only runs while
   * the panel is open is a hook that runs a different number of times per render.
   */
  const allComments = useMemo(
    () =>
      threads
        .flatMap((thread) => thread.messages)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [threads],
  );

  // Reset the marker when the reader moves to a different surface (another plan or category), which
  // is the only thing that should make the count start over.
  const surfaceKey = `${target?.clientId ?? ""}:${target?.targetType ?? ""}:${
    target?.category ?? ""
  }`;

  // No `atBottom`: the rail has no single bottom to be at, so the marker only advances when the pill
  // is clicked — and the count then stands until the reader acknowledges it.
  const { count: newCommentCount, clear: clearNewComments } = useNewMessages({
    scopeId: surfaceKey,
    messages: allComments,
    currentUserId,
    atBottom: false,
  });

  /** Bumped when the pill is clicked, so an open thread scrolls to its newest reply. */
  const [scrollSignal, setScrollSignal] = useState(0);
  /** The assign dialog, mounted only once a moderator actually asks for it. */
  const [assignOpen, setAssignOpen] = useState(false);
  /** The surface's roster (team members + collaborators), opened on demand. */
  const [teamOpen, setTeamOpen] = useState(false);

  /**
   * The typing signals that SURVIVED their own authors' messages.
   *
   * The rail is the only place holding both halves of the story — who says they are typing, and
   * everything they have posted — and the two arrive on different polls, so it is also the only place
   * the contradiction between them can be settled. `liveTypingPeople` drops anyone whose own message
   * is newer than their mark, which is what stops the pill appearing above a composer line still
   * claiming its author is typing. See `typingMarkStands` for the argument in full.
   *
   * Declared up here with the other hooks, never below the early return below.
   */
  const liveComposers = useMemo(
    () => liveTypingPeople(composerTypers, allComments),
    [composerTypers, allComments],
  );
  const liveTypersByThread = useMemo(() => {
    const live: Record<string, CommentTypingPerson[]> = {};
    for (const [threadId, people] of Object.entries(typingByThread)) {
      const survivors = liveTypingPeople(people, allComments);
      // A key with nobody left is DROPPED rather than left as an empty array, so every consumer keeps
      // asking `?? []` and treating "present" as "someone is typing".
      if (survivors.length > 0) live[threadId] = survivors;
    }
    return live;
  }, [typingByThread, allComments]);

  /* ── The panel's own open/close animation ──
   *
   * `open` is the real state: it drives the fetches, the thread list and the column the page
   * reserves. `rendered` outlives it by one transition so the CLOSE can animate — React would
   * otherwise unmount the element before the browser had a chance to interpolate it off-screen —
   * and `slidIn` is the transform target, parked off-screen until the frame after the panel mounts,
   * because a transition needs a starting value to interpolate FROM.
   *
   * All of it sits ABOVE the early return, with the other hooks and unconditionally: a hook below a
   * `return` changes the hook count between renders, which is the crash this file already had once.
   */
  const open = canComment && mode === "on";
  const [rendered, setRendered] = useState(open);
  const [slidIn, setSlidIn] = useState(false);
  const everOpened = useRef(false);

  useEffect(() => {
    if (!open) {
      // Nothing to animate away. Without this, the first render of a surface whose rail is simply
      // off would mount the panel for the length of an exit animation on every page load.
      if (!everOpened.current) return;
      setSlidIn(false);
      return;
    }
    everOpened.current = true;
    setRendered(true);
    setSlidIn(false);
    const frame = requestAnimationFrame(() => setSlidIn(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Hold the panel in the DOM for the length of the exit, then let it go.
  useEffect(() => {
    if (open || !rendered) return;
    const timer = window.setTimeout(() => setRendered(false), RAIL_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  if (!canComment || !rendered) return null;

  const openCount = threads.filter((thread) => !thread.resolvedAt).length;
  // The open thread, if any. `activeThreadId` stays the provider's single source of truth for
  // "which thread is selected", so a notification's `?comment=` deep link opens this view
  // directly rather than just highlighting a card in the list.
  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ?? null;

  // Someone is composing a NEW comment — the SURFACE-scoped signal, deliberately distinct from a
  // thread's. It has no card to sit on, so it is rendered once, directly under the header.
  const composerTypingLabel = commentComposerTypingLabel(liveComposers);

  const jumpToNewComments = () => {
    clearNewComments();
    setScrollSignal((value) => value + 1);
    // When the LIST is what is showing, take it to the bottom too — threads are ordered oldest-first,
    // so the newest card is there. An open thread scrolls itself off `scrollSignal`.
    if (!activeThread) scrollToBottom(listScrollRef.current, true);
  };

  return (
    <aside
      className={cn(
        // WIDTH ONLY — nothing here changes the page's layout. The reservation of a column
        // is `--comments-inset` (`lib/comments/comments-layout.ts`), and expanding does not
        // touch it: the panel is `position: fixed`, so growing it to the left paints OVER
        // the page while everything behind stays exactly where it was. That is the point of
        // the wide mode — the plan you are commenting on does not move, which is what makes
        // the two readable side by side. `transition-[width]` interpolates because both ends
        // are plain rem lengths, and max-w keeps the wide state sane on a narrow window.
        "fixed bottom-0 right-0 flex max-w-[92vw] flex-col overflow-hidden border-l border-border bg-background transition-[width,box-shadow,transform] duration-200 ease-out",
        // z-50 only while wide, and only because the page's own fixed action bars (the
        // wizard footer, the edit pages' Save bar) are z-50 and sit exactly where the panel
        // grows — at z-40 they would paint over our composer. At z-50 the panel wins by DOM
        // order (it is mounted after the page content), while dialogs and popovers, which
        // portal into `document.body` after it, still paint above it.
        // The narrow width matches `COMMENTS_RAIL_WIDTH` — and therefore the Messages rail, which
        // shares this column, so swapping between the two panels cannot move the page.
        expanded ? "z-50 w-[44rem] shadow-2xl" : "z-40 w-[24rem]",
        // The open/close slide. `translate-x-full` is 100% of the PANEL's own width, so it parks
        // exactly off-screen at each of its three widths rather than at a hard-coded distance.
        slidIn ? "translate-x-0" : "translate-x-full",
        // A departing panel must not swallow a click aimed at the page underneath it.
        !open && "pointer-events-none",
      )}
      // Where the panel starts. `4rem` is the dashboard header it docks beneath; the participant
      // portal raises it to the full height (`--comments-rail-top: 0px`), because there the portal's
      // own header clears the rail's COLUMN rather than sitting above it. A CSS variable rather than
      // a prop because the panel is `position: fixed` and this is a layout fact about the page it is
      // docked to — see portal-comments-rail.tsx.
      style={{ top: "var(--comments-rail-top, 4rem)" }}
      // Off-screen is not the same as absent: while it slides out, hide it from assistive tech too.
      aria-hidden={!open}
      aria-label="Comments"
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          {showPanelSwitch ? (
            <RailPanelSwitch active="comments" />
          ) : (
            <>
              <MessageSquare className="h-4 w-4 shrink-0 text-accent-blue" />
              <span className="shrink-0 text-sm font-semibold">Comments</span>
            </>
          )}
          {/* Which benefit these threads belong to. A benefit's thread is keyed by its category
              and this panel is global, so without a label the reader has to infer whose comments
              they are looking at from the page behind the panel. */}
          {!surfaceLabel && target?.targetType === "benefit" && target.category ? (
            <span
              className="truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              title={target.category}
            >
              {target.category}
            </span>
          ) : null}
          {threads.length > 0 ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {openCount} open
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          {/* Widens the panel over the page. Its shadow is what signals "overlay" rather
              than "the layout moved", since nothing behind it actually moves. */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-muted-foreground"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={
              expanded ? "Narrow the comments panel" : "Widen the comments panel"
            }
            title={expanded ? "Narrow" : "Widen"}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => setMode("off")}
            aria-label="Turn comments off"
            title="Turn comments off"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Which Plan/Benefit conversation this is, and who is reading it. A
          context band rather than more header chrome: the plan/benefit name can
          be long, and the reader's identity needs room for a name AND a role. */}
      {(contextLabel || viewer) && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
          {viewer ? (
            <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
              <Headshot
                src={viewer.headshot}
                alt={viewer.name}
                monogramName={viewer.name}
                wrapperClassName="rounded-full"
              />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {viewer ? (
              <p
                className="truncate text-xs font-semibold text-foreground"
                title={viewer.name}
              >
                {viewer.name}
              </p>
            ) : null}
            {contextLabel ? (
              <p
                className="truncate text-[10px] text-muted-foreground"
                title={contextLabel}
              >
                {contextLabel}
              </p>
            ) : null}
          </div>
          {viewer?.roleLabel ? (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
              {viewer.roleLabel}
            </span>
          ) : null}
        </div>
      )}

      {/* The new-comments pill, in normal FLOW directly under the header — the top of the comments
          UI, in both views. In flow rather than floated because it must not collide with the filter
          row below it, and because a band that pushes the content down is honest about being there. */}
      {newCommentCount > 0 ? (
        <div className="flex shrink-0 justify-center border-b border-border bg-background py-1.5">
          <NewMessagesPill count={newCommentCount} onClick={jumpToNewComments} />
        </div>
      ) : null}

      {/* Panel actions, in one row: the surface's roster on the LEFT, assignment on the RIGHT.
          The roster is available to every reader who can open the rail (the mentionable read is
          the same one the @mention picker uses), while assignment stays Owner/Admin only — the
          same `canModerate` the server refuses on — and is rendered in both views so it never
          disappears mid-task. What is being handed over is the WORK, not a conversation, so the
          reader can ask for it before any thread exists; the assignment creates the thread it
          lands in. */}
      <div className="flex shrink-0 items-center justify-start gap-2 border-b border-border px-3 py-1.5">
        {/* Outline buttons rather than bare text: the row is a pair of actions, and the border +
            surface make that legible at a glance. Both share the accent-blue hover wash and border
            so they read as one control group — and sit side by side at the start of the row. */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium text-foreground hover:bg-accent-blue/5 hover:text-accent-blue"
          onClick={() => setTeamOpen(true)}
          title="See the team members and collaborators who work on this surface"
        >
          <Users className="h-3.5 w-3.5" />
          Team
        </Button>
        {canModerate ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium text-foreground hover:bg-accent-blue/5 hover:text-accent-blue"
            onClick={() => setAssignOpen(true)}
            title="Assign a task from this panel"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Assign Task
          </Button>
        ) : null}
      </div>

      {/* The surface's roster — the same team members and collaborators the @mention picker
          offers, narrowed to this plan or benefit. */}
      <TeamMembersDialog
        open={teamOpen}
        onOpenChange={setTeamOpen}
        clientId={target?.clientId ?? ""}
        targetType={target?.targetType ?? "plan"}
        category={target?.category ?? null}
      />

      {/* Drawn only when asked for, so a reader who cannot assign issues no request at all. */}
      <AssignTaskDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        clientId={target?.clientId ?? ""}
        targetType={target?.targetType ?? "plan"}
        category={target?.category ?? null}
        onAssign={async (input) => {
          try {
            // No thread: the assignment creates one. See the note on the panel band above.
            await assignTask(input);
            return null;
          } catch (error) {
            return error instanceof Error
              ? error.message
              : "Could not assign the task.";
          }
        }}
      />

      {activeThread ? (
        /* One thread gets the whole panel: parent, replies, and its own composer. The list
           (and its composer) is what it replaces — that is the Slack model. */
        <ThreadView
          thread={activeThread}
          typing={liveTypersByThread[activeThread.id] ?? []}
          onTyping={notifyTyping}
          scrollSignal={scrollSignal}
          onOpenAttachment={setViewing}
        />
      ) : (
        /* The wrapper exists only so the whole view is ONE animated element — the header
           above it stays put, which is what makes the swap read as the body changing rather
           than the panel moving. */
        <div className={cn("flex min-h-0 flex-1 flex-col", VIEW_ENTER_BACK)}>
          {/* Filter row */}
          <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-2">
            {(["open", "resolved", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                aria-label={`Show ${value} comments`}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                  filter === value
                    ? "bg-accent-blue/10 text-accent-blue"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {value}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading comments…
            </div>
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              {/* A refusal is not a failure. Offering "Try again" on a 403 promises something that
                  cannot happen — the assignment that granted access is gone — so the panel says so
                  and offers the only useful action: closing it, which also stops the poll from
                  asking again every ten seconds. */}
              {errorStatus === 403 ? (
                <>
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    You no longer have access to this plan
                  </p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => setMode("off")}>
                    Turn comments off
                  </Button>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button variant="outline" size="sm" onClick={refresh}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    Try again
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div
              ref={listScrollRef}
              className="comment-scroll min-h-0 flex-1 overflow-y-auto"
            >
              <div className="space-y-2 p-3">
                {visible.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">
                      {threads.length === 0 ? "No comments yet" : "Nothing here"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {threads.length === 0
                        ? "Write the first comment below."
                        : "No threads match this filter."}
                    </p>
                  </div>
                ) : (
                  visible.map((thread) => (
                    <ThreadCard
                      key={thread.id}
                      thread={thread}
                      typing={liveTypersByThread[thread.id] ?? []}
                      onOpenThread={setActiveThreadId}
                      onOpenAttachment={setViewing}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Persistent composer — pinned to the BOTTOM of the panel, chat-style, so the
              thread list scrolls above it. In a thread, that thread's own composer takes over. */}
          <div className="shrink-0 border-t border-border p-3">
            {/* The composer's own line, immediately above the box it is about — the bottom of the
                panel, where the reader's eye already is, and where the comment they are about to
                watch arrive will land. Worded differently from a thread's line ("… is typing a
                comment" against "… is typing") so the two can never be confused for each other. */}
            {composerTypingLabel ? (
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-accent-blue">
                <span className="flex items-center gap-0.5" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="typing-dot h-1 w-1 rounded-full bg-accent-blue"
                      style={{ animationDelay: `${index * 160}ms` }}
                    />
                  ))}
                </span>
                {composerTypingLabel}
              </p>
            ) : null}
            <RailComposer
              onTyping={notifyComposerTyping}
              onSendStart={() => {
                stickListRef.current = true;
              }}
            />
          </div>
        </div>
      )}

      {/* Radix renders this through a portal, so nesting it in the locked-down <aside>
          is harmless — it still paints over the whole viewport. */}
      <CommentAttachmentModal
        attachment={viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
    </aside>
  );
}
