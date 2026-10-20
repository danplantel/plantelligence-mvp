import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FALLBACK_HEADER_IMAGE,
  HERO_RECOMMENDED_HEIGHT,
  HERO_RECOMMENDED_SIZE_LABEL,
  HERO_RECOMMENDED_WIDTH,
  autoCropHeroBackgroundImage,
  convertBrandImageToLogo,
  convertLogoToBrandImage,
} from "../hero-utils";
import { autoCropThumbnailImage } from "../thumbnail-utils";
import {
  exportFullResolutionImage,
  resolveBrandImageUrl,
} from "../image-utils";

/**
 * Create Plan brand-image helpers.
 *
 * The two auto-crop helpers sit on paths that bypass the cropper (gallery pick,
 * plain upload), so their exported dimensions are a product decision — 580×240
 * for the hero band and the 900×1000 Featured Image slot. Those numbers are
 * asserted here so a guide change cannot silently ship the old shape.
 */

type FakeImage = {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  crossOrigin: string | null;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
};

let createdImages: FakeImage[] = [];
let nextImage: { width: number; height: number; fail?: boolean } = {
  width: 1920,
  height: 1080,
};

class FakeImageClass {
  width = 0;
  height = 0;
  naturalWidth = 0;
  naturalHeight = 0;
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    this.width = nextImage.width;
    this.height = nextImage.height;
    this.naturalWidth = nextImage.width;
    this.naturalHeight = nextImage.height;
    if (nextImage.fail) {
      queueMicrotask(() => this.onerror?.());
    } else {
      queueMicrotask(() => this.onload?.());
    }
    createdImages.push(this as unknown as FakeImage);
  }
}

let contextAvailable = true;
const drawImage = vi.fn();
const toDataURL = vi.fn(() => "data:image/png;base64,cropped");

function stubCanvas() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() =>
    contextAvailable
      ? ({ drawImage } as unknown as CanvasRenderingContext2D)
      : null) as any);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
    toDataURL as any,
  );
}

beforeEach(() => {
  createdImages = [];
  nextImage = { width: 1920, height: 1080 };
  contextAvailable = true;
  drawImage.mockClear();
  toDataURL.mockClear();
  vi.stubGlobal("Image", FakeImageClass);
  stubCanvas();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hero-utils constants", () => {
  it("advertises the 16:9 hero size", () => {
    expect(HERO_RECOMMENDED_WIDTH).toBe(1920);
    expect(HERO_RECOMMENDED_HEIGHT).toBe(1080);
    expect(HERO_RECOMMENDED_SIZE_LABEL).toBe("1920×1080 px");
    expect(FALLBACK_HEADER_IMAGE.recommendedSize).toBe("1920×1080 px");
  });
});

function brandImage(partial: Record<string, unknown>) {
  return partial as any;
}

describe("convertBrandImageToLogo", () => {
  it("returns null for an absent image", () => {
    expect(convertBrandImageToLogo(null)).toBeNull();
  });

  it("flags transparency for PNG and SVG data URLs", () => {
    expect(
      convertBrandImageToLogo(
        brandImage({ url: "data:image/png;base64,AAAA", fileName: "logo.png" }),
      )?.hasTransparency,
    ).toBe(true);
    expect(
      convertBrandImageToLogo(
        brandImage({
          url: "data:image/svg+xml;base64,AAAA",
          fileName: "logo.svg",
        }),
      )?.hasTransparency,
    ).toBe(true);
  });

  it("does not flag transparency for a JPEG", () => {
    expect(
      convertBrandImageToLogo(
        brandImage({ url: "https://cdn.test/logo.jpg", fileName: "logo.jpg" }),
      )?.hasTransparency,
    ).toBe(false);
  });

  it("prefers originalUrl and falls back to the crop original", () => {
    expect(
      convertBrandImageToLogo(
        brandImage({
          url: "cropped.png",
          originalUrl: "original.png",
          fileName: "logo.png",
        }),
      )?.originalUrl,
    ).toBe("original.png");

    expect(
      convertBrandImageToLogo(
        brandImage({
          url: "cropped.png",
          fileName: "logo.png",
          cropData: { originalImage: "crop-original.png" },
        }),
      )?.originalUrl,
    ).toBe("crop-original.png");
  });

  it("defaults warnings to an empty list", () => {
    expect(
      convertBrandImageToLogo(brandImage({ url: "x.png", fileName: "x.png" }))
        ?.warnings,
    ).toEqual([]);
  });
});

