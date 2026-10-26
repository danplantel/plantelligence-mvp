import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VideoCarousel } from "../video-carousel";

/**
 * The hub's videos, as the closing rail of "How Can We Help You Today?".
 *
 * The fetch is the old `BenefitsHubVideosCardSection` one — this file pins that it
 * survived the move: this plan's videos, this page's placement, no video files.
 * The card itself (`WebinarReplayCard`) is covered by the webinars suites, so it
 * is stubbed here and the assertions are about the RAIL.
 */

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
}));

vi.mock("../videos-card-section", () => ({
  WebinarReplayCard: ({
    replay,
    active,
  }: {
    replay: { title: string; duration?: string };
    active?: boolean;
  }) => (
    // `data-duration` is the runtime the poster card prints bottom-right;
    // `data-active` is the border it draws on the thumbnail while playing.
    <div
      data-testid="video-card"
      data-duration={replay.duration ?? ""}
      data-active={active || undefined}
    >
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

/** jsdom performs no layout, so the track's metrics are stubbed per test. */
function stubTrackSize(clientWidth: number, scrollWidth: number) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => clientWidth,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get: () => scrollWidth,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Those stubs shadow jsdom's own metrics on the prototype; drop the shadow so
  // the next test starts from the real (zero) values.
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)
    .clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)
    .scrollWidth;
});

describe("VideoCarousel request", () => {
  it("asks for this plan's videos on this page, without the files", async () => {
    const fetchMock = mockFetch({ success: true, data: videos });

    render(<VideoCarousel placement="retirement" />);

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

    render(<VideoCarousel placement="life-insurance" clientId="plan-9" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/webinars?clientId=plan-9&placement=life-insurance&includeVideoFiles=0",
      { cache: "no-store" },
    );
  });
});

