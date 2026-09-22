import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const formNow = (date: dayjs.ConfigType) => {
  return dayjs(date).fromNow();
};

const US_DATE_OPTS: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
};

const US_TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

/** Display dates as MM/DD/YYYY (US). */
export function formatUsDate(
  input: Date | string | number | null | undefined,
): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", US_DATE_OPTS).format(d);
}

/** Display time in US locale (12-hour). */
export function formatUsTime(
  input: Date | string | number | null | undefined,
): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", US_TIME_OPTS).format(d);
}

// ---------------------------------------------------------------------------
// Scheduling days
//
// This is a US-based app: a meeting scheduled for a given day belongs to that
// day for every viewer, regardless of where they happen to be sitting. Meeting
// and review dates are persisted as date-only values (a `yyyy-MM-dd` string
// passed through `new Date()`, which lands on UTC midnight), so the day the
// scheduler picked is the UTC date portion of the stored instant.
//
// Reading such a value back with `new Date(iso)` renders it in the *viewer's*
// timezone, which shifts the day for anyone west of UTC (a US viewer sees the
// previous day) and shifts duplicate-detection keys for anyone east of it.
// These helpers keep scheduling days timezone-independent.
// ---------------------------------------------------------------------------

/** The timezone the app schedules in; used for "today" and past/future gating. */
export const SCHEDULING_TIME_ZONE = "America/New_York";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `yyyy-MM-dd` key for a stored scheduling value. A bare day key is returned
 * as-is; any other value is reduced to its UTC calendar day, which is the day
 * that was scheduled.
 */
export function toScheduleDayKey(
  input: Date | string | number | null | undefined,
): string {
  if (input == null || input === "") return "";
  if (typeof input === "string" && DAY_KEY_PATTERN.test(input.trim())) {
    return input.trim();
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Local midnight `Date` for a day key. Safe for calendar-grid math in any
 * timezone: the same key always produces the same calendar day locally.
 */
export function scheduleDayKeyToDate(key: string): Date {
  if (!DAY_KEY_PATTERN.test(key)) return new Date(key);
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Display a day key as `MM/DD/YYYY` with no timezone conversion. */
export function formatScheduleDayKey(key: string): string {
  if (!DAY_KEY_PATTERN.test(key)) return "";
  const [year, month, day] = key.split("-");
  return `${month}/${day}/${year}`;
}

/**
 * Whole days from `fromKey` to `toKey` (negative when `toKey` is earlier).
 * Both sides are day keys, so the result never depends on the viewer's timezone.
 */
export function daysBetweenScheduleDays(
  fromKey: string,
  toKey: string,
): number {
  const from = scheduleDayKeyToDate(fromKey);
  const to = scheduleDayKeyToDate(toKey);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Today's day key in {@link SCHEDULING_TIME_ZONE}, not the viewer's timezone. */
export function todayScheduleDayKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}
