import { describe, expect, it } from "vitest";

import {
  HOVER_PREVIEW_SECONDS,
  getWebinarEmbedUrl,
  getWebinarHoverEmbedUrl,
} from "@/lib/webinar-video-embed";

const YOUTUBE_ID = "abcdefghijk";

describe("HOVER_PREVIEW_SECONDS", () => {
  it("is 15 seconds", () => {
    expect(HOVER_PREVIEW_SECONDS).toBe(15);
  });
});

describe("getWebinarEmbedUrl", () => {
  it("converts YouTube watch links", () => {
    expect(
      getWebinarEmbedUrl(`https://www.youtube.com/watch?v=${YOUTUBE_ID}`),
    ).toBe(`https://www.youtube.com/embed/${YOUTUBE_ID}`);
    expect(
      getWebinarEmbedUrl(`https://youtube.com/watch?v=${YOUTUBE_ID}&t=30`),
    ).toBe(`https://www.youtube.com/embed/${YOUTUBE_ID}`);
  });

  it("converts youtu.be short links", () => {
    expect(getWebinarEmbedUrl(`https://youtu.be/${YOUTUBE_ID}`)).toBe(
      `https://www.youtube.com/embed/${YOUTUBE_ID}`,
    );
  });

  it("keeps an already-embedded YouTube URL", () => {
    expect(
      getWebinarEmbedUrl(`https://www.youtube.com/embed/${YOUTUBE_ID}`),
    ).toBe(`https://www.youtube.com/embed/${YOUTUBE_ID}`);
  });

  it("rejects a short youtu.be id but truncates a long v= value (current behavior)", () => {
    expect(getWebinarEmbedUrl("https://youtu.be/short")).toBeNull();
    // The regex captures the first 11 characters rather than rejecting the id.
    expect(
      getWebinarEmbedUrl("https://www.youtube.com/watch?v=tooLongVideoId"),
    ).toBe("https://www.youtube.com/embed/tooLongVide");
  });

  it("does not recognise YouTube Shorts links (current behavior)", () => {
    expect(
      getWebinarEmbedUrl(`https://www.youtube.com/shorts/${YOUTUBE_ID}`),
    ).toBeNull();
  });

  it("converts Vimeo links, including channel paths", () => {
    expect(getWebinarEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
    expect(
      getWebinarEmbedUrl("https://vimeo.com/channels/staffpicks/123456789"),
    ).toBe("https://player.vimeo.com/video/123456789");
  });

  it("keeps an already-embedded Vimeo URL", () => {
    expect(getWebinarEmbedUrl("https://player.vimeo.com/video/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("returns null for direct video files", () => {
    expect(getWebinarEmbedUrl("https://cdn.example/video.mp4")).toBeNull();
    expect(getWebinarEmbedUrl("https://cdn.example/video.webm")).toBeNull();
    expect(getWebinarEmbedUrl("https://cdn.example/video.ogg?x=1")).toBeNull();
    expect(getWebinarEmbedUrl("https://cdn.example/video.mov")).toBeNull();
  });

  it("returns null for blank or unrelated URLs", () => {
    expect(getWebinarEmbedUrl("")).toBeNull();
    expect(getWebinarEmbedUrl("https://example.com/page")).toBeNull();
  });
});

describe("getWebinarHoverEmbedUrl", () => {
  it("adds muted autoplay and an end time to YouTube", () => {
    const url = getWebinarHoverEmbedUrl(
      `https://www.youtube.com/watch?v=${YOUTUBE_ID}&t=45`,
    );

    expect(url).toContain(`https://www.youtube.com/embed/${YOUTUBE_ID}?`);
    expect(url).toContain("autoplay=1");
    expect(url).toContain("mute=1");
    expect(url).toContain("controls=0");
    expect(url).toContain(`end=${HOVER_PREVIEW_SECONDS}`);
    expect(url).not.toContain("t=45");
  });

  it("adds background-mode parameters to Vimeo", () => {
    const url = getWebinarHoverEmbedUrl("https://vimeo.com/123456789");

    expect(url).toBe(
      "https://player.vimeo.com/video/123456789?autoplay=1&muted=1&background=1&controls=0",
    );
  });

  it("returns null for direct files and blank URLs", () => {
    expect(getWebinarHoverEmbedUrl("https://cdn.example/video.mp4")).toBeNull();
    expect(getWebinarHoverEmbedUrl("")).toBeNull();
  });
});
