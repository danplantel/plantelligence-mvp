import { describe, expect, it } from "vitest";

import {
  buildHubLocationFromForm,
  defaultMeetingScheduleForm,
  formatTime12h,
  getTimezoneAbbr,
  parseDurationPickers,
  parseLocalDate,
  resolveMeetingTypeToSend,
  resolvePlatformForDb,
  resolveRsvpUrl,
  validateMeetingScheduleForm,
  type MeetingScheduleFormData,
} from "@/lib/meetings/meeting-schedule-shared";

function validForm(
  overrides: Partial<MeetingScheduleFormData> = {},
): MeetingScheduleFormData {
  return {
    ...defaultMeetingScheduleForm("Acme Corp"),
    date: "2027-05-10",
    time: "13:30",
    duration: "1 hour",
    format: "Virtual",
    platform: "Zoom",
    meetingLink: "https://zoom.us/j/1",
    ...overrides,
  };
}

describe("parseLocalDate", () => {
  it("parses a bare day key as local midnight", () => {
    const date = parseLocalDate("2027-05-10");

    expect(date.getFullYear()).toBe(2027);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(10);
    expect(date.getHours()).toBe(0);
  });

  it("parses timestamps through Date", () => {
    expect(parseLocalDate("2027-05-10T00:00:00Z").toISOString()).toBe(
      "2027-05-10T00:00:00.000Z",
    );
  });
});

describe("getTimezoneAbbr", () => {
  it("maps US zones and falls back to the zone segment", () => {
    expect(getTimezoneAbbr("America/New_York")).toBe("ET");
    expect(getTimezoneAbbr("America/Chicago")).toBe("CT");
    expect(getTimezoneAbbr("America/Los_Angeles")).toBe("PT");
    expect(getTimezoneAbbr("Europe/Berlin")).toBe("Berlin");
    expect(getTimezoneAbbr("UTC")).toBe("UTC");
  });
});

