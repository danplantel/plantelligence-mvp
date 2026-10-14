"use client";

import { useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
import { TYPING_PING_THROTTLE_MS, TYPING_POLL_MS } from "@/lib/messages/types";

/** SWR key for the conversation list's typing poll. */
export const DIRECT_TYPING_LIST_KEY = "/api/messages/typing";

async function fetchTypingThreads(url: string): Promise<string[]> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as {
    typingThreadIds?: string[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload?.error ?? "Could not read the typing state.");
  }
  return Array.isArray(payload.typingThreadIds) ? payload.typingThreadIds : [];
}

async function fetchTyping(url: string): Promise<boolean> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as {
    typing?: boolean;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload?.error ?? "Could not read the typing state.");
  }
  return Boolean(payload.typing);
}

export interface UseDirectTypingResult {
  /**
   * The PEER's state, or `null` before the first answer — null rather than false so the caller can
   * fall back to the thread read's own answer instead of briefly asserting "not typing".
   */
  peerTyping: boolean | null;
  /** Call on the reader's own input. Throttled, and fire-and-forget. */
  notifyTyping: () => void;
}

/**
 * "Currently typing" for one open conversation.
 *
 * A SEPARATE and faster poll than the thread read, on purpose: typing needs a couple of seconds to
 * feel live, while the messages are perfectly fine at ten. Moving the whole conversation every tick
 * to answer a one-bit question would be the wrong trade.
 *
 * `notifyTyping` is throttled HERE rather than at the call site, so no caller can flood the endpoint
 * by forgetting to. It never surfaces an error: a dropped ping is worthless by definition — the
 * next keystroke sends another — so there is nothing to report and nothing to retry.
 */
export function useDirectTyping(
  threadId: string | null,
  enabled: boolean,
): UseDirectTypingResult {
  const key =
    enabled && threadId
      ? `/api/messages/threads/${encodeURIComponent(threadId)}/typing`
      : null;

  const { data } = useSWR<boolean>(key, fetchTyping, {
    refreshInterval: TYPING_POLL_MS,
    refreshWhenHidden: false,
    revalidateOnFocus: false,
  });

  const lastPingRef = useRef(0);
  const notifyTyping = useCallback(() => {
    if (!threadId) return;
    const now = Date.now();
    if (now - lastPingRef.current < TYPING_PING_THROTTLE_MS) return;
    lastPingRef.current = now;
    void fetch(`/api/messages/threads/${encodeURIComponent(threadId)}/typing`, {
      method: "POST",
    }).catch(() => undefined);
  }, [threadId]);

  return { peerTyping: data ?? null, notifyTyping };
}

/**
 * The typing set for the conversation LIST.
 *
 * A `Set` so a row can ask "is this one typing?" in constant time while rendering. One request for
 * the whole list rather than a flag per row — the opposite would be fifty requests every couple of
 * seconds.
 *
 * `enabled` is how the caller keeps the two polls from running at once: the list poll runs while the
 * list is what is on screen, and opening a conversation hands the job to that thread's own poll.
 */
export function useDirectTypingThreads(enabled: boolean): Set<string> {
  const { data } = useSWR<string[]>(
    enabled ? DIRECT_TYPING_LIST_KEY : null,
    fetchTypingThreads,
    {
      refreshInterval: TYPING_POLL_MS,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
    },
  );

  return useMemo(() => new Set(data ?? []), [data]);
}
