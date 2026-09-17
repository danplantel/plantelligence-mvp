import {
  daysBetweenScheduleDays,
  scheduleDayKeyToDate,
  toScheduleDayKey,
  todayScheduleDayKey,
} from "@/lib/date";

/**
 * Shared presentation helpers for meeting rows across the dashboard panels.
 *
 * Meeting dates are date-only scheduling values (see lib/date.ts), so both the day label
 * and the time are derived from those helpers rather than from the browser's clock.
 */

/** Abbreviations for the scheduling timezones the app offers. */
const TIME_ZONE_LABELS: Record<string, string> = {
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
  "America/Anchorage": "AT",
  "Pacific/Honolulu": "HT",
};

/** `12:00` + `America/New_York` → `12:00 PM ET`. Returns the stored value if unparseable. */
export function formatMeetingTime(
  time: string,
  timezone?: string | null,
): string {
  const [hours, minutes] = time.split(":");
  const hour = Number(hours);
  if (Number.isNaN(hour)) return time;

  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const suffix = hour >= 12 ? "PM" : "AM";
  const zone = timezone ? TIME_ZONE_LABELS[timezone] : undefined;

  return `${hour12}:${minutes ?? "00"} ${suffix}${zone ? ` ${zone}` : ""}`;
}

/**
 * Compact day label: "Today", "Tomorrow", otherwise e.g. "Thu, Sep 18".
 *
 * The offset is measured between scheduling day keys, so the label never shifts with the
 * viewer's timezone — unlike formatting the stored instant directly.
 */
export function formatMeetingDay(
  dateValue: string | Date | null | undefined,
): string {
  const key = toScheduleDayKey(dateValue);
  if (!key) return "";

  const todayKey = todayScheduleDayKey();
  const offset = todayKey ? daysBetweenScheduleDays(todayKey, key) : Number.NaN;
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";

  const day = scheduleDayKeyToDate(key);
  if (Number.isNaN(day.getTime())) return key;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(day);
}
