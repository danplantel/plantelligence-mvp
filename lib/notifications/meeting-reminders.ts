/**
 * Shared meeting-reminder helpers used by both the server route
 * (`app/api/meetings/reminders/route.ts`) and the header Notifications menu.
 *
 * Tiering intentionally mirrors the document expiration reminders
 * (`app/api/documents/expiring/route.ts`): a reminder fires on the exact
 * day-of, 2-days, and 7-days marks only.
 *
 * `Meeting.date` is persisted from a `yyyy-MM-dd` string (see
 * `app/api/meetings/route.ts`), so it lands on UTC midnight. Every comparison
 * here is therefore made between `yyyy-MM-dd` keys — never raw `Date`
 * instant math — which avoids off-by-one-day drift for users west of UTC.
 */

import {
  formatTime12h,
  getTimezoneAbbr,
} from "@/lib/meetings/meeting-schedule-shared";

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

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** True when `value` is a well-formed `yyyy-MM-dd` key. */
export function isDateKey(value: string | null | undefined): boolean {
  return !!value && DATE_KEY_PATTERN.test(value);
}

/**
 * Calendar-day key for a stored meeting date. Uses the UTC date portion so a
 * date persisted from `yyyy-MM-dd` reads back as the same calendar day.
 */
export function toMeetingDateKey(
  input: Date | string | null | undefined,
): string | null {
  if (input === null || input === undefined || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Local `yyyy-MM-dd` key for `now`. Called on the client so the reminder tiers
 * follow the viewer's calendar day rather than the server's (UTC) day.
 */
export function todayDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** UTC instant for a `yyyy-MM-dd` key, optionally offset by whole days. */
export function dateKeyToUtcDate(key: string, offsetDays = 0): Date {
  const base = Date.parse(`${key}T00:00:00.000Z`);
  if (Number.isNaN(base)) return new Date(NaN);
  return new Date(base + offsetDays * MS_PER_DAY);
}

/** Whole days from `fromKey` to `toKey`; `null` when either key is invalid. */
export function daysBetweenDateKeys(
  fromKey: string,
  toKey: string,
): number | null {
  if (!isDateKey(fromKey) || !isDateKey(toKey)) return null;
  const from = Date.parse(`${fromKey}T00:00:00.000Z`);
  const to = Date.parse(`${toKey}T00:00:00.000Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

/** Map a day offset onto a reminder tier, or `null` when no reminder fires. */
export function resolveMeetingReminderStatus(
  daysUntil: number,
): MeetingReminderStatus | null {
  if (daysUntil === 0) return "today";
  if (daysUntil === 2) return "in_2days";
  if (daysUntil === 7) return "in_week";
  return null;
}

/** Display a date key as `MM/DD/YYYY` without any timezone conversion. */
export function formatReminderDateKey(key: string): string {
  if (!isDateKey(key)) return "";
  const [year, month, day] = key.split("-");
  return `${month}/${day}/${year}`;
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

  const dayLabel = formatReminderDateKey(dateKey);
  if (!clock) return dayLabel;
  return `${dayLabel} at ${clock}`;
}

/** Urgency order (soonest first), then earliest start time. */
export function compareMeetingReminders<
  T extends { daysUntil: number; time: string },
>(a: T, b: T): number {
  if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
  return (a.time || "").localeCompare(b.time || "");
}
