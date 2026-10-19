import { describe, expect, it } from "vitest";

import {
  computeStartAtUtc,
  getMeetingSortInstantMs,
  legacyMeetingInstantMs,
  resolveMeetingStartMs,
} from "@/lib/meeting-start-at";

describe("computeStartAtUtc", () => {
  it("converts a New York winter time to UTC", () => {
    expect(computeStartAtUtc("2027-01-15", "13:30", "America/New_York")?.toISOString()).toBe(
      "2027-01-15T18:30:00.000Z",
    );
  });

  it("respects daylight saving time", () => {
    expect(computeStartAtUtc("2027-05-10", "13:30", "America/New_York")?.toISOString()).toBe(
      "2027-05-10T17:30:00.000Z",
    );
  });

  it("handles other US zones", () => {
    expect(computeStartAtUtc("2027-05-10", "13:30", "America/Chicago")?.toISOString()).toBe(
      "2027-05-10T18:30:00.000Z",
    );
    expect(
      computeStartAtUtc("2027-05-10", "13:30", "America/Los_Angeles")?.toISOString(),
    ).toBe("2027-05-10T20:30:00.000Z");
  });

  it("defaults to New York when no timezone is supplied", () => {
    expect(computeStartAtUtc("2027-05-10", "13:30", null)?.toISOString()).toBe(
      "2027-05-10T17:30:00.000Z",
    );
    expect(computeStartAtUtc("2027-05-10", "13:30", "   ")?.toISOString()).toBe(
      "2027-05-10T17:30:00.000Z",
    );
  });

  it("accepts seconds-bearing 24-hour times", () => {
    expect(
      computeStartAtUtc("2027-05-10", "13:30:00", "America/New_York")?.toISOString(),
    ).toBe("2027-05-10T17:30:00.000Z");
  });

  it("parses '1:30 PM' as 01:30 because the H:mm format matches first (current behavior)", () => {
    // TIME_FORMATS tries "H:mm" before "h:mm A"; dayjs accepts the numeric
    // prefix and ignores the trailing "PM", so the afternoon time is lost.
    expect(
      computeStartAtUtc("2027-05-10", "1:30 PM", "America/New_York")?.toISOString(),
    ).toBe("2027-05-10T05:30:00.000Z");
  });

  it("returns null for missing or unparseable input", () => {
    expect(computeStartAtUtc("", "13:30", "America/New_York")).toBeNull();
    expect(computeStartAtUtc("2027-05-10", "", "America/New_York")).toBeNull();
    expect(computeStartAtUtc("2027-05-10", "not-a-time", "America/New_York")).toBeNull();
    expect(computeStartAtUtc("bad-date", "13:30", "America/New_York")).toBeNull();
  });
});

describe("legacyMeetingInstantMs", () => {
  it("interprets the date and time in the runtime's local zone", () => {
    const expected = new Date(2027, 4, 10, 13, 30, 0, 0).getTime();

    expect(
      legacyMeetingInstantMs({ date: "2027-05-10", time: "13:30" }),
    ).toBe(expected);
    expect(
      legacyMeetingInstantMs({
        date: new Date(2027, 4, 10),
        time: "13:30",
      }),
    ).toBe(expected);
  });

  it("returns null for an incomplete or invalid time", () => {
    expect(legacyMeetingInstantMs({ date: "2027-05-10", time: "13" })).toBeNull();
    expect(legacyMeetingInstantMs({ date: "2027-05-10", time: "bad" })).toBeNull();
  });
});

describe("getMeetingSortInstantMs", () => {
  it("prefers a valid stored startAtUtc", () => {
    expect(
      getMeetingSortInstantMs({
        startAtUtc: "2027-05-10T17:30:00.000Z",
        date: "2027-05-01",
        time: "09:00",
      }),
    ).toBe(Date.parse("2027-05-10T17:30:00.000Z"));
  });

  it("falls back to the legacy local instant", () => {
    const expected = new Date(2027, 4, 10, 13, 30, 0, 0).getTime();

    expect(
      getMeetingSortInstantMs({
        startAtUtc: null,
        date: "2027-05-10",
        time: "13:30",
      }),
    ).toBe(expected);
    expect(
      getMeetingSortInstantMs({
        startAtUtc: "not-a-date",
        date: "2027-05-10",
        time: "13:30",
      }),
    ).toBe(expected);
  });
});

describe("resolveMeetingStartMs", () => {
  it("uses a valid stored startAtUtc", () => {
    expect(
      resolveMeetingStartMs({
        startAtUtc: new Date("2027-05-10T17:30:00.000Z"),
        date: "2027-05-01",
        time: "09:00",
        timezone: "America/Chicago",
      }),
    ).toBe(Date.parse("2027-05-10T17:30:00.000Z"));
  });

  it("derives the instant with the meeting's timezone when the field is missing", () => {
    expect(
      resolveMeetingStartMs({
        startAtUtc: null,
        date: "2027-05-10",
        time: "13:30",
        timezone: "America/Chicago",
      }),
    ).toBe(Date.parse("2027-05-10T18:30:00.000Z"));
  });

  it("returns null when the day key cannot be derived", () => {
    expect(
      resolveMeetingStartMs({
        startAtUtc: null,
        date: "not-a-date",
        time: "13:30",
        timezone: "America/New_York",
      }),
    ).toBeNull();
  });
});
