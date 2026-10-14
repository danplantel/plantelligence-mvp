"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Paperclip,
  RefreshCw,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Headshot } from "@/components/ui/headshot";
import { cn } from "@/lib/utils";
import { scrollToBottom } from "@/lib/scroll-to-bottom";
import {
  directAttachmentInlineUrl,
  formatAttachmentSize,
  isImageAttachment,
  type DirectAttachment,
  type DirectConversationView,
  type DirectMessageView,
} from "@/lib/messages/types";
import { useDirectThread } from "@/hooks/useDirectThread";
import {
  useDirectTyping,
  useDirectTypingThreads,
} from "@/hooks/useDirectTyping";
import { useViewerAccess } from "@/hooks/useViewerAccess";
import { CommentAttachmentModal } from "@/components/comments/comment-attachment-modal";
import { DirectoryPicker } from "./directory-picker";
import { MessagesComposer } from "./messages-composer";
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
  peerTyping,
  onOpen,
}: {
  conversation: DirectConversationView;
  currentUserId: string | null;
  /** The other participant is typing right now, per the list's own fast poll. */
  peerTyping: boolean;
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
            {peerTyping ? (
              // The typing state REPLACES the preview rather than sitting beside it: "typing" and
              // "their last message" answer the same question — what is this conversation doing
              // right now — and showing both is noise. Same dots as the thread's bubble, at list
              // scale, so the two read as one idea.
              <span className="flex items-center gap-1.5">
                <span className="flex items-center gap-0.5" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="typing-dot h-1 w-1 rounded-full bg-accent-blue"
                      style={{ animationDelay: `${index * 160}ms` }}
                    />
                  ))}
                </span>
                <span className="text-[11px] font-medium text-accent-blue">
                  typing
                </span>
              </span>
            ) : (
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
            )}
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

/**
 * "Currently typing" — the chat convention, in the peer's lane.
 *
 * Three dots in a bubble, each rising and fading IN SEQUENCE rather than together: synchronised
 * motion reads as a loading spinner, a stagger reads as a person. It sits exactly where the peer's
 * next message will land, with the same avatar gutter, so the message replaces it instead of
 * shifting the list.
 *
 * The dots are decorative and the bubble is not: the `sr-only` line is the whole accessible content,
 * and because it is added inside the conversation's polite live region it is announced once, for
 * free, when it appears. There is no second live region here to announce it twice.
 */
