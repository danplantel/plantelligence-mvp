import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── GET /api/marketing/assets/public?clientId=xxx[&type=xxx] ──
// Public endpoint — no auth required. Returns Published assets (portal-notice, pop-up, news-post).

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const type = searchParams.get("type"); // optional: "portal-notice" | "pop-up" | "news-post"

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
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
