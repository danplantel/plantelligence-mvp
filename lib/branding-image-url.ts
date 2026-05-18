/**
 * Branding image URL resolution: R2 keys → signed URL.
 * Convention: a string starting with "org/" is an R2 storage key; resolve via GET /api/r2/signed-url.
 * Results are cached in memory to avoid refetching when parent re-renders (e.g. typing in step 3 form).
 */

const R2_KEY_PREFIX = "org/";

/**
 * Strip BOM/whitespace and a single leading slash so stored values like "/org/…"
 * or "\uFEFForg/…" still resolve. Without this, `org/…` is requested as a relative
 * URL (e.g. /new/org/…) and returns 404.
 */
export function normalizePotentialR2Key(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().replace(/^\//, "");
}

/**
 * Returns the canonical R2 object key, or null if the string is not an org/ key.
 * Prefix is matched case-insensitively so `Org/...` still resolves (avoids relative URLs like /new/org/... → 404).
 */
export function toR2BrandingKey(
  value: string | null | undefined,
): string | null {
  if (value == null || typeof value !== "string") return null;
  const n = normalizePotentialR2Key(value);
  if (n.length < 4) return null;
  const head = n.slice(0, 4).toLowerCase();
  if (head !== "org/") return null;
  return R2_KEY_PREFIX + n.slice(4);
}

/** TTL 50 minutes so we refresh before typical 1h signed URL expiry */
const CACHE_TTL_MS = 50 * 60 * 1000;

const signedUrlCache = new Map<
  string,
  { url: string; expiresAt: number }
>();

function getCachedSignedUrl(key: string): string | null {
  const entry = signedUrlCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.url;
}

function setCachedSignedUrl(key: string, url: string): void {
  signedUrlCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function isR2BrandingKey(value: string | null | undefined): value is string {
  return toR2BrandingKey(value) !== null;
}

/**
 * Same-origin URL to stream an R2 object through the app (authenticated).
 * Use for Fabric/canvas — presigned R2 URLs often fail CORS when loaded as images on canvas.
 */
export function getR2ObjectProxyUrl(key: string): string | null {
  const canonical = toR2BrandingKey(key);
  if (!canonical) return null;
  return `/api/r2/object?key=${encodeURIComponent(canonical)}`;
}

/**
 * `next/image` requires a root-relative path (`/...`) or an absolute URL — bare R2 keys
 * like `org/.../branding/secondaryBanner/...` are invalid. Maps those to
 * `getR2ObjectProxyUrl`; leaves `/public-assets`, `https://…`, and `data:` as-is.
 */
export function toNextImageSrc(
  value: string | null | undefined,
  fallback: string = "/Hiking-Couple-Looking.webp",
): string {
  if (value == null) return fallback;
  const v = String(value).trim();
  if (!v) return fallback;
  if (v.startsWith("data:") || /^https?:\/\//i.test(v)) {
    return v;
  }
  // R2 object key (e.g. org/…/plans/…/branding/…)
  const r2 = toR2BrandingKey(v);
  if (r2) {
    const p = getR2ObjectProxyUrl(r2);
    if (p) return p;
  }
  if (v.startsWith("/")) {
    return v;
  }
  return fallback;
}

/**
 * Value suitable for FabricImage.fromURL / Image(): R2 keys → proxy URL; data/http URLs unchanged.
 * Also rewrites presigned R2 object URLs (legacy stored URLs) to the same-origin proxy.
 */
export function toFabricImageLoadUrl(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  if (/^https?:\/\//i.test(value) && value.includes("/org/")) {
    const orgIdx = value.indexOf("/org/");
    const fromOrg = value.slice(orgIdx + 1).split("?")[0];
    if (fromOrg.startsWith("org/")) {
      const proxy = getR2ObjectProxyUrl(fromOrg);
      if (proxy) return proxy;
    }
  }
  const proxy = getR2ObjectProxyUrl(value);
  if (proxy) return proxy;
  return value;
}

/** Slots used in `buildBrandingKey` (lib/r2.ts). */
export type BrandingKeySlot =
  | "logo"
  | "background"
  | "thumbnail"
  | "secondaryBanner"
  | "favicon";

/**
 * Some legacy saves stored only the last path segment of an R2 branding key
 * (e.g. "1736123456789-logo_cropped-png") instead of `org/.../branding/{slot}/...`.
 * Reconstruct the full key when safe (no slashes, not data/http URL, not already org/).
 */
export function coerceBareBrandingKeySegment(
  value: string | null | undefined,
  orgId: string,
  planId: string,
  slot: BrandingKeySlot,
): string | null | undefined {
  if (value == null || typeof value !== "string") return value;
  const v = normalizePotentialR2Key(value);
  if (!v) return value;
  if (v.startsWith(R2_KEY_PREFIX)) return v;
  if (v.startsWith("data:") || /^https?:\/\//i.test(v)) return v;
  if (v.includes("/")) return value;
  return `${R2_KEY_PREFIX}${orgId}/plans/${planId}/branding/${slot}/${v}`;
}

type JsonBrandSlotMap = {
  header?: unknown;
  thumbnail?: unknown;
  secondaryBanner?: unknown;
  favicon?: unknown;
};

/**
 * Returns a shallow copy of the client record with branding image strings coerced to full R2 keys when needed.
 */
export function normalizeClientBrandingKeysForResponse<
  T extends Record<string, unknown>,
>(client: T, orgId: string, planId: string): T {
  const c = (v: unknown, slot: BrandingKeySlot) =>
    typeof v === "string"
      ? coerceBareBrandingKeySegment(v, orgId, planId, slot)
      : v;

  const out: Record<string, unknown> = { ...client };
  if (typeof out.companyLogo === "string") {
    out.companyLogo = c(out.companyLogo, "logo");
  }
  if (typeof out.backgroundImg === "string") {
    out.backgroundImg = c(out.backgroundImg, "background");
  }
  if (typeof out.thumbnailImg === "string") {
    out.thumbnailImg = c(out.thumbnailImg, "thumbnail");
  }
  if (typeof out.secondaryBannerImg === "string") {
    out.secondaryBannerImg = c(out.secondaryBannerImg, "secondaryBanner");
  }
  if (typeof out.faviconImg === "string") {
    out.faviconImg = c(out.faviconImg, "favicon");
  }

  const bi = out.brandImages as JsonBrandSlotMap | null | undefined;
  if (bi && typeof bi === "object" && !Array.isArray(bi)) {
    const next: JsonBrandSlotMap = { ...bi };
    const pairs: [keyof JsonBrandSlotMap, BrandingKeySlot][] = [
      ["header", "background"],
      ["thumbnail", "thumbnail"],
      ["secondaryBanner", "secondaryBanner"],
      ["favicon", "favicon"],
    ];
    for (const [key, slot] of pairs) {
      const entry = next[key] as { url?: string } | null | undefined;
      if (entry && typeof entry === "object" && typeof entry.url === "string") {
        (next as Record<string, unknown>)[key as string] = {
          ...entry,
          url: c(entry.url, slot),
        };
      }
    }
    out.brandImages = next;
  }

  return out as T;
}

export interface GetBrandingSignedUrlOptions {
  /** If true, skip cache and always fetch (e.g. for refetch after expiry). */
  skipCache?: boolean;
}

/**
 * Fetch a signed read URL for an R2 key. Returns the URL or null on failure.
 * Uses in-memory cache to avoid duplicate requests when the same key is used across re-renders.
 */
export async function getBrandingSignedUrl(
  key: string,
  options?: GetBrandingSignedUrlOptions
): Promise<string | null> {
  const canonicalKey = toR2BrandingKey(key) ?? null;
  if (!canonicalKey) return null;

  if (!options?.skipCache) {
    const cached = getCachedSignedUrl(canonicalKey);
    if (cached) return cached;
  }
  try {
    const res = await fetch(
      `/api/r2/signed-url?key=${encodeURIComponent(canonicalKey)}`,
      { credentials: "include" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    const url = data.url ?? null;
    if (url) setCachedSignedUrl(canonicalKey, url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Resolve a branding image value to a display URL.
 * - If value is an R2 key (starts with "org/"), returns the signed URL (async).
 * - Otherwise returns the value as-is (base64 data URL or external URL).
 */
export async function resolveBrandingImageUrl(
  value: string | null | undefined
): Promise<string | null> {
  if (value == null || value === "") return null;
  const key = toR2BrandingKey(value);
  if (key) return getR2ObjectProxyUrl(key);
  return value;
}
