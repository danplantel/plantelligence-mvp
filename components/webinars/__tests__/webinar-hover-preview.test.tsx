import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WebinarHoverPreviewLayer } from "../webinar-hover-preview";

function preview(overrides: Record<string, unknown> = {}) {
  return {
    id: "w-1",
    videoUrl: null,
    videoFileUrl: null,
    isLoading: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

describe("WebinarHoverPreviewLayer", () => {
  it("renders nothing without a preview", () => {
    const { container } = render(
      <WebinarHoverPreviewLayer preview={null} title="Webinar" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a spinner while the payload is loading", () => {
    const { container } = render(
      <WebinarHoverPreviewLayer
        preview={preview({ isLoading: true })}
        title="Webinar"
        className="z-[1]"
      />,
    );

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain("z-[1]");
    expect(container.querySelector("video")).toBeNull();
  });

  it("renders a base64 video with the sticky play badge hidden underneath", () => {
    const { container } = render(
      <WebinarHoverPreviewLayer
        preview={preview({ videoFileUrl: "BASE64" })}
        title="Webinar"
      />,
    );

    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("src", "data:video/mp4;base64,BASE64");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("playsinline");
    // React sets `muted` as a property rather than an attribute.
    expect(video.muted).toBe(true);
  });

  it("loops the teaser over its opening seconds", () => {
    const { container } = render(
      <WebinarHoverPreviewLayer
        preview={preview({ videoFileUrl: "BASE64" })}
        title="Webinar"
      />,
    );
    const video = container.querySelector("video")!;

    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(0);

    video.currentTime = 10;
    fireEvent.ended(video);
    expect(video.currentTime).toBe(0);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("frames a YouTube URL with hover parameters", () => {
    const { container } = render(
      <WebinarHoverPreviewLayer
        preview={preview({ videoUrl: "https://youtu.be/abcdefghijk" })}
        title="Annual Update"
      />,
    );

    const frame = container.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toContain(
      "https://www.youtube.com/embed/abcdefghijk?",
    );
    expect(frame.getAttribute("src")).toContain("autoplay=1");
    expect(frame).toHaveAttribute("title", "Hover preview of Annual Update");
  });

  it("frames a Vimeo URL in background mode", () => {
    const { container } = render(
      <WebinarHoverPreviewLayer
        preview={preview({ videoUrl: "https://vimeo.com/123456789" })}
        title="Vimeo"
      />,
    );

    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://player.vimeo.com/video/123456789?autoplay=1&muted=1&background=1&controls=0",
    );
  });

  it("plays a direct video URL without framing it", () => {
    const { container } = render(
      <WebinarHoverPreviewLayer
        preview={preview({ videoUrl: "https://cdn.example/video.mp4" })}
        title="Direct"
      />,
    );

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "https://cdn.example/video.mp4",
    );
  });

  it("renders nothing when a preview has no playable source", () => {
    const { container } = render(
      <WebinarHoverPreviewLayer preview={preview()} title="Empty" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
