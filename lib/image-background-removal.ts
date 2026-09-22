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
 * alter a brand asset on its own initiative. `detectImageBackground()` is the one
 * exception, and it is safe because it is a dry run: it only reports whether a
 * backdrop exists so the caller can ASK, and never changes a pixel.
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

/** Coverage at which a detected backdrop becomes worth offering to the user. */
const OFFER_MIN_COVERAGE = 0.02;

/** Above this the frame is essentially one flat colour — a block, not a logo. */
const OFFER_MAX_COVERAGE = 0.985;

/**
 * Colour distance below which the surviving artwork is considered "the same
 * colour" as the backdrop that was removed. Flags the case where a white-on-white
 * or black-on-black logo can lose visible content.
 */
const ARTWORK_RISK_DISTANCE = 60;

/**
 * Boundary rings worked inward by the matte pass, one ring per round.
 *
 * Two covers the practical cases: a natively anti-aliased edge (one ring) and the
 * wider, softer fringe a resaved or JPEG-compressed logo leaves behind. Repeating
 * helps rather than re-deriving the same numbers, because each round takes its
 * reference colour from the next ring in — a ring that is itself less contaminated.
 */
const EDGE_MATTE_PASSES = 2;

/**
 * Radius searched for the artwork colour that a boundary pixel is a blend of. One
 * ring in is the ideal reference; the second is the fallback for thick fringes.
 */
const MATTE_REFERENCE_RADIUS = 2;

/**
 * Alpha below which a neighbour counts as open background, i.e. as something that
 * exposes the pixel beside it to the next matte pass.
 *
 * Using the fully-transparent threshold instead would make every pass process the
 * same ring: a pixel the matte just gave alpha 128 still reads as opaque, so the ring
 * behind it would never be reached and a two-pixel fringe would keep its wash. Above
 * three-quarters opaque, a neighbour is treated as artwork and the pass stops — which
 * is what keeps a legitimately soft edge from being walked into.
 */
const MATTE_EXPOSED_ALPHA = 192;

/**
 * Residual, in RGB distance, within which two candidate reference colours count as
 * fitting equally well. Real pixels are noisy, so exact ties never happen: without
 * this slack the noisier of two collinear candidates would win and the pixel would be
 * solved against a partially contaminated colour.
 */
const MATTE_FIT_TOLERANCE = 2;

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

/**
 * Result of the dry-run detection — enough to decide whether to offer the feature
 * and to explain to the user what was found.
 */
export interface BackgroundDetection {
  /** True when a backdrop was found that is worth offering to remove. */
  hasBackground: boolean;
  /** The backdrop colour, or null when the border is not one solid colour. */
  color: [number, number, number] | null;
  /** Share of border samples matching that colour, 0-1. */
  uniformity: number;
  /** Share of the whole image the backdrop covers, 0-1. */
  coverage: number;
  /** The source already carries transparency (informational; a painted backdrop
   *  inside a transparent PNG is still detected and still offered). */
  alreadyTransparent: boolean;
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
 *   alpha-matte approximation that ramps the halo out instead of stepping, and
 *   re-derive the neighbour's colour so it stops carrying the backdrop's tint.
 *
 * The colour half matters as much as the alpha. A pixel that is 40 % artwork and
 * 60 % white, given a low alpha, still *looks* white wherever it is composited —
 * that pale edge is the halo people actually notice, and lowering alpha alone never
 * removes it. For a pixel known to be a blend, the artwork colour is recoverable
 * from `observed = coverage * artwork + (1 - coverage) * backdrop`, which is exact
 * and cheap; see the apply loop below.
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
    const o = idx * 4;
    if (data[o + 3] > alpha) data[o + 3] = alpha;

    // Un-premultiply the backdrop back out, at the coverage the ramp just assigned.
    // Guarded by a minimum coverage: below it the division only amplifies noise, and
    // the pixel is effectively gone anyway.
    const coverage = data[o + 3] / 255;
    if (coverage > 0.08) {
      for (let channel = 0; channel < 3; channel++) {
        const artworkChannel =
          (data[o + channel] - (1 - coverage) * colour[channel]) / coverage;
        data[o + channel] = clampByte(Math.round(artworkChannel));
      }
    }
  }
}

