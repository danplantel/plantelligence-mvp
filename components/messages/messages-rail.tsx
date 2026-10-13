"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Headshot } from "@/components/ui/headshot";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MAX_DIRECT_MESSAGE_LENGTH,
  type DirectConversationView,
  type DirectMessageView,
} from "@/lib/messages/types";
import { useDirectThread } from "@/hooks/useDirectThread";
import { useOptionalMessagesMode } from "./messages-mode-provider";

/**
 * The Messages rail: the conversation list, and the open conversation.
 *
 * Two views in one panel with a back control rather than two panels, for the same reason the
 * comments rail does it — the right column is one box, and a second box inside it would have to
 * re-solve the layout contract the rail already satisfies.
 *
 * Placed at `top-16` (the header's own height) so the header's controls stay reachable while it is
 * open, and `z-40`, matching the comments rail so the two never stack.
 */
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

/** The calendar day a timestamp falls on, in the reader's own timezone. */
function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** "Today" / "Yesterday" / a date — the chat convention, and shorter than a full date. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

const VIEW_ENTER_FORWARD =
  "animate-in fade-in-0 slide-in-from-right-4 duration-200 ease-out";
const VIEW_ENTER_BACK =
  "animate-in fade-in-0 slide-in-from-left-4 duration-200 ease-out";

/* ─────────────────────────────── Conversation list ─────────────────────────────── */

