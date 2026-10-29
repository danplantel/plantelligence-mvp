// Protecting routes with next-auth
// https://next-auth.js.org/configuration/nextjs#middleware
// https://nextjs.org/docs/app/building-your-application/routing/middleware

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  getAppHost,
  getAppOrigin,
  getMarketingOrigin,
  isMarketingAssetPath,
  isMarketingHost,
  isWwwMarketingHost,
  requestHostFromHeaders,
} from "@/lib/marketing/host";

// App routes that require auth + onboarding completion. Portal pages live at
// the root-level /{slug} (the (portal) route group) and are excluded here.
const APP_ROUTES = [
  "/dashboard",
  "/clients",
  "/benefits",
  "/new-benefits",
  "/edit-benefit",
  "/settings",
  "/documents",
  "/communications",
  "/new-client",
  "/edit-client",
  "/video",
  "/videos",
  "/onboarding",
];

function isPathOrChild(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestHost = requestHostFromHeaders(req.headers);

  // `x-pathname` lets app/layout.tsx tell the marketing root apart from the app
  // and portal pages. It has to be forwarded on the *request* (the response
  // header alone is not visible to server components).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-pathname", pathname);

  // Let static/public assets through (e.g. /logo.png) — they're never an app
  // or portal route.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return response;
  }

  // ── Public marketing site (plantel.ai) ─────────────────────────────────
  // The marketing site is served by this same deployment but owns its own
  // origin. `/` is the landing page there; every app or portal path belongs on
  // the app origin. The two origins are allowed to be the same host so a local
  // preview can exercise both without redirect loops.
  if (isMarketingHost(requestHost)) {
    const isMarketingAsset = isMarketingAssetPath(pathname);

    // One canonical marketing origin: `www.` never serves content itself.
    if (isWwwMarketingHost(requestHost)) {
      const targetOrigin =
        pathname === "/" || isMarketingAsset
          ? getMarketingOrigin()
          : getAppOrigin();
      return NextResponse.redirect(
        new URL(`${pathname}${req.nextUrl.search}`, targetOrigin),
        308,
      );
    }

    const sameHost = getAppHost() === requestHost;

    // App routes and portal slugs are not duplicated on the marketing host.
    if (pathname !== "/" && !isMarketingAsset && !sameHost) {
      return NextResponse.redirect(
        new URL(`${pathname}${req.nextUrl.search}`, getAppOrigin()),
        308,
      );
    }

    // `/` (and, on a shared local host, the app paths) render normally. The
    // root page is the marketing page, so no internal rewrite URL is exposed.
    return response;
  }

  // ── Root ───────────────────────────────────────────────────────────────
  // `/` is the public marketing landing page on every host — plantel.pro,
  // dev.plantel.pro, localhost. It is deliberately NOT a redirect to /signin:
  // sign-in keeps its own path, and app routes are gated further down.
  // Nothing to do for `/` here; it falls through to the root page.

  // ── Auth + onboarding gate for app routes ──────────────────────────────
  // /api/* and auth routes handle their own auth; only app routes need the
  // session + onboarding check (the flag lives in the JWT, set/refreshed by
  // the auth-options jwt callback).
  //
  // Root-level /{plan-slug} portal pages (the (portal) route group) are public
  // and must NOT be gated — they're served anonymously to employees. Any path
  // that isn't a known app/auth/public route is treated as a portal page and
  // passes through to the (portal) route group (which renders its own
  // not-found when the slug doesn't resolve).
  const isAppPath = APP_ROUTES.some((r) => isPathOrChild(pathname, r));
  if (isAppPath) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      // Mirror the session-cookie name that lib/auth-options.ts sets — it keys
      // off NODE_ENV, not NEXTAUTH_URL's protocol. getToken() otherwise derives
      // the cookie name from process.env.NEXTAUTH_URL: when that points at an
      // https URL (e.g. .env's https://plantel.pro) while the dev server runs
      // over http, getToken looks for "__Secure-next-auth.session-token" but
      // the server only set "next-auth.session-token", so every /dashboard
      // request is treated as unauthenticated and bounced back to /signin.
      cookieName:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
    });

    if (!token) {
      const signInUrl = new URL("/signin", req.url);
      // Relative callbackUrl (path + query). This is the same-origin target
      // NextAuth accepts natively, and it means the post-sign-in redirect lands
      // back on the originally requested page (e.g. /onboarding from a resume
      // email) without an absolute-URL round trip.
      signInUrl.searchParams.set(
        "callbackUrl",
        `${pathname}${req.nextUrl.search ?? ""}`,
      );
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
    // skipping Next.js internals and ALL /api/* paths. Portal API routes
    // (/api/clients/..., /api/profile, etc.) resolve the owning advisor from
    // the plan slug in the Node runtime, so they must not run through
    // middleware.
    "/((?!_next/|favicon.ico|api/).*)",
  ],
};
