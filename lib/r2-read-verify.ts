import { toR2BrandingKey } from "@/lib/branding-image-url";

/**
 * After a client PUT to R2, confirm the app can read the object via GET /api/r2/object
 * (same bucket and credentials as presign). Retries briefly for read-after-write lag.
 */
export async function verifyR2ObjectReadableViaApp(
  key: string,
  opts?: { retries?: number; initialDelayMs?: number },
): Promise<boolean> {
  const canonical = toR2BrandingKey(key);
  if (!canonical) return false;
  const retries = opts?.retries ?? 5;
  const initialDelayMs = opts?.initialDelayMs ?? 200;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, initialDelayMs * attempt));
    }
    try {
      const res = await fetch(
        `/api/r2/object?key=${encodeURIComponent(canonical)}`,
        { credentials: "include", cache: "no-store" },
      );
      if (res.ok) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}
