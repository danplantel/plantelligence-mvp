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

// App routes that require auth + onboarding completion. Portal pages live at
// the root-level /{slug} (the (portal) route group) and are excluded here.
const APP_ROUTES = [
  "/dashboard",
  "/clients",
  "/benefits",
  "/settings",
  "/documents",
  "/communications",
  "/new-client",
  "/edit-client",
  "/video",
  "/videos",
  "/onboarding",
];

// Public auth routes — never gated by the session/onboarding checks.
const AUTH_ROUTES = [
  "/signin",
  "/signup",
  "/forget",
  "/reset-password",
  "/verify-code",
];

function isPathOrChild(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") || "";
  const rootDomain = process.env.ROOT_DOMAIN || "plantel.pro";
  const subdomain = extractSubdomain(host, rootDomain);

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  // Let static/public assets through (e.g. /logo.png) — they're never an app
  // or portal route. /api/r2/object image paths are exempt so subdomain image
  // serving below can still attach x-advisor-id.
  if (
    !pathname.startsWith("/api/r2/object") &&
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return response;
  }

  // ── Subdomain portal routing ──────────────────────────────────────────
  // Subdomains serve ONLY the public portal (root-level /{slug} and its
  // sub-pages). Every non-API path is a portal page; /api/r2/object serves
  // portal images. The subdomain→advisor lookup is delegated to
  // /api/resolve-subdomain (Node.js runtime) because Prisma cannot run in
  // Edge middleware.
  if (subdomain) {
    // Only the R2 image proxy is allowed on a subdomain; other API routes
    // aren't portal pages.
    if (
      pathname.startsWith("/api/") &&
      !pathname.startsWith("/api/r2/object")
    ) {
      return NextResponse.rewrite(new URL("/not-found", req.url));
    }

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
      return response;
    } catch (err) {
      console.error("[middleware] subdomain lookup error:", err);
      return NextResponse.rewrite(new URL("/not-found", req.url));
    }
  }

  // ── Apex domain ────────────────────────────────────────────────────────
  // Portal pages (root-level /{slug}) must only be accessed via a subdomain.
  // Any apex path that isn't a known app/auth/api route is treated as a
  // portal request and redirected to the dashboard.
  const isAuthPath = AUTH_ROUTES.some((r) => isPathOrChild(pathname, r));
  const isKnownPath =
    pathname === "/" ||
    pathname === "/not-found" ||
    pathname.startsWith("/api/") ||
    isAuthPath ||
    APP_ROUTES.some((r) => isPathOrChild(pathname, r));

  if (!isKnownPath) {
    // Development exception: allow the portal to be previewed locally (e.g.
    // the clients list Hub button opens http://localhost:3000/{slug}), mirroring
    // the public subdomain behavior. Production stays subdomain-only.
    if (process.env.NODE_ENV === "development") {
      return response;
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // ── Auth + onboarding gate for app routes ──────────────────────────────
  // /api/* and auth routes handle their own auth; only app routes need the
  // session + onboarding check (the flag lives in the JWT, set/refreshed by
  // the auth-options jwt callback).
  const isAppPath = APP_ROUTES.some((r) => isPathOrChild(pathname, r));
  if (isAppPath) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const signInUrl = new URL("/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(signInUrl);
    }

    // Incomplete users are sent to /onboarding; /onboarding itself is excluded.
    const isOnboardingPage = pathname.startsWith("/onboarding");
    if (!isOnboardingPage && !(token as any).onboardingComplete) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Catch-all for app + portal routes (root-level /{slug} and /{slug}/…),
    // skipping Next.js internals and ALL /api/* paths. If /api/* were matched,
    // the middleware's own internal fetch to /api/resolve-subdomain (and the
    // portal's /api/clients/... calls) would be re-intercepted and rewritten to
    // the HTML not-found page, breaking JSON responses.
    "/((?!_next/|favicon.ico|api/).*)",
    // /api/r2/object must still run through middleware for subdomain image serving.
    "/api/r2/object",
  ],
};
