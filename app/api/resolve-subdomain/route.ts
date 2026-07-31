import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Internal API used by middleware to resolve a subdomain to an advisor user ID.
 * This runs on the Node.js runtime (not Edge), so Prisma is available.
 *
 * GET /api/resolve-subdomain?subdomain=waypoint
 *   → 200 { userId: "..." }
 *   → 404 { error: "Not found" }
 */
export async function GET(request: NextRequest) {
  const subdomain = request.nextUrl.searchParams.get("subdomain");

  if (!subdomain) {
    return NextResponse.json(
      { error: "Missing subdomain parameter" },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.findFirst({
      where: { subdomain },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ userId: user.id });
  } catch (err) {
    console.error("[resolve-subdomain] lookup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
