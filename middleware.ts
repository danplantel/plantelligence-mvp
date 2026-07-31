// Protecting routes with next-auth
// https://next-auth.js.org/configuration/nextjs#middleware
// https://nextjs.org/docs/app/building-your-application/routing/middleware

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";

/**
 * Extract the subdomain from a host header.
 *
 * Examples:
 *   "waypoint.plantel.pro" → "waypoint"
 *   "plantel.pro"          → null (no subdomain)
 *   "localhost:3000"       → null (local dev)
 */
function extractSubdomain(host: string, rootDomain: string): string | null {
  if (!host) return null;
  if (host === rootDomain || host.startsWith("localhost")) return null;
  const base = host.replace(`.${rootDomain}`, "");
  const parts = base.split(".");
  // Take the rightmost subdomain part (closest to the root domain).
  // This correctly handles both:
  //   "waypoint.plantel.pro"        → "waypoint"
  //   "www.waypoint.plantel.pro"    → "waypoint"  (www is just a prefix)
  //   "www.plantel.pro"             → "www" → rejected (treated as apex)
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
  // Everything else (dashboard, client creation, settings, etc.) redirects
  // to the apex domain — those features are admin-only and must be accessed
  // via plantel.pro, not {subdomain}.plantel.pro.
  if (subdomain) {
    if (pathname.startsWith("/new/view/")) {
      try {
        const user = await prisma.user.findFirst({
          where: { subdomain },
          select: { id: true },
        });

        if (!user) {
          // Invalid subdomain — redirect to the root domain
          return NextResponse.redirect(new URL("/", `https://${rootDomain}`));
        }

        response.headers.set("x-advisor-id", user.id);
        response.headers.set("x-root-domain", rootDomain);

        // Public portal — no auth required
        return response;
      } catch (err) {
        console.error("[middleware] subdomain lookup error:", err);
        // Fall through to auth check below as a safety net
      }
    }

    // Subdomain request to a non-portal path — redirect to apex
    const apexUrl = new URL(pathname, `https://${rootDomain}`);
    req.nextUrl.searchParams.forEach((value, key) => {
      apexUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(apexUrl);
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

  // Onboarding completion guard
  if (pathname.startsWith("/new/onboarding") && token.id) {
    try {
      const hasCompleted = await prisma.wizardSession.findFirst({
        where: {
          userId: token.id as string,
          completed: true,
        },
      });

      if (hasCompleted) {
        return NextResponse.redirect(new URL("/new/dashboard", req.url));
      }
    } catch (error) {
      console.error("Error checking onboarding status:", error);
    }
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
