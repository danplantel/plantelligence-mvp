/**
 * Calendar-day key helpers shared by the header notification reminder types
 * (meetings and documents).
 *
 * Reminder tiers are "N days away" questions, so every comparison is made
 * between `yyyy-MM-dd` keys rather than raw `Date` instants. That matches how
 * these dates are persisted — `Meeting.date` and `Document.expirationDate` are
 * both written from `yyyy-MM-dd` strings and therefore land on UTC midnight —
 * and it removes off-by-one-day drift for users west of UTC.
 */

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** True when `value` is a well-formed `yyyy-MM-dd` key. */
export function isDateKey(value: string | null | undefined): boolean {
  return !!value && DATE_KEY_PATTERN.test(value);
}

/**
 * Calendar-day key for a stored date. Uses the UTC date portion so a value
 * persisted from `yyyy-MM-dd` reads back as the same calendar day.
 */
export function toDateKey(
  input: Date | string | null | undefined,
): string | null {
  if (input === null || input === undefined || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Calendar-day key for an instant **as seen in `timeZone`** (IANA name).
 *
 * This mirrors the browser-local day math the dashboard pages use — i.e.
 * `new Date(x)` followed by `setHours(0, 0, 0, 0)` — which is the interpretation
 * the reminder tiers must agree with. Falls back to the UTC date portion when no
 * zone is supplied or the zone is not supported.
 */
export function localDateKey(
  input: Date | string | null | undefined,
  timeZone?: string | null,
): string | null {
  if (input === null || input === undefined || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  if (!timeZone) return toDateKey(date);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) return toDateKey(date);
    return `${year}-${month}-${day}`;
  } catch {
    return toDateKey(date);
  }
}

/** True when `value` is a usable IANA time zone name (e.g. `America/New_York`). */
export function isTimeZone(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Local `yyyy-MM-dd` key for `now`. Called on the client so reminder tiers
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

/** Display a date key as `MM/DD/YYYY` without any timezone conversion. */
export function formatDateKey(key: string): string {
  if (!isDateKey(key)) return "";
  const [year, month, day] = key.split("-");
  return `${month}/${day}/${year}`;
}

/** Urgency order (soonest first), then earliest time of day. */
export function compareByDaysThenTime<
  T extends { daysUntil: number; time?: string },
>(a: T, b: T): number {
  if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
  return (a.time || "").localeCompare(b.time || "");
}
