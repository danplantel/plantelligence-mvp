import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Reads request.url (query params) on every request — must stay dynamic.
export const dynamic = "force-dynamic";

// ── GET /api/marketing/assets/public?clientId=xxx[&type=xxx] ──
// Public endpoint — no auth required. Returns Published assets (portal-notice, pop-up, news-post).
//
// `clientId` arrives in BOTH shapes the portal uses:
//   • the plan's PRIMARY KEY (a cuid such as "cmve68k0900jw12r2sawz2xdm") — that is
//     the portal payload's own `id`, and what `NewsPostList` (the Announcements
//     section) and the pop-up overlay hand this endpoint;
//   • the plan's SLUG — what the portal route hands the top-banner fetch.
//
// The old guard treated every value that was not a 24-hex Mongo ObjectId as a slug,
// so a cuid matched no slug, no client resolved, and this endpoint answered with an
// empty list. That silently blanked the Announcements section (and pop-ups) for
// every cuid-keyed plan while the slug-fetched banner kept working.
const PLAN_LOOKUP = (clientIdOrSlug: string) => ({
  OR: [{ id: clientIdOrSlug }, { slug: clientIdOrSlug }],
});

/** Resolve either identifier to the plan's primary key, or null when unknown. */
async function resolvePlanId(clientIdOrSlug: string): Promise<string | null> {
  const client = await prisma.client.findFirst({
    where: PLAN_LOOKUP(clientIdOrSlug),
    select: { id: true },
  });
  return client?.id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientIdParam = searchParams.get("clientId");
    const type = searchParams.get("type"); // optional: "portal-notice" | "pop-up" | "news-post"

    if (!clientIdParam) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    // An unknown plan is an empty portal, not an error — the page simply renders
    // without announcements.
    const clientId = await resolvePlanId(clientIdParam);
    if (!clientId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const where: Record<string, unknown> = {
      clientId,
      status: "Published",
    };

    // If a specific type is requested, filter by it; otherwise return portal-notice, pop-up, and news-post
    if (type) {
      where.type = type;
    } else {
      where.type = { in: ["portal-notice", "pop-up", "news-post"] };
    }

    const assets = await prisma.marketingAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ success: true, data: assets });
  } catch (error) {
    console.error("GET /api/marketing/assets/public:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
