import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WebinarsCarousel } from "../webinars-carousel";

/**
 * The hub's videos, as the closing rail of "How Can We Help You Today?".
 *
 * The fetch is the old `BenefitsHubWebinarsSection` one — this file pins that it
 * survived the move: this plan's videos, this page's placement, no video files.
 * The card itself (`WebinarReplayCard`) is covered by the webinars suites, so it
 * is stubbed here and the assertions are about the RAIL.
 */

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
}));

vi.mock("../webinars-section", () => ({
  WebinarReplayCard: ({
    replay,
  }: {
    replay: { title: string; duration?: string };
  }) => (
    // `data-duration` is what the poster card prints in its bottom-right badge.
    <div data-testid="webinar-card" data-duration={replay.duration ?? ""}>
      {replay.title}
    </div>
  ),
  guessLanguageFromWebinar: () => "EN",
}));

const videos = [
  {
    id: "w1",
    webinarTitle: "Retirement Basics",
    description: "What to know in your first year.",
    clientId: "c1",
  },
  {
    id: "w2",
    webinarTitle: "Catch-up Contributions",
    description: "Catching up after 50.",
    clientId: "c1",
  },
  {
    id: "w3",
    webinarTitle: "Medicare and You",
    description: "How the pieces fit together.",
    clientId: "c1",
  },
];

function mockFetch(payload: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    json: async () => payload,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WebinarsCarousel request", () => {
  it("asks for this plan's videos on this page, without the files", async () => {
    const fetchMock = mockFetch({ success: true, data: videos });

    render(<WebinarsCarousel placement="retirement" />);

    // The title appears twice: the (stubbed) card and the caption under it.
    await waitFor(() =>
      expect(
        screen.getAllByText("Retirement Basics", { exact: false })[0],
      ).toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/webinars?clientId=plan-1&placement=retirement&includeVideoFiles=0",
      { cache: "no-store" },
    );
  });

  it("prefers an explicit clientId over the route segment", async () => {
    const fetchMock = mockFetch({ success: true, data: videos });

    render(<WebinarsCarousel placement="life-insurance" clientId="plan-9" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/webinars?clientId=plan-9&placement=life-insurance&includeVideoFiles=0",
      { cache: "no-store" },
    );
  });
});

describe("WebinarsCarousel rail", () => {
  it("reserves the row with skeletons while the videos load", () => {
    // Never resolves, so the loading state is what is asserted.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    render(<WebinarsCarousel placement="retirement" />);

    const track = screen.getByTestId("webinars-carousel-track");
    expect(track).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading videos…")).toBeInTheDocument();
  });

  it("renders one slide per video in a snapping horizontal track", async () => {
    mockFetch({ success: true, data: videos });

    render(<WebinarsCarousel placement="retirement" />);
    await waitFor(() =>
      expect(screen.getAllByTestId("webinar-slide")).toHaveLength(3),
    );

    const track = screen.getByTestId("webinars-carousel-track");
    expect(track.className).toContain("overflow-x-auto");
    expect(track.className).toContain("snap-x");
    // Each slide is a fixed width and its own snap point.
    for (const slide of screen.getAllByTestId("webinar-slide")) {
      expect(slide.className).toContain("snap-start");
      expect(slide.className).toContain("shrink-0");
    }
    // The title lives on the poster card; the slide captions it with the
    // description instead.
    expect(screen.getAllByText("Retirement Basics")).toHaveLength(1);
    expect(
      screen.getByText("What to know in your first year."),
    ).toBeInTheDocument();
  });

  it("hands the card the stored runtime for its badge", async () => {
    // The runtime is a column, not something the browser measures: the list
    // request omits the video files, so a badge that depended on loading the
    // video would never appear.
    mockFetch({
      success: true,
      data: [
        { ...videos[0], duration: "1:01" },
        // A row uploaded before the column was measured.
        { ...videos[1], duration: null },
      ],
    });

    render(<WebinarsCarousel placement="retirement" />);

    await waitFor(() =>
      expect(screen.getAllByTestId("webinar-card")).toHaveLength(2),
    );
    const [withRuntime, withoutRuntime] = screen.getAllByTestId("webinar-card");
    expect(withRuntime).toHaveAttribute("data-duration", "1:01");
    expect(withoutRuntime).toHaveAttribute("data-duration", "");
  });

  it("renders nothing for a plan with no videos", async () => {
    mockFetch({ success: true, data: [] });

    const { container } = render(<WebinarsCarousel placement="retirement" />);

    await waitFor(() =>
      expect(container).toBeEmptyDOMElement(),
    );
  });

  it("renders nothing when the API fails", async () => {
    mockFetch({ success: false }, false);

    const { container } = render(<WebinarsCarousel placement="retirement" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("pages the row when a chevron is pressed", async () => {
    const user = userEvent.setup();
    mockFetch({ success: true, data: videos });

    // jsdom performs no layout, so give the track a measurable size: a 400px
    // viewport over 1000px of content means the row overflows to the right.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 1000,
    });
    const scrollBy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
      configurable: true,
      value: scrollBy,
    });

    render(<WebinarsCarousel placement="retirement" />);
    await waitFor(() =>
      expect(screen.getAllByTestId("webinar-slide")).toHaveLength(3),
    );

    const right = screen.getByRole("button", { name: /scroll webinars right/i });
    await waitFor(() => expect(right).toBeEnabled());
    await user.click(right);

    // One page leaves a card and a half on screen.
    expect(scrollBy).toHaveBeenCalledWith({ left: 340, behavior: "smooth" });
  });
});
