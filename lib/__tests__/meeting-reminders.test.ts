import { describe, expect, it } from "vitest";

import {
  MEETING_REMINDER_EXCLUDED_STATUSES,
  MEETING_REMINDER_LABEL,
  MEETING_REMINDER_LIMIT,
  MEETING_REMINDER_TIERS,
  MEETING_REMINDER_WINDOW_DAYS,
  compareMeetingReminders,
  dateKeyToUtcDate,
  daysBetweenDateKeys,
  formatDateKey,
  formatMeetingReminderWhen,
  formatReminderDateKey,
  isDateKey,
  resolveMeetingReminderStatus,
  toMeetingDateKey,
} from "@/lib/notifications/meeting-reminders";

describe("meeting reminder constants", () => {
  it("exposes the reminder tiers, window, limit, and excluded statuses", () => {
    expect(MEETING_REMINDER_TIERS).toEqual([0, 2, 7]);
    expect(MEETING_REMINDER_WINDOW_DAYS).toBe(7);
    expect(MEETING_REMINDER_LIMIT).toBe(20);
    expect(MEETING_REMINDER_EXCLUDED_STATUSES).toEqual(["Draft", "Cancelled"]);
    expect(MEETING_REMINDER_LABEL).toEqual({
      today: "Today",
      in_2days: "In 2 days",
      in_week: "In 7 days",
    });
  });

  it("maps only the exact tier offsets to a reminder status", () => {
    expect(resolveMeetingReminderStatus(0)).toBe("today");
    expect(resolveMeetingReminderStatus(2)).toBe("in_2days");
    expect(resolveMeetingReminderStatus(7)).toBe("in_week");
    for (const offset of [-1, 1, 3, 6, 8]) {
      expect(resolveMeetingReminderStatus(offset)).toBeNull();
    }
  });
});

describe("date-key helpers", () => {
  it("recognizes well-formed day keys", () => {
    expect(isDateKey("2027-05-10")).toBe(true);
    expect(isDateKey("2027-5-10")).toBe(false);
    expect(isDateKey("")).toBe(false);
    expect(isDateKey(null)).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
  });

  it("derives the UTC day key from dates and strings", () => {
    expect(toMeetingDateKey(new Date("2027-05-10T23:00:00Z"))).toBe("2027-05-10");
    expect(toMeetingDateKey("2027-05-10T00:00:00Z")).toBe("2027-05-10");
    expect(toMeetingDateKey(null)).toBeNull();
    expect(toMeetingDateKey("")).toBeNull();
    expect(toMeetingDateKey("not-a-date")).toBeNull();
  });

  it("measures whole days between keys", () => {
    expect(daysBetweenDateKeys("2027-05-10", "2027-05-12")).toBe(2);
    expect(daysBetweenDateKeys("2027-05-12", "2027-05-10")).toBe(-2);
    expect(daysBetweenDateKeys("2027-05-10", "2027-05-10")).toBe(0);
    expect(daysBetweenDateKeys("bad", "2027-05-10")).toBeNull();
  });

  it("formats a key without timezone conversion", () => {
    expect(formatDateKey("2027-05-10")).toBe("05/10/2027");
    expect(formatReminderDateKey("2027-05-10")).toBe("05/10/2027");
    expect(formatDateKey("bad")).toBe("");
  });

  it("builds a UTC instant from a key with a day offset", () => {
    expect(dateKeyToUtcDate("2027-05-10")).toEqual(
      new Date("2027-05-10T00:00:00.000Z"),
    );
    expect(dateKeyToUtcDate("2027-05-10", -1)).toEqual(
      new Date("2027-05-09T00:00:00.000Z"),
    );
    expect(dateKeyToUtcDate("2027-05-10", 8)).toEqual(
      new Date("2027-05-18T00:00:00.000Z"),
    );
  });
});

describe("compareMeetingReminders", () => {
  it("orders by days remaining, then start time", () => {
    const items = [
      { daysUntil: 2, time: "16:00" },
      { daysUntil: 2, time: "09:00" },
      { daysUntil: 0, time: "17:00" },
      { daysUntil: 7, time: "08:00" },
    ];

    expect(
      [...items].sort(compareMeetingReminders).map((i) => `${i.daysUntil}-${i.time}`),
    ).toEqual(["0-17:00", "2-09:00", "2-16:00", "7-08:00"]);
  });

  it("treats a missing time as the earliest slot", () => {
    const items = [{ daysUntil: 0, time: "09:00" }, { daysUntil: 0 }];

    expect([...items].sort(compareMeetingReminders)[0]).toEqual({ daysUntil: 0 });
  });
});

describe("formatMeetingReminderWhen", () => {
  it("shows only the clock for today's reminder", () => {
    expect(
      formatMeetingReminderWhen("2027-05-10", "13:00", "America/New_York", "today"),
    ).toBe("1:00 PM ET");
  });

  it("shows the date and clock for future reminders", () => {
    expect(
      formatMeetingReminderWhen("2027-09-17", "13:00", "America/Chicago", "in_week"),
    ).toBe("09/17/2027 at 1:00 PM CT");
  });

  it("omits the timezone when none is supplied", () => {
    expect(
      formatMeetingReminderWhen("2027-09-17", "09:30", null, "in_2days"),
    ).toBe("09/17/2027 at 9:30 AM");
  });

  it("shows only the date when the time is empty", () => {
    expect(formatMeetingReminderWhen("2027-09-17", "", "America/New_York", "in_week")).toBe(
      "09/17/2027",
    );
  });

  it("falls back to the clock alone when the status is present but time is empty", () => {
    expect(
      formatMeetingReminderWhen("2027-05-10", "", "America/New_York", "today"),
    ).toBe("");
  });
});
