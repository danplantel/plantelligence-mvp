import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildFlyerSvgFromData,
  resolveQrImageDataUrl,
} from "@/lib/marketing/flyer-pdf";

const baseData = {
  headline: "Your retirement benefits are ready",
  body: "Open your Benefits Hub to review plan documents.",
  startDate: "2026-03-01",
  bgColor: "#23919c",
  planName: "Acme",
  flyerSubtitle: "A subtitle",
  flyerImage: "data:image/png;base64,flyer",
  flyerQrUrl: "https://hub.example/acme",
  meetingTime: "10:00 AM",
  meetingLocation: "Zoom",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("buildFlyerSvgFromData", () => {
  it("builds a sized SVG with the headline, subtitle, and image", () => {
    const svg = buildFlyerSvgFromData(baseData as any);

    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 612 792");
    expect(svg.getAttribute("width")).toBe("612");
    expect(svg.getAttribute("height")).toBe("792");
    expect(svg.textContent).toContain("Your retirement benefits are");
    expect(svg.textContent).toContain("A subtitle");
    expect(svg.querySelector("image")?.getAttribute("href")).toBe(
      "data:image/png;base64,flyer",
    );
  });

  it("includes meeting time and location", () => {
    const svg = buildFlyerSvgFromData(baseData as any);

    expect(svg.textContent).toContain("10:00 AM");
    expect(svg.textContent).toContain("Zoom");
  });

  it("embeds a resolved logo when supplied", () => {
    const svg = buildFlyerSvgFromData(baseData as any, "data:image/png;base64,logo");

    const images = Array.from(svg.querySelectorAll("image"));
    expect(
      images.some(
        (image) => image.getAttribute("href") === "data:image/png;base64,logo",
      ),
    ).toBe(true);
  });

  it("uses the fallback background color", () => {
    const svg = buildFlyerSvgFromData({ ...baseData, bgColor: "" } as any);

    expect(svg.innerHTML).toContain("#23919c");
  });

  it("handles missing optional text", () => {
    const svg = buildFlyerSvgFromData({
      ...baseData,
      flyerSubtitle: "",
      flyerImage: "",
      meetingTime: "",
      meetingLocation: "",
    } as any);

    expect(svg.textContent).toContain("Your retirement benefits");
  });
});

describe("resolveQrImageDataUrl", () => {
  it("returns an existing data URL unchanged", async () => {
    await expect(
      resolveQrImageDataUrl("data:image/png;base64,qr", "https://hub.example"),
    ).resolves.toBe("data:image/png;base64,qr");
  });

  it("inlines a remote QR image", async () => {
    const blob = new Blob(["qr"], { type: "image/png" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => blob,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveQrImageDataUrl(
      "https://qr.example/image.png",
      "",
    );

    expect(fetchMock).toHaveBeenCalledWith("https://qr.example/image.png");
    expect(result.startsWith("data:")).toBe(true);
  });

  it("falls back to qrserver when the remote fetch fails", async () => {
    const blob = new Blob(["qr"], { type: "image/png" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, blob: async () => blob })
      .mockResolvedValueOnce({ ok: true, blob: async () => blob });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveQrImageDataUrl(
      "https://qr.example/broken.png",
      "https://hub.example/acme",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent("https://hub.example/acme")}`,
    );
    expect(result.startsWith("data:")).toBe(true);
  });

  it("returns the original value when both fetches fail", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolveQrImageDataUrl("https://qr.example/broken.png", ""),
    ).resolves.toBe("https://qr.example/broken.png");
  });

  it("returns an empty string when there is no QR source", async () => {
    await expect(resolveQrImageDataUrl("", "")).resolves.toBe("");
  });
});
