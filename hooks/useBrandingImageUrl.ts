"use client";

import { useState, useEffect, useCallback } from "react";
import { toR2BrandingKey, getR2ObjectProxyUrl } from "@/lib/branding-image-url";

/**
 * Synchronously resolves a branding image value to a display URL.
 * - R2 keys (`org/...`): same-origin `/api/r2/object?key=...` so the image loads reliably
 *   (presigned R2 URLs often fail in <img> due to CORS / bucket config even when signed-url API returns 200).
 * - Otherwise returns the value as-is (base64 or absolute URL).
 */
function resolveBrandingUrl(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const r2Key = toR2BrandingKey(value);
  if (r2Key == null) return value;
  return getR2ObjectProxyUrl(r2Key);
}

/**
 * Resolves a branding image value to a display URL for <img>.
 * The URL is computed synchronously so the first render immediately has the correct value
 * (avoids a flash where the image is missing on initial mount).
 */
export function useBrandingImageUrl(
  value: string | null | undefined,
): { url: string | null; loading: boolean; refetch: () => Promise<void> } {
  // Initialize synchronously — getR2ObjectProxyUrl is a pure string transform, no async needed.
  const [url, setUrl] = useState<string | null>(() => resolveBrandingUrl(value));
  const [loading, setLoading] = useState(false);

  // Keep in sync when value changes (e.g. a new image is uploaded)
  useEffect(() => {
    setUrl(resolveBrandingUrl(value));
    setLoading(false);
  }, [value]);

  const refetch = useCallback(async () => {
    if (value == null || value === "") return;
    const r2Key = toR2BrandingKey(value);
    if (r2Key == null) return;
    setLoading(true);
    const base = getR2ObjectProxyUrl(r2Key);
    if (base) {
      // Cache-bust so the browser retries the image after a transient error
      const sep = base.includes("?") ? "&" : "?";
      setUrl(`${base}${sep}_=${Date.now()}`);
    }
    setLoading(false);
  }, [value]);

  return { url, loading, refetch };
}