/**
 * Solve the boundary ring as a real alpha matte.
 *
 * A fill can only clear what *is* the backdrop colour. What it leaves behind is the
 * ring of pixels where artwork and backdrop are blended, and those blends can be
 * arbitrary — a 50/50 mix of dark navy and white sits ~180 from white, and even a
 * 95 %-artwork mix stays ~330 away — so colour distance cannot classify them, and
 * clearing them by geometry would shave off real artwork to hide the symptom.
 *
 * What identifies them is the mix itself:
 *
 *     observed = coverage * artwork + (1 - coverage) * backdrop
 *
 * Both unknowns are recoverable from the neighbourhood. `artwork` is the colour of
 * the opaque pixels just inside the shape; `coverage` is then the projection of
 * `observed` onto the line from the backdrop colour to it:
 *
 *     coverage = dot(observed - backdrop, artwork - backdrop) / |artwork - backdrop|²
 *
 * Writing that coverage as the pixel's alpha and un-premultiplying makes the pale,
 * white-tinged ring into a correctly coloured, partially transparent one — which is
 * the anti-aliased edge the artwork actually has — instead of a hard cut or a halo.
 * Left alone, a heavily blended pixel keeps alpha 255 and a colour washed toward the
 * backdrop, and that is the "some of the background is still there" ring.
 *
 * Only opaque pixels touching transparency are touched, so enclosed regions (white
 * text inside a badge) and every interior pixel are untouched. Where no interior
 * reference exists — a 1 px wireframe, or artwork whose colour *is* the backdrop
 * colour — the pixel is left exactly as it was rather than guessed at; the
 * artwork-risk warning covers the latter.
 *
 * Mutates `imageData` in place.
 */
