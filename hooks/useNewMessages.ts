"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** The shape both a DM's and a comment thread's messages already have. */
export interface NewMessageLike {
  id: string;
  createdAt: string;
  authorUserId: string;
}

export interface UseNewMessagesResult {
  /** Messages from the OTHER side that arrived since the reader last saw the newest one. */
  count: number;
  /** Called when the reader jumps to them (or otherwise catches up). */
  clear: () => void;
}

/**
 * How many messages the reader has not seen, for the Discord-style "N new messages" pill.
 *
 * The count is a MARKER, not a scroll position: it starts at the newest message the reader was last
 * level with, and everything newer than that from the other side is "new". So it is genuinely
 * per-session — opening the panel does not produce a count for history, because the marker is
 * initialised at today's newest message.
 *
 * `atBottom` is what keeps it honest in both directions. While the reader is pinned to the newest
 * message the marker keeps moving forward, so nothing ever counts; the moment they scroll up it
 * freezes, and everything that lands after that accumulates. Without that, the pill would either
 * nag about messages already on screen or silently miss ones that arrived while they were reading.
 *
 * Own messages never count. A "new messages" affordance is a "there is something for you" affordance,
 * and your own message is not a thing you need telling about — including the optimistic placeholder,
 * which is why `"pending"` is excluded alongside the real id.
 *
 * The marker is STATE and not a ref, deliberately: it feeds a memoised count, and a ref write cannot
 * invalidate a memo. See the comment on `marker` below for the bug that taught us this.
 */
export function useNewMessages(input: {
  /** Changes when the conversation does, which resets the marker. */
  scopeId: string | null;
  messages: NewMessageLike[];
  currentUserId: string | null;
  /**
   * Whether the reader is level with the newest message.
   *
   * Optional because not every caller HAS such a notion: an open conversation knows whether its
   * scroller is at the bottom, while the comments rail reports across every thread at once and has no
   * single "bottom" to be at. Those callers omit it (or pass `false`) and the marker then only moves
   * when `clear()` is called — which is what a top-of-panel notification wants anyway.
   */
  atBottom?: boolean;
}): UseNewMessagesResult {
  const { scopeId, messages, currentUserId, atBottom = false } = input;

  /**
   * The marker: the newest message the reader has acknowledged.
   *
   * STATE, not a ref, and that is load-bearing. The count below is memoised on the marker, so with a
   * ref the two could not talk to each other: `clear()` would move the marker, the memo would hand
   * back its cached total, and the pill would sit there after the click. A memo is only invalidated
   * by its dependencies changing, and a ref is not a dependency — which is exactly how the comments
   * rail's pill behaved (it scrolled the list, so the click ran, and stayed on screen anyway). State
   * also survives the poll's deep-compare: when a poll returns an unchanged payload, SWR keeps the
   * same `data`, so nothing else would have recomputed the memo either.
   */
  const [marker, setMarker] = useState<string | null>(null);

  // A different conversation starts from scratch: another thread's history is not "unread".
  useEffect(() => {
    setMarker(null);
  }, [scopeId]);

  const newestAt = messages.length
    ? messages[messages.length - 1].createdAt
    : null;

  /**
   * Where the marker starts, and when it moves.
   *
   * It is seeded AT the newest message the first time data arrives, so opening a panel never counts
   * the history already on screen. After that it advances only while the reader is level with the
   * newest — being at the bottom IS having seen it — which keeps the count at zero for someone
   * watching the conversation live. A caller with no "at bottom" (see the input doc) leaves the
   * marker where it is and relies on `clear()`.
   *
   * The marker is read from the updater rather than from the closure, which keeps this effect
   * dependent on the DATA alone — it must never re-run because of its own write.
   */
  useEffect(() => {
    if (!newestAt) return;
    setMarker((current) => (current === null || atBottom ? newestAt : current));
  }, [atBottom, newestAt]);

  const count = useMemo(() => {
    // No marker yet means nothing has been missed — treated as "seen" rather than flashing a count
    // for the history that was already on screen when the panel opened.
    if (atBottom || !marker) return 0;
    const since = new Date(marker).getTime();
    return messages.filter(
      (message) =>
        message.authorUserId !== currentUserId &&
        message.authorUserId !== "pending" &&
        new Date(message.createdAt).getTime() > since,
    ).length;
  }, [atBottom, marker, messages, currentUserId]);

  /**
   * Acknowledge the newest message: the count drops to zero on the spot, because moving the marker
   * is a state change and state invalidates the memo above.
   */
  const clear = useCallback(() => {
    setMarker(newestAt);
  }, [newestAt]);

  return { count, clear };
}
