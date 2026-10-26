import { describe, expect, it } from "vitest";

import {
  coerceToHttpUrl,
  firstRegisterableUrl,
  formatTime12h,
  getEmbedUrl,
  guessLanguageFromWebinar,
  hubDateKey,
  mapHubMeetingToWebinar,
} from "../videos-card-section";

/**
 * The pure helpers behind the portal's webinar cards.
 *
 * They decide what a participant can actually click and what date/time they
 * read — a bare-host registration URL has to become a real link, a pasted
 * `mailto:` must not, a `YYYY-MM-DD` date must not shift a day across time
 * zones, and a URL-shaped location must not also render as a street address.
 */

describe("formatTime12h", () => {
  it("formats 24h times as 12h with AM/PM", () => {
    expect(formatTime12h("09:30")).toBe("9:30 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
    expect(formatTime12h("13:05")).toBe("1:05 PM");
    expect(formatTime12h("23:59")).toBe("11:59 PM");
  });

  it("renders midnight as 12 AM", () => {
    expect(formatTime12h("00:05")).toBe("12:05 AM");
  });

  it("returns an empty string for an empty value", () => {
    expect(formatTime12h("")).toBe("");
  });

  it("passes an unparseable value through instead of rendering NaN", () => {
    expect(formatTime12h("not-a-time")).toBe("not-a-time");
    expect(formatTime12h("9")).toBe("9");
  });
});

describe("coerceToHttpUrl", () => {
  it("assumes https for a bare host or host/path", () => {
    expect(coerceToHttpUrl("example.com")).toBe("https://example.com");
    expect(coerceToHttpUrl("example.com/register")).toBe(
      "https://example.com/register",
    );
    expect(coerceToHttpUrl("  example.com  ")).toBe("https://example.com");
  });

  it("leaves an existing http(s) URL alone", () => {
    expect(coerceToHttpUrl("https://example.com/x")).toBe(
      "https://example.com/x",
    );
    expect(coerceToHttpUrl("HTTP://EXAMPLE.COM")).toBe("HTTP://EXAMPLE.COM");
  });

  it("refuses values that are not web URLs", () => {
    expect(coerceToHttpUrl("")).toBeUndefined();
    expect(coerceToHttpUrl("   ")).toBeUndefined();
    expect(coerceToHttpUrl("not a url.example")).toBeUndefined();
    expect(coerceToHttpUrl("a.b")).toBeUndefined();
    expect(coerceToHttpUrl("mailto:me@example.com")).toBeUndefined();
    expect(coerceToHttpUrl("javascript:alert(1)")).toBeUndefined();
  });
});

describe("firstRegisterableUrl", () => {
  it("returns the first usable candidate, coercing a bare host", () => {
    expect(firstRegisterableUrl("register.test", "https://meet.test")).toBe(
      "https://register.test",
    );
  });

  it("skips missing and unusable candidates", () => {
    expect(
      firstRegisterableUrl(undefined, "", "not a url", "https://meet.test"),
    ).toBe("https://meet.test");
  });

  it("returns undefined when nothing is usable", () => {
    expect(
      firstRegisterableUrl(undefined, "", "no scheme here"),
    ).toBeUndefined();
  });
});

describe("hubDateKey", () => {
  it("keeps a date-only value as-is and truncates a full timestamp", () => {
    expect(hubDateKey("2026-05-10")).toBe("2026-05-10");
    expect(hubDateKey("2026-05-10T23:30:00.000Z")).toBe("2026-05-10");
  });
});

describe("getEmbedUrl", () => {
  it("converts YouTube watch and short URLs to their embed form", () => {
    expect(getEmbedUrl("https://www.youtube.com/watch?v=abc123&t=30")).toBe(
      "https://www.youtube.com/embed/abc123",
    );
    expect(getEmbedUrl("https://youtu.be/xyz789")).toBe(
      "https://www.youtube.com/embed/xyz789",
    );
  });

  it("converts Vimeo URLs to the player URL", () => {
    expect(getEmbedUrl("https://vimeo.com/123456")).toBe(
      "https://player.vimeo.com/video/123456",
    );
  });

  it("returns null for anything that is not YouTube or Vimeo", () => {
    expect(getEmbedUrl("https://cdn.test/talk.mp4")).toBeNull();
    expect(getEmbedUrl("")).toBeNull();
  });
});

describe("mapHubMeetingToWebinar", () => {
  const baseMeeting = {
    id: "meeting-1",
    meeting: "Plan Review",
    date: "2026-05-10",
    time: "14:30",
  };

  it("drops a meeting that is missing its title, date or time", () => {
    expect(
      mapHubMeetingToWebinar({ ...baseMeeting, meeting: "" }, false),
    ).toBeNull();
    expect(
      mapHubMeetingToWebinar({ ...baseMeeting, date: "" }, false),
    ).toBeNull();
    expect(
      mapHubMeetingToWebinar({ ...baseMeeting, time: "" }, false),
    ).toBeNull();
    expect(
      mapHubMeetingToWebinar({ ...baseMeeting, meeting: 42 }, false),
    ).toBeNull();
  });

  it("maps the full meeting payload", () => {
    const mapped = mapHubMeetingToWebinar(
      {
        ...baseMeeting,
        timezone: "EST",
        meetingType: "Webinar",
        format: "Virtual",
        platform: "Zoom",
        registrationUrl: " register.test ",
        hubLocation: "https://loc.test",
        replayUrl: " https://replay.test ",
        description: "  A plan review  ",
        duration: " 1 hour ",
        language: " Spanish ",
      },
      false,
    );

    expect(mapped).toMatchObject({
      id: "meeting-1",
      title: "Plan Review",
      date: "05/10/2026",
      time: "2:30 PM (EST)",
      format: "Webinar",
      meetingFormat: "Virtual",
      platform: "Zoom",
      link: "https://loc.test",
      registrationLink: "https://register.test",
      replayLink: "https://replay.test",
      isPast: false,
      description: "A plan review",
      duration: "1 hour",
      language: "Spanish",
    });
    // A URL-shaped location is a join link, not a street address.
    expect(mapped?.location).toBeUndefined();
  });

  it("shows a plain address as the location and falls back to the meeting link", () => {
    const mapped = mapHubMeetingToWebinar(
      {
        ...baseMeeting,
        hubLocation: "123 Main St",
        meetingLink: "https://meet.test/abc",
      },
      true,
    );

    expect(mapped).toMatchObject({
      location: "123 Main St",
      link: undefined,
      registrationLink: "https://meet.test/abc",
      isPast: true,
    });
    // A timezone-less meeting has no parenthetical suffix.
    expect(mapped?.time).toBe("2:30 PM");
  });

  it("leaves the registration link undefined when there is nothing to register to", () => {
    expect(
      mapHubMeetingToWebinar(baseMeeting, false)?.registrationLink,
    ).toBeUndefined();
  });

  it("ignores a non-string id", () => {
    expect(
      mapHubMeetingToWebinar({ ...baseMeeting, id: 7 }, false)?.id,
    ).toBeUndefined();
  });
});

describe("guessLanguageFromWebinar", () => {
  it("detects the explicit Spanish markers", () => {
    expect(
      guessLanguageFromWebinar({ webinarTitle: "[ES] Retirement 101" }),
    ).toBe("ES");
    expect(
      guessLanguageFromWebinar({ webinarTitle: "Retirement 101 (es)" }),
    ).toBe("ES");
    expect(
      guessLanguageFromWebinar({ webinarTitle: "Sesión en español" }),
    ).toBe("ES");
  });

  it("detects Spanish vocabulary in the title or description", () => {
    expect(guessLanguageFromWebinar({ webinarTitle: "Tu jubilación" })).toBe(
      "ES",
    );
    expect(guessLanguageFromWebinar({ description: "Una guía completa" })).toBe(
      "ES",
    );
  });

  it("defaults to English", () => {
    expect(guessLanguageFromWebinar({ webinarTitle: "Retirement 101" })).toBe(
      "EN",
    );
    expect(guessLanguageFromWebinar({})).toBe("EN");
  });

  it('misreads an English "plan" title as Spanish (known false positive)', () => {
    // "plan" is in the Spanish word list, so plain English copy that mentions a
    // plan is tagged ES on the replay card.
    expect(guessLanguageFromWebinar({ webinarTitle: "Plan overview" })).toBe(
      "ES",
    );
  });
});
