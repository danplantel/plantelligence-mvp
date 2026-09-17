export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ACTIVE_CLIENT_STATUS_FILTER } from "@/lib/active-client-status";
import { meetingsThisWeekWhere } from "@/lib/meetings-this-week";
import { countPlansNeedingAttention } from "@/lib/plan-needs-attention.server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const [activePlansCount, meetingsThisWeekCount, needsAttentionCount] =
      await Promise.all([
        // "Plans" are Client rows (Benefits Hubs) — the same records served by /api/clients —
        // so this counts the user's clients that are neither Draft nor Archived.
        prisma.client.count({
          where: {
            userId,
            status: ACTIVE_CLIENT_STATUS_FILTER,
          },
        }),

        // Counts the current scheduling week (Sunday–Saturday) using the same shared
        // window as the "Meetings this Week" panel, so the number and the list agree.
        prisma.meeting.count({
          where: meetingsThisWeekWhere(userId),
        }),

        // Active plans flagged for incomplete benefit content, uncategorized documents
        // or absent disclaimers — the same evaluation the detail panel lists.
        countPlansNeedingAttention(userId),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        activePlans: activePlansCount,
        meetingsThisWeek: meetingsThisWeekCount,
        needsAttention: needsAttentionCount,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
