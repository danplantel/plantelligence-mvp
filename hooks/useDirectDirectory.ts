"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { DirectDirectoryEntry } from "@/lib/messages/types";

/** SWR key for the picker's list. */
export const DIRECT_DIRECTORY_KEY = "/api/messages/directory";

export interface DirectDirectoryState {
  entries: DirectDirectoryEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchDirectory(url: string): Promise<DirectDirectoryEntry[]> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as {
    entries?: DirectDirectoryEntry[];
    error?: string;
  };
  if (!response.ok) throw new Error(body?.error ?? "Could not load the directory.");
  return Array.isArray(body.entries) ? body.entries : [];
}

/**
 * Who the reader may start a conversation with.
 *
 * No polling, unlike the inbox: a roster does not change while a picker is open, and this list
 * never needs to be fresher than the moment the panel was opened. `keepPreviousData` so typing in
 * the search box does not blank the list if the read revalidates.
 */
export function useDirectDirectory(enabled: boolean): DirectDirectoryState {
  const { data, error, isLoading, mutate } = useSWR<DirectDirectoryEntry[]>(
    enabled ? DIRECT_DIRECTORY_KEY : null,
    fetchDirectory,
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    entries: data ?? [],
    isLoading: isLoading && !data,
    error: error ? (error as Error).message : null,
    refresh,
  };
}
