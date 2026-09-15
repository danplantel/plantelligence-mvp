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
  const [meetings, setMeetings] = useState<MeetingReminder[]>([]);
  const [documents, setDocuments] = useState<ExpiringDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (hasLoadedRef.current) {
      if (isMountedRef.current) setIsRefreshing(true);
    } else if (isMountedRef.current) {
      setIsLoading(true);
    }

    const today = todayDateKey();
    // Send the viewer's IANA zone too: the dashboard pages read these dates in
    // browser-local time, so the server must resolve the same calendar day to
    // keep the reminder tiers in agreement with the page-level alerts.
    const timeZone =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "";
    const params = new URLSearchParams({ today });
    if (timeZone) params.set("tz", timeZone);
    const query = params.toString();

    const [meetingsResult, documentsResult] = await Promise.allSettled([
      fetch(`/api/meetings/reminders?${query}`),
      fetch(`/api/documents/expiring?${query}`),
    ]);

    if (!isMountedRef.current) return;

    if (meetingsResult.status === "fulfilled" && meetingsResult.value.ok) {
      try {
        const payload = await meetingsResult.value.json();
        if (payload?.success) setMeetings(payload.data || []);
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
        if (payload?.success) setDocuments(payload.data || []);
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
    void load();
  }, [load]);

  return { meetings, documents, isLoading, isRefreshing, refresh };
}
