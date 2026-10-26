import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VideoFeaturePlayer } from "../video-feature-player";

/**
 * The player the journey section swaps in when a video is picked from its rail.
 *
 * It is not the card's dialog: it replaces the section's two-column intro and runs
 * full width, with the X in the top-right corner putting the intro back.
 *
 * Source resolution is the card's order — embed URL, then direct file URL, then
 * the uploaded payload fetched on demand — because the list the rail reads
 * deliberately omits the multi-MB base64.
 */

const replay = {
  id: "w1",
  title: "Retirement Basics",
  clientId: "plan-1",
};

function stubFetch(payload: unknown, ok = true) {
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

describe("VideoFeaturePlayer sources", () => {
  it("plays a YouTube link in an embed", () => {
    const { container } = render(
      <VideoFeaturePlayer
        replay={{ ...replay, videoUrl: "https://youtu.be/abcdefghijk" }}
        onClose={() => {}}
      />,
    );

    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/abcdefghijk",
    );
    expect(frame).toHaveAttribute("title", "Retirement Basics");
    expect(container.querySelector("video")).toBeNull();
  });

  it("plays a direct file link in a native player", () => {
    const { container } = render(
      <VideoFeaturePlayer
        replay={{ ...replay, videoUrl: "https://cdn.test/replay.mp4" }}
        onClose={() => {}}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("src", "https://cdn.test/replay.mp4");
    expect(video).toHaveAttribute("controls");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("fetches an uploaded file on demand, through the plan's portal endpoint", async () => {
    const fetchMock = stubFetch({
      success: true,
      data: { videoFileUrl: "AAAA" },
    });

    const { container } = render(
      <VideoFeaturePlayer
        replay={{ ...replay, hasVideoFile: true }}
        clientId="plan-1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(container.querySelector("video")).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/webinars/w1?forPortal=1&clientId=plan-1",
      { cache: "no-store" },
    );
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "data:video/mp4;base64,AAAA",
    );
  });

  it("falls back to the row's own clientId when the host passes none", async () => {
    const fetchMock = stubFetch({
      success: true,
      data: { videoFileUrl: "BBBB" },
    });

    render(
      <VideoFeaturePlayer
        replay={{ ...replay, hasVideoFile: true }}
        onClose={() => {}}
      />,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/webinars/w1?forPortal=1&clientId=plan-1",
        { cache: "no-store" },
      ),
    );
  });

  it("does not request a file when the row already carries one", () => {
    const fetchMock = stubFetch({ success: true, data: {} });

    const { container } = render(
      <VideoFeaturePlayer
        replay={{ ...replay, videoFileUrl: "CCCC", hasVideoFile: true }}
        onClose={() => {}}
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "data:video/mp4;base64,CCCC",
    );
  });

  it("says so when the file cannot be loaded", async () => {
    stubFetch({ error: "not found" }, false);

    render(
      <VideoFeaturePlayer
        replay={{ ...replay, hasVideoFile: true }}
        onClose={() => {}}
      />,
    );

    expect(
      await screen.findByText("This video could not be loaded."),
    ).toBeInTheDocument();
  });

  it("shows the loading state while the file is in flight", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    render(
      <VideoFeaturePlayer
        replay={{ ...replay, hasVideoFile: true }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Loading video…")).toBeInTheDocument();
  });

  it("reports a row with nothing to play", () => {
    render(<VideoFeaturePlayer replay={replay} onClose={() => {}} />);

    expect(
      screen.getByText("This video has no playable source."),
    ).toBeInTheDocument();
  });
});

describe("VideoFeaturePlayer close affordance", () => {
  it("puts an X in the top-right corner", () => {
    render(<VideoFeaturePlayer replay={{ ...replay }} onClose={() => {}} />);

    const close = screen.getByRole("button", { name: /close video/i });
    // The overlay is pinned to the top edge and pushes the X to the right.
    const bar = close.parentElement as HTMLElement;
    expect(bar.className).toContain("top-0");
    expect(bar.className).toContain("justify-between");
    expect(close.className).toContain("border-white");
  });

  it("closes on the X and on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<VideoFeaturePlayer replay={replay} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /close video/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows the video's title over the frame", () => {
    render(<VideoFeaturePlayer replay={replay} onClose={() => {}} />);

    expect(screen.getByText("Retirement Basics")).toBeInTheDocument();
  });
});
