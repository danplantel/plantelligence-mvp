import { describe, expect, it } from "vitest";

import {
  compareByDaysThenTime,
  dateKeyToUtcDate,
  daysBetweenDateKeys,
  formatDateKey,
  isDateKey,
  isTimeZone,
  localDateKey,
  toDateKey,
  todayDateKey,
} from "@/lib/notifications/date-keys";

describe("date keys", () => {
  it("validates yyyy-MM-dd keys", () => {
    expect(isDateKey("2026-01-31")).toBe(true);
    expect(isDateKey("2026-1-31")).toBe(false);
    expect(isDateKey("")).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it("reduces stored dates to their UTC day", () => {
    expect(toDateKey("2026-03-05T23:30:00-05:00")).toBe("2026-03-06");
    expect(toDateKey(new Date("2026-03-05T00:00:00Z"))).toBe("2026-03-05");
    expect(toDateKey(null)).toBeNull();
    expect(toDateKey("not-a-date")).toBeNull();
  });

  it("formats a day key without timezone conversion", () => {
    expect(formatDateKey("2026-03-05")).toBe("03/05/2026");
    expect(formatDateKey("bad")).toBe("");
  });

  it("builds UTC instants with day offsets", () => {
    expect(dateKeyToUtcDate("2026-01-01").toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(dateKeyToUtcDate("2026-01-01", 2).toISOString()).toBe(
      "2026-01-03T00:00:00.000Z",
    );
    expect(Number.isNaN(dateKeyToUtcDate("bad").getTime())).toBe(true);
  });

  it("counts whole days between keys", () => {
    expect(daysBetweenDateKeys("2026-01-01", "2026-01-08")).toBe(7);
    expect(daysBetweenDateKeys("2026-01-08", "2026-01-01")).toBe(-7);
    expect(daysBetweenDateKeys("bad", "2026-01-01")).toBeNull();
  });

  it("uses the local calendar day for todayDateKey", () => {
    const now = new Date(2026, 2, 5, 23, 59);
    expect(todayDateKey(now)).toBe("2026-03-05");
  });

  it("formats a day key in an explicit time zone", () => {
    expect(localDateKey("2026-03-05T02:00:00Z", "America/New_York")).toBe(
      "2026-03-04",
    );
    expect(localDateKey("2026-03-05T02:00:00Z", null)).toBe("2026-03-05");
    expect(localDateKey("bad", "America/New_York")).toBeNull();
  });

  it("validates IANA time zones", () => {
    expect(isTimeZone("America/New_York")).toBe(true);
    expect(isTimeZone("Not/AZone")).toBe(false);
    expect(isTimeZone(null)).toBe(false);
  });

  it("sorts by days then time", () => {
    const rows = [
      { id: "later", daysUntil: 2, time: "14:00" },
      { id: "same-early", daysUntil: 2, time: "09:00" },
      { id: "today", daysUntil: 0, time: "16:00" },
    ];

    expect([...rows].sort(compareByDaysThenTime).map((row) => row.id)).toEqual([
      "today",
      "same-early",
      "later",
    ]);
  });
});
