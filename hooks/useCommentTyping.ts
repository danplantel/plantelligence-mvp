"use client";

import { useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
import {
  COMMENT_TYPING_PING_THROTTLE_MS,
  COMMENT_TYPING_POLL_MS,
  type CommentSurfaceTyping,
  type CommentTargetType,
  type CommentTypingByThread,
  type CommentTypingPerson,
} from "@/lib/comments/types";

const EMPTY: CommentSurfaceTyping = { byThread: {}, composers: [] };

async function fetchTyping(url: string): Promise<CommentSurfaceTyping> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as {
    byThread?: CommentTypingByThread;
    composers?: CommentTypingPerson[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload?.error ?? "Could not read the typing state.");
  }
  return {
    byThread: payload.byThread ?? {},
    composers: payload.composers ?? [],
  };
}

export interface UseCommentTypingResult {
  /** threadId → the people typing a REPLY in it. Never includes the reader. */
  byThread: CommentTypingByThread;
  /** The people composing a NEW comment on the surface — the rail's persistent composer. */
  composers: CommentTypingPerson[];
  /** Call on the reader's own input in a thread's reply box. Throttled per thread. */
  notifyTyping: (threadId: string) => void;
  /** Call on the reader's own input in the rail's persistent composer. */
  notifyComposerTyping: () => void;
}

/**
 * "Currently typing" for a comments rail — both scopes in one poll.
 *
 * ONE request for the whole surface rather than one per thread: the rail renders every thread at
 * once, and a card that fetches its own typing state is a request per card every couple of seconds.
 * The response carries the per-thread map AND the surface's own composer typers, which are shown in
 * different places but share the same cadence and the same authorization.
 *
 * `enabled` keeps this from running when the rail is closed or the viewer cannot comment: a request
 * every 2.5s for a panel nobody is looking at is pure waste.
 *
 * Both notifiers are throttled HERE, keyed by the scope they belong to, so no caller can flood the
 * endpoint by forgetting to — and so one scope's ping cannot silently suppress the other's. They
 * never surface an error: a dropped ping is worthless by definition, and the next keystroke sends
 * another.
 */
export function useCommentTyping(input: {
  enabled: boolean;
  clientId: string | null;
  targetType: CommentTargetType;
  category: string | null;
}): UseCommentTypingResult {
  const { enabled, clientId, targetType, category } = input;

  const surfaceKey =
    enabled && clientId
      ? `/api/clients/${encodeURIComponent(clientId)}/comments/typing?targetType=${encodeURIComponent(
          targetType,
        )}${category ? `&category=${encodeURIComponent(category)}` : ""}`
      : null;

  const { data } = useSWR<CommentSurfaceTyping>(surfaceKey, fetchTyping, {
    refreshInterval: COMMENT_TYPING_POLL_MS,
    refreshWhenHidden: false,
    revalidateOnFocus: false,
  });

  // One throttle mark per SCOPE, keyed so a reply and a new comment cannot suppress each other.
  const lastPingRef = useRef<Map<string, number>>(new Map());

  const ping = useCallback((scope: string, send: () => Promise<unknown>) => {
    const now = Date.now();
    const last = lastPingRef.current.get(scope) ?? 0;
    if (now - last < COMMENT_TYPING_PING_THROTTLE_MS) return;
    lastPingRef.current.set(scope, now);
    void send().catch(() => undefined);
  }, []);

  const notifyTyping = useCallback(
    (threadId: string) => {
      if (!threadId) return;
      ping(`thread:${threadId}`, () =>
        fetch(`/api/comments/threads/${encodeURIComponent(threadId)}/typing`, {
          method: "POST",
        }),
      );
    },
    [ping],
  );

  const notifyComposerTyping = useCallback(() => {
    if (!surfaceKey) return;
    // POSTs to the very endpoint the poll GETs, so the two can never disagree about which surface
    // the signal belongs to — there is no second URL to keep in step.
    ping("surface", () =>
      fetch(surfaceKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, category }),
      }),
    );
  }, [ping, surfaceKey, targetType, category]);

  return {
    byThread: useMemo(() => (data ?? EMPTY).byThread, [data]),
    composers: useMemo(() => (data ?? EMPTY).composers, [data]),
    notifyTyping,
    notifyComposerTyping,
  };
}
