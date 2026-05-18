import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

// Order: 24h first (common from <input type="time">), then 12h with AM/PM
const TIME_FORMATS = [
  "HH:mm:ss",
  "H:mm:ss",
  "HH:mm",
  "H:mm",
  "h:mm A",
  "hh:mm A",
];

/**
 * Parse calendar date (YYYY-MM-DD) + time + IANA tz into UTC Date for sorting.
 * dayjs.tz / utc().toDate() can throw RangeError for edge parses — never propagate.
 */
export function computeStartAtUtc(
  dateStr: string,
  timeStr: string,
  tz: string | null | undefined,
): Date | null {
  const d = dateStr.trim();
  const t = timeStr.trim().replace(/\s+/g, " ");
  if (!d || !t) return null;

  const zone =
    tz && tz.trim().length > 0 ? tz.trim() : "America/New_York";

  for (const tf of TIME_FORMATS) {
    try {
      const parsed = dayjs.tz(`${d} ${t}`, `YYYY-MM-DD ${tf}`, zone);
      if (!parsed || !parsed.isValid()) continue;
      const out = parsed.utc().toDate();
      if (Number.isNaN(out.getTime())) continue;
      return out;
    } catch {
      continue;
    }
  }
  return null;
}

function parseYmd(d: Date | string): { y: number; m: number; day: number } {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, day] = d.slice(0, 10).split("-").map(Number);
    return { y, m, day };
  }
  const x = new Date(d);
  return { y: x.getFullYear(), m: x.getMonth() + 1, day: x.getDate() };
}

/**
 * Fallback when startAtUtc is missing: local browser/server interpretation (legacy behavior).
 */
export function legacyMeetingInstantMs(input: {
  date: Date | string;
  time: string;
}): number | null {
  const { y, m, day } = parseYmd(input.date);
  const meetingDate = new Date(y, m - 1, day);
  const parts = input.time.split(":");
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  meetingDate.setHours(hours, minutes, 0, 0);
  return meetingDate.getTime();
}

export function getMeetingSortInstantMs(input: {
  startAtUtc: Date | string | null | undefined;
  date: Date | string;
  time: string;
}): number | null {
  if (input.startAtUtc) {
    const t = new Date(input.startAtUtc).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return legacyMeetingInstantMs({ date: input.date, time: input.time });
}