describe("formatTime12h", () => {
  it("formats midnight, noon, and afternoon times", () => {
    expect(formatTime12h("00:00")).toBe("12:00 AM");
    expect(formatTime12h("09:05")).toBe("9:05 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
    expect(formatTime12h("13:30")).toBe("1:30 PM");
    expect(formatTime12h("23:59")).toBe("11:59 PM");
  });

  it("returns the input for an empty or unparseable value", () => {
    expect(formatTime12h("")).toBe("");
    expect(formatTime12h("bad")).toBe("bad");
  });
});

describe("parseDurationPickers", () => {
  it("extracts the hour and minute picker values", () => {
    expect(parseDurationPickers("2 hours 30 minutes")).toEqual({
      hour: "2",
      minute: "30",
    });
    expect(parseDurationPickers("1 hour")).toEqual({ hour: "1", minute: "0" });
    expect(parseDurationPickers("45 minutes")).toEqual({
      hour: "0",
      minute: "45",
    });
    expect(parseDurationPickers("")).toEqual({ hour: "0", minute: "0" });
  });
});

describe("resolveRsvpUrl", () => {
  it("prefers the RSVP link and falls back to the meeting URL", () => {
    expect(
      resolveRsvpUrl({ meetingLink: "  https://rsvp  ", meetingUrl: "https://meet" }),
    ).toBe("https://rsvp");
    expect(
      resolveRsvpUrl({ meetingLink: " ", meetingUrl: " https://meet " }),
    ).toBe("https://meet");
    expect(resolveRsvpUrl({ meetingLink: "", meetingUrl: "" })).toBe("");
  });
});

describe("validateMeetingScheduleForm", () => {
  it("accepts a complete virtual meeting", () => {
    expect(
      validateMeetingScheduleForm(validForm(), { requireClient: true }),
    ).toEqual({});
  });

  it("requires the client only when asked", () => {
    expect(
      validateMeetingScheduleForm(validForm({ client: "" }), {
        requireClient: true,
      }),
    ).toMatchObject({ client: true });
    expect(
      validateMeetingScheduleForm(validForm({ client: "" }), {
        requireClient: false,
      }),
    ).toEqual({});
  });

  it("requires a name for a custom meeting type", () => {
    expect(
      validateMeetingScheduleForm(
        validForm({ meetingType: "Custom", customMeetingType: "  " }),
        { requireClient: false },
      ),
    ).toMatchObject({ customMeetingType: true });
  });

  it("requires a platform for Virtual and a name for Other", () => {
    expect(
      validateMeetingScheduleForm(validForm({ platform: "" }), {
        requireClient: false,
      }),
    ).toMatchObject({ platform: true });
    expect(
      validateMeetingScheduleForm(
        validForm({ platform: "Other", customPlatform: " " }),
        { requireClient: false },
      ),
    ).toMatchObject({ customPlatform: true });
  });

  it("requires an address for In-Person", () => {
    expect(
      validateMeetingScheduleForm(
        validForm({ format: "In-Person", address: "" }),
        { requireClient: false },
      ),
    ).toMatchObject({ address: true });
    expect(
      validateMeetingScheduleForm(
        validForm({ format: "In-Person", address: "1 Main St" }),
        { requireClient: false },
      ),
    ).not.toHaveProperty("address");
  });

  it("requires an RSVP URL but accepts the meeting URL as a fallback", () => {
    expect(
      validateMeetingScheduleForm(
        validForm({ meetingLink: "", meetingUrl: "" }),
        { requireClient: false },
      ),
    ).toMatchObject({ meetingLink: true });
    expect(
      validateMeetingScheduleForm(
        validForm({ meetingLink: "", meetingUrl: "https://meet" }),
        { requireClient: false },
      ),
    ).not.toHaveProperty("meetingLink");
  });

  it("requires every core field", () => {
    const errors = validateMeetingScheduleForm(
      {
        ...defaultMeetingScheduleForm(""),
        meetingType: "",
        date: "",
        time: "",
        duration: "",
        format: "",
        meetingLink: "",
      },
      { requireClient: true },
    );

    expect(errors).toMatchObject({
      meetingType: true,
      client: true,
      date: true,
      time: true,
      duration: true,
      format: true,
      meetingLink: true,
    });
  });
});

describe("payload helpers", () => {
  it("resolves Custom to its typed name", () => {
    expect(
      resolveMeetingTypeToSend(
        validForm({ meetingType: "Custom", customMeetingType: "  Fireside " }),
      ),
    ).toBe("Fireside");
    expect(resolveMeetingTypeToSend(validForm())).toBe("Open Enrollment");
  });

  it("builds an in-person hub location from all address parts", () => {
    expect(
      buildHubLocationFromForm(
        validForm({
          format: "In-Person",
          address: "1 Main St",
          city: "Austin",
          state: "TX",
          zip: "78701",
        }),
      ),
    ).toBe("1 Main St, Austin, TX, 78701");
    expect(
      buildHubLocationFromForm(
        validForm({ format: "In-Person", address: "1 Main St", city: "", state: "", zip: "" }),
      ),
    ).toBe("1 Main St");
  });

  it("falls back to the virtual link or 'Virtual'", () => {
    expect(
      buildHubLocationFromForm(
        validForm({ format: "Virtual", meetingUrl: "", meetingLink: "https://x" }),
      ),
    ).toBe("https://x");
    expect(
      buildHubLocationFromForm(
        validForm({ format: "Virtual", meetingUrl: "", meetingLink: "" }),
      ),
    ).toBe("Virtual");
  });

  it("resolves the platform stored in the database", () => {
    expect(resolvePlatformForDb(validForm({ format: "In-Person", platform: "Zoom" }))).toBeNull();
    expect(resolvePlatformForDb(validForm({ platform: "Zoom" }))).toBe("Zoom");
    expect(
      resolvePlatformForDb(
        validForm({ platform: "Other", customPlatform: "  Webex " }),
      ),
    ).toBe("Webex");
    expect(resolvePlatformForDb(validForm({ platform: "" }))).toBeNull();
  });
});

describe("defaultMeetingScheduleForm", () => {
  it("seeds the plan name and standard defaults", () => {
    const form = defaultMeetingScheduleForm("Acme Corp");

    expect(form).toMatchObject({
      meetingType: "Open Enrollment",
      client: "Acme Corp",
      timezone: "America/New_York",
      displayOnPortal: true,
      duration: "",
      format: "",
    });
    expect(form.description.length).toBeGreaterThan(0);
  });
});
