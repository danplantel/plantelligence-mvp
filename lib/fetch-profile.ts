// lib/fetch-profile.ts
//
// Single-flight fetcher for GET /api/profile.
//
// Several components on a page (settings forms, the layout header's user-nav,
// disclaimers, etc.) all need the same user profile. Without coordination each
// one fires its own `fetch("/api/profile")`, and because the route is slow
// (Prisma query with several nested includes), "is it cached yet?" fallbacks
// end up racing each other and producing N identical requests on page load.
//
// This helper coalesces concurrent callers onto a single in-flight request:
// the first caller starts the request, and every caller that arrives before it
// settles reuses the same promise. It resolves to the parsed JSON profile, or
// null when the request fails / returns a non-2xx response (callers treat that
// as "no data available").

let profilePromise: Promise<any | null> | null = null;

export function fetchProfileOnce(): Promise<any | null> {
  if (!profilePromise) {
    profilePromise = fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .finally(() => {
        profilePromise = null;
      });
  }
  return profilePromise;
}
