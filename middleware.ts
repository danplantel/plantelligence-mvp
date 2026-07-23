// Protecting routes with next-auth
// https://next-auth.js.org/configuration/nextjs#middleware
// https://nextjs.org/docs/app/building-your-application/routing/middleware

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** Extract the subdomain from a host header like "waypoint.plantelligence-mvp.vercel.app" */
function extractSubdomain(host: string): string | null {
  const rootDomain =
    process.env.ROOT_DOMAIN || "plantelligence-mvp.vercel.app";

  // Local dev or root domain — no subdomain to extract
  if (host === rootDomain || host.startsWith("localhost")) return null;

  // Host must end with the root domain (e.g. *.plantelligence-mvp.vercel.app)
  if (!host.endsWith(`.${rootDomain}`)) return null;

  // "waypoint.plantelligence-mvp.vercel.app" → "waypoint"
  const prefix = host.replace(`.${rootDomain}`, "");
  const parts = prefix.split(".");
  return parts[parts.length - 1] || null;
}

/** Slugify a string for use as a subdomain: "Waypoint Wealth" → "waypoint-wealth" */
function slugifySubdomain(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve an advisor userId from a subdomain string like "waypoint".
 *
 *  Matches against both User.subdomain and a slugified version of
 *  User.organizationName so that "waypoint" resolves whether it was
 *  set as the subdomain or the organization name. */
async function resolveAdvisorFromSubdomain(
  subdomain: string,
): Promise<{ id: string; subdomain: string | null; organizationName: string | null } | null> {
  try {
    // 1. Try exact subdomain match
    let user = await prisma.user.findFirst({
      where: { subdomain },
      select: { id: true, subdomain: true, organizationName: true },
    });
    if (user) return user as any;

    // 2. Fall back to matching a slugified organizationName
    //    e.g. "Waypoint Wealth" stored as org name → "waypoint-wealth" subdomain
    const allUsers = await prisma.user.findMany({
      where: { organizationName: { not: null } },
      select: { id: true, subdomain: true, organizationName: true },
    });

    for (const u of allUsers) {
      if (u.organizationName && slugifySubdomain(u.organizationName) === subdomain) {
        return u as any;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ── Portal routes that should be accessible without auth when
//     accessed via a valid advisor subdomain ────────────────────────────────
const PORTAL_PATHS = ["/new/view", "/new/documents", "/new/communications"];

function isPortalPath(pathname: string): boolean {
  return PORTAL_PATHS.some((p) => pathname.startsWith(p));
}

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;
    const host = req.headers.get("host") || "";

    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);

    // ── Subdomain portal access ──────────────────────────────────────────
    const subdomain = extractSubdomain(host);

    if (subdomain) {
      const advisor = await resolveAdvisorFromSubdomain(subdomain);
      if (advisor) {
        // Pass the resolved advisor ID to all downstream handlers
        response.headers.set("x-advisor-id", advisor.id);
        if (advisor.subdomain) {
          response.headers.set("x-advisor-subdomain", advisor.subdomain);
        }
      }
      // Subdomain access does NOT require auth (employees view the portal)
      return response;
    }
    // ── End subdomain ────────────────────────────────────────────────────

    // Check if user is trying to access onboarding after completion
    if (pathname.startsWith("/new/onboarding") && req.nextauth?.token?.id) {
      try {
        const hasCompleted = await prisma.wizardSession.findFirst({
          where: {
            userId: req.nextauth.token.id as string,
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
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow portal paths accessed via subdomain without auth
        const host = req.headers.get("host") || "";
        const subdomain = extractSubdomain(host);
        if (subdomain) {
          return true; // No auth required for subdomain access
        }

        // Require auth for all main-domain protected routes
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/new/:path*",
    "/onboarding/:path*",
  ],
};
