// Protecting routes with next-auth
// https://next-auth.js.org/configuration/nextjs#middleware
// https://nextjs.org/docs/app/building-your-application/routing/middleware

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Extract the tenant subdomain from a host header.
 *
 * Examples:
 *   "waypoint.plantel.pro"        → "waypoint"
 *   "www.waypoint.plantel.pro"    → "waypoint"  (www is stripped)
 *   "www.plantel.pro"             → null (www alone is treated as apex)
 *   "plantel.pro"                 → null (apex)
 *   "localhost:3000"              → null (local dev)
 */
function extractSubdomain(host: string, rootDomain: string): string | null {
  if (!host) return null;
  if (host === rootDomain || host.startsWith("localhost")) return null;
  const base = host.replace(`.${rootDomain}`, "");
  const parts = base.split(".");
  // Take the rightmost subdomain part (closest to the root domain).
  const candidate = parts[parts.length - 1];
  if (!candidate || candidate.includes(":") || candidate === "www") return null;
  return candidate;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") || "";
  const rootDomain = process.env.ROOT_DOMAIN || "plantel.pro";
  const subdomain = extractSubdomain(host, rootDomain);

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  // ── Subdomain portal routing ──────────────────────────────────────────
  // Subdomains are ONLY valid for public portal paths (/new/view/*).
  // The subdomain→advisor lookup is delegated to /api/resolve-subdomain
  // (Node.js runtime) because Prisma cannot run in Edge middleware.
  if (subdomain) {
    if (pathname.startsWith("/new/view/")) {
      try {
        const resolveUrl = new URL("/api/resolve-subdomain", req.url);
        resolveUrl.searchParams.set("subdomain", subdomain);
        const resolveRes = await fetch(resolveUrl.toString());

        if (!resolveRes.ok) {
          // Invalid subdomain — show the app's not-found page
          return NextResponse.rewrite(new URL("/not-found", req.url));
        }

        const { userId } = await resolveRes.json();
        response.headers.set("x-advisor-id", userId);
        response.headers.set("x-root-domain", rootDomain);

        // Public portal — no auth required
        return response;
      } catch (err) {
        console.error("[middleware] subdomain lookup error:", err);
        return NextResponse.rewrite(new URL("/not-found", req.url));
      }
    }

    // Subdomain request to a non-portal path — show not-found page
    return NextResponse.rewrite(new URL("/not-found", req.url));
  }

  // ── Block portal paths on the apex domain ─────────────────────────────
  // /new/view/* pages are employee-facing portals and must only be accessed
  // via a subdomain (e.g. waypoint.plantel.pro/new/view/gloomis). Visiting
  // them directly on plantel.pro redirects to the dashboard.
  if (pathname.startsWith("/new/view/")) {
    return NextResponse.redirect(new URL("/new/dashboard", req.url));
  }

  // ── Auth check for all other matched routes ────────────────────────────
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/new/:path*",
    "/onboarding/:path*",
  ],
};
