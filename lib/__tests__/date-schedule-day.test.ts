import { describe, expect, it } from "vitest";

import {
  daysBetweenScheduleDays,
  formatScheduleDayKey,
  scheduleDayKeyToDate,
  toScheduleDayKey,
  todayScheduleDayKey,
} from "@/lib/date";

describe("toScheduleDayKey", () => {
  it("returns a bare day key unchanged", () => {
    expect(toScheduleDayKey("2027-05-10")).toBe("2027-05-10");
    expect(toScheduleDayKey(" 2027-05-10 ")).toBe("2027-05-10");
  });

  it("reduces instants to their UTC day", () => {
    expect(toScheduleDayKey("2027-05-10T23:59:59Z")).toBe("2027-05-10");
    expect(toScheduleDayKey("2027-05-11T00:00:00Z")).toBe("2027-05-11");
    expect(toScheduleDayKey(new Date("2027-05-10T12:00:00Z"))).toBe("2027-05-10");
  });

  it("returns an empty string for missing or invalid values", () => {
    expect(toScheduleDayKey(null)).toBe("");
    expect(toScheduleDayKey(undefined)).toBe("");
    expect(toScheduleDayKey("")).toBe("");
    expect(toScheduleDayKey("not-a-date")).toBe("");
  });
});

describe("scheduleDayKeyToDate", () => {
  it("builds local midnight for a day key", () => {
    const date = scheduleDayKeyToDate("2027-05-10");

    expect(date.getFullYear()).toBe(2027);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(10);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("round-trips through toScheduleDayKey for local dates", () => {
    const date = scheduleDayKeyToDate("2027-05-10");

    expect(toScheduleDayKey(date)).toBe("2027-05-10");
  });
});

describe("formatScheduleDayKey", () => {
  it("formats as MM/DD/YYYY without timezone conversion", () => {
    expect(formatScheduleDayKey("2027-05-10")).toBe("05/10/2027");
    expect(formatScheduleDayKey("2027-12-31")).toBe("12/31/2027");
  });

  it("returns an empty string for an invalid key", () => {
    expect(formatScheduleDayKey("2027-5-10")).toBe("");
    expect(formatScheduleDayKey("")).toBe("");
  });
});

describe("daysBetweenScheduleDays", () => {
  it("measures whole days between keys in either direction", () => {
    expect(daysBetweenScheduleDays("2027-05-10", "2027-05-12")).toBe(2);
    expect(daysBetweenScheduleDays("2027-05-12", "2027-05-10")).toBe(-2);
    expect(daysBetweenScheduleDays("2027-05-10", "2027-05-10")).toBe(0);
  });

  it("crosses month and leap-year boundaries", () => {
    expect(daysBetweenScheduleDays("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetweenScheduleDays("2027-12-31", "2028-01-01")).toBe(1);
  });
});

describe("todayScheduleDayKey", () => {
  it("uses the US scheduling day, not the viewer's UTC day", () => {
    // 03:30 UTC is still the previous evening in New York (EDT).
    expect(todayScheduleDayKey(new Date("2027-05-10T03:30:00Z"))).toBe(
      "2027-05-09",
    );
    // 05:00 UTC is 01:00 in New York.
    expect(todayScheduleDayKey(new Date("2027-05-10T05:00:00Z"))).toBe(
      "2027-05-10",
    );
  });

  it("handles both sides of DST", () => {
    // 06:30 UTC on 2027-03-14 is 01:30 EST (before the 2am switch).
    expect(todayScheduleDayKey(new Date("2027-03-14T06:30:00Z"))).toBe(
      "2027-03-14",
    );
    // 05:30 UTC on 2027-11-07 is 01:30 EDT.
    expect(todayScheduleDayKey(new Date("2027-11-07T05:30:00Z"))).toBe(
      "2027-11-07",
    );
  });
});
