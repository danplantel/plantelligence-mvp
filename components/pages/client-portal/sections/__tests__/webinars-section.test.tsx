import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebinarsSection } from "../webinars-section";

/**
 * `WebinarsSection` — the News & Events page's meetings/replays band.
 *
 * It owns two independent reads: plan meetings (`?forHub=1`, which become the
 * Upcoming and Past cards) and published replays (`placement=news-events`,
 * without file payloads). Each has its own loading and empty state, and the
 * `onLoadComplete` callback fires only once both have settled.
 */

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  preloadHoverPreviews: vi.fn(),
  onLoadComplete: vi.fn(),
}));

vi.mock("@/hooks/useWebinarHoverPreview", () => ({
  useWebinarHoverPreview: () => ({
    previewFor: () => null,
    hoveredId: null,
    getHoverProps: () => ({}),
    preloadHoverPreviews: mocks.preloadHoverPreviews,
  }),
}));

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

function meetingsPayload(
  upcoming: Record<string, unknown>[] = [],
  past: Record<string, unknown>[] = [],
) {
  return jsonResponse({ success: true, data: { upcoming, past } });
}

function replaysPayload(rows: Record<string, unknown>[] = []) {
  return jsonResponse({ success: true, data: rows });
}

function meeting(overrides: Record<string, unknown> = {}) {
  return {
    id: "meeting-1",
    meeting: "Plan Review",
    date: "2026-05-10",
    time: "14:30",
    ...overrides,
  };
}

function replay(overrides: Record<string, unknown> = {}) {
  return {
    id: "replay-1",
    clientId: "plan-1",
    webinarTitle: "Retirement 101",
    description: "The recording.",
    videoUrl: "https://cdn.test/talk.mp4",
    ...overrides,
  };
}

/** Route the two reads by URL, defaulting both to empty successes. */
function routeFetch({
  meetings = meetingsPayload(),
  replays = replaysPayload(),
}: {
  meetings?: Response | Promise<Response>;
  replays?: Response | Promise<Response>;
} = {}) {
  mocks.fetch.mockImplementation((url: string) => {
    if (url.startsWith("/api/clients/")) return meetings;
    return replays;
  });
}

function renderSection(clientId: string = "plan-1") {
  return render(
    <WebinarsSection
      clientId={clientId}
      brandColor="#123456"
      onLoadComplete={mocks.onLoadComplete}
    />,
  );
}

function meetingsCall() {
  return mocks.fetch.mock.calls.find(([url]) =>
    String(url).startsWith("/api/clients/"),
  );
}

function replaysCall() {
  return mocks.fetch.mock.calls.find(([url]) =>
    String(url).startsWith("/api/webinars"),
  );
}

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.preloadHoverPreviews.mockReset();
  mocks.onLoadComplete.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebinarsSection reads", () => {
  it("reads plan meetings and published replays with their documented contracts", async () => {
    routeFetch({ replays: replaysPayload([replay()]) });
    renderSection();

    await screen.findByText("Retirement 101");

    expect(meetingsCall()).toEqual([
      "/api/clients/plan-1/meetings?forHub=1",
      { credentials: "include", cache: "no-store" },
    ]);
    expect(replaysCall()).toEqual([
      "/api/webinars?clientId=plan-1&placement=news-events&includeVideoFiles=0",
      { cache: "no-store" },
    ]);
  });

  it("encodes the client id in the replay query", async () => {
    routeFetch();
    renderSection("plan 1");

    await waitFor(() => expect(replaysCall()).toBeDefined());

    expect(String(replaysCall()?.[0])).toContain("clientId=plan%201");
  });

  it("makes no request at all without a client id", async () => {
    // "" is what the page hands over when the plan has no id, and it is falsy.
    renderSection("");

    expect(await screen.findByText("No upcoming sessions")).toBeInTheDocument();
    expect(await screen.findByText("No replays yet")).toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();

    // Inconsistent on purpose: the Past empty state is gated on a client id, so
    // a plan-less render leaves that section blank instead of saying "none".
    expect(screen.queryByText("No past meetings")).not.toBeInTheDocument();
  });
});

