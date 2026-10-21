import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebinarReplayCard, type WebinarReplay } from "../webinars-section";

/**
 * `WebinarReplayCard` — an on-demand webinar tile.
 *
 * Two things make this card more than markup:
 *
 *  - the list payload never carries the video bytes, so an uploaded file is
 *    fetched only when the visitor presses play, through the plan-scoped
 *    `?forPortal=1&clientId=…` URL that lets an anonymous portal visitor read it;
 *  - the hover teaser has to be suspended while the modal is open, or the video
 *    keeps playing behind the dialog.
 */

const mocks = vi.hoisted(() => {
  const state = {
    fetch: vi.fn(),
    preloadHoverPreviews: vi.fn(),
    suspended: [] as boolean[],
    videoFileEndpoint: undefined as any,
  };
  return state;
});

vi.mock("@/hooks/useWebinarHoverPreview", () => ({
  useWebinarHoverPreview: (options: any) => {
    mocks.suspended.push(Boolean(options.suspended));
    mocks.videoFileEndpoint = options.videoFileEndpoint;
    return {
      previewFor: () => null,
      hoveredId: null,
      getHoverProps: () => ({}),
      preloadHoverPreviews: mocks.preloadHoverPreviews,
    };
  },
}));

function replay(overrides: Partial<WebinarReplay> = {}): WebinarReplay {
  return {
    id: "replay-1",
    title: "Retirement 101",
    description: "The recording of our retirement session.",
    ...overrides,
  };
}

function renderCard(
  overrides: Partial<WebinarReplay> = {},
  secondaryColor?: string,
) {
  return render(
    <WebinarReplayCard
      replay={replay(overrides)}
      secondaryColor={secondaryColor}
    />,
  );
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

async function openModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(document.querySelector(".aspect-video") as HTMLElement);
}

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.preloadHoverPreviews.mockReset();
  mocks.suspended = [];
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebinarReplayCard media precedence", () => {
  it("paints the advisor's thumbnail over the video", () => {
    const { container } = renderCard({
      thumbnail: "https://cdn.test/thumb.webp",
      videoUrl: "https://youtu.be/abc123",
    });

    expect(screen.getByRole("img", { name: "Retirement 101" })).toHaveAttribute(
      "src",
      "https://cdn.test/thumb.webp",
    );
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("uses the YouTube still for a YouTube URL", () => {
    const { container } = renderCard({ videoUrl: "https://youtu.be/abc123" });

    expect(screen.getByRole("img", { name: "Retirement 101" })).toHaveAttribute(
      "src",
      "https://img.youtube.com/vi/abc123/maxresdefault.jpg",
    );
    expect(container.querySelector("video")).toBeNull();
  });

  it("previews a direct video URL with a muted video element", () => {
    const { container } = renderCard({
      videoUrl: "https://cdn.test/talk.mp4",
    });

    const video = container.querySelector("video");
    expect(video).toHaveAttribute("src", "https://cdn.test/talk.mp4");
    // React sets `muted` as a DOM property rather than an attribute.
    expect((video as HTMLVideoElement).muted).toBe(true);
  });

  it("shows the play placeholder when only a file exists", () => {
    const { container } = renderCard({ hasVideoFile: true });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector(".bg-red-600")).toBeInTheDocument();
  });
});