export function matteBoundaryRing(
  imageData: ImageData,
  colour: [number, number, number],
  maxDistance: number,
  passes: number,
): void {
  const { data, width, height } = imageData;
  const rounds = Math.max(0, Math.floor(passes));
  if (!rounds) return;

  const backdropDistanceSq = maxDistance * maxDistance;
  const opaqueAt = (o: number) => data[o + 3] >= ALPHA_OPAQUE_MIN;
  // One byte per pixel: the pixels this function has already solved. Without it a
  // later pass would re-derive coverage from the colour an earlier pass wrote — which
  // is the artwork colour, not a blend — and put the alpha it removed straight back.
  const solved = new Uint8Array(width * height);

  for (let round = 0; round < rounds; round++) {
    // Snapshot the ring before writing to it: if a pass changed which pixels count as
    // boundary as it went, it would race inward and consume the artwork in one sweep.
    const boundary: number[] = [];
    const boundarySet = new Set<number>();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const o = index * 4;
        if (!opaqueAt(o) || solved[index]) continue;

        const exposedAt = (neighbourIndex: number) =>
          data[neighbourIndex * 4 + 3] < MATTE_EXPOSED_ALPHA;
        const touchesClear =
          (x > 0 && exposedAt(index - 1)) ||
          (x < width - 1 && exposedAt(index + 1)) ||
          (y > 0 && exposedAt(index - width)) ||
          (y < height - 1 && exposedAt(index + width));
        if (touchesClear) {
          boundary.push(index);
          boundarySet.add(index);
        }
      }
    }

    if (!boundary.length) return;

    for (const index of boundary) {
      const x = index % width;
      const y = (index - x) / width;
      const o = index * 4;

      const observed: [number, number, number] = [
        data[o],
        data[o + 1],
        data[o + 2],
      ];

      // The artwork colour this pixel is a blend of. It is *not* simply the nearest
      // opaque neighbour: on a two-pixel fringe the neighbour one ring in is itself a
      // blend, and solving against it returns that blend's coverage instead of the
      // real one. The candidate is chosen by how well it explains the pixel — see the
      // ranking inside the loop.
      let artwork: [number, number, number] | null = null;
      let bestResidual = Infinity;
      let bestMixLengthSq = 0;

      for (let radius = 1; radius <= MATTE_REFERENCE_RADIUS; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            // Only the shell at this radius; inner shells were scanned already.
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;

            const neighbourIndex = ny * width + nx;
            // A boundary pixel is another blend, and an already-solved pixel's colour
            // was derived rather than observed — neither is a reference for this one.
            if (boundarySet.has(neighbourIndex) || solved[neighbourIndex]) continue;

            const nO = neighbourIndex * 4;
            if (!opaqueAt(nO)) continue;

            const candidate: [number, number, number] = [
              data[nO],
              data[nO + 1],
              data[nO + 2],
            ];
            // Backdrop-coloured neighbours are background the fill could not reach,
            // not artwork.
            if (
              squaredDistance(
                candidate[0],
                candidate[1],
                candidate[2],
                colour,
              ) <= backdropDistanceSq
            ) {
              continue;
            }

            const mixR = candidate[0] - colour[0];
            const mixG = candidate[1] - colour[1];
            const mixB = candidate[2] - colour[2];
            const candidateMixLengthSq = mixR * mixR + mixG * mixG + mixB * mixB;
            if (candidateMixLengthSq <= 1) continue;

            const offsetR = observed[0] - colour[0];
            const offsetG = observed[1] - colour[1];
            const offsetB = observed[2] - colour[2];

            const fit = Math.max(
              0,
              Math.min(
                1,
                (offsetR * mixR + offsetG * mixG + offsetB * mixB) /
                  candidateMixLengthSq,
              ),
            );
            // Perpendicular distance from the line backdrop → candidate: how much of
            // this pixel that candidate leaves unexplained. A true mix lies on that
            // line, so the fit is near zero for the right colour and the wrong colours
            // are rejected by it.
            const residual = Math.sqrt(
              (offsetR - fit * mixR) ** 2 +
                (offsetG - fit * mixG) ** 2 +
                (offsetB - fit * mixB) ** 2,
            );

            // Best fit wins. When two candidates fit equally well — and the artwork's
            // own blends do, because a blend sits on the same line as the colour it was
            // mixed from, just nearer the backdrop — the one furthest from the backdrop
            // is the uncontaminated colour, so it is the one to solve against.
            const betterFit = residual < bestResidual - MATTE_FIT_TOLERANCE;
            const purerTie =
              residual <= bestResidual + MATTE_FIT_TOLERANCE &&
              candidateMixLengthSq > bestMixLengthSq;
            if (betterFit || purerTie) {
              bestResidual = Math.min(bestResidual, residual);
              bestMixLengthSq = candidateMixLengthSq;
              artwork = candidate;
            }
          }
        }
      }

      if (!artwork) continue;

      const mix: [number, number, number] = [
        artwork[0] - colour[0],
        artwork[1] - colour[1],
        artwork[2] - colour[2],
      ];
      const mixLengthSq =
        mix[0] * mix[0] + mix[1] * mix[1] + mix[2] * mix[2];
      // Artwork the same colour as the backdrop: there is no mix to solve. Leave the
      // pixel alone — the artwork-risk warning is what speaks to this case.
      if (mixLengthSq <= 1) continue;

      const offset: [number, number, number] = [
        observed[0] - colour[0],
        observed[1] - colour[1],
        observed[2] - colour[2],
      ];
      const coverage = Math.max(
        0,
        Math.min(
          1,
          (offset[0] * mix[0] + offset[1] * mix[1] + offset[2] * mix[2]) /
            mixLengthSq,
        ),
      );

      const alpha = Math.round(coverage * 255);
      data[o + 3] = alpha;
      solved[index] = 1;
      // Fully backdrop: the fill simply could not reach it. Its colour no longer
      // matters, and dividing by a coverage this small would only amplify noise.
      if (alpha < ALPHA_OPAQUE_MIN) continue;

      for (let channel = 0; channel < 3; channel++) {
        const recovered =
          (data[o + channel] - (1 - coverage) * colour[channel]) / coverage;
        data[o + channel] = clampByte(Math.round(recovered));
      }
    }
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

  if (removed > 0) {
    // Matte first: it resolves the blend ring exactly, and the soft edge below then
    // only has to deal with what the matte deliberately skipped — the pixels with no
    // interior reference to solve against.
    matteBoundaryRing(imageData, backdrop, maxDistance, EDGE_MATTE_PASSES);

    if (softEdge) {
      softenEdges(imageData, backdrop, maxDistance);
    }
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

/**
 * Dry run of the removal pipeline: work out whether a removable backdrop exists
 * and how much of the frame it covers, WITHOUT writing anything back.
 *
 * This is the only function here that may run without an explicit user action,
 * and it is safe to do so because it reports rather than edits — the caller uses
 * it to decide whether to *offer* the feature. `removeImageBackground()` remains
 * the only way pixels change.
 *
 * Never throws: a source that cannot be read, or has no solid backdrop, simply
 * reports `hasBackground: false`, so a detection failure can never block the
 * editor or hide the manual Remove Background button.
 */
export async function detectImageBackground(
  src: string,
  options: { tolerance?: number; maxDimension?: number } = {},
): Promise<BackgroundDetection> {
  const { tolerance = 12, maxDimension = DEFAULT_MAX_DIMENSION } = options;

  const nothingFound: BackgroundDetection = {
    hasBackground: false,
    color: null,
    uniformity: 0,
    coverage: 0,
    alreadyTransparent: false,
  };

  try {
    const canvas = await loadSourceCanvas(src, maxDimension);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return nothingFound;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const alreadyTransparent = detectTransparency(canvas);

    const detection = detectBorderColor(imageData);
    if (!detection.color) {
      return {
        ...nothingFound,
        uniformity: detection.uniformity,
        alreadyTransparent,
      };
    }

    // Measure the backdrop by running the real fill. `floodFillBackground` clears
    // alpha inside `imageData`, which belongs to this throwaway canvas and is never
    // written back — so the source image, and the caller's copy of it, are untouched.
    const removed = floodFillBackground(
      imageData,
      detection.color,
      toleranceToDistance(tolerance),
    );
    const coverage = removed / (imageData.width * imageData.height);

    return {
      // A backdrop worth offering covers some of the frame but is not the whole of
      // it — a fully-flooded image is a flat block of colour, not a logo.
      hasBackground:
        coverage >= OFFER_MIN_COVERAGE && coverage <= OFFER_MAX_COVERAGE,
      color: detection.color,
      uniformity: detection.uniformity,
      coverage,
      alreadyTransparent,
    };
  } catch {
    return nothingFound;
  }
}
