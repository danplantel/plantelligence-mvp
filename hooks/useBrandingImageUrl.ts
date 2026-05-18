"use client";

import { useState, useEffect, useCallback } from "react";
import { toR2BrandingKey, getR2ObjectProxyUrl } from "@/lib/branding-image-url";

/**
 * Resolves a branding image value to a display URL for <img>.
 * - R2 keys (`org/...`): same-origin `/api/r2/object?key=...` so the image loads reliably
 *   (presigned R2 URLs often fail in <img> due to CORS / bucket config even when signed-url API returns 200).
 * - Otherwise returns the value as-is (base64 or absolute URL).
 */
export function useBrandingImageUrl(
  value: string | null | undefined,
): { url: string | null; loading: boolean; refetch: () => Promise<void> } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value == null || value === "") {
      setUrl(null);
      setLoading(false);
      return;
    }
    const r2Key = toR2BrandingKey(value);
    if (r2Key == null) {
      setUrl(value);
      setLoading(false);
      return;
    }
    const proxy = getR2ObjectProxyUrl(r2Key);
    setUrl(proxy);
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
