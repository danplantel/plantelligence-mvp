import { scheduleDayKeyToDate, todayScheduleDayKey } from "@/lib/date";

/**
 * Meeting `date` values are persisted as date-only scheduling days — a `yyyy-MM-dd`
 * string passed through `new Date()`, which lands on UTC midnight (see lib/date.ts).
 *
 * That means the week window has to be built from day keys and converted back into
 * UTC-midnight bounds. Comparing against the current instant instead would drop every
 * meeting scheduled for today the moment the clock passed midnight UTC.
 */

/** Statuses excluded from the week's totals — a cancelled meeting is not a meeting. */
const EXCLUDED_STATUSES = ["Cancelled", "Canceled"];

const pad = (value: number) => String(value).padStart(2, "0");

/** `yyyy-MM-dd` for a local-midnight Date, avoiding the shift `toISOString` introduces. */
const toDayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export interface SchedulingWeekRange {
  /** Sunday of the current scheduling week, `yyyy-MM-dd`. */
  startKey: string;
  /** Saturday of the current scheduling week, `yyyy-MM-dd`. */
  endKey: string;
  /** UTC-midnight bounds matching how meeting dates are stored. */
  startUtc: Date;
  endUtc: Date;
}

/**
 * The scheduling week (Sunday–Saturday, in `SCHEDULING_TIME_ZONE`) containing `now`.
 *
 * Sunday is the week start to match the calendar grid, which builds its cells with
 * `weekStartsOn: 0` in the meetings view.
 */
export function getSchedulingWeekRange(
  now: Date = new Date(),
): SchedulingWeekRange {
  const todayKey = todayScheduleDayKey(now) || toDayKey(now);
  const today = scheduleDayKeyToDate(todayKey);

  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startKey = toDayKey(start);
  const endKey = toDayKey(end);

  return {
    startKey,
    endKey,
    startUtc: new Date(`${startKey}T00:00:00.000Z`),
    endUtc: new Date(`${endKey}T23:59:59.999Z`),
  };
}

/**
 * Prisma `where` for a user's meetings in the current scheduling week.
 *
 * Shared by `/api/dashboard/stats` and `/api/dashboard/meetings-this-week` so the tile's
 * count and the list it expands into are always defined by the same rule.
 */
export function meetingsThisWeekWhere(userId: string, now: Date = new Date()) {
  const { startUtc, endUtc } = getSchedulingWeekRange(now);

  return {
    userId,
    archived: false,
    status: { notIn: EXCLUDED_STATUSES },
    date: { gte: startUtc, lte: endUtc },
  };
}
