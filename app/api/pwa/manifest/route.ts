import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { planIdOrSlug } from "@/lib/plan-lookup";

/**
 * The web app manifest, resolved PER PLAN.
 *
 * A participant installs "their benefits portal", not the advisor's dashboard — so `start_url` has
 * to be the plan's portal root (`/{slug}`), not `/`. The plan is resolved two ways, because the
 * manifest is linked from the root metadata (one static href for the whole app):
 *
 *  1. `?slug=` — set by `PortalInstallApp` once the portal knows which plan it is rendering.
 *  2. The `Referer` header — the browser sends the portal page's URL when it fetches a same-origin
 *     manifest, so even the FIRST fetch (before the client has updated the link) resolves the plan.
 *
 * With neither, the manifest is the brand-level one (start at `/`). With a plan, the display name
 * is read from `Client.companyName` — the query-string `name` is only a fallback, because the very
 * first manifest fetch can happen before the portal's client data has loaded.
 */

/**
 * Path segments that must never be treated as a plan slug when guessing from the Referer. The app
 * routes are exactly those gated by `middleware.ts`, so a dashboard page can never claim a plan.
 */
const RESERVED_FIRST_SEGMENTS = new Set([
  "api",
  "accept-invite",
  "benefits",
  "clients",
  "communications",
  "contact",
  "dashboard",
  "documents",
  "edit-benefit",
  "edit-client",
  "new-benefits",
  "new-client",
  "onboarding",
  "portal",
  "pwa",
  "settings",
  "signin",
  "video",
  "videos",
]);

/** Same shape the portal's own slugs use: a single, URL-safe path segment. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

function sanitizeName(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return cleaned || null;
}

/**
 * A short label for the home screen. Chrome truncates long ones mid-word, so prefer the FIRST word
 * ("Ayres Hotels" → "Ayres") over a cut. A single long word is ellipsised rather than clipped.
 */
function toShortName(name: string): string {
  if (name.length <= 12) return name;
  const firstWord = name.split(" ")[0] || name;
  if (firstWord.length <= 16) return firstWord;
  return `${firstWord.slice(0, 15)}…`;
}

function slugFromReferer(request: NextRequest): string | null {
  // A client can suppress this header; missing simply means "no plan hint".
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const url = new URL(referer);
    if (url.origin !== request.nextUrl.origin) return null;
    const first = url.pathname.split("/").filter(Boolean)[0];
    if (!first) return null;
    if (RESERVED_FIRST_SEGMENTS.has(first.toLowerCase())) return null;
    return SLUG_PATTERN.test(first) ? first : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const explicitSlug = request.nextUrl.searchParams.get("slug");
  const slug =
    explicitSlug && SLUG_PATTERN.test(explicitSlug)
      ? explicitSlug
      : slugFromReferer(request);

  // The installed app is named after the PLAN, not the platform. Read it from
  // the row rather than trusting the URL: the browser's first manifest fetch can
  // arrive before PortalInstallApp has learned the company name, and an install
  // prompt captured at that moment would keep "PlanTelligence" as the name.
  let planName: string | null = null;
  if (slug) {
    try {
      const client = await prisma.client.findFirst({
        where: planIdOrSlug(slug),
        select: { companyName: true },
      });
      planName = sanitizeName(client?.companyName || null);
    } catch (error) {
      console.error("[pwa/manifest] plan name lookup failed", error);
    }
  }

  const name =
    planName ||
    sanitizeName(request.nextUrl.searchParams.get("name")) ||
    "PlanTelligence Benefits";

  // A plan install uses the Plan Company Logo, resolved by /api/pwa/icon. The
  // brand-level manifest (no slug) keeps the platform icons.
  const planIcon = slug
    ? `/api/pwa/icon?slug=${encodeURIComponent(slug)}`
    : null;

  const manifest = {
    // Identity: one installed app per plan. Distinct ids also keep two plans on the same
    // home screen from overwriting each other.
    id: slug ? `/pwa/${slug}` : "/",
    name,
    short_name: toShortName(name),
    description: `${name} — your benefits portal, on your home screen.`,
    start_url: slug ? `/${slug}` : "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1F3A60",
    icons: planIcon
      ? [
          {
            src: `${planIcon}&size=192`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${planIcon}&size=512`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            // The icon route contains the logo on a white square, so it has the
            // safe-zone padding a maskable icon needs.
            src: `${planIcon}&size=512`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ]
      : [
          {
            src: "/pwa/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
  } as const;

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json",
      // The plan and its name can change; never let a CDN pin an old manifest to the origin.
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
