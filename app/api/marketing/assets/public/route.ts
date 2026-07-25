import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── GET /api/marketing/assets/public?clientId=xxx[&type=xxx] ──
// Public endpoint — no auth required. Returns Published assets (portal-notice, pop-up, news-post).

/** Returns true when the string looks like a MongoDB ObjectID (24 hex chars). */
function isObjectId(v: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(v);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientIdParam = searchParams.get("clientId");
    const type = searchParams.get("type"); // optional: "portal-notice" | "pop-up" | "news-post"

    if (!clientIdParam) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    // Resolve clientId — it may be a slug (e.g. "g-loomis") rather than a MongoDB ObjectID.
    let clientId = clientIdParam;
    if (!isObjectId(clientIdParam)) {
      const client = await prisma.client.findFirst({
        where: { slug: clientIdParam },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ success: true, data: [] });
      }
      clientId = client.id;
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
