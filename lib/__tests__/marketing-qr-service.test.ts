import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toBuffer: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("qrcode", () => ({
  default: { toBuffer: mocks.toBuffer },
}));

import {
  generateQrDataUrl,
  generateQrViaQrIo,
  isQrIoConfigured,
  renderQrToDataUrl,
  renderQrToPngBuffer,
} from "@/lib/marketing/qr-service";

function qrResponse(text: string, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => text,
    json: async () => JSON.parse(text || "{}"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.QR_IO_API_KEY;
  mocks.toBuffer.mockResolvedValue(Buffer.from("png-bytes"));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("QR.io configuration", () => {
  it("reports configured only with a non-empty key", () => {
    expect(isQrIoConfigured()).toBe(false);
    process.env.QR_IO_API_KEY = "   ";
    expect(isQrIoConfigured()).toBe(false);
    process.env.QR_IO_API_KEY = " key ";
    expect(isQrIoConfigured()).toBe(true);
  });
});

describe("generateQrViaQrIo", () => {
  it("requires an API key", async () => {
    await expect(generateQrViaQrIo("https://hub.example")).rejects.toThrow(
      "QR_IO_API_KEY is not configured",
    );
  });

  it("requires a URL", async () => {
    process.env.QR_IO_API_KEY = "key";

    await expect(generateQrViaQrIo("  ")).rejects.toThrow(
      "QR payload URL is empty",
    );
  });

  it("creates a QR with a hostname-derived default title", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.fetch.mockResolvedValue(
      qrResponse(
        JSON.stringify({ qrid: "qr-1", png: "https://qr.example/p.png" }),
      ),
    );

    await expect(generateQrViaQrIo("https://hub.example/acme")).resolves.toEqual({
      id: "qr-1",
      imageUrl: "https://qr.example/p.png",
      name: "Flyer - hub.example",
    });
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      apikey: "key",
      data: "https://hub.example/acme",
      title: "Flyer - hub.example",
    });
  });

  it("uses a supplied name and prefers PNG over SVG/JPG", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.fetch.mockResolvedValue(
      qrResponse(
        JSON.stringify({
          qrid: "qr-1",
          svg: "https://qr.example/p.svg",
          png: "https://qr.example/p.png",
          jpg: "https://qr.example/p.jpg",
        }),
      ),
    );

    const result = await generateQrViaQrIo("https://hub.example", {
      name: "  Spring  ",
    });

    expect(result.imageUrl).toBe("https://qr.example/p.png");
    expect(result.name).toBe("Spring");
  });

  it("falls back to SVG when PNG is absent", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.fetch.mockResolvedValue(
      qrResponse(JSON.stringify({ qrid: "qr-1", svg: "https://qr.example/s.svg" })),
    );

    await expect(generateQrViaQrIo("https://hub.example")).resolves.toEqual(
      expect.objectContaining({ imageUrl: "https://qr.example/s.svg" }),
    );
  });

  it("rejects an HTTP failure", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.fetch.mockResolvedValue(qrResponse("nope", false, 500));

    await expect(generateQrViaQrIo("https://hub.example")).rejects.toThrow(
      "QR.io create failed (HTTP 500)",
    );
  });

  it("rejects a non-JSON response", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.fetch.mockResolvedValue(qrResponse("<html>"));

    await expect(generateQrViaQrIo("https://hub.example")).rejects.toThrow(
      "non-JSON",
    );
  });

  it("rejects an error message in the response", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.fetch.mockResolvedValue(
      qrResponse(JSON.stringify({ message: "bad key" })),
    );

    await expect(generateQrViaQrIo("https://hub.example")).rejects.toThrow(
      "QR.io error: bad key",
    );
  });

  it("rejects a response without an image URL", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.fetch.mockResolvedValue(qrResponse(JSON.stringify({ qrid: "qr-1" })));

    await expect(generateQrViaQrIo("https://hub.example")).rejects.toThrow(
      "missing image URL",
    );
  });
});

describe("generateQrDataUrl", () => {
  it("uses QR.io when configured", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.fetch.mockResolvedValue(
      qrResponse(
        JSON.stringify({ qrid: "qr-1", png: "https://qr.example/p.png" }),
      ),
    );

    await expect(
      generateQrDataUrl("https://hub.example", { name: "Hub" }),
    ).resolves.toEqual({
      dataUrl: "https://qr.example/p.png",
      source: "qrio",
      qrIoId: "qr-1",
      name: "Hub",
    });
  });

  it("falls back to local generation when QR.io fails", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.fetch.mockResolvedValue(qrResponse("nope", false, 500));

    await expect(generateQrDataUrl("https://hub.example")).resolves.toEqual({
      dataUrl: "data:image/png;base64,cG5nLWJ5dGVz",
      source: "local",
    });
  });

  it("uses local generation without a key", async () => {
    await expect(generateQrDataUrl("https://hub.example")).resolves.toEqual({
      dataUrl: "data:image/png;base64,cG5nLWJ5dGVz",
      source: "local",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("local QR rendering", () => {
  it("rejects an empty URL", async () => {
    await expect(renderQrToPngBuffer(" ")).rejects.toThrow(
      "QR payload URL is empty",
    );
  });

  it("uses the documented defaults", async () => {
    await renderQrToPngBuffer("https://hub.example");

    expect(mocks.toBuffer).toHaveBeenCalledWith("https://hub.example", {
      type: "png",
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  });

  it("honors overrides", async () => {
    await renderQrToPngBuffer("https://hub.example", {
      sizePx: 100,
      margin: 0,
      errorCorrectionLevel: "H",
    });

    expect(mocks.toBuffer).toHaveBeenCalledWith(
      "https://hub.example",
      expect.objectContaining({
        width: 100,
        margin: 0,
        errorCorrectionLevel: "H",
      }),
    );
  });

  it("returns a base64 PNG data URL", async () => {
    await expect(renderQrToDataUrl("https://hub.example")).resolves.toBe(
      "data:image/png;base64,cG5nLWJ5dGVz",
    );
  });
});
