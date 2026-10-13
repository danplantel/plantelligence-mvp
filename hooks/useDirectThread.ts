"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { mutate as mutateGlobal } from "swr";
import { DIRECT_INBOX_KEY } from "./useDirectThreads";
import type {
  DirectAttachment,
  DirectMessageView,
  DirectThreadView,
} from "@/lib/messages/types";

/** Poll cadence for an open conversation — the inbox's own 10s, for the same reason. */
const REFRESH_INTERVAL_MS = 10_000;

interface DirectFetchError extends Error {
  status?: number;
}

async function fetchThread(url: string): Promise<DirectThreadView> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as {
    thread?: DirectThreadView;
    error?: string;
  };
  if (!response.ok || !body.thread) {
    const failure: DirectFetchError = new Error(
      body?.error ?? "Could not open that conversation.",
    );
    failure.status = response.status;
    throw failure;
  }
  return body.thread;
}

export interface UseDirectThreadResult {
  thread: DirectThreadView | null;
  /**
   * The conversation's messages, oldest first — the newest page PLUS every page pulled in by
   * `loadEarlier`, de-duplicated. The rail renders this rather than `thread.messages` so a paged-in
   * history and the polled newest page read as one continuous list.
   */
  messages: DirectMessageView[];
  isLoading: boolean;
  error: string | null;
  errorStatus: number | null;
  isSending: boolean;
  /** Send, optimistically: the message appears at once and is replaced by the server's copy. */
  send: (body: string, attachments?: DirectAttachment[]) => Promise<void>;
  withdraw: (messageId: string) => Promise<void>;
  markRead: () => Promise<void>;
  refresh: () => void;
  /** True while older messages remain to the past of the oldest one currently shown. */
  hasEarlier: boolean;
  isLoadingEarlier: boolean;
  /** Pull the previous page. Throws so the caller can surface the failure; the cursor is not moved. */
  loadEarlier: () => Promise<void>;
}

/**
 * One open conversation, plus its writes.
 *
 * The optimistic append is the point of the hook: a chat that waits a round trip before showing
 * your own message reads as broken. A failed send ROLLS BACK and reports, and the poll is the
 * safety net — if the write actually landed, the next fetch brings it.
 *
 * Reading is not implied by fetching. `markRead` is called by the rail when the reader is actually
 * looking at the newest message, so a prefetch, a retry or a background poll cannot clear an unread
 * badge on their behalf.
 */