describe("WebinarsSection meetings", () => {
  it("renders upcoming and past cards from the hub payload", async () => {
    routeFetch({
      meetings: meetingsPayload(
        [meeting({ id: "up-1", meeting: "Open Enrollment" })],
        [meeting({ id: "past-1", meeting: "Plan Review" })],
      ),
    });
    renderSection();

    expect(await screen.findByText("Open Enrollment")).toBeInTheDocument();
    expect(await screen.findByText("Plan Review")).toBeInTheDocument();
    // The date is formatted as MM/dd/yyyy for the card.
    expect(screen.getAllByText("05/10/2026").length).toBeGreaterThan(0);
  });

  it("drops meeting rows that cannot be rendered", async () => {
    routeFetch({
      meetings: meetingsPayload([
        meeting({ id: "ok", meeting: "Valid Session" }),
        meeting({ id: "bad", meeting: "Dropped Session", time: "" }),
      ]),
    });
    renderSection();

    expect(await screen.findByText("Valid Session")).toBeInTheDocument();
    expect(screen.queryByText("Dropped Session")).not.toBeInTheDocument();
  });

  it("shows the empty states for a malformed meetings payload", async () => {
    routeFetch({
      meetings: jsonResponse({ success: true, data: { upcoming: {} } }),
    });
    renderSection();

    expect(await screen.findByText("No upcoming sessions")).toBeInTheDocument();
    expect(screen.getByText("No past meetings")).toBeInTheDocument();
  });

  it("shows the empty states when the meetings read rejects", async () => {
    routeFetch({ meetings: Promise.reject(new Error("offline")) });
    renderSection();

    expect(await screen.findByText("No upcoming sessions")).toBeInTheDocument();
    expect(screen.getByText("No past meetings")).toBeInTheDocument();
  });
});

describe("WebinarsSection replays", () => {
  it("renders a replay card and the empty state is gone", async () => {
    routeFetch({ replays: replaysPayload([replay()]) });
    renderSection();

    expect(await screen.findByText("Retirement 101")).toBeInTheDocument();
    expect(screen.queryByText("No replays yet")).not.toBeInTheDocument();
  });

  it("shows the replay empty state for a malformed payload", async () => {
    routeFetch({ replays: jsonResponse({ success: true, data: null }) });
    renderSection();

    expect(await screen.findByText("No replays yet")).toBeInTheDocument();
  });

  it("shows the replay empty state when the read rejects", async () => {
    routeFetch({ replays: Promise.reject(new Error("offline")) });
    renderSection();

    expect(await screen.findByText("No replays yet")).toBeInTheDocument();
  });
});

describe("WebinarsSection lifecycle", () => {
  it("reports completion once, after both reads settle", async () => {
    let resolveReplays: (value: Response) => void = () => {};
    routeFetch({
      meetings: meetingsPayload(),
      replays: new Promise<Response>((resolve) => {
        resolveReplays = resolve;
      }),
    });
    renderSection();

    // Both sections show a loading line until their read settles.
    expect(screen.getByText("Loading upcoming sessions…")).toBeInTheDocument();
    expect(screen.getByText("Loading replays…")).toBeInTheDocument();
    expect(mocks.onLoadComplete).not.toHaveBeenCalled();

    resolveReplays(replaysPayload());
    await screen.findByText("No replays yet");

    await waitFor(() => expect(mocks.onLoadComplete).toHaveBeenCalledTimes(1));
  });

  it("does not report completion while the replay read is still pending", async () => {
    routeFetch({
      meetings: meetingsPayload(),
      replays: new Promise<Response>(() => {}),
    });
    renderSection();

    await waitFor(() =>
      expect(
        screen.queryByText("Loading upcoming sessions…"),
      ).not.toBeInTheDocument(),
    );
    expect(mocks.onLoadComplete).not.toHaveBeenCalled();
  });

  it("renders all three section headings", async () => {
    routeFetch();
    renderSection();

    expect(
      screen.getByRole("heading", { name: "Upcoming Meetings & Webinars" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Past Meetings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Webinar Replays" }),
    ).toBeInTheDocument();
    await screen.findByText("No replays yet");
  });
});