describe("convertLogoToBrandImage", () => {
  it("returns undefined for an absent logo", () => {
    expect(convertLogoToBrandImage(null)).toBeUndefined();
  });

  it("marks the slot as a warning when the logo has warnings", () => {
    const image = convertLogoToBrandImage({
      url: "logo.png",
      fileName: "logo.png",
      warnings: ["Too small"],
    } as any);

    expect(image).toMatchObject({
      url: "logo.png",
      fileName: "logo.png",
      recommendedSize: "900×900 px",
      status: "warning",
      warnings: ["Too small"],
    });
  });

  it("keeps crop data and reports ok without warnings", () => {
    const cropData = { originalImage: "original.png" } as any;
    const image = convertLogoToBrandImage({
      url: "logo.png",
      fileName: "logo.png",
      cropData,
    } as any);

    expect(image).toMatchObject({
      status: "ok",
      cropData,
      originalUrl: "original.png",
    });
  });
});

describe("autoCropHeroBackgroundImage", () => {
  it("samples the 580×240 hero band from the source", async () => {
    const result = await autoCropHeroBackgroundImage(
      "https://cdn.test/hero.png",
    );

    expect(result).toEqual({
      croppedUrl: "data:image/png;base64,cropped",
      width: 580,
      height: 240,
    });
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(toDataURL).toHaveBeenCalledWith("image/png");
  });

  it("rejects when the image cannot load", async () => {
    nextImage = { width: 0, height: 0, fail: true };

    await expect(
      autoCropHeroBackgroundImage("https://cdn.test/missing.png"),
    ).rejects.toThrow("Failed to load image");
  });

  it("rejects when the canvas has no 2d context", async () => {
    contextAvailable = false;

    await expect(
      autoCropHeroBackgroundImage("https://cdn.test/hero.png"),
    ).rejects.toThrow("Failed to get canvas context");
  });
});

describe("autoCropThumbnailImage", () => {
  it("exports the Featured Image at its recommended 900×1000", async () => {
    const result = await autoCropThumbnailImage(
      "https://cdn.test/portrait.png",
    );

    expect(result).toEqual({
      croppedUrl: "data:image/png;base64,cropped",
      width: 900,
      height: 1000,
    });
  });

  it("rejects when the image cannot load", async () => {
    nextImage = { width: 0, height: 0, fail: true };

    await expect(
      autoCropThumbnailImage("https://cdn.test/missing.png"),
    ).rejects.toThrow("Failed to load image");
  });
});

describe("resolveBrandImageUrl", () => {
  it("passes through an empty value", () => {
    expect(resolveBrandImageUrl("")).toBe("");
    expect(resolveBrandImageUrl(null)).toBe("");
    expect(resolveBrandImageUrl(undefined)).toBe("");
  });

  it.each([
    "data:image/png;base64,AAAA",
    "blob:http://localhost/abc",
    "https://cdn.test/logo.png",
    "/api/r2/object?key=org%2Flogo.png",
    "/Hiking-Couple-Looking.webp",
  ])("leaves the loadable value %s untouched", (value) => {
    expect(resolveBrandImageUrl(value)).toBe(value);
  });

  it("maps an R2 key to the same-origin proxy", () => {
    expect(resolveBrandImageUrl("org/acme/branding/header.png")).toBe(
      "/api/r2/object?key=org%2Facme%2Fbranding%2Fheader.png",
    );
  });

  it("normalizes a leading slash and BOM on an R2 key", () => {
    expect(resolveBrandImageUrl("\uFEFF/org/acme/logo.png")).toBe(
      "/api/r2/object?key=org%2Facme%2Flogo.png",
    );
  });
});

describe("exportFullResolutionImage", () => {
  it("re-encodes the source at its original resolution", async () => {
    nextImage = { width: 1200, height: 800 };

    const result = await exportFullResolutionImage(
      "https://cdn.test/photo.png",
    );

    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.92);
  });

  it("rejects when the image cannot load", async () => {
    nextImage = { width: 0, height: 0, fail: true };

    await expect(
      exportFullResolutionImage("https://cdn.test/missing.png"),
    ).rejects.toThrow("Failed to load image");
  });

  it("rejects when the canvas has no 2d context", async () => {
    contextAvailable = false;

    await expect(
      exportFullResolutionImage("https://cdn.test/photo.png"),
    ).rejects.toThrow("Failed to get canvas context");
  });
});
