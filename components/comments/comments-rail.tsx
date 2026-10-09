"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Headshot } from "@/components/ui/headshot";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  MAX_COMMENT_LENGTH,
  type CommentMessageView,
  type CommentThreadView,
} from "@/lib/comments/types";
import { useCommentMode } from "./comment-mode-provider";
import { MentionTextarea } from "./mention-textarea";

type ThreadFilter = "open" | "resolved" | "all";

/** "benefit:faqs" / "key-contacts" → a readable label. */
function humanizeSectionKey(key: string): string {
  return key
    .replace(/[:]/g, " \u203a ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  onDelete,
}: {
  message: CommentMessageView;
  currentUserId: string | null;
  onDelete: () => void;
}) {
  const name = messageAuthorName(message, currentUserId);
  const isOwn = Boolean(currentUserId) && message.authorUserId === currentUserId;

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
          {isOwn && !message.deletedAt ? (
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto shrink-0 text-muted-foreground transition-colors hover:text-red-600"
              aria-label="Delete this comment"
              title="Delete this comment"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : null}
        </div>
        <p
          className={cn(
            "mt-0.5 whitespace-pre-wrap break-words text-xs",
            message.deletedAt && "italic text-muted-foreground",
          )}
        >
          {message.deletedAt ? "This message was deleted." : message.body}
        </p>
      </div>
    </li>
  );
}

function ThreadCard({
  thread,
  active,
  unanchored,
}: {
  thread: CommentThreadView;
  active: boolean;
  unanchored: boolean;
}) {
  const {
    currentUserId,
    reply,
    setResolved,
    deleteThread,
    deleteMessage,
    mentionable,
    setActiveThreadId,
  } = useCommentMode();

  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  const canDeleteThread =
    Boolean(currentUserId) && thread.createdByUserId === currentUserId;

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

  const submitReply = () => {
    const text = replyText.trim();
    if (!text) return;
    return run(async () => {
      await reply(thread.id, text);
      setReplyText("");
    }, "Could not reply.");
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
      <button
        type="button"
        onClick={() => setActiveThreadId(active ? null : thread.id)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {humanizeSectionKey(thread.sectionKey)}
          </span>
          {thread.resolvedAt ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Resolved
            </span>
          ) : null}
        </div>
        {unanchored ? (
          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            Unanchored
          </span>
        ) : null}
        {thread.quote ? (
          <p className="mt-1 line-clamp-2 border-l-2 border-amber-300 pl-2 text-[11px] italic text-muted-foreground">
            {thread.quote}
          </p>
        ) : null}
      </button>

      <ul className="mt-2 space-y-2">
        {thread.messages.map((message) => (
          <MessageRow
            key={message.id}
            message={message}
            currentUserId={currentUserId}
            onDelete={() =>
              void run(
                () => deleteMessage(message.id, thread.id),
                "Could not delete the comment.",
              )
            }
          />
        ))}
      </ul>

      <div className="mt-2 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          disabled={busy}
          onClick={() =>
            void run(
              () => setResolved(thread.id, !thread.resolvedAt),
              "Could not update the thread.",
            )
          }
        >
          {thread.resolvedAt ? (
            <>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reopen
            </>
          ) : (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Resolve
            </>
          )}
        </Button>
        {canDeleteThread ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-red-600"
            disabled={busy}
            onClick={() =>
              void run(() => deleteThread(thread.id), "Could not delete the thread.")
            }
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        ) : null}
      </div>

      {active ? (
        <div className="mt-2 border-t border-border pt-2">
          <MentionTextarea
            value={replyText}
            onValueChange={setReplyText}
            mentionable={mentionable}
            placeholder="Reply…"
            className="min-h-[56px] text-xs"
            maxLength={MAX_COMMENT_LENGTH}
            onSubmit={submitReply}
          />
          <div className="mt-1.5 flex justify-end">
            <Button
              size="sm"
              className="h-7 bg-accent-blue px-3 text-[11px] hover:bg-accent-blue/90"
              disabled={busy || !replyText.trim()}
              onClick={submitReply}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">Reply</span>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Composer for a section/text anchor that has been started but not yet posted. */
function DraftComposer() {
  const { draftAnchor, cancelDraft, createThread, mentionable } =
    useCommentMode();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!draftAnchor) return null;

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await createThread(draftAnchor, body);
      setText("");
      cancelDraft();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add comment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-accent-blue/40 bg-accent-blue/5 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-accent-blue">
        New comment · {humanizeSectionKey(draftAnchor.sectionKey)}
      </p>
      {draftAnchor.quote ? (
        <p className="mt-1 line-clamp-2 border-l-2 border-amber-300 pl-2 text-[11px] italic text-muted-foreground">
          {draftAnchor.quote}
        </p>
      ) : null}
      <MentionTextarea
        value={text}
        onValueChange={setText}
        mentionable={mentionable}
        autoFocus
        placeholder="Write a comment…"
        className="mt-2 min-h-[64px] text-xs"
        maxLength={MAX_COMMENT_LENGTH}
        onSubmit={submit}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => {
            setText("");
            cancelDraft();
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 bg-accent-blue px-3 text-[11px] hover:bg-accent-blue/90"
          disabled={busy || !text.trim()}
          onClick={submit}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5">Comment</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * The right-hand Comments rail: open/resolved filter, a composer for the active draft
 * anchor, and a thread card per thread (messages, reply, resolve/reopen, delete). Threads
 * whose section is not currently rendered are grouped as "Unanchored" rather than
 * disappearing.
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
    sectionKeys,
    target,
  } = useCommentMode();

  const [filter, setFilter] = useState<ThreadFilter>("open");

  const anchored = useMemo(() => {
    const keys = new Set(sectionKeys);
    return threads.filter((thread) => keys.has(thread.sectionKey));
  }, [threads, sectionKeys]);

  const unanchored = useMemo(() => {
    const keys = new Set(sectionKeys);
    return threads.filter((thread) => !keys.has(thread.sectionKey));
  }, [threads, sectionKeys]);

  const visible = useMemo(() => {
    const matches = (thread: CommentThreadView) =>
      filter === "all" ||
      (filter === "open" ? !thread.resolvedAt : Boolean(thread.resolvedAt));
    return [...anchored.filter(matches), ...unanchored.filter(matches)];
  }, [anchored, unanchored, filter]);

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
      className="fixed bottom-0 right-0 top-16 z-40 flex w-[22rem] flex-col border-l border-border bg-background"
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
        <ScrollArea className="flex-1">
          <div className="space-y-2 p-3">
            <DraftComposer />

            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">
                  {threads.length === 0 ? "No comments yet" : "Nothing here"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {threads.length === 0
                    ? target?.targetType === "benefit"
                      ? "Hover a benefit section and click the comment pin to start a thread."
                      : "Hover a plan section and click the comment pin to start a thread."
                    : "No threads match this filter."}
                </p>
              </div>
            ) : (
              visible.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  active={thread.id === activeThreadId}
                  unanchored={!sectionKeys.includes(thread.sectionKey)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </aside>
  );
}