describe("VideoCarousel rail", () => {
  it("reserves the row with skeletons while the videos load", () => {
    // Never resolves, so the loading state is what is asserted.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    render(<VideoCarousel placement="retirement" />);

    const track = screen.getByTestId("video-carousel-track");
    expect(track).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading videos…")).toBeInTheDocument();
  });

  it("renders one slide per video in a snapping horizontal track", async () => {
    mockFetch({ success: true, data: videos });

    render(<VideoCarousel placement="retirement" />);
    await waitFor(() =>
      expect(screen.getAllByTestId("video-slide")).toHaveLength(3),
    );

    const track = screen.getByTestId("video-carousel-track");
    expect(track.className).toContain("overflow-x-auto");
    expect(track.className).toContain("snap-x");
    // Each slide is a fixed width and its own snap point.
    for (const slide of screen.getAllByTestId("video-slide")) {
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

    render(<VideoCarousel placement="retirement" />);

    await waitFor(() =>
      expect(screen.getAllByTestId("video-card")).toHaveLength(2),
    );
    const [withRuntime, withoutRuntime] = screen.getAllByTestId("video-card");
    expect(withRuntime).toHaveAttribute("data-duration", "1:01");
    expect(withoutRuntime).toHaveAttribute("data-duration", "");
  });

  it("orders the row by upload date, newest first", async () => {
    mockFetch({
      success: true,
      data: [
        // Oldest upload, answered first by the API (which sorts on `eventDate`).
        { ...videos[0], createdAt: "2026-01-10T12:00:00.000Z" },
        { ...videos[2], createdAt: "2026-03-02T12:00:00.000Z" },
        { ...videos[1], createdAt: "2026-02-14T12:00:00.000Z" },
      ],
    });

    render(<VideoCarousel placement="retirement" />);

    await waitFor(() =>
      expect(screen.getAllByTestId("video-card")).toHaveLength(3),
    );

    expect(
      screen.getAllByTestId("video-card").map((card) => card.textContent),
    ).toEqual([
      "Medicare and You",
      "Catch-up Contributions",
      "Retirement Basics",
    ]);
  });

  it("keeps the server's order for videos uploaded at the same moment", async () => {
    // `sort` is stable, so a tie falls back to the order the API answered with
    // rather than jittering between renders.
    mockFetch({
      success: true,
      data: [
        { ...videos[0], createdAt: "2026-02-14T12:00:00.000Z" },
        { ...videos[1], createdAt: "2026-02-14T12:00:00.000Z" },
      ],
    });

    render(<VideoCarousel placement="retirement" />);

    await waitFor(() =>
      expect(screen.getAllByTestId("video-card")).toHaveLength(2),
    );
    expect(
      screen.getAllByTestId("video-card").map((card) => card.textContent),
    ).toEqual(["Retirement Basics", "Catch-up Contributions"]);
  });

  it("marks the playing card and leaves the border to the thumbnail", async () => {
    mockFetch({ success: true, data: videos });

    render(<VideoCarousel placement="retirement" activeId="w2" />);

    await waitFor(() =>
      expect(screen.getAllByTestId("video-slide")).toHaveLength(3),
    );

    const slides = screen.getAllByTestId("video-slide");
    const cards = screen.getAllByTestId("video-card");

    // The playing slide is announced, and only its card is told it is active.
    expect(slides[1]).toHaveAttribute("data-active", "true");
    expect(slides[1]).toHaveAttribute("aria-current", "true");
    expect(cards[1]).toHaveAttribute("data-active", "true");

    // No ring on the slide itself: that sits outside the box (the track clipped
    // its top edge under the heading) and wrapped the caption below the card.
    for (const slide of slides) {
      expect(slide.className).not.toContain("ring");
      expect(slide.className).not.toContain("rounded-xl");
    }
  });

  it("renders nothing for a plan with no videos", async () => {
    mockFetch({ success: true, data: [] });

    const { container } = render(<VideoCarousel placement="retirement" />);

    await waitFor(() =>
      expect(container).toBeEmptyDOMElement(),
    );
  });

  it("renders nothing when the API fails", async () => {
    mockFetch({ success: false }, false);

    const { container } = render(<VideoCarousel placement="retirement" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("hides the chevrons when every video already fits in the row", async () => {
    // Four cards fill a 1280px column exactly, so there is nothing to page to.
    stubTrackSize(1280, 1280);
    mockFetch({ success: true, data: videos });

    render(<VideoCarousel placement="retirement" />);
    await waitFor(() =>
      expect(screen.getAllByTestId("video-slide")).toHaveLength(3),
    );

    expect(
      screen.queryByRole("button", { name: /scroll videos left/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /scroll videos right/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the chevrons once a card overflows the row", async () => {
    stubTrackSize(1280, 1580);
    mockFetch({ success: true, data: videos });

    render(<VideoCarousel placement="retirement" />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /scroll videos right/i }),
      ).toBeInTheDocument(),
    );

    // Nothing is hidden to the left yet, so that one is present but inert.
    const left = screen.getByRole("button", { name: /scroll videos left/i });
    expect(left).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /scroll videos right/i }),
    ).toBeEnabled();
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

    render(<VideoCarousel placement="retirement" />);
    await waitFor(() =>
      expect(screen.getAllByTestId("video-slide")).toHaveLength(3),
    );

    const right = screen.getByRole("button", { name: /scroll videos right/i });
    await waitFor(() => expect(right).toBeEnabled());
    await user.click(right);

    // One page leaves a card and a half on screen.
    expect(scrollBy).toHaveBeenCalledWith({ left: 340, behavior: "smooth" });
  });
});

describe("VideoCarousel heading", () => {
  it("defaults to Videos and counts what the row holds", async () => {
    mockFetch({ success: true, data: videos });

    render(<VideoCarousel placement="retirement" />);

    await waitFor(() =>
      expect(screen.getByTestId("rail-count")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("rail-title")).toHaveTextContent("Videos");
    expect(screen.getByTestId("rail-count")).toHaveTextContent("3 videos");
  });

  it("takes the host's heading, so the journey section names it after the benefit", async () => {
    mockFetch({ success: true, data: videos });

    render(
      <VideoCarousel placement="retirement" title="Retirement Essentials" />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("rail-title")).toHaveTextContent(
        "Retirement Essentials",
      ),
    );
  });

  it("says '1 video' for a single one", async () => {
    mockFetch({ success: true, data: [videos[0]] });

    render(<VideoCarousel placement="retirement" />);

    await waitFor(() =>
      expect(screen.getByTestId("rail-count")).toHaveTextContent("1 video"),
    );
  });

  it("shows no count until the fetch answers", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    render(<VideoCarousel placement="retirement" />);

    expect(screen.queryByTestId("rail-count")).not.toBeInTheDocument();
  });
});
