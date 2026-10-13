"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { DirectConversationView } from "@/lib/messages/types";

/** SWR key for the reader's inbox. Exported so a send can refresh it by key. */
export const DIRECT_INBOX_KEY = "/api/messages/threads";

/**
 * Poll cadence.
 *
 * The same 10s the comments rail uses — one number for "how live is a side panel" in this app, so
 * two panels cannot feel different for no reason.
 */
const REFRESH_INTERVAL_MS = 10_000;

export interface DirectInboxState {
  conversations: DirectConversationView[];
  /** Unread messages across every conversation — the header badge's number. */
  unreadTotal: number;
  isLoading: boolean;
  error: string | null;
  /** The HTTP status behind `error`, so the rail can tell a refusal from a failure. */
  errorStatus: number | null;
  refresh: () => void;
}

interface InboxPayload {
  conversations: DirectConversationView[];
  unreadTotal: number;
}

interface DirectFetchError extends Error {
  status?: number;
}

async function fetchInbox(url: string): Promise<InboxPayload> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as {
    conversations?: DirectConversationView[];
    unreadTotal?: number;
    error?: string;
  };
  if (!response.ok) {
    const failure: DirectFetchError = new Error(
      body?.error ?? "Could not load your messages.",
    );
    failure.status = response.status;
    throw failure;
  }
  return {
    conversations: Array.isArray(body.conversations) ? body.conversations : [],
    unreadTotal: typeof body.unreadTotal === "number" ? body.unreadTotal : 0,
  };
}

/**
 * The reader's inbox.
 *
 * Polled ALWAYS, not only while the rail is open — this is what feeds the header badge, and a
 * closed panel is precisely when the reader needs to know something arrived. `refreshWhenHidden`
 * is false so a backgrounded tab stops polling rather than keeping a hidden reader's connection
 * busy; the next focus fetches.
 */
export function useDirectInbox(): DirectInboxState {
  const { data, error, isLoading, mutate } = useSWR<InboxPayload, DirectFetchError>(
    DIRECT_INBOX_KEY,
    fetchInbox,
    {
      refreshInterval: REFRESH_INTERVAL_MS,
      refreshWhenHidden: false,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    conversations: data?.conversations ?? [],
    unreadTotal: data?.unreadTotal ?? 0,
    isLoading: isLoading && !data,
    error: error ? error.message : null,
    errorStatus: error?.status ?? null,
    refresh,
  };
}
