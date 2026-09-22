"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExpiringDocument } from "@/lib/notifications/document-expirations";
import type { MeetingReminder } from "@/hooks/useHeaderNotifications";

const STORAGE_KEY = "plantelligence:dismissed-notifications";

/** Cap on stored keys so the list cannot grow without bound. */
const MAX_STORED = 300;

/**
 * Identity of a single reminder row.
 *
 * The key includes the day the reminder refers to **and** its urgency tier, which
 * gives three deliberate behaviours:
 *
 * - Closing a row suppresses that one reminder, never the whole record.
 * - Rescheduling the meeting (or changing the review date) changes the day key,
 *   so the reminder surfaces again instead of staying silently dismissed.
 * - Later, more urgent tiers — 2 days out, then day-of — still appear, so
 *   closing an early heads-up does not mute the actual deadline.
 */
export function meetingNotificationKey(reminder: MeetingReminder): string {
  return `meeting:${reminder.id}:${reminder.dateKey}:${reminder.reminderStatus}`;
}

/** Counterpart of {@link meetingNotificationKey} for document reminders. */
export function documentNotificationKey(document: ExpiringDocument): string {
  return `document:${document.id}:${document.dateKey}:${document.status}`;
}

export interface DismissedNotificationsResult {
  isDismissed: (key: string) => boolean;
  dismiss: (key: string) => void;
  /** Number of closed rows remembered on this device. */
  dismissedCount: number;
}

/**
 * Remembers which individual notification rows the user has closed, persisted in
 * `localStorage` so a dismissal survives reloads on this device (the same
 * approach as `useDismissibleAlert`, which the dashboard alerts use).
 *
 * SSR-safe: the first render reports nothing as dismissed, and the stored set is
 * applied in an effect after mount so server and client markup match.
 */
export function useDismissedNotifications(): DismissedNotificationsResult {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setDismissed(
        new Set(parsed.filter((value): value is string => typeof value === "string")),
      );
    } catch {
      // Ignore storage access / parse errors (private mode, disabled storage).
    }
  }, []);

  const dismiss = useCallback((key: string) => {
    setDismissed((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([...next].slice(-MAX_STORED)),
          );
        } catch {
          // Ignore quota / access errors.
        }
      }
      return next;
    });
  }, []);

  const isDismissed = useCallback(
    (key: string) => dismissed.has(key),
    [dismissed],
  );

  return { isDismissed, dismiss, dismissedCount: dismissed.size };
}
