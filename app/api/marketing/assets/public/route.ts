import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── GET /api/marketing/assets/public?clientId=xxx ──
// Public endpoint — no auth required. Returns only Published portal-notice assets.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const assets = await prisma.marketingAsset.findMany({
      where: {
        clientId,
        type: "portal-notice",
        status: "Published",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ success: true, data: assets });
  } catch (error) {
    console.error("GET /api/marketing/assets/public:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