function ConversationRow({
  conversation,
  currentUserId,
  onOpen,
}: {
  conversation: DirectConversationView;
  currentUserId: string | null;
  onOpen: () => void;
}) {
  const { participant, unreadCount } = conversation;
  const preview =
    conversation.lastMessagePreview ??
    (conversation.lastMessageByUserId
      ? "Sent an attachment"
      : "No messages yet");
  const mine = conversation.lastMessageByUserId === currentUserId;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
      >
        <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
          <Headshot
            src={participant.headshot}
            alt={participant.name}
            monogramName={participant.name}
            wrapperClassName="rounded-full"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-xs font-medium">
              {participant.name}
            </span>
            <span className="shrink-0 rounded-full bg-accent-blue/10 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-accent-blue">
              {participant.label}
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {relativeTime(conversation.lastMessageAt)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1">
            <span
              className={cn(
                "truncate text-[11px]",
                unreadCount > 0
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {mine ? "You: " : ""}
              {preview}
            </span>
            {unreadCount > 0 && (
              <span className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-accent-blue px-1 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/* ──────────────────────────────── Open conversation ──────────────────────────────── */

type RenderedRow =
  | { kind: "day"; key: string; label: string }
  | { kind: "divider"; key: string }
  | { kind: "message"; key: string; message: DirectMessageView };

function MessagesThread({ threadId }: { threadId: string }) {
  const mode = useOptionalMessagesMode();
  const currentUserId = mode?.currentUserId ?? null;

  const {
    thread,
    isLoading,
    error,
    isSending,
    send,
    withdraw,
    markRead,
  } = useDirectThread(threadId, true);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Whether to keep the view pinned to the newest message. Set by the reader's own scrolling. */
  const stickRef = useRef(true);

  const messages = thread?.messages ?? [];
  const newest = messages[messages.length - 1] ?? null;

  /**
   * Mark read — once per (conversation, newest message).
   *
   * The ref is what makes it once: `markRead` refreshes the inbox, not this thread, so `readAt`
   * here only catches up on the next poll, and an effect keyed on the value alone would re-POST on
   * every poll. Keying on the pair also means a message arriving later marks read again, which is
   * the behaviour a reader expects.
   */
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!thread || !newest) return;
    // Nothing of theirs to read: your own message, or a placeholder still in flight.
    if (newest.authorUserId === currentUserId || newest.authorUserId === "pending") return;
    const signature = `${thread.threadId}:${newest.id}`;
    if (markedRef.current === signature) return;
    const readAt = thread.readAt ? new Date(thread.readAt).getTime() : 0;
    if (readAt && new Date(newest.createdAt).getTime() <= readAt) return;
    markedRef.current = signature;
    void markRead();
  }, [thread, newest, currentUserId, markRead]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  /** Day separators, plus the "New messages" divider at the reader's own watermark. */
  const rendered = useMemo<RenderedRow[]>(() => {
    const rows: RenderedRow[] = [];
    const readAt = thread?.readAt ? new Date(thread.readAt).getTime() : 0;
    let lastDay = "";
    let dividerPlaced = readAt > 0;

    for (const message of messages) {
      const key = dayKey(message.createdAt);
      if (key !== lastDay) {
        rows.push({ kind: "day", key: `day-${key}`, label: dayLabel(message.createdAt) });
        lastDay = key;
      }
      if (!dividerPlaced && new Date(message.createdAt).getTime() > readAt) {
        rows.push({ kind: "divider", key: "unread-divider" });
        dividerPlaced = true;
      }
      rows.push({ kind: "message", key: message.id, message });
    }
    return rows;
  }, [messages, thread?.readAt]);

  const remaining = MAX_DIRECT_MESSAGE_LENGTH - draft.length;
  const canSend = draft.trim().length > 0 && !isSending;

  const submit = async () => {
    if (!canSend) return;
    const body = draft;
    // Cleared up front so the send feels immediate; restored if the write is refused.
    setDraft("");
    try {
      await send(body);
    } catch (sendError) {
      setDraft(body);
      toast.error(
        (sendError as Error)?.message ?? "Could not send that message.",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="sr-only">Opening the conversation…</span>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-xs text-muted-foreground">
          {error ?? "That conversation could not be opened."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
          <Headshot
            src={thread.participant.headshot}
            alt={thread.participant.name}
            monogramName={thread.participant.name}
            wrapperClassName="rounded-full"
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium">
            {thread.participant.name}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {thread.participant.label}
          </span>
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (!el) return;
          stickRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className={cn("flex-1 overflow-y-auto px-3 py-3", VIEW_ENTER_FORWARD)}
      >
        {rendered.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No messages yet — say hello.
          </p>
        ) : (
          <ul className="space-y-2">
            {rendered.map((row) => {
              if (row.kind === "day") {
                return (
                  <li
                    key={row.key}
                    className="flex items-center gap-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground"
                  >
                    <span className="h-px flex-1 bg-border" />
                    {row.label}
                    <span className="h-px flex-1 bg-border" />
                  </li>
                );
              }
              if (row.kind === "divider") {
                return (
                  <li
                    key={row.key}
                    className="flex items-center gap-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-blue"
                  >
                    <span className="h-px flex-1 bg-accent-blue/40" />
                    New messages
                    <span className="h-px flex-1 bg-accent-blue/40" />
                  </li>
                );
              }

              const { message } = row;
              const mine =
                message.authorUserId === currentUserId ||
                message.authorUserId === "pending";
              const inFlight = message.id.startsWith("temp-");

              return (
                <li
                  key={row.key}
                  className={cn(
                    "group flex gap-2",
                    mine ? "justify-end" : "justify-start",
                  )}
                >
                  {!mine && (
                    <span className="mt-0.5 h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted">
                      <Headshot
                        src={thread.participant.headshot}
                        alt={thread.participant.name}
                        monogramName={thread.participant.name}
                        wrapperClassName="rounded-full"
                      />
                    </span>
                  )}
                  <div className={cn("min-w-0 max-w-[85%]", mine && "order-first")}>
                    <div
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words",
                        message.deletedAt
                          ? "bg-muted italic text-muted-foreground"
                          : mine
                            ? "bg-accent-blue text-white"
                            : "bg-muted",
                        inFlight && "opacity-70",
                      )}
                    >
                      {message.deletedAt
                        ? "This message was deleted."
                        : message.body || "Sent an attachment"}
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground",
                        mine && "justify-end",
                      )}
                    >
                      <span>{relativeTime(message.createdAt)}</span>
                      {/* Author-only, and the API refuses anyone else: there is no moderator on a
                          private conversation, so this is the only delete that exists. */}
                      {mine && !inFlight && !message.deletedAt && (
                        <button
                          type="button"
                          aria-label="Delete this message"
                          title="Delete for both of you"
                          className="opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                          onClick={async () => {
                            try {
                              await withdraw(message.id);
                            } catch (withdrawError) {
                              toast.error(
                                (withdrawError as Error)?.message ??
                                  "Could not delete that message.",
                              );
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              void submit();
            }}
            placeholder="Write a message…"
            rows={1}
            maxLength={MAX_DIRECT_MESSAGE_LENGTH}
            aria-label="Write a message"
            className="min-h-[38px] max-h-32 resize-none text-xs"
          />
          <Button
            size="icon"
            onClick={() => void submit()}
            disabled={!canSend}
            aria-label="Send"
            title="Send (Enter)"
            className="h-9 w-9 shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Enter to send, Shift+Enter for a new line</span>
          {/* Only in the last stretch: a permanent counter is noise on a limit nobody reaches. */}
          {remaining <= MAX_DIRECT_MESSAGE_LENGTH * 0.2 && (
            <span
              className={cn(remaining <= 0 && "font-semibold text-destructive")}
            >
              {remaining}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────── The rail ─────────────────────────────────── */

export function MessagesRail() {
  const mode = useOptionalMessagesMode();
  if (!mode || !mode.open) return null;

  const {
    activeThreadId,
    setActiveThreadId,
    conversations,
    unreadTotal,
    isLoading,
    error,
    errorStatus,
    refresh,
    setMode,
  } = mode;

  return (
    <aside
      role="complementary"
      aria-label="Messages"
      className="fixed right-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-[24rem] flex-col border-l border-border bg-background shadow-sm"
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {activeThreadId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Back to conversations"
              onClick={() => setActiveThreadId(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="truncate text-sm font-semibold">Messages</h2>
          {unreadTotal > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-blue px-1 text-[10px] font-semibold leading-none text-white">
              {unreadTotal > 9 ? "9+" : unreadTotal}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label="Close messages"
          onClick={() => setMode("off")}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {activeThreadId ? (
        <MessagesThread threadId={activeThreadId} />
      ) : (
        <div className={cn("flex-1 overflow-y-auto", VIEW_ENTER_BACK)}>
          {isLoading ? (
            <div className="flex justify-center py-10" aria-busy="true">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="sr-only">Loading your messages…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <p className="text-xs text-muted-foreground">{error}</p>
              {/* A refusal (403) is not worth retrying; a failure is. */}
              {errorStatus !== 403 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </Button>
              )}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-xs font-medium">No messages yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Conversations you start or receive will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.threadId}
                  conversation={conversation}
                  currentUserId={mode.currentUserId}
                  onOpen={() => setActiveThreadId(conversation.threadId)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