describe("WebinarReplayCard modal", () => {
  it("plays a YouTube URL through the embed iframe", async () => {
    const user = userEvent.setup();
    renderCard({ videoUrl: "https://www.youtube.com/watch?v=abc123" });

    await openModal(user);

    const dialog = await screen.findByRole("dialog", {
      name: "Retirement 101",
    });
    expect(dialog.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://www.youtube.com/embed/abc123",
    );
  });

  it("plays a direct URL in a controlled video element", async () => {
    const user = userEvent.setup();
    renderCard({ videoUrl: "https://cdn.test/talk.mp4" });

    await openModal(user);

    const dialog = await screen.findByRole("dialog");
    const video = dialog.querySelector("video");
    expect(video).toHaveAttribute("src", "https://cdn.test/talk.mp4");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("autoplay");
  });

  it("closes from the close button", async () => {
    const user = userEvent.setup();
    renderCard({ videoUrl: "https://cdn.test/talk.mp4" });

    await openModal(user);
    await user.click(screen.getByRole("button", { name: "Close video" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    renderCard({ videoUrl: "https://cdn.test/talk.mp4" });

    await openModal(user);
    await user.click(screen.getByRole("dialog"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does nothing when the replay has no video at all", async () => {
    const user = userEvent.setup();
    renderCard();

    await openModal(user);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("WebinarReplayCard on-demand file fetch", () => {
  it("fetches the file for the plan when play is pressed", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockReturnValue(
      jsonResponse({ success: true, data: { videoFileUrl: "BASE64" } }),
    );
    renderCard({ hasVideoFile: true, clientId: "plan 1" });

    await openModal(user);

    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/webinars/replay-1?forPortal=1&clientId=plan%201",
      { cache: "no-store" },
    );
    await waitFor(() => {
      expect(screen.getByRole("dialog").querySelector("video")).toHaveAttribute(
        "src",
        "data:video/mp4;base64,BASE64",
      );
    });
  });

  it("shows the loading state while the file is in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    mocks.fetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    renderCard({ hasVideoFile: true });

    await openModal(user);

    expect(screen.getByText("Loading video…")).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { videoFileUrl: "X" } }),
    } as Response);

    await waitFor(() => {
      expect(screen.queryByText("Loading video…")).not.toBeInTheDocument();
    });
  });

  it("omits the plan query for a replay without a client id", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockReturnValue(
      jsonResponse({ success: true, data: { videoFileUrl: "BASE64" } }),
    );
    renderCard({ hasVideoFile: true });

    await openModal(user);

    expect(mocks.fetch).toHaveBeenCalledWith("/api/webinars/replay-1", {
      cache: "no-store",
    });
  });

  it("reports a failed load", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockReturnValue(jsonResponse({ success: false }, false));
    renderCard({ hasVideoFile: true });

    await openModal(user);

    expect(
      await screen.findByText("This video could not be loaded."),
    ).toBeInTheDocument();
  });

  it("reports a thrown request", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderCard({ hasVideoFile: true });

    await openModal(user);

    expect(
      await screen.findByText("This video could not be loaded."),
    ).toBeInTheDocument();
  });

  it("still fetches the file when a thumbnail is showing", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockReturnValue(
      jsonResponse({ success: true, data: { videoFileUrl: "BASE64" } }),
    );
    renderCard({
      hasVideoFile: true,
      thumbnail: "https://cdn.test/thumb.webp",
      clientId: "plan-1",
    });

    await openModal(user);

    expect(mocks.fetch).toHaveBeenCalled();
  });
});

describe("WebinarReplayCard details and teaser", () => {
  it("always renders the title and the reserved description box", () => {
    renderCard({ description: undefined });

    expect(
      screen.getByRole("heading", { level: 3, name: "Retirement 101" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".h-20")).toBeInTheDocument();
  });

  it("renders the duration and the Popular badge", () => {
    renderCard({ duration: "12 min", isPopular: true });

    expect(screen.getByText("12 min")).toBeInTheDocument();
    expect(screen.getByText("Popular")).toBeInTheDocument();
  });

  it("suspends the hover teaser while the modal is open", async () => {
    const user = userEvent.setup();
    renderCard({ videoUrl: "https://cdn.test/talk.mp4" });

    expect(mocks.suspended.at(-1)).toBe(false);

    await openModal(user);

    expect(mocks.suspended.at(-1)).toBe(true);
  });

  it("warms the teaser for this card on mount", () => {
    renderCard({ hasVideoFile: true, clientId: "plan-1" });

    expect(mocks.preloadHoverPreviews).toHaveBeenCalled();
    expect(mocks.preloadHoverPreviews.mock.calls.at(-1)?.[0]).toEqual([
      expect.objectContaining({ id: "replay-1", hasVideoFile: true }),
    ]);
  });
});
