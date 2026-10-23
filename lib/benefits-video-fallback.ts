/**
 * The image the journey (`BenefitsVideoSection`) shows when a plan has no video.
 *
 * A plan may set its own image (`Benefit.planVideoFallbackImage`), picked from the
 * in-app gallery or uploaded in the Video Source editor. When it has not, each
 * benefit category has a stock image here — the same one the portal showed before
 * the image became editable, so nothing changes for plans that never touch it.
 *
 * Kept in one module because four surfaces read it — the live hubs, the Step 2
 * preview, the editor's "Default Image" card and its gallery fallback — and a
 * default that differed between them would be a difference nobody could explain.
 */

/** Stock fallback image per benefit category (the Custom hub uses the Wellness one). */
export const VIDEO_FALLBACK_IMAGES: Record<string, string> = {
  Retirement:
    "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1600&q=80",
  "Group Health":
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600&q=80",
  "Group Life":
    "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1600&q=80",
  "Company / Plan Sponsor":
    "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1600&q=80",
};

/** The stock fallback image for a category, defaulting to Retirement's. */
export function resolveCategoryVideoFallbackImage(category?: string): string {
  const key = (category || "").trim();
  return VIDEO_FALLBACK_IMAGES[key] || VIDEO_FALLBACK_IMAGES.Retirement;
}

/**
 * Turn a stored fallback image into something an `<img>`/`next/image` can load.
 *
 * Data URLs and absolute URLs load as-is; a raw R2 key goes through the
 * same-origin `/api/r2/object` proxy (or, for the public portal, the presigned URL
 * the benefit API returns). Returns `""` for an unset value so callers can simply
 * fall through to the category default.
 */
export function resolveVideoFallbackImageUrl(value?: string | null): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (
    raw.startsWith("data:") ||
    raw.startsWith("http") ||
    raw.startsWith("/")
  ) {
    return raw;
  }
  return `/api/r2/object?key=${encodeURIComponent(raw)}`;
}

/**
 * The image a plan's journey section should actually paint, in priority order:
 * the plan's own fallback image, then the category's stock image.
 */
export function resolveJourneyImage(
  storedImage: string | null | undefined,
  category?: string,
): string {
  return (
    resolveVideoFallbackImageUrl(storedImage) ||
    resolveCategoryVideoFallbackImage(category)
  );
}
