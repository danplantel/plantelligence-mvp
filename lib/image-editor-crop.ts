/**
 * Shared client-side crop/export math for the image editor modals.
 *
 * Browser-only — no server (Node) imports. All DOM/canvas work happens here so
 * the DPR-safe crop logic (which previously existed in ~4 near-identical copies
 * across simple-image-editor-modal.tsx and universal-image-editor-modal.tsx)
 * lives in a single place.
 */

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Derive the Fabric backing-canvas scale (physical device pixels per logical
 * CSS pixel). Fabric renders into a backing canvas scaled by the browser's
 * devicePixelRatio (clamped to >= 1) at creation time. Reading it from the
 * backing canvas — rather than `window.devicePixelRatio` — guarantees the
 * exported crop matches the on-screen canvas at any browser zoom.
 */
export function getBackingScale(canvas: { getWidth: () => number }): number {
  const sourceCanvas = (canvas as unknown as {
    lowerCanvasEl?: HTMLCanvasElement;
  }).lowerCanvasEl;
  const logicalWidth = canvas.getWidth();
  if (sourceCanvas && logicalWidth > 0 && sourceCanvas.width > 0) {
    return sourceCanvas.width / logicalWidth;
  }
  return 1;
}

export interface DrawCroppedImageParams {
  /** Source canvas or image. */
  source: CanvasImageSource;
  /** Source rect, in source pixels (already multiplied by the source scale). */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Output size in pixels. */
  dw: number;
  dh: number;
}

/**
 * Draw a crop of `source` into a fresh canvas sized `dw` x `dh` px and return
 * it. Returns null when a 2d context cannot be created.
 */
export function drawCroppedImage({
  source,
  sx,
  sy,
  sw,
  sh,
  dw,
  dh,
}: DrawCroppedImageParams): HTMLCanvasElement | null {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(dw));
  out.height = Math.max(1, Math.round(dh));
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

/**
 * Crop `source` and export it as a data URL. Returns null when the crop canvas
 * cannot be created.
 */
export function cropImageToDataUrl(
  params: DrawCroppedImageParams & { format?: string; quality?: number },
): string | null {
  const { format = "image/png", quality } = params;
  const out = drawCroppedImage(params);
  if (!out) return null;
  return out.toDataURL(format, quality);
}

/**
 * Returns true when any pixel in `source` has alpha < 255 (i.e. the image has
 * transparency and must be exported as PNG rather than JPEG).
 */
export function detectTransparency(source: HTMLCanvasElement): boolean {
  const ctx = source.getContext("2d");
  if (!ctx) return false;
  try {
    const data = ctx.getImageData(0, 0, source.width, source.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  } catch {
    // Reading pixels can throw (e.g. tainted canvas); treat as non-transparent.
    return false;
  }
  return false;
}

export interface CropMetadataInput {
  /** Crop x/y within the ORIGINAL image, in unscaled image pixels. */
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  originalWidth: number;
  originalHeight: number;
}

export interface BuiltCropMetadata {
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  cropped: boolean;
}

/** Round to 2 decimal places. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Convert a crop rect (relative to the original image, in unscaled image
 * pixels) into percentage-based crop metadata, clamped to 0-100%.
 */
export function buildCropMetadata(input: CropMetadataInput): BuiltCropMetadata {
  const {
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    originalWidth,
    originalHeight,
  } = input;

  const x = Math.max(0, Math.min(100, (cropX / originalWidth) * 100));
  const y = Math.max(0, Math.min(100, (cropY / originalHeight) * 100));
  const width = Math.max(
    0,
    Math.min(100, (cropWidth / originalWidth) * 100),
  );
  const height = Math.max(
    0,
    Math.min(100, (cropHeight / originalHeight) * 100),
  );

  return {
    x: round2(x),
    y: round2(y),
    width: round2(width),
    height: round2(height),
    originalWidth: Math.round(originalWidth),
    originalHeight: Math.round(originalHeight),
    cropped: true,
  };
}
