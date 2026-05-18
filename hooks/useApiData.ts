"use client";

/**
 * Shared SWR hooks for the primary nav-page data fetches.
 *
 * SWR caches responses by key (URL). On first visit the data is fetched
 * and stored in memory. On subsequent visits the cached data is returned
 * immediately (no loading state) while SWR revalidates in the background.
 *
 * This eliminates the "blank page while loading" UX on every navigation.
 */

import useSWR from "swr";

// ---------------------------------------------------------------------------
// Generic JSON fetcher
// ---------------------------------------------------------------------------
async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error(`API error: ${res.status} ${res.statusText}`);
    throw error;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// SWR config defaults shared across all hooks
// ---------------------------------------------------------------------------
const SWR_CONFIG = {
  // Keep cached data for 30 seconds before considering it stale
  dedupingInterval: 30_000,
  // Revalidate when the window regains focus (user switches tabs and comes back)
  revalidateOnFocus: true,
  // Don't revalidate on reconnect (avoids unnecessary fetches)
  revalidateOnReconnect: false,
  // Keep showing stale data while revalidating (no loading flash on revisit)
  keepPreviousData: true,
} as const;

// ---------------------------------------------------------------------------
// Clients / Plans
// ---------------------------------------------------------------------------
export interface ClientRecord {
  id: string;
  companyName: string;
  status?: string;
  [key: string]: any;
}

interface ClientsResponse {
  success: boolean;
  data: ClientRecord[];
  total?: number;
}

/**
 * Fetches and caches the full client list.
 * Pass `params` to customise the query string (e.g. status, limit, sort).
 */
export function useClients(
  params: Record<string, string> = { status: "all", limit: "500", sortColumn: "companyName", sortDirection: "asc" },
) {
  const qs = new URLSearchParams(params).toString();
  const key = `/api/clients?${qs}`;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<ClientsResponse>(key, jsonFetcher, SWR_CONFIG);

  return {
    clients: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    isValidating,
    error,
    /** Call to force a fresh fetch (e.g. after creating/deleting a client) */
    refresh: () => mutate(),
  };
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------
export interface MeetingRecord {
  id: string;
  meeting: string;
  meetingType: string;
  client: string;
  clientId?: string | null;
  date: string;
  time: string;
  timezone?: string;
  duration: string;
  format: string;
  platform?: string;
  attendees: number;
  status: string;
  [key: string]: any;
}

interface MeetingsResponse {
  success: boolean;
  data: MeetingRecord[];
}

/**
 * Fetches and caches meetings.
 * Pass `params` to filter by search/type/status.
 */
export function useMeetings(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const key = `/api/meetings${qs ? `?${qs}` : ""}`;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<MeetingsResponse>(key, jsonFetcher, SWR_CONFIG);

  return {
    meetings: data?.data ?? [],
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
  };
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export interface DocumentRecord {
  id: string;
  title: string;
  fileName: string;
  type?: string;
  uploadedAt: string;
  expirationDate?: string;
  client: { id: string; companyName: string };
  [key: string]: any;
}

interface DocumentsResponse {
  success: boolean;
  data: DocumentRecord[];
}

/**
 * Fetches and caches documents.
 * Pass `params` to filter by search/type/clientId.
 */
export function useDocuments(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const key = `/api/documents${qs ? `?${qs}` : ""}`;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<DocumentsResponse>(key, jsonFetcher, SWR_CONFIG);

  return {
    documents: data?.data ?? [],
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
  };
}

// ---------------------------------------------------------------------------
// Videos (plan list with embedded video data)
// ---------------------------------------------------------------------------
interface PlansWithVideosResponse {
  success?: boolean;
  data?: any[];
  [key: string]: any;
}

/**
 * Fetches and caches the plan list (which includes embedded video data).
 */
export function usePlansWithVideos() {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<PlansWithVideosResponse>("/api/plans/get-list-plan", jsonFetcher, SWR_CONFIG);

  return {
    plans: data?.data ?? [],
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
  };
}
