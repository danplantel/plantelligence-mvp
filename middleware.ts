// Protecting routes with next-auth
// https://next-auth.js.org/configuration/nextjs#middleware
// https://nextjs.org/docs/app/building-your-application/routing/middleware

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  // Let static/public assets through (e.g. /logo.png) — they're never an app
  // or portal route.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return response;
  }

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
    // skipping Next.js internals and ALL /api/* paths. Portal API routes
    // (/api/clients/..., /api/profile, etc.) resolve the owning advisor from
    // the plan slug in the Node runtime, so they must not run through
    // middleware.
    "/((?!_next/|favicon.ico|api/).*)",
  ],
};
