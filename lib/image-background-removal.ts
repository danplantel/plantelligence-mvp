/**
 * Client-side logo background removal.
 *
 * Browser-only — no server (Node) imports. Same rule as
 * [`lib/image-editor-crop.ts`](lib/image-editor-crop.ts:1).
 *
 * Pipeline: detect the backdrop colour from the image border, flood-fill it away
 * inward from the border (connectivity-scoped, so enclosed artwork pixels of the
 * same colour survive), soften the anti-aliased rim, then trim the transparent
 * margins.
 *
 * Nothing in here is invoked automatically. The caller runs
 * `removeImageBackground()` from an explicit button press — the editor must never
 * alter a brand asset on its own initiative.
 */

import { detectTransparency } from "@/lib/image-editor-crop";

/** Longest side the working canvas is allowed to reach. Bounds processing time. */
const DEFAULT_MAX_DIMENSION = 4096;

/** Thickness of the border ring sampled for backdrop detection. */
const BORDER_RING_PX = 2;

/**
 * 5-bit per channel quantisation, matching `extract-colors-from-image.ts:96`.
 * Groups anti-aliased / compressed shades of the same colour into one bucket
 * instead of splitting the backdrop across dozens of near-identical values.
 */
const QUANT_SHIFT = 5;
const QUANT_LEVELS = 1 << (8 - QUANT_SHIFT);

/** Colour distance at which a border pixel counts as "the backdrop colour". */
const DETECT_DISTANCE = 24;

/** Share of border samples that must match before we trust the detection. */
const UNIFORMITY_THRESHOLD = 0.85;

/** Alpha at or below this is treated as already transparent. */
const ALPHA_OPAQUE_MIN = 8;

/** Slider 0-100 maps onto this RGB Euclidean distance range. */
const TOLERANCE_MIN_DISTANCE = 4;
const TOLERANCE_SPAN = 76;

/** Below this cleared fraction we report that nothing matched. */
export const MEANINGFUL_REMOVAL_RATIO = 0.005;

/**
 * Colour distance below which the surviving artwork is considered "the same
 * colour" as the backdrop that was removed. Flags the case where a white-on-white
 * or black-on-black logo can lose visible content.
 */
const ARTWORK_RISK_DISTANCE = 60;

export interface BorderDetection {
  /** Detected backdrop colour as [r, g, b], or null when the border is not uniform. */
  color: [number, number, number] | null;
  /** Share of border samples matching the detected colour, 0-1. */
  uniformity: number;
  /** Candidate colour even when `color` is null, for a future manual override. */
  candidate: [number, number, number] | null;
}

export interface RemovalOptions {
  /** 0-100 from the UI slider. Consumed on each press of the button. */
  tolerance: number;
  /** Remove the anti-aliased rim / colour fringe. Default true. */
  softEdge?: boolean;
  /** Trim the transparent margins. Default true. */
  trim?: boolean;
  /** Keep the artwork clear of the Fabric selection border. Default 2. */
  paddingPx?: number;
  /** Manual override; skips border detection. */
  colorOverride?: [number, number, number] | null;
  /** Longest side of the working canvas. Default 4096. */
  maxDimension?: number;
}

export interface RemovalResult {
  /** PNG data URL of the processed artwork. */
  dataUrl: string;
  width: number;
  height: number;
  detectedColor: [number, number, number] | null;
  /** Cleared pixels / total pixels, 0-1. */
  removedRatio: number;
  /** True when transparent margins were trimmed. */
  trimmed: boolean;
  /** Source already had alpha below 255 before processing. */
  alreadyTransparent: boolean;
  /** True when the source already had transparency and nothing meaningful matched. */
  noChange: boolean;
  /** The surviving artwork is close in colour to the backdrop it was removed from. */
  artworkRisk: boolean;
}

