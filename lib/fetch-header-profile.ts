// lib/fetch-header-profile.ts
//
// Single-flight + short-TTL fetcher for GET /api/profile/header.
//
// The dashboard header unmounts and remounts on every route change inside the
// dashboard, so a plain fetch in its mount effect re-requested the payload on
// every navigation. This mirrors lib/fetch-profile.ts:
//   1. Coalesces concurrent callers onto one in-flight request.
//   2. Reuses a recently resolved payload so a remount doesn't hit the network.
// It resolves to the parsed payload, or null on failure/non-2xx.

export interface HeaderProfile {
  name: string;
  email: string;
  title: string;
  /** Presigned R2 URL, or the raw value when it isn't an R2 key (null if none). */
  avatarUrl: string | null;
  /** Same-origin proxy URL for the avatar, used when `avatarUrl` is missing or fails. */
  avatarFallbackUrl: string | null;
}

let request: Promise<HeaderProfile | null> | null = null;
let cached: HeaderProfile | null = null;
let cachedAt = 0;

// Matches the window used by the other profile fetcher, so a rename or new
// avatar shows up about as quickly as it does elsewhere.
const CACHE_TTL = 60_000;

export function fetchHeaderProfileOnce(): Promise<HeaderProfile | null> {
  if (cached !== null && Date.now() - cachedAt < CACHE_TTL) {
    return Promise.resolve(cached);
  }

  if (!request) {
    request = fetch("/api/profile/header")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => (payload?.success ? (payload.data as HeaderProfile) : null))
      .catch(() => null)
      .finally(() => {
        request = null;
      });

    // Cache the resolved value; a failure (null) is not cached, so the next
    // caller retries.
    request.then((data) => {
      if (data !== null) {
        cached = data;
        cachedAt = Date.now();
      }
    });
  }

  return request;
}

/**
 * Drop the cached payload so the next call hits the network. Called by
 * `invalidateProfileCache()` — any save that changes the name or avatar updates
 * both caches together.
 */
export function invalidateHeaderProfileCache(): void {
  cached = null;
  cachedAt = 0;
}
