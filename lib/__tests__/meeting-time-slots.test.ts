import { describe, expect, it } from "vitest";

import {
  TIME_OPTIONS,
  formatMeetingDuration,
  formatTimeAbbrev,
  indexOfClosestInList,
  minutesBetweenTimes,
  parseTimeInput,
} from "@/lib/meetings/time-slots";

/**
 * The meeting form's time arithmetic, lifted out of the Meetings page so the
 * portal's Schedule a Meeting modal can offer the same picker. These are the
 * rules that picker leans on: what a typed time means, which slot is "closest",
 * and how a duration reads.
 */
describe("parseTimeInput", () => {
  it("reads a 12-hour time with am/pm", () => {
    expect(parseTimeInput("1:30pm")).toBe("13:30");
    expect(parseTimeInput("1:30 pm")).toBe("13:30");
    expect(parseTimeInput("12am")).toBe("00:00");
    expect(parseTimeInput("2pm")).toBe("14:00");
  });

  it("reads the compact and 24-hour forms", () => {
    expect(parseTimeInput("1330")).toBe("13:30");
    expect(parseTimeInput("1:30")).toBe("01:30");
    expect(parseTimeInput("13:30")).toBe("13:30");
    expect(parseTimeInput("130pm")).toBe("13:30");
  });

  it("refuses what it cannot read", () => {
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("half past one")).toBeNull();
    expect(parseTimeInput("25:00")).toBeNull();
    expect(parseTimeInput("1:99pm")).toBeNull();
  });
});

describe("minutesBetweenTimes", () => {
  it("measures a same-day span", () => {
    expect(minutesBetweenTimes("09:00", "10:30")).toBe(90);
  });

  it("is 0 when reversed or missing", () => {
    expect(minutesBetweenTimes("10:30", "09:00")).toBe(0);
    expect(minutesBetweenTimes("", "10:30")).toBe(0);
  });
});

describe("formatMeetingDuration", () => {
  it("prints hours the way the card does", () => {
    expect(formatMeetingDuration(90)).toBe("1.5 hours");
    expect(formatMeetingDuration(60)).toBe("1 hour");
    expect(formatMeetingDuration(120)).toBe("2 hours");
    expect(formatMeetingDuration(30)).toBe("30 minutes");
  });
});

describe("formatTimeAbbrev", () => {
  it("prints a compact 12-hour label", () => {
    expect(formatTimeAbbrev("13:30")).toBe("1:30pm");
    expect(formatTimeAbbrev("00:15")).toBe("12:15am");
  });
});

describe("indexOfClosestInList", () => {
  it("finds the quarter-hour slot nearest a value", () => {
    // 13:30 is slot 54 of 96.
    expect(indexOfClosestInList("13:31", TIME_OPTIONS)).toBe(54);
    expect(indexOfClosestInList("13:29", TIME_OPTIONS)).toBe(54);
  });

  it("has no answer without a value", () => {
    expect(indexOfClosestInList("", TIME_OPTIONS)).toBe(-1);
  });
});
