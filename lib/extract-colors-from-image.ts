/**
 * Extract primary and secondary colors from an image.
 *
 * Uses canvas pixel analysis with:
 *  - Color quantization (5-bit per channel) so anti-aliased / gradient shades of
 *    the same hue are grouped into one dominant bucket instead of splitting the
 *    most frequent exact hex across dozens of near-identical values.
 *  - Saturation weighting so vivid brand colors out-rank muted/background pixels.
 *  - Neutral filtering (near-white, near-black, and grays R≈G≈B) so backgrounds,
 *    borders, and text don't masquerade as brand colors.
 *  - Secondary = the next most dominant color that is clearly distinct from the
 *    primary (not the "farthest" color, which often picks a background/accent).
 */

interface ColorResult {
  primary: string;
  secondary: string;
}

/** Convert RGB to Hex color. */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b]
    .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Get color distance (simple Euclidean distance in RGB space). */
function getColorDistance(
  color1: [number, number, number],
  color2: [number, number, number],
): number {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

interface DominantColor {
  hex: string;
  count: number;
  rgb: [number, number, number];
}

/**
 * Extract primary and secondary colors from an image.
 */
export async function extractColorsFromImage(
  imageUrl: string,
): Promise<ColorResult> {
  // For non-inline sources (R2 same-origin proxy, external URLs) fetch the bytes
  // first and draw from an object URL. A blob drawn from the same origin never
  // taints the canvas, so getImageData works regardless of CORS headers on the
  // source. Inline data URLs are used directly.
  let src = imageUrl;
  let objectUrl: string | null = null;
  if (!imageUrl.startsWith("data:")) {
    try {
      const res = await fetch(imageUrl, { credentials: "same-origin" });
      if (res.ok) {
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        src = objectUrl;
      }
    } catch {
      // Fall through to a direct <img> load below.
    }
  }

  return new Promise<ColorResult>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Set canvas size to image size (limit to 200x200 for performance)
        const maxSize = 200;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Quantization step (5-bit per channel). Groups similar shades into one
        // bucket so the perceived dominant hue wins regardless of anti-aliasing.
        const STEP = 32;
        const buckets = new Map<
          string,
          { count: number; rSum: number; gSum: number; bSum: number }
        >();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          const brightness = (r + g + b) / 3;
          // Skip near-white / near-black pixels (often backgrounds/text)
          if (brightness > 240 || brightness < 15) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const maxDiff = max - min;
          // Skip near-pure grays (R≈G≈B within ~12) — backgrounds, borders, and
          // text. Muted "slate" brand colors (which carry a visible hue) are kept
          // and de-prioritized by the saturation weighting below.
          if (maxDiff <= 12) continue;

          // Weight pixels by saturation so vivid brand colors out-rank muted ones.
          const saturation = max === 0 ? 0 : maxDiff / max;
          const weight = 0.5 + saturation;

          const br = Math.min(255, Math.round(r / STEP) * STEP);
          const bg = Math.min(255, Math.round(g / STEP) * STEP);
          const bb = Math.min(255, Math.round(b / STEP) * STEP);

          const key = `${br}|${bg}|${bb}`;
          const entry = buckets.get(key);
          if (entry) {
            entry.count += weight;
            entry.rSum += r * weight;
            entry.gSum += g * weight;
            entry.bSum += b * weight;
          } else {
            buckets.set(key, {
              count: weight,
              rSum: r * weight,
              gSum: g * weight,
              bSum: b * weight,
            });
          }
        }

        if (buckets.size === 0) {
          // Fallback if no suitable colors found
          resolve({ primary: "#1F3A60", secondary: "#4A90E2" });
          return;
        }

        // Sort buckets by weighted dominance (most prominent first)
        const dominant: DominantColor[] = Array.from(buckets.values())
          .map((e) => {
            const r = Math.round(e.rSum / e.count);
            const g = Math.round(e.gSum / e.count);
            const b = Math.round(e.bSum / e.count);
            return {
              hex: rgbToHex(r, g, b),
              count: e.count,
              rgb: [r, g, b] as [number, number, number],
            };
          })
          .sort((a, b) => b.count - a.count);

        // Primary = the most dominant color
        const primaryColor = dominant[0].hex;

        // Secondary = the next most dominant color that is clearly a different
        // hue. Start from the 2nd cluster and skip near-identical shades
        // (anti-aliasing/gradients of the primary) until a genuinely distinct
        // color is found. Threshold is deliberately modest (30 RGB units) so
        // muted/adjacent brand hues (e.g. slate plum vs slate green) still
        // register as distinct instead of being skipped.
        let secondaryColor = dominant[1]?.hex || primaryColor;
        for (let i = 1; i < dominant.length; i++) {
          if (getColorDistance(dominant[0].rgb, dominant[i].rgb) >= 30) {
            secondaryColor = dominant[i].hex;
            break;
          }
        }

        resolve({ primary: primaryColor, secondary: secondaryColor });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = src;
  }).finally(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
}