/** Map the 0-100 slider onto an RGB Euclidean distance. */
export function toleranceToDistance(tolerance: number): number {
  const t = Number.isFinite(tolerance) ? Math.max(0, Math.min(100, tolerance)) : 12;
  return TOLERANCE_MIN_DISTANCE + (t / 100) * TOLERANCE_SPAN;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function squaredDistance(
  r: number,
  g: number,
  b: number,
  colour: [number, number, number],
): number {
  const dr = r - colour[0];
  const dg = g - colour[1];
  const db = b - colour[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * Load a source into a canvas at its natural size, capped to `maxDimension`.
 *
 * `getImageData` throws `SecurityError` on a canvas tainted by a cross-origin
 * image, so for anything that is not an inline data URL we fetch the bytes and
 * draw from a same-origin `blob:` URL. This mirrors the approach already proven
 * in `extractColorsFromImage()` (`lib/extract-colors-from-image.ts:47`) and makes
 * every subsequent pixel read safe regardless of the source's CORS headers.
 */
export async function loadSourceCanvas(
  src: string,
  maxDimension: number = DEFAULT_MAX_DIMENSION,
): Promise<HTMLCanvasElement> {
  if (!src) throw new Error("No image to process.");

  let objectUrl: string | null = null;
  let loadUrl = src;

  if (!src.startsWith("data:")) {
    try {
      const res = await fetch(src, { credentials: "same-origin" });
      if (res.ok) {
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        loadUrl = objectUrl;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      throw new Error(
        "Could not read this image to process it. Re-upload the file and try again.",
      );
    }
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode this image."));
      el.src = loadUrl;
    });

    const naturalWidth = img.naturalWidth || img.width || 1;
    const naturalHeight = img.naturalHeight || img.height || 1;
    const scale = Math.min(
      1,
      maxDimension / Math.max(naturalWidth, naturalHeight),
    );
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create a drawing context.");

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Determine the backdrop colour from the outer border ring.
 *
 * Opaque border pixels are quantised to 5 bits per channel; the modal bucket
 * supplies the candidate colour and `uniformity` is the share of border samples
 * sitting close to it. A non-uniform border (photo, gradient, textured backdrop)
 * yields `color: null` so the caller can report that no solid backdrop exists.
 */
export function detectBorderColor(imageData: ImageData): BorderDetection {
  const { data, width, height } = imageData;
  const buckets = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >();
  let opaqueSamples = 0;

  const sample = (index: number) => {
    const o = index * 4;
    if (data[o + 3] < ALPHA_OPAQUE_MIN) return;
    opaqueSamples++;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const key =
      ((r >> QUANT_SHIFT) * QUANT_LEVELS + (g >> QUANT_SHIFT)) * QUANT_LEVELS +
      (b >> QUANT_SHIFT);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  };

  const ring = Math.max(
    1,
    Math.min(BORDER_RING_PX, Math.floor(width / 2), Math.floor(height / 2)),
  );

  // Build the ring once; both the bucket pass and the uniformity pass walk the
  // same set of pixels.
  const ringPixels: number[] = [];
  for (let y = 0; y < height; y++) {
    if (y < ring || y >= height - ring) {
      for (let x = 0; x < width; x++) ringPixels.push(y * width + x);
    } else {
      for (let x = 0; x < ring; x++) ringPixels.push(y * width + x);
      for (let x = width - ring; x < width; x++) ringPixels.push(y * width + x);
    }
  }

  for (const index of ringPixels) sample(index);

  if (!buckets.size) {
    return { color: null, uniformity: 0, candidate: null };
  }

  let modalCount = 0;
  let modalKey = -1;
  for (const [key, bucket] of buckets) {
    if (bucket.count > modalCount) {
      modalCount = bucket.count;
      modalKey = key;
    }
  }

  const modal = buckets.get(modalKey)!;
  const candidate = [
    Math.round(modal.r / modal.count),
    Math.round(modal.g / modal.count),
    Math.round(modal.b / modal.count),
  ] as [number, number, number];

  // Second pass over the same ring to measure how much of it sits close to the
  // candidate.
  let matching = 0;
  const maxDistanceSq = DETECT_DISTANCE * DETECT_DISTANCE;
  for (const index of ringPixels) {
    const o = index * 4;
    if (data[o + 3] < ALPHA_OPAQUE_MIN) continue;
    if (
      squaredDistance(data[o], data[o + 1], data[o + 2], candidate) <=
      maxDistanceSq
    ) {
      matching++;
    }
  }

  const uniformity = opaqueSamples ? matching / opaqueSamples : 0;

  return {
    color: uniformity >= UNIFORMITY_THRESHOLD ? candidate : null,
    uniformity,
    candidate,
  };
}

/**
 * Flood-fill the backdrop away, seeded from the image border.
 *
 * Connectivity scoping is the critical detail: a global colour key would erase
 * every pixel matching the backdrop colour, punching holes in white text inside
 * a coloured badge or a white highlight inside a mark. Growing the region from
 * the border instead means expansion stops at the artwork and every enclosed
 * region survives, no matter what colour it is.
 *
 * Returns the number of pixels cleared.
 */
export function floodFillBackground(
  imageData: ImageData,
  colour: [number, number, number],
  maxDistance: number,
): number {
  const { data, width, height } = imageData;
  const total = width * height;
  const maxDistanceSq = maxDistance * maxDistance;

  // Only cleared pixels are marked, so the mask doubles as the visited set.
  const cleared = new Uint8Array(total);

  const matches = (x: number, y: number): boolean => {
    const idx = y * width + x;
    if (cleared[idx]) return false;
    const o = idx * 4;
    // Already-transparent pixels are not backdrop; leave them alone and do not
    // count them as removals.
    if (data[o + 3] < ALPHA_OPAQUE_MIN) return false;
    return (
      squaredDistance(data[o], data[o + 1], data[o + 2], colour) <= maxDistanceSq
    );
  };

  // Seed from every border pixel that convinced us the border is uniform.
  const seedDistance = Math.max(maxDistance, DETECT_DISTANCE);
  const seedDistanceSq = seedDistance * seedDistance;
  const isSeed = (x: number, y: number): boolean => {
    const idx = y * width + x;
    if (cleared[idx]) return false;
    const o = idx * 4;
    if (data[o + 3] < ALPHA_OPAQUE_MIN) return false;
    return (
      squaredDistance(data[o], data[o + 1], data[o + 2], colour) <= seedDistanceSq
    );
  };

  // Span-based fill: the stack holds one seed per contiguous run, so memory
  // stays bounded even on very large sources.
  const stack: number[] = [];
  const pushSeed = (x: number, y: number) => {
    if (isSeed(x, y)) stack.push(x, y);
  };

  for (let x = 0; x < width; x++) {
    pushSeed(x, 0);
    pushSeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushSeed(0, y);
    pushSeed(width - 1, y);
  }

  let removed = 0;

  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (!matches(x, y)) continue;

    // Expand the run left and right from the seed.
    let left = x;
    while (left > 0 && matches(left - 1, y)) left--;
    let right = x;
    while (right < width - 1 && matches(right + 1, y)) right++;

    const rowOffset = y * width;
    for (let i = left; i <= right; i++) {
      const idx = rowOffset + i;
      if (cleared[idx]) continue;
      cleared[idx] = 1;
      data[idx * 4 + 3] = 0;
      removed++;
    }

    // Seed the runs that touch this span on the rows above and below.
    for (const neighbourY of [y - 1, y + 1]) {
      if (neighbourY < 0 || neighbourY >= height) continue;
      let insideRun = false;
      for (let i = left; i <= right; i++) {
        if (matches(i, neighbourY)) {
          if (!insideRun) {
            stack.push(i, neighbourY);
            insideRun = true;
          }
        } else {
          insideRun = false;
        }
      }
    }

    if (removed === total) break;
  }

  return removed;
}

/**
 * Fade the anti-aliased rim the flood fill leaves behind.
 *
 * A hard fill leaves a ring of half-backdrop pixels that reads as a grey halo on
 * a white backdrop. For each cleared pixel with an opaque neighbour at distance
 * `d` from the backdrop colour:
 *
 * - `d < maxDistance` → clear the neighbour too (kills the 1 px fringe).
 * - `maxDistance <= d < 2 * maxDistance` → set alpha proportionally, a cheap
 *   alpha-matte approximation that ramps the halo out instead of stepping.
 *
 * Mutates `imageData` in place.
 */
export function softenEdges(
  imageData: ImageData,
  colour: [number, number, number],
  maxDistance: number,
): void {
  const { data, width, height } = imageData;

  const toClear: number[] = [];
  const toRamp: number[] = [];
  const doubleDistance = maxDistance * 2;

  const inspect = (neighbourIndex: number) => {
    const nO = neighbourIndex * 4;
    if (data[nO + 3] < ALPHA_OPAQUE_MIN) return;
    const d = Math.sqrt(
      squaredDistance(data[nO], data[nO + 1], data[nO + 2], colour),
    );
    if (d < maxDistance) {
      toClear.push(neighbourIndex);
    } else if (d < doubleDistance) {
      toRamp.push(
        neighbourIndex,
        clampByte(Math.round(((d - maxDistance) / maxDistance) * 255)),
      );
    }
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      // Only pixels the fill cleared are candidates for a softened rim.
      if (data[o + 3] >= ALPHA_OPAQUE_MIN) continue;

      if (x > 0) inspect(y * width + (x - 1));
      if (x < width - 1) inspect(y * width + (x + 1));
      if (y > 0) inspect((y - 1) * width + x);
      if (y < height - 1) inspect((y + 1) * width + x);
    }
  }

  // Applied after the scan so the ramp is derived from the state the fill left
  // behind rather than from partially-updated pixels.
  for (const idx of toClear) {
    data[idx * 4 + 3] = 0;
  }
  for (let i = 0; i < toRamp.length; i += 2) {
    const idx = toRamp[i];
    const alpha = toRamp[i + 1];
    if (data[idx * 4 + 3] > alpha) data[idx * 4 + 3] = alpha;
  }
}

/**
 * Bounding box of pixels with alpha above the trim threshold.
 *
 * The threshold ignores stray anti-alias specks that would otherwise keep the
 * box pinned to the full frame. Returns null when nothing is left opaque.
 */
export function trimTransparent(
  imageData: ImageData,
  paddingPx: number,
): { x: number; y: number; width: number; height: number } | null {
  const { data, width, height } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (data[(rowOffset + x) * 4 + 3] <= ALPHA_OPAQUE_MIN) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null;

  const pad = Math.max(0, paddingPx);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(width - 1, maxX + pad);
  const bottom = Math.min(height - 1, maxY + pad);

  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Dominant colour of the pixels that survived removal, or null when nothing is
 * left. Used to warn when the artwork is made of the same colour as the backdrop
 * it was just removed from.
 */
export function dominantOpaqueColor(
  imageData: ImageData,
): [number, number, number] | null {
  const { data, width, height } = imageData;
  const buckets = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >();

  const total = width * height;
  for (let index = 0; index < total; index++) {
    const o = index * 4;
    if (data[o + 3] < ALPHA_OPAQUE_MIN) continue;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const key =
      ((r >> QUANT_SHIFT) * QUANT_LEVELS + (g >> QUANT_SHIFT)) * QUANT_LEVELS +
      (b >> QUANT_SHIFT);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  let dominant:
    | { count: number; r: number; g: number; b: number }
    | null = null;
  for (const bucket of buckets.values()) {
    if (!dominant || bucket.count > dominant.count) dominant = bucket;
  }
  if (!dominant) return null;

  return [
    Math.round(dominant.r / dominant.count),
    Math.round(dominant.g / dominant.count),
    Math.round(dominant.b / dominant.count),
  ];
}

/**
 * Run the full pipeline over `src` and return a PNG data URL of the result.
 *
 * Call this only from an explicit user action.
 *
 * @throws Error with a user-safe message when there is no solid backdrop, when
 * the image cannot be read, or when removal would leave nothing behind.
 */
export async function removeImageBackground(
  src: string,
  options: RemovalOptions,
): Promise<RemovalResult> {
  const {
    tolerance,
    softEdge = true,
    trim = true,
    paddingPx = 2,
    colorOverride = null,
    maxDimension = DEFAULT_MAX_DIMENSION,
  } = options;

  const canvas = await loadSourceCanvas(src, maxDimension);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not read this image's pixels.");

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);

  const alreadyTransparent = detectTransparency(canvas);

  const detection = detectBorderColor(imageData);
  const backdrop = colorOverride ?? detection.color;

  if (!backdrop) {
    throw new Error(
      "No solid background detected. This logo's edges are not a single colour, so there is nothing to remove automatically.",
    );
  }

  const maxDistance = toleranceToDistance(tolerance);
  const removed = floodFillBackground(imageData, backdrop, maxDistance);
  const removedRatio = removed / (width * height);

  if (removedRatio >= 0.999) {
    throw new Error(
      "Removal would erase the whole image. This logo looks like a solid block of colour — try a lower tolerance.",
    );
  }

  if (removed > 0 && softEdge) {
    softenEdges(imageData, backdrop, maxDistance);
  }

  // Write the alpha changes back before measuring the trim box, so the box
  // reflects the softened edges too.
  ctx.putImageData(imageData, 0, 0);

  const survivingColour = dominantOpaqueColor(imageData);
  const artworkRisk =
    removed > 0 &&
    survivingColour != null &&
    Math.sqrt(
      squaredDistance(
        survivingColour[0],
        survivingColour[1],
        survivingColour[2],
        backdrop,
      ),
    ) < ARTWORK_RISK_DISTANCE;

  let outputCanvas = canvas;
  let trimmed = false;

  if (trim) {
    const box = trimTransparent(imageData, paddingPx);
    if (box && (box.x !== 0 || box.y !== 0 || box.width !== width || box.height !== height)) {
      const next = document.createElement("canvas");
      next.width = box.width;
      next.height = box.height;
      const nextCtx = next.getContext("2d");
      if (nextCtx) {
        nextCtx.clearRect(0, 0, box.width, box.height);
        nextCtx.drawImage(
          canvas,
          box.x,
          box.y,
          box.width,
          box.height,
          0,
          0,
          box.width,
          box.height,
        );
        outputCanvas = next;
        trimmed = true;
      }
    }
  }

  return {
    dataUrl: outputCanvas.toDataURL("image/png"),
    width: outputCanvas.width,
    height: outputCanvas.height,
    detectedColor: detection.candidate,
    removedRatio,
    trimmed,
    alreadyTransparent,
    noChange: alreadyTransparent && removedRatio < MEANINGFUL_REMOVAL_RATIO,
    artworkRisk,
  };
}
