export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ACTIVE_CLIENT_STATUS_FILTER } from "@/lib/active-client-status";

/** Upper bound for the dashboard list. The tile's count is intentionally not capped. */
const MAX_ACTIVE_PLANS = 25;

/**
 * Minified active-plan list backing the Active Plans detail panel.
 *
 * Deliberately separate from `/api/clients`: that endpoint takes `status` verbatim from
 * the query string and so misses the lowercase `"active"` rows, and it returns the full
 * client payload (documents, branding JSON, contact records). This returns only what the
 * list renders, using the same active-status definition as `/api/dashboard/stats`.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plans = await prisma.client.findMany({
      where: {
        userId: session.user.id,
        status: ACTIVE_CLIENT_STATUS_FILTER,
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_ACTIVE_PLANS,
      select: {
        id: true,
        companyName: true,
        companyLogo: true,
      },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    console.error("Error fetching active plans:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
