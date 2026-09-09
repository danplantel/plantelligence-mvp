// Protecting routes with next-auth
// https://next-auth.js.org/configuration/nextjs#middleware
// https://nextjs.org/docs/app/building-your-application/routing/middleware

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { extractSubdomain } from "@/lib/portal-subdomain";

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
  console.log(
    `[middleware] host=${host} rootDomain=${rootDomain} extractedSubdomain=${subdomain || "(none)"} path=${pathname} env=${process.env.NODE_ENV}`,
  );

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  // Let static/public assets through (e.g. /logo.png) — they're never an app
  // or portal route. /api/r2/object image paths are exempt so subdomain image
  // serving below still works (the R2 route resolves the advisor from the Host).
  if (
    !pathname.startsWith("/api/r2/object") &&
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return response;
  }

  // ── Subdomain portal routing ──────────────────────────────────────────
  // Subdomains serve ONLY the public portal (root-level /{slug} and its
  // sub-pages). Every non-API path is a portal page; /api/r2/object serves
  // portal images. Advisor scoping happens in the Node.js API routes
  // (resolvePortalAdvisorId derives the advisor from the Host subdomain via
  // Prisma), so the Edge middleware just lets portal requests through.
  if (subdomain) {
    // Only the R2 image proxy is allowed on a subdomain; other API routes
    // aren't portal pages.
    if (
      pathname.startsWith("/api/") &&
      !pathname.startsWith("/api/r2/object")
    ) {
      return NextResponse.rewrite(new URL("/not-found", req.url));
    }

    // Portal pages + the R2 image proxy pass straight through. Advisor scoping
    // is handled in the Node.js API routes via resolvePortalAdvisorId (which
    // derives the advisor from the Host subdomain using Prisma). We no longer
    // self-fetch /api/resolve-subdomain here: on preview deployments Vercel's
    // Deployment Protection answers that server-side fetch with an HTML
    // challenge instead of JSON, which wrongly rewrote every portal to the
    // not-found page.
    response.headers.set("x-root-domain", rootDomain);
    return response;
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
    // skipping Next.js internals and ALL /api/* paths. Portal API routes
    // (/api/clients/..., /api/profile, etc.) resolve their own advisor from the
    // Host subdomain in the Node runtime, so they must not run through
    // middleware. /api/r2/object is matched separately below for subdomain
    // image serving.
    "/((?!_next/|favicon.ico|api/).*)",
    // /api/r2/object must still run through middleware for subdomain image serving.
    "/api/r2/object",
  ],
};
