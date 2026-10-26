import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WebinarReplayCard } from "../videos-card-section";

/**
 * `WebinarReplayCard`'s poster variant — the card the hub pages' Webinars rail
 * uses (`video-carousel.tsx`).
 *
 * The card IS the 16:9 frame, so the two overlays are its whole chrome:
 *  - the play control in the TOP-RIGHT, a white ring around a white icon;
 *  - the runtime in the BOTTOM-RIGHT, black pill, white text.
 * The title lives under the card (the rail renders it), which is why the poster
 * itself has no heading.
 */

vi.mock("@/hooks/useWebinarHoverPreview", () => ({
  useWebinarHoverPreview: () => ({
    previewFor: () => null,
    hoveredId: null,
    getHoverProps: () => ({}),
    preloadHoverPreviews: () => {},
  }),
}));

vi.mock("@/components/webinars/webinar-hover-preview", () => ({
  WebinarHoverPreviewLayer: () => null,
}));

const replay = {
  id: "w1",
  title: "Retirement Basics",
  description: "What to know in your first year.",
  thumbnail: "https://cdn.test/thumb.jpg",
  videoUrl: "https://cdn.test/video.mp4",
  duration: "12:34",
};

function poster(overrides: Record<string, unknown> = {}) {
  return render(
    <WebinarReplayCard
      replay={{ ...replay, ...overrides } as any}
      variant="poster"
    />,
  );
}

describe("WebinarReplayCard poster variant", () => {
  it("is a 16:9 frame carrying the title but none of the body copy", () => {
    const { container } = poster();

    const frame = container.querySelector(".aspect-video") as HTMLElement;
    expect(frame).not.toBeNull();
    // The title is printed ON the card; the description moves below it (the rail
    // renders it), so the card itself never grows past its 16:9 frame.
    expect(screen.getByText("Retirement Basics")).toBeInTheDocument();
    expect(
      screen.queryByText("What to know in your first year."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("prints the title bottom-left over a bottom-to-top gradient", () => {
    const { container } = poster();

    const title = screen.getByText("Retirement Basics");
    expect(title.className).toContain("bottom-3");
    expect(title.className).toContain("left-3");
    expect(title.className).toContain("text-white");
    // About half the card wide, large enough to read, wrapping over several rows.
    expect(title.className).toContain("w-1/2");
    expect(title.className).toContain("text-base");
    expect(title.className).toContain("line-clamp-3");

    // The scrim that makes the title readable: black at the bottom, clear at the
    // top, and it never swallows a click.
    const gradient = container.querySelector(
      ".bg-gradient-to-t",
    ) as HTMLElement;
    expect(gradient).not.toBeNull();
    expect(gradient.className).toContain("bottom-0");
    expect(gradient.className).toContain("from-black/85");
    expect(gradient.className).toContain("to-transparent");
    expect(gradient.className).toContain("pointer-events-none");
    expect(gradient).toHaveAttribute("aria-hidden");
  });

  it("puts a white-ringed play control in the top-right corner", () => {
    poster();

    const play = screen.getByRole("button", { name: "Play Retirement Basics" });
    expect(play.className).toContain("top-3");
    expect(play.className).toContain("right-3");
    expect(play.className).toContain("border-2");
    expect(play.className).toContain("border-white");
    expect(play.className).toContain("text-white");
  });

  it("puts the runtime in the bottom-right, black on white", () => {
    poster();

    const duration = screen.getByText("12:34");
    expect(duration.className).toContain("bottom-3");
    expect(duration.className).toContain("right-3");
    expect(duration.className).toContain("bg-black/80");
    expect(duration.className).toContain("text-white");
  });

  it("borders the thumbnail, and only the thumbnail, while it is playing", () => {
    const { container, rerender } = poster();

    // A resting card draws no border of its own.
    expect(
      container.querySelector('[data-testid="video-card-active-border"]'),
    ).toBeNull();

    rerender(
      <WebinarReplayCard replay={replay as any} variant="poster" active />,
    );

    const border = container.querySelector(
      '[data-testid="video-card-active-border"]',
    ) as HTMLElement;
    expect(border).not.toBeNull();
    expect(border.className).toContain("absolute");
    expect(border.className).toContain("inset-0");
    expect(border.className).toContain("border-2");
    expect(border.className).toContain("border-white");
    expect(border.className).toContain("pointer-events-none");

    // Inset inside the 16:9 frame, so it hugs the thumbnail: an outer ring sat
    // outside the box, where the rail's scroll container clipped its top edge
    // under the heading, and it wrapped the caption printed beneath the card.
    const frame = border.parentElement as HTMLElement;
    expect(frame.className).toContain("aspect-video");
    expect(frame.className).toContain("overflow-hidden");
    expect(frame.className).toContain("rounded-xl");
  });

  it("measures the runtime from the video's metadata when the row has none", async () => {
    const { container } = poster({ duration: undefined });

    // The hidden probe requests metadata only; its `loadedmetadata` gives the
    // length, which is what the badge prints.
    const probe = container.querySelector("video.hidden") as HTMLVideoElement;
    expect(probe).not.toBeNull();
    Object.defineProperty(probe, "duration", {
      configurable: true,
      value: 95,
    });
    fireEvent.loadedMetadata(probe);

    expect(await screen.findByText("1:35")).toBeInTheDocument();
  });

  it("hides the runtime when the video's length is unknown", () => {
    poster({ duration: undefined, videoUrl: "https://www.youtube.com/embed/x" });

    expect(screen.queryByText("12:34")).not.toBeInTheDocument();
  });

  it("keeps the default card's title and copy for every other host", () => {
    render(<WebinarReplayCard replay={replay as any} />);

    expect(
      screen.getByRole("heading", { name: "Retirement Basics" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("What to know in your first year."),
    ).toBeInTheDocument();
  });
});
