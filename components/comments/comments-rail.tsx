"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
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
  formatAttachmentSize,
  isImageAttachment,
  type CommentAttachment,
  type CommentMessageView,
  type CommentThreadView,
} from "@/lib/comments/types";
import { useCommentMode } from "./comment-mode-provider";
import { CommentAttachmentModal } from "./comment-attachment-modal";
import { CommentComposer } from "./comment-composer";

type ThreadFilter = "open" | "resolved" | "all";

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
  const name = messageAuthorName(message, currentUserId);
  // Defensive against a stale SWR cache written before attachments existed.
  const attachments = message.attachments ?? [];

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

        {message.deletedAt ? (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs italic text-muted-foreground">
            This message was deleted.
          </p>
        ) : message.body ? (
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

function ThreadCard({
  thread,
  active,
  onOpenAttachment,
}: {
  thread: CommentThreadView;
  active: boolean;
  onOpenAttachment: (attachment: CommentAttachment) => void;
}) {
  const {
    currentUserId,
    reply,
    setResolved,
    deleteThread,
    setActiveThreadId,
    canModerate,
  } = useCommentMode();

  const [busy, setBusy] = useState(false);

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
    <div
      data-comment-thread-id={thread.id}
      className={cn(
        "rounded-lg border p-3 transition-colors",
        active
          ? "border-accent-blue/60 bg-accent-blue/5"
          : "border-border bg-background",
      )}
    >
      {/* Card toolbar — Resolve/Reopen + Delete, top-right. Owners/Admins ONLY (the API
          refuses anyone else), so a non-moderator gets no toolbar at all rather than an
          empty row where a control used to be. Everyone still sees the Resolved badge:
          the thread's state is information, moderating it is not. */}
      {canModerate || thread.resolvedAt ? (
        <div className="flex items-center justify-end gap-0.5">
          {thread.resolvedAt ? (
            <span className="mr-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Resolved
            </span>
          ) : null}
          {canModerate ? (
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
                aria-label={
                  thread.resolvedAt ? "Reopen this thread" : "Resolve this thread"
                }
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
                  void run(
                    () => deleteThread(thread.id),
                    "Could not delete the thread.",
                  )
                }
                aria-label="Delete this thread"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-2 space-y-2">
        {thread.messages.map((message) => (
          <MessageRow
            key={message.id}
            message={message}
            currentUserId={currentUserId}
            onOpenAttachment={onOpenAttachment}
          />
        ))}
      </ul>

      <div className="mt-2 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          disabled={busy}
          onClick={() => setActiveThreadId(active ? null : thread.id)}
        >
          {active ? "Hide reply" : "Reply"}
        </Button>
      </div>

      {active ? (
        <div className="mt-2 border-t border-border pt-2">
          <CommentComposer
            placeholder="Reply…"
            submitLabel="Reply"
            onSubmit={async (body, attachments) => {
              await reply(thread.id, body, attachments);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The rail's PERSISTENT composer: always visible while the panel is open, so adding a
 * comment starts here rather than from a floating button on the page. Comments are not
 * anchored to a page section, so every post is a plain comment on the whole plan/benefit.
 */
function RailComposer() {
  const { createThread } = useCommentMode();

  return (
    <CommentComposer
      placeholder="Write a comment…"
      submitLabel="Comment"
      onSubmit={async (body, attachments) => {
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
    threads,
    isLoading,
    error,
    activeThreadId,
    refresh,
  } = useCommentMode();

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

  if (!canComment || mode !== "on") return null;

  const openCount = threads.filter((thread) => !thread.resolvedAt).length;

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
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent-blue" />
          <span className="text-sm font-semibold">Comments</span>
          {threads.length > 0 ? (
            <span className="text-xs text-muted-foreground">{openCount} open</span>
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
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      ) : (
        <div className="comment-scroll min-h-0 flex-1 overflow-y-auto">
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
                  active={thread.id === activeThreadId}
                  onOpenAttachment={setViewing}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Persistent composer — pinned to the BOTTOM of the panel, chat-style, so the
          thread list scrolls above it. */}
      <div className="shrink-0 border-t border-border p-3">
        <RailComposer />
      </div>

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
