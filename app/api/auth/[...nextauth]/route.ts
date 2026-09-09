import { authOptions } from "@/lib/auth-options";
import NextAuth from "next-auth/next";
import type { NextRequest } from "next/server";

const handler = NextAuth(authOptions);

const ROOT_DOMAIN = (process.env.ROOT_DOMAIN || "plantel.pro")
  .replace(/^\./, "")
  .toLowerCase();

/**
 * Decide the Domain attribute for the session cookie based on the ACTUAL
 * request host (not an env URL, which may be copied/stale between Vercel
 * projects).
 *
 * - On the Plantel root domain (plantel.pro, www.plantel.pro, waypoint.…,
 *   etc.) the session cookie is scoped to `.plantel.pro` so it is shared
 *   across the apex and all subdomains.
 * - On any other host (e.g. the Vercel dev domain plantel-dev.vercel.app) the
 *   cookie stays host-only — a `Domain=.plantel.pro` cookie would be rejected
 *   by the browser there, silently dropping the session after a successful
 *   sign-in.
 */
function cookieDomainForHost(req: NextRequest): string | null {
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  if (!host) return null;
  return host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`)
    ? `.${ROOT_DOMAIN}`
    : null;
}

function isSessionTokenCookie(setCookieValue: string): boolean {
  const name = (setCookieValue.split(";")[0] || "").trim();
  return (
    name.startsWith("__Secure-next-auth.session-token=") ||
    name.startsWith("next-auth.session-token=")
  );
}

/** Replace (or add) the Domain= attribute on a serialized Set-Cookie value. */
function withCookieDomain(setCookieValue: string, domain: string): string {
  const parts = setCookieValue
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.toLowerCase().startsWith("domain="));
  return `${parts.join("; ")}; Domain=${domain}`;
}

async function auth(req: NextRequest, ctx: any) {
  const res = await handler(req, ctx);

  // Host-only cookies are already correct for non-Plantel hosts — nothing to do.
  const domain = cookieDomainForHost(req);
  if (!domain) return res;

  // NextAuth v4 serializes cookies as real Set-Cookie headers on the returned
  // Response (see next-auth/next). getSetCookie() exists on Node Headers
  // (Node >= 18.13); if it is unavailable, keep the host-only cookie.
  const headers = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie !== "function") return res;

  const setCookies = headers.getSetCookie();
  if (!setCookies || setCookies.length === 0) return res;

  const rewritten = setCookies.map((cookie) =>
    isSessionTokenCookie(cookie) ? withCookieDomain(cookie, domain) : cookie,
  );

  const nextHeaders = new Headers(res.headers);
  nextHeaders.delete("set-cookie");
  for (const cookie of rewritten) nextHeaders.append("set-cookie", cookie);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: nextHeaders,
  });
}

export { auth as GET, auth as POST };
