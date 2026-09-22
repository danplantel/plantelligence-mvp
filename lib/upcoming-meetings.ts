import { todayScheduleDayKey } from "@/lib/date";

/**
 * Query for a user's upcoming meetings.
 *
 * Two date representations have to be reconciled. `Meeting.startAtUtc` is the true instant
 * (date + time + timezone, via lib/meeting-start-at.ts) and is the precise thing to compare
 * against the clock — but it is nullable, so rows created before it was populated cannot be
 * filtered with it alone. `Meeting.date` is always present but is a date-only scheduling day
 * stored at UTC midnight (see lib/date.ts), so comparing it to the current instant would drop
 * every meeting happening later today.
 *
 * This module therefore narrows to a day-scoped superset, and the route resolves each row's
 * instant with `resolveMeetingStartMs` to apply the exact-time cut. That keeps every row
 * reachable regardless of which fields it happens to carry.
 */

/**
 * Statuses that are never "upcoming".
 *
 * Deliberately a deny-list. The status vocabulary here is inconsistent — the meetings page
 * writes `"Upcoming"`, the API falls back to `"Upcoming"`, the Prisma comment claims
 * `"Scheduled, Completed, Cancelled"`, and its status filter offers `Upcoming / Past /
 * Draft` — so an allow-list silently matches nothing the moment the stored wording differs
 * from the guess. Enumerating only what must be excluded keeps unknown or legacy values
 * visible, and the date window is what actually decides "upcoming".
 */
const NON_UPCOMING_STATUSES = [
  "Draft",
  "Cancelled",
  "Canceled",
  "Past",
  "Completed",
];

const pad = (value: number) => String(value).padStart(2, "0");

/** UTC midnight for `now`'s scheduling day, falling back to its UTC day. */
export function startOfSchedulingDayUtc(now: Date = new Date()): Date {
  const key = todayScheduleDayKey(now);
  if (key) return new Date(`${key}T00:00:00.000Z`);

  return new Date(
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T00:00:00.000Z`,
  );
}

/**
 * Prisma `where` for a user's *candidate* upcoming meetings — a superset the caller must
 * narrow by exact start time.
 *
 * The day-scoped window is the most this query can express: a row with no stored instant has
 * nothing to compare, and `date` is only a day. Keeping it inclusive also means no meeting is
 * ever hidden by a field it does not carry.
 */
export function upcomingMeetingsWhere(userId: string, now: Date = new Date()) {
  return {
    userId,
    // `not: true` rather than `false`: it excludes only rows explicitly archived, and still
    // matches documents written before the `archived` field existed.
    archived: { not: true },
    status: { notIn: [...NON_UPCOMING_STATUSES] },
    date: { gte: startOfSchedulingDayUtc(now) },
  };
}
