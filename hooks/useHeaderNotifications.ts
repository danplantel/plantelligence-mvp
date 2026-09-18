"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  todayDateKey,
  type MeetingReminderStatus,
} from "@/lib/notifications/meeting-reminders";
import type { ExpiringDocument } from "@/lib/notifications/document-expirations";

export type { ExpiringDocument };

/** A meeting reminder returned by `GET /api/meetings/reminders`. */
export interface MeetingReminder {
  id: string;
  title: string;
  meetingType: string;
  client: string;
  clientId: string | null;
  /** `yyyy-MM-dd` calendar day of the meeting. */
  dateKey: string;
  /** 24-hour `HH:mm` start time. */
  time: string;
  timezone: string | null;
  format: string;
  status: string;
  daysUntil: number;
  reminderStatus: MeetingReminderStatus;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * How long a resolved snapshot stays usable across mounts.
 *
 * The dashboard header remounts on every route change, so without this each
 * navigation re-requested both sources even when the counts were seconds old.
 * Navigating now reuses the in-memory snapshot and only refetches once it is
 * older than this — which bounds how stale the badge can get (the 5-minute
 * interval alone can't, because remounting restarts it).
 */
const CACHE_TTL_MS = 2 * 60 * 1000;

interface HeaderNotificationsSnapshot {
  meetings: MeetingReminder[];
  documents: ExpiringDocument[];
  at: number;
}

let cachedSnapshot: HeaderNotificationsSnapshot | null = null;

/** Drop the snapshot so the next mount refetches (e.g. after a reminder changes). */
export function invalidateHeaderNotificationsCache(): void {
  cachedSnapshot = null;
}

export interface HeaderNotificationsResult {
  meetings: MeetingReminder[];
  documents: ExpiringDocument[];
  /** True only for the initial load, so the menu can show a loading state. */
  isLoading: boolean;
  /** True for background refreshes, so the menu can stay interactive. */
  isRefreshing: boolean;
  /** Force an immediate refetch of both sources. */
  refresh: () => void;
}

/**
 * Loads header notification data (meeting reminders + expiring documents) on a
 * shared 5-minute interval. Both sources are fetched in parallel and any single
 * failure leaves the other source's data intact.
 */
export function useHeaderNotifications(): HeaderNotificationsResult {
  // Seeded from the snapshot so a remount renders the previous counts instead of
  // flashing a loading state.
  const [meetings, setMeetings] = useState<MeetingReminder[]>(
    () => cachedSnapshot?.meetings ?? [],
  );
  const [documents, setDocuments] = useState<ExpiringDocument[]>(
    () => cachedSnapshot?.documents ?? [],
  );
  const [isLoading, setIsLoading] = useState(() => cachedSnapshot === null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(cachedSnapshot !== null);

  const load = useCallback(async () => {
    // Reuse a recent snapshot rather than re-fetching on every remount.
    if (
      cachedSnapshot &&
      Date.now() - cachedSnapshot.at < CACHE_TTL_MS
    ) {
      if (isMountedRef.current) {
        setMeetings(cachedSnapshot.meetings);
        setDocuments(cachedSnapshot.documents);
        setIsLoading(false);
        setIsRefreshing(false);
      }
      hasLoadedRef.current = true;
      return;
    }

    if (hasLoadedRef.current) {
      if (isMountedRef.current) setIsRefreshing(true);
    } else if (isMountedRef.current) {
      setIsLoading(true);
    }

    const today = todayDateKey();
    // A day key only: both reminder types resolve the calendar day from the
    // stored date-only value, so the viewer's timezone is never sent or used.
    const query = new URLSearchParams({ today }).toString();

    const [meetingsResult, documentsResult] = await Promise.allSettled([
      fetch(`/api/meetings/reminders?${query}`),
      fetch(`/api/documents/expiring?${query}`),
    ]);

    if (!isMountedRef.current) return;

    let nextMeetings: MeetingReminder[] | null = null;
    let nextDocuments: ExpiringDocument[] | null = null;

    if (meetingsResult.status === "fulfilled" && meetingsResult.value.ok) {
      try {
        const payload = await meetingsResult.value.json();
        if (payload?.success) nextMeetings = payload.data || [];
      } catch (error) {
        console.error("Error parsing meeting reminders:", error);
      }
    } else if (meetingsResult.status === "rejected") {
      console.error("Error fetching meeting reminders:", meetingsResult.reason);
    }

    if (!isMountedRef.current) return;

    if (documentsResult.status === "fulfilled" && documentsResult.value.ok) {
      try {
        const payload = await documentsResult.value.json();
        if (payload?.success) nextDocuments = payload.data || [];
      } catch (error) {
        console.error("Error parsing expiring documents:", error);
      }
    } else if (documentsResult.status === "rejected") {
      console.error(
        "Error fetching expiring documents:",
        documentsResult.reason,
      );
    }

    if (!isMountedRef.current) return;

    // Apply and cache together: a source that failed keeps its previous value, so
    // one outage never blanks the other source's data.
    if (nextMeetings) setMeetings(nextMeetings);
    if (nextDocuments) setDocuments(nextDocuments);

    cachedSnapshot = {
      meetings: nextMeetings ?? cachedSnapshot?.meetings ?? [],
      documents: nextDocuments ?? cachedSnapshot?.documents ?? [],
      at: Date.now(),
    };

    hasLoadedRef.current = true;
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void load();

    const interval = window.setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [load]);

  const refresh = useCallback(() => {
    // An explicit refresh must reach the network, so drop the snapshot first.
    invalidateHeaderNotificationsCache();
    void load();
  }, [load]);

  return { meetings, documents, isLoading, isRefreshing, refresh };
}
