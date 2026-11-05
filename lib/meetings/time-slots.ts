/**
 * The meeting form's time arithmetic — one set of rules for the quarter-hour
 * slots, the typed input and the derived duration.
 *
 * Lifted out of `app/(dashboard)/communications/meetings/page.tsx` so the portal
 * can offer the same Google-Calendar-style picker without a second copy of the
 * parsing (which is the part that is easy to get subtly wrong).
 */

/** Every quarter hour of the day, as "HH:MM" with a 12-hour label. */
export const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15;
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const ampm = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    value: `${hour24.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`,
    label: `${hour12}:${minute.toString().padStart(2, "0")}${ampm}`,
  };
});

/** Pixel height of one time row (py-1.5 + text-sm line-height). */
export const TIME_ROW_HEIGHT = 32;
/** How many rows the list shows at once. */
export const TIME_VISIBLE_ROWS = 5;

/** Compact time label like Google Calendar ("1:00am", "1:15pm"). */
export function formatTimeAbbrev(time24: string): string {
  const [hour, minute] = time24.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return "";
  const ampm = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")}${ampm}`;
}

/**
 * Parse a typed time into "HH:MM" (24h), or null.
 *
 * Accepts "1:30pm", "1:30 pm", "1:30p", "13:30", "1330", "130pm", "2pm",
 * "2 pm" and a bare "1:30" (read as 24-hour).
 */
export function parseTimeInput(text: string): string | null {
  const raw = text.trim().toLowerCase();
  if (!raw) return null;

  let ampm: "am" | "pm" | null = null;
  let body = raw;
  const ampmMatch = raw.match(/([ap])\.?m?\.?\s*$/);
  if (ampmMatch) {
    ampm = ampmMatch[1] === "a" ? "am" : "pm";
    body = raw.slice(0, ampmMatch.index).replace(/\s+$/, "").trim();
  }

  const toValue = (hour: number, minute: number) => {
    if (minute > 59) return null;
    if (ampm) {
      if (hour < 1 || hour > 12) return null;
      hour =
        ampm === "pm" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
    } else if (hour > 23) {
      return null;
    }
    return `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`;
  };

  const colon = body.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) return toValue(Number(colon[1]), Number(colon[2]));

  const military = body.match(/^(\d{3,4})$/);
  if (military) {
    const digits = military[1];
    return toValue(Number(digits.slice(0, -2)), Number(digits.slice(-2)));
  }

  const hourOnly = body.match(/^(\d{1,2})$/);
  if (hourOnly && ampm) return toValue(Number(hourOnly[1]), 0);

  return null;
}

/** Split a "HH:MM" time into 12-hour picker fields. */
export function timeToFields(time24: string): {
  hour: string;
  minute: string;
  ampm: string;
} {
  const [hour, minute] = time24.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return { hour: "", minute: "", ampm: "" };
  }
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return { hour: hour12.toString(), minute: minute.toString().padStart(2, "0"), ampm };
}

/** Index (within `options`) of the slot closest to a "HH:MM" value; -1 if none. */
export function indexOfClosestInList(
  value: string,
  options: typeof TIME_OPTIONS,
): number {
  if (!value) return -1;
  const [hour, minute] = value.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return -1;
  const target = hour * 60 + minute;
  let best = -1;
  let bestDiff = Infinity;
  options.forEach((option, index) => {
    const [optionHour, optionMinute] = option.value.split(":").map(Number);
    const diff = Math.abs(optionHour * 60 + optionMinute - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = index;
    }
  });
  return best;
}

/** Minutes between two "HH:MM" times on the same day; 0 when invalid or reversed. */
export function minutesBetweenTimes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return 0;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  return endMinutes > startMinutes ? endMinutes - startMinutes : 0;
}

/** A duration in minutes as the card prints it ("2 hours", "1.5 hours"). */
export function formatMeetingDuration(minutes: number): string {
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} ${rest === 1 ? "minute" : "minutes"}`;
  if (rest === 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  if (rest === 30) return `${hours}.5 hours`;
  return `${hours} ${hours === 1 ? "hour" : "hours"} ${rest} ${
    rest === 1 ? "minute" : "minutes"
  }`;
}
