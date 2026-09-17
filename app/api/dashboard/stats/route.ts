export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

/**
 * `Client.status` is written as both "Active" (schema default, complete-v2) and
 * "active" (clients/create, new-client-wizard/complete), so both spellings are counted.
 * Anything else — "Draft", "Archived" — is excluded.
 */
const ACTIVE_CLIENT_STATUSES = ["Active", "active"];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();

    const [activePlansCount, upcomingMeetingsCount] = await Promise.all([
      // "Plans" are Client rows (Benefits Hubs) — the same records served by /api/clients —
      // so this counts the user's clients that are neither Draft nor Archived.
      prisma.client.count({
        where: {
          userId,
          status: { in: ACTIVE_CLIENT_STATUSES },
        },
      }),

      // Mirrors /api/meetings: scoped to the current user and excluding archived rows.
      prisma.meeting.count({
        where: {
          userId,
          archived: false,
          OR: [
            { status: "In Progress" },
            { status: "Scheduled", date: { gte: now } },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        activePlans: activePlansCount,
        upcomingMeetings: upcomingMeetingsCount,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