export function useDirectThread(
  threadId: string | null,
  enabled: boolean,
): UseDirectThreadResult {
  const key =
    enabled && threadId
      ? `/api/messages/threads/${encodeURIComponent(threadId)}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<DirectThreadView, DirectFetchError>(
    key,
    fetchThread,
    {
      refreshInterval: REFRESH_INTERVAL_MS,
      refreshWhenHidden: false,
      keepPreviousData: true,
    },
  );

  const [isSending, setIsSending] = useState(false);

  const send = useCallback(
    async (body: string, attachments: DirectAttachment[] = []) => {
      if (!threadId) return;
      const trimmed = body.trim();
      if (!trimmed && attachments.length === 0) return;

      setIsSending(true);

      // The placeholder, shaped exactly like a real message so the rail's renderer needs no
      // special case. `temp-` ids are what the rail keys on to render it as in-flight.
      const placeholder: DirectMessageView = {
        id: `temp-${Date.now()}`,
        authorUserId: "pending",
        body: trimmed,
        attachments,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      };

      try {
        await mutate(
          async (current) => {
            const response = await fetch(
              `/api/messages/threads/${encodeURIComponent(threadId)}/messages`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: trimmed, attachments }),
              },
            );
            const payload = (await response.json().catch(() => ({}))) as {
              message?: DirectMessageView;
              error?: string;
            };
            if (!response.ok || !payload.message) {
              throw new Error(payload.error ?? "Could not send that message.");
            }
            const base = current ?? {
              threadId,
              participant: data?.participant,
              messages: [],
              hasEarlier: false,
              readAt: null,
            };
            return {
              ...base,
              messages: [
                ...(base.messages ?? []).filter((m) => m.id !== placeholder.id),
                payload.message,
              ],
            } as DirectThreadView;
          },
          {
            optimisticData: (current) =>
              ({
                ...(current ?? {
                  threadId,
                  participant: data?.participant,
                  messages: [],
                  hasEarlier: false,
                  readAt: null,
                }),
                messages: [...(current?.messages ?? []), placeholder],
              }) as DirectThreadView,
            rollbackOnError: true,
            revalidate: true,
          },
        );
        // The inbox's preview, unread count and ordering all moved with that message.
        void mutateGlobal(DIRECT_INBOX_KEY);
      } finally {
        setIsSending(false);
      }
    },
    [threadId, mutate, data?.participant],
  );

  const withdraw = useCallback(
    async (messageId: string) => {
      const response = await fetch(
        `/api/messages/messages/${encodeURIComponent(messageId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Could not delete that message.");
      }
      await mutate();
      void mutateGlobal(DIRECT_INBOX_KEY);
    },
    [mutate],
  );

  const markRead = useCallback(async () => {
    if (!threadId) return;
    await fetch(`/api/messages/threads/${encodeURIComponent(threadId)}/read`, {
      method: "POST",
    }).catch(() => undefined);
    // Both signals move together: the watermark on this thread, and the Bell row with it.
    void mutateGlobal(DIRECT_INBOX_KEY);
    void mutateGlobal("/api/notifications");
  }, [threadId]);

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  /* ─────────────────────────── Paging: "load earlier" ─────────────────────────── */

  /**
   * Older pages are held SEPARATELY from the SWR page and merged at read time.
   *
   * That is deliberate: the 10s poll revalidates the newest page and would otherwise wipe
   * anything the reader had paged back to. Keeping them apart means a poll replaces only the
   * newest slice, and the merge below is what stitches the two together for the rail.
   */
  const [older, setOlder] = useState<DirectMessageView[]>([]);
  const [earlierExhausted, setEarlierExhausted] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);

  // A different conversation starts from a clean slate; pages from the previous thread must not
  // bleed into this one.
  useEffect(() => {
    setOlder([]);
    setEarlierExhausted(false);
  }, [threadId]);

  const loadEarlier = useCallback(async () => {
    if (!threadId || isLoadingEarlier) return;
    // The cursor is the oldest message ON SCREEN, so the next page continues exactly from there
    // whether or not the reader has paged before.
    const oldest = older[0] ?? data?.messages?.[0];
    if (!oldest) return;

    setIsLoadingEarlier(true);
    try {
      const response = await fetch(
        `/api/messages/threads/${encodeURIComponent(threadId)}?before=${encodeURIComponent(
          oldest.createdAt,
        )}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        thread?: DirectThreadView;
        error?: string;
      };
      if (!response.ok || !payload.thread) {
        throw new Error(payload.error ?? "Could not load earlier messages.");
      }
      setOlder((prev) => [...payload.thread!.messages, ...prev]);
      setEarlierExhausted(!payload.thread.hasEarlier);
    } finally {
      setIsLoadingEarlier(false);
    }
  }, [threadId, older, data?.messages, isLoadingEarlier]);

  const baseMessages = data?.messages;
  const messages = useMemo(() => {
    const base = baseMessages ?? [];
    if (older.length === 0) return base;
    // De-duplicate against the newest page: a message that arrived between the two reads can
    // legitimately appear in both, and it must not render twice.
    const seen = new Set(base.map((message) => message.id));
    return [...older.filter((message) => !seen.has(message.id)), ...base];
  }, [baseMessages, older]);

  // Exhausted once a page came back short; otherwise "more exists" iff we have paged at least once
  // or the newest page said so.
  const hasEarlier = earlierExhausted
    ? false
    : older.length > 0
      ? true
      : Boolean(data?.hasEarlier);

  return {
    thread: data ?? null,
    messages,
    isLoading: isLoading && !data,
    error: error ? error.message : null,
    errorStatus: error?.status ?? null,
    isSending,
    send,
    withdraw,
    markRead,
    refresh,
    hasEarlier,
    isLoadingEarlier,
    loadEarlier,
  };
}
