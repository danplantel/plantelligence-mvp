import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  qrToDataUrl: vi.fn(),
  sharpToBuffer: vi.fn(),
  sharp: vi.fn(),
  doc: {
    internal: {
      pageSize: { getWidth: () => 612, getHeight: () => 792 },
    },
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    addImage: vi.fn(),
    rect: vi.fn(),
    output: vi.fn(() => new ArrayBuffer(4)),
  },
}));

vi.mock("jspdf", () => ({
  default: class {
    internal = mocks.doc.internal;
    setFillColor = mocks.doc.setFillColor;
    setDrawColor = mocks.doc.setDrawColor;
    setFont = mocks.doc.setFont;
    setFontSize = mocks.doc.setFontSize;
    setTextColor = mocks.doc.setTextColor;
    text = mocks.doc.text;
    splitTextToSize = mocks.doc.splitTextToSize;
    addImage = mocks.doc.addImage;
    rect = mocks.doc.rect;
    output = mocks.doc.output;
  },
}));

vi.mock("sharp", () => ({
  default: mocks.sharp,
}));

vi.mock("@/lib/marketing/qr-service", () => ({
  renderQrToDataUrl: mocks.qrToDataUrl,
}));

import {
  renderFlyerPdf,
  renderFlyerPng,
} from "@/lib/marketing/render-flyer";

const input = {
  headline: "Your benefits, all in one place",
  body: "Review your plan documents and meet your advisor.",
  cta: "Visit your Benefits Hub",
  hubAbsoluteUrl: "https://hub.example/acme",
  brand: {
    sponsor: {
      companyName: "Acme & Sons",
      brandColor: "#123",
      secondaryColor: "#456",
      companyLogo: null,
    },
    organization: {
      organizationType: "RIA",
      name: "Advisor",
      advisorLogo: null,
      advisorLogoUrl: null,
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.qrToDataUrl.mockResolvedValue("data:image/png;base64,qr");
  mocks.sharpToBuffer.mockResolvedValue(Buffer.from("png"));
  mocks.sharp.mockReturnValue({ png: () => ({ toBuffer: mocks.sharpToBuffer }) });
  mocks.doc.splitTextToSize.mockImplementation((text: string) => [text]);
});

describe("renderFlyerPdf", () => {
  it("renders the QR and returns a PDF buffer", async () => {
    const buffer = await renderFlyerPdf(input as any);

    expect(mocks.qrToDataUrl).toHaveBeenCalledWith(input.hubAbsoluteUrl, {
      sizePx: 280,
      errorCorrectionLevel: "M",
      margin: 2,
    });
    expect(mocks.doc.setFillColor).toHaveBeenCalledWith(17, 34, 51);
    expect(mocks.doc.text).toHaveBeenCalledWith(
      "Acme & Sons",
      expect.any(Number),
      expect.any(Number),
    );
    expect(mocks.doc.addImage).toHaveBeenCalledWith(
      "data:image/png;base64,qr",
      "PNG",
      expect.any(Number),
      expect.any(Number),
      112,
      112,
      undefined,
      "FAST",
    );
    expect(mocks.doc.output).toHaveBeenCalledWith("arraybuffer");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBe(4);
  });

  it("falls back to the default brand color for malformed hex", async () => {
    await renderFlyerPdf({
      ...input,
      brand: {
        ...input.brand,
        sponsor: { ...input.brand.sponsor, brandColor: "nope" },
      },
    } as any);

    expect(mocks.doc.setFillColor).toHaveBeenCalledWith(31, 58, 96);
  });
});

describe("renderFlyerPng", () => {
  it("renders an escaped SVG through sharp", async () => {
    const buffer = await renderFlyerPng(input as any);

    expect(mocks.qrToDataUrl).toHaveBeenCalledWith(input.hubAbsoluteUrl, {
      sizePx: 360,
      errorCorrectionLevel: "M",
      margin: 2,
    });
    const svg = mocks.sharp.mock.calls[0][0] as Buffer;
    const text = svg.toString("utf8");
    expect(text).toContain("Acme");
    expect(text).toContain("&");
    expect(text).toContain("Your benefits, all in one place");
    expect(text).toContain("Visit your Benefits Hub");
    expect(text).toContain("data:image/png;base64,qr");
    expect(mocks.sharpToBuffer).toHaveBeenCalled();
    expect(buffer).toEqual(Buffer.from("png"));
  });

  it("wraps long headline text", async () => {
    await renderFlyerPng({
      ...input,
      headline:
        "This headline is deliberately much longer than thirty four characters",
    } as any);

    const svg = (mocks.sharp.mock.calls[0][0] as Buffer).toString("utf8");
    expect(svg).toContain("This headline is deliberately much");
  });
});
