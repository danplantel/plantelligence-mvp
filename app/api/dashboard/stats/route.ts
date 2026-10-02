export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ACTIVE_CLIENT_STATUS_FILTER } from "@/lib/active-client-status";
import { meetingsThisWeekWhere } from "@/lib/meetings-this-week";
import { countPlansNeedingAttention } from "@/lib/plan-needs-attention.server";
import { listAccessiblePlanIds } from "@/lib/teammates/access.server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Every tile counts the plans this reader may see — owned OR assigned through a seat — so a
    // teammate's dashboard matches the owner's for the plans they share. `userId` alone returned
    // zeros for anyone but the owner, whose id is the only one that owns `Client` rows.
    const accessiblePlanIds = await listAccessiblePlanIds(userId);

    const [activePlansCount, meetingsThisWeekCount, needsAttentionCount] =
      await Promise.all([
        // "Plans" are Client rows (Benefits Hubs) — the same records served by /api/clients —
        // so this counts the accessible clients that are neither Draft nor Archived.
        prisma.client.count({
          where: {
            id: { in: accessiblePlanIds },
            status: ACTIVE_CLIENT_STATUS_FILTER,
          },
        }),

        // Counts the current scheduling week (Sunday–Saturday) using the same shared
        // window as the "Meetings this Week" panel, so the number and the list agree.
        prisma.meeting.count({
          where: meetingsThisWeekWhere({ userId, accessiblePlanIds }),
        }),

        // Active plans flagged for incomplete benefit content, uncategorized documents
        // or absent disclaimers — the same evaluation the detail panel lists.
        countPlansNeedingAttention(accessiblePlanIds),
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
