import { describe, expect, it } from "vitest";

import { formatMeetingDay, formatMeetingTime } from "@/lib/meeting-display";
import {
  daysBetweenScheduleDays,
  scheduleDayKeyToDate,
  todayScheduleDayKey,
} from "@/lib/date";

describe("formatMeetingTime", () => {
  it("formats a 24-hour time with the scheduling-zone abbreviation", () => {
    expect(formatMeetingTime("12:00", "America/New_York")).toBe("12:00 PM ET");
    expect(formatMeetingTime("09:05", "America/Chicago")).toBe("9:05 AM CT");
    expect(formatMeetingTime("13:45", "America/Denver")).toBe("1:45 PM MT");
  });

  it("handles midnight and noon", () => {
    expect(formatMeetingTime("00:05")).toBe("12:05 AM");
    expect(formatMeetingTime("12:05")).toBe("12:05 PM");
  });

  it("omits an unknown timezone and fills missing minutes", () => {
    expect(formatMeetingTime("13:45", "Europe/Berlin")).toBe("1:45 PM");
    expect(formatMeetingTime("9")).toBe("9:00 AM");
  });

  it("returns the stored value when the hour is not numeric", () => {
    expect(formatMeetingTime("nope", "America/New_York")).toBe("nope");
  });
});

describe("formatMeetingDay", () => {
  function offsetKey(days: number): string {
    const key = todayScheduleDayKey();
    const date = scheduleDayKeyToDate(key);
    const shifted = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + days,
    );
    const y = shifted.getFullYear();
    const m = String(shifted.getMonth() + 1).padStart(2, "0");
    const d = String(shifted.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  it("labels today and tomorrow relative to the scheduling day", () => {
    expect(formatMeetingDay(todayScheduleDayKey())).toBe("Today");
    expect(formatMeetingDay(offsetKey(1))).toBe("Tomorrow");
    expect(
      daysBetweenScheduleDays(todayScheduleDayKey(), offsetKey(1)),
    ).toBe(1);
  });

  it("formats other days without a timezone shift", () => {
    const key = offsetKey(5);

    expect(formatMeetingDay(key)).toMatch(/^\w{3}, \w{3} \d{1,2}$/);
    expect(formatMeetingDay(`${key}T23:59:59Z`)).toBe(formatMeetingDay(key));
  });

  it("returns an empty string for missing or invalid values", () => {
    expect(formatMeetingDay(null)).toBe("");
    expect(formatMeetingDay(undefined)).toBe("");
    expect(formatMeetingDay("")).toBe("");
    expect(formatMeetingDay("not-a-date")).toBe("");
  });
});
