/**
 * Pure navigation helpers for the sign-in flow.
 *
 * Keeping these decisions out of the React components makes the redirect rules
 * (deep links, onboarding resumption, role-aware landing, and the "never bounce
 * back to /signin" guard) unit-testable without a browser.
 */

/**
 * Where a sign-in lands when the user asked for no particular page.
 *
 * A route rather than a page: it resolves the viewer's role server-side and
 * redirects to the right place (the Dashboard, or the Benefits page for a
 * Collaborator) — see `app/api/teammates/landing/route.ts`.
 */
export const DEFAULT_LANDING_PATH = "/api/teammates/landing";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * Where an ALREADY signed-in visitor to /signin should go.
 *
 * Returns `null` when no redirect should happen (still loading, signed out, or
 * no `callbackUrl`). An onboarding deep link is collapsed to `/onboarding` so a
 * stale step-specific URL (e.g. from a resume email) cannot 404.
 */
export function resolveSignInRedirect(
  status: SessionStatus,
  callbackUrl: string | null | undefined,
): string | null {
  if (status !== "authenticated" || !callbackUrl) return null;
  return callbackUrl.includes("/onboarding") ? "/onboarding" : callbackUrl;
}

/**
 * Where a successful sign-in should navigate.
 *
 * Prefer NextAuth's resolved URL, then the `callbackUrl` from the query, then
 * the role-aware landing route. Never navigate back to `/signin` — for a user
 * resuming onboarding that reads as a broken loop.
 */
export function resolvePostSignInPath(
  resultUrl: string | null | undefined,
  callbackUrl: string | null | undefined,
): string {
  const target = resultUrl || callbackUrl || DEFAULT_LANDING_PATH;
  return target.startsWith("/signin") ? "/onboarding" : target;
}

/**
 * Reads the NextAuth `callbackUrl` query parameter from a location search
 * string. Blank values are treated as "no callback".
 */
export function getCallbackUrl(search: string): string | null {
  const value = new URLSearchParams(search).get("callbackUrl");
  return value ? value : null;
}
