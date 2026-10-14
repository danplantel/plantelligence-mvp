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
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
          <span className="truncate text-xs font-medium">{name}</span>
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
                    // Sized by its own aspect ratio, capped inside a 12rem x 6rem box, so
                    // the WHOLE image shows — no object-cover crop.
                    <img
                      src={commentAttachmentInlineUrl(attachment.key)}
                      alt={attachment.name}
                      className="block max-h-24 w-auto max-w-full rounded-md border border-border transition-opacity hover:opacity-90"
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
        onClick={() =>
          void run(() => deleteThread(thread.id), "Could not delete the thread.")
        }
        aria-label="Delete this thread"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
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
  const { currentUserId, canModerate, assignTask, reply, setActiveThreadId } =
    useCommentMode();
  const [parent, ...replies] = thread.messages;
  /** The assign dialog, mounted only for a moderator and only once they ask for it. */
  const [assignOpen, setAssignOpen] = useState(false);

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
          {canModerate ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-full px-2 text-xs text-muted-foreground"
              onClick={() => setAssignOpen(true)}
              title="Assign a task from this thread"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Assign
            </Button>
          ) : null}
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

      {/* Owner/Admin only, and it asks the API what THIS thread may offer before drawing anything —
          so nothing it presents can be refused, and a reader who cannot assign issues no request at
          all because the dialog is not mounted until they ask for it. */}
      <AssignTaskDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        threadId={thread.id}
        onAssign={async (input) => {
          try {
            await assignTask(thread.id, input);
            return null;
          } catch (error) {
            return error instanceof Error
              ? error.message
              : "Could not assign the task.";
          }
        }}
      />
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
 */
export function CommentsRail() {
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
  } = useCommentMode();

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

  if (!canComment || mode !== "on") return null;

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
        "fixed bottom-0 right-0 top-16 flex max-w-[92vw] flex-col overflow-hidden border-l border-border bg-background transition-[width,box-shadow] duration-200 ease-out",
        // z-50 only while wide, and only because the page's own fixed action bars (the
        // wizard footer, the edit pages' Save bar) are z-50 and sit exactly where the panel
        // grows — at z-40 they would paint over our composer. At z-50 the panel wins by DOM
        // order (it is mounted after the page content), while dialogs and popovers, which
        // portal into `document.body` after it, still paint above it.
        expanded ? "z-50 w-[44rem] shadow-2xl" : "z-40 w-[22rem]",
      )}
      aria-label="Comments"
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquare className="h-4 w-4 shrink-0 text-accent-blue" />
          <span className="shrink-0 text-sm font-semibold">Comments</span>
          {/* Which benefit these threads belong to. A benefit's thread is keyed by its category
              and this panel is global, so without a label the reader has to infer whose comments
              they are looking at from the page behind the panel. */}
          {target?.targetType === "benefit" && target.category ? (
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

      {/* The new-comments pill, in normal FLOW directly under the header — the top of the comments
          UI, in both views. In flow rather than floated because it must not collide with the filter
          row below it, and because a band that pushes the content down is honest about being there. */}
      {newCommentCount > 0 ? (
        <div className="flex shrink-0 justify-center border-b border-border bg-background py-1.5">
          <NewMessagesPill count={newCommentCount} onClick={jumpToNewComments} />
        </div>
      ) : null}

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
