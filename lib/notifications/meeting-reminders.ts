/**
 * Meeting reminder helpers shared by the server route
 * (`app/api/meetings/reminders/route.ts`) and the header Notifications menu.
 *
 * Tiering intentionally mirrors the document expiration reminders
 * (`lib/notifications/document-expirations.ts`): a reminder fires on the exact
 * day-of, 2-days, and 7-days marks only.
 *
 * Calendar-day math lives in `lib/notifications/date-keys.ts` and is re-exported
 * here so callers only need this one import.
 */

import {
  formatTime12h,
  getTimezoneAbbr,
} from "@/lib/meetings/meeting-schedule-shared";
import {
  compareByDaysThenTime,
  dateKeyToUtcDate,
  daysBetweenDateKeys,
  formatDateKey,
  isDateKey,
  toDateKey,
  todayDateKey,
} from "@/lib/notifications/date-keys";

export {
  compareByDaysThenTime,
  dateKeyToUtcDate,
  daysBetweenDateKeys,
  formatDateKey,
  isDateKey,
  todayDateKey,
};

/** Meeting-specific alias for `toDateKey`. */
export const toMeetingDateKey = toDateKey;

/** Meeting-specific alias for `formatDateKey`. */
export const formatReminderDateKey = formatDateKey;

export type MeetingReminderStatus = "today" | "in_2days" | "in_week";

/** Day offsets (from today) that trigger a reminder. */
export const MEETING_REMINDER_TIERS = [0, 2, 7] as const;

/** Widest look-ahead, in days, used for the DB query window. */
export const MEETING_REMINDER_WINDOW_DAYS = 7;

/** Cap on returned reminders, matching the documents endpoint. */
export const MEETING_REMINDER_LIMIT = 20;

/** Meeting statuses that should never surface as a reminder. */
export const MEETING_REMINDER_EXCLUDED_STATUSES = ["Draft", "Cancelled"] as const;

export const MEETING_REMINDER_LABEL: Record<MeetingReminderStatus, string> = {
  today: "Today",
  in_2days: "In 2 days",
  in_week: "In 7 days",
};

/** Map a day offset onto a reminder tier, or `null` when no reminder fires. */
export function resolveMeetingReminderStatus(
  daysUntil: number,
): MeetingReminderStatus | null {
  if (daysUntil === 0) return "today";
  if (daysUntil === 2) return "in_2days";
  if (daysUntil === 7) return "in_week";
  return null;
}

/**
 * Date/time label for a reminder row, e.g. `1:00 PM ET` for a same-day meeting
 * or `09/17/2026 at 1:00 PM ET` for a future one.
 */
export function formatMeetingReminderWhen(
  dateKey: string,
  time: string,
  timezone?: string | null,
  status?: MeetingReminderStatus | null,
): string {
  const timeLabel = formatTime12h(time);
  const abbr = timezone ? getTimezoneAbbr(timezone) : "";
  const clock = timeLabel ? `${timeLabel}${abbr ? ` ${abbr}` : ""}` : "";

  if (status === "today") return clock;

  const dayLabel = formatDateKey(dateKey);
  if (!clock) return dayLabel;
  return `${dayLabel} at ${clock}`;
}

/** Urgency order (soonest first), then earliest start time. */
export const compareMeetingReminders = compareByDaysThenTime;