function TypingBubble({ name }: { name: string }) {
  return (
    <div className="mt-2 flex gap-2">
      <span className="w-6 shrink-0" aria-hidden="true" />
      <div className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-2">
        <span className="sr-only">{name} is typing</span>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            aria-hidden="true"
            className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground"
            style={{ animationDelay: `${index * 160}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function MessagesThread({ threadId }: { threadId: string }) {
  const mode = useOptionalMessagesMode();
  const currentUserId = mode?.currentUserId ?? null;

  const {
    thread,
    messages,
    isLoading,
    error,
    errorStatus,
    send,
    withdraw,
    markRead,
    refresh,
    hasEarlier,
    isLoadingEarlier,
    loadEarlier,
  } = useDirectThread(threadId, true);

  /** The attachment the reader opened in the shared viewer, or null when it is closed. */
  const [openAttachment, setOpenAttachment] = useState<DirectAttachment | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Whether to keep the view pinned to the newest message. Set by the reader's own scrolling. */
  const stickRef = useRef(true);

  const newest = messages[messages.length - 1] ?? null;

  // The peer's typing signal, on its own faster poll. `peerTyping` is null until the first answer,
  // in which case the thread read's own (slower) answer stands in — so the dots appear on the first
  // frame the conversation has any opinion at all, and the fast poll merely sharpens it.
  const { peerTyping, notifyTyping } = useDirectTyping(threadId, true);
  const peerIsTyping = peerTyping ?? Boolean(thread?.peerTyping);

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

  /**
   * Pin to the newest message — keyed on the NEWEST ID, not the list length.
   *
   * Paging in an older page also changes the length, and jumping to the bottom on that would throw
   * the reader away from the history they just asked for. Only a genuinely new newest message
   * should move the view.
   */
  /**
   * Whether the scroll this render triggers should ANIMATE. Set only by the send path, because that
   * is the one scroll the reader is owed feedback for — an incoming message must not set the list
   * gliding under them. Consumed and cleared by the effect below.
   */
  const smoothScrollRef = useRef(false);

  const newestId = newest?.id ?? null;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickRef.current) return;
    scrollToBottom(el, smoothScrollRef.current);
    smoothScrollRef.current = false;
    // `peerIsTyping` is a dependency too: the bubble is an arrival at the bottom of the list, and a
    // reader already pinned there should see it appear without scrolling.
  }, [newestId, peerIsTyping]);

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
        {/* A refusal (403) is not worth retrying; a failure is — the rule the list already applies,
            so the two views answer a missing conversation the same way. */}
        {errorStatus !== 403 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        )}
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
        // Announce new messages here, and ONLY here: the conversation list is not a live region, so
        // a background poll for a thread the reader is not looking at stays silent.
        aria-live="polite"
        aria-relevant="additions"
        className={cn("flex-1 overflow-y-auto px-3 py-3", VIEW_ENTER_FORWARD)}
      >
        {hasEarlier && (
          <div className="flex justify-center pb-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-[11px]"
              disabled={isLoadingEarlier}
              onClick={async () => {
                try {
                  await loadEarlier();
                } catch (loadError) {
                  toast.error(
                    (loadError as Error)?.message ??
                      "Could not load earlier messages.",
                  );
                }
              }}
            >
              {isLoadingEarlier && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Load earlier messages
            </Button>
          </div>
        )}
        {rendered.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No messages yet — say hello.
          </p>
        ) : (
          <ul className="space-y-2">
            {rendered.map((row, index) => {
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
              // Group a run: the avatar is drawn once, on the first message of a run by the same
              // author, with a spacer keeping the rest of the run aligned beneath it.
              const previous = rendered[index - 1];
              const startsRun =
                !previous ||
                previous.kind !== "message" ||
                previous.message.authorUserId !== message.authorUserId;

              return (
                <li
                  key={row.key}
                  className={cn(
                    "group flex gap-2",
                    mine ? "justify-end" : "justify-start",
                  )}
                >
                  {!mine &&
                    (startsRun ? (
                      <span className="mt-0.5 h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted">
                        <Headshot
                          src={thread.participant.headshot}
                          alt={thread.participant.name}
                          monogramName={thread.participant.name}
                          wrapperClassName="rounded-full"
                        />
                      </span>
                    ) : (
                      <span className="w-6 shrink-0" aria-hidden="true" />
                    ))}
                  <div className={cn("min-w-0 max-w-[85%]", mine && "order-first")}>
                    {message.deletedAt ? (
                      <div className="rounded-lg bg-muted px-2.5 py-1.5 text-xs italic text-muted-foreground">
                        This message was deleted.
                      </div>
                    ) : (
                      <>
                        {message.body && (
                          <div
                            className={cn(
                              "rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words",
                              mine ? "bg-accent-blue text-white" : "bg-muted",
                              inFlight && "opacity-70",
                            )}
                          >
                            {message.body}
                          </div>
                        )}

                        {/* Attachments: images render as their own thumbnail, any other file as a
                            labelled chip. Either opens the shared viewer. A message can be files
                            only, so this block stands on its own rather than assuming a caption. */}
                        {message.attachments.length > 0 && (
                          <ul
                            className={cn(
                              "flex flex-wrap gap-1.5",
                              message.body && "mt-1",
                              inFlight && "opacity-70",
                            )}
                          >
                            {message.attachments.map((attachment) => (
                              <li key={attachment.key}>
                                <button
                                  type="button"
                                  onClick={() => setOpenAttachment(attachment)}
                                  className="block max-w-[12rem] text-left"
                                  title={attachment.name}
                                >
                                  {isImageAttachment(attachment.type) ? (
                                    // Sized by its own aspect ratio inside a 12rem x 6rem box, so
                                    // the WHOLE image shows — no object-cover crop.
                                    <img
                                      src={directAttachmentInlineUrl(attachment.key)}
                                      alt={attachment.name}
                                      className="block max-h-24 w-auto max-w-full rounded-md border border-border transition-opacity hover:opacity-90"
                                    />
                                  ) : (
                                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] transition-colors hover:bg-muted">
                                      <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                                      <span className="truncate">
                                        {attachment.name}
                                      </span>
                                      <span className="shrink-0 text-muted-foreground">
                                        {formatAttachmentSize(attachment.size)}
                                      </span>
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
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

        {/* The peer is typing. */}
        {peerIsTyping && <TypingBubble name={thread.participant.name} />}
      </div>

      <MessagesComposer
        threadId={threadId}
        onSubmit={async (body, attachments) => {
          /**
           * Sending is the reader explicitly saying "I want to see this", so it RE-ARMS the pin.
           *
           * The scroll effect above is gated on `stickRef`, which the reader's own scrolling turns
           * off — that gate is what stops an incoming message yanking them back down while they are
           * reading history. But it also meant that sending while scrolled up left your own message
           * off-screen. Re-arming here pins the list for this send and keeps it pinned afterwards,
           * which is where the reader now is by definition.
           *
           * The effect itself fires on the NEXT render, once the optimistic bubble exists — so this
           * only has to set the intent. `smoothScrollRef` marks THIS scroll as the one worth
           * animating; the effect clears it again so later arrivals stay instant.
           */
          stickRef.current = true;
          smoothScrollRef.current = true;
          await send(body, attachments);
        }}
        onTyping={notifyTyping}
      />

      {/* The comments' viewer, reused: its Open/Download URLs are key-agnostic (`/api/r2/object`),
          and what authorizes the read behind them is the DIRECT guard, not the plan check — see
          `resolveDirectAttachmentAccess`. */}
      <CommentAttachmentModal
        attachment={openAttachment}
        onOpenChange={(open) => {
          if (!open) setOpenAttachment(null);
        }}
      />
    </>
  );
}

/* ─────────────────────────────────── The rail ─────────────────────────────────── */

export function MessagesRail() {
  const mode = useOptionalMessagesMode();
  // Declared before the early return: hooks must run on every render, and the picker is chrome.
  const [showPicker, setShowPicker] = useState(false);
  const isOpen = Boolean(mode?.open);
  useEffect(() => {
    // Reopening the rail should land on the conversation list, not wherever the reader last left
    // the picker open.
    if (!isOpen) setShowPicker(false);
  }, [isOpen]);

  // Move focus into the panel when it opens, so a keyboard reader lands inside it instead of having
  // to tab in from the header. Fired on the TRANSITION only, so a poll or a re-render cannot steal
  // focus back from wherever the reader has since moved.
  const railRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) railRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  const { isCollaborator } = useViewerAccess();

  // The conversation LIST's typing poll — live only while the list is what is on screen. Opening a
  // conversation hands the job to that thread's own poll, so the two never run at once and neither
  // is paying for the other's answer.
  const typingThreadIds = useDirectTypingThreads(
    isOpen && !mode?.activeThreadId && !showPicker,
  );

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
      ref={railRef}
      tabIndex={-1}
      role="complementary"
      aria-label="Messages"
      className="fixed right-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-[24rem] flex-col border-l border-border bg-background shadow-sm focus:outline-none"
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
        <div className="flex shrink-0 items-center gap-0.5">
          {!activeThreadId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label={showPicker ? "Back to conversations" : "New message"}
              title={showPicker ? "Back to conversations" : "New message"}
              onClick={() => setShowPicker((prev) => !prev)}
            >
              {showPicker ? (
                <ArrowLeft className="h-4 w-4" />
              ) : (
                <SquarePen className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="Close messages"
            onClick={() => setMode("off")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {activeThreadId ? (
        <MessagesThread threadId={activeThreadId} />
      ) : showPicker ? (
        <DirectoryPicker
          onPicked={(threadId) => {
            setShowPicker(false);
            setActiveThreadId(threadId);
          }}
        />
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
              {/* A Collaborator has a smaller roster and a more specific question — "who can I even
                  reach?" — so the copy answers that instead of describing the mechanism. */}
              <p className="mt-1 text-xs text-muted-foreground">
                {isCollaborator
                  ? "You can message the advisor who invited you, and the team on your plans."
                  : "Start one from the directory, or wait for someone to message you."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => setShowPicker(true)}
              >
                <SquarePen className="h-3.5 w-3.5" />
                New message
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.threadId}
                  conversation={conversation}
                  currentUserId={mode.currentUserId}
                  peerTyping={typingThreadIds.has(conversation.threadId)}
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
