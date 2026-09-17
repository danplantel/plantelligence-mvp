export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { listPlansNeedingAttention } from "@/lib/plan-needs-attention.server";

/**
 * Active plans that need attention, backing the "Needs Attention" detail panel.
 *
 * Uses the same evaluation as the tile's count in `/api/dashboard/stats`, so the number
 * and this list are always derived from one rule.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const flagged = await listPlansNeedingAttention(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        total: flagged.length,
        plans: flagged.map((plan) => ({
          id: plan.id,
          companyName: plan.companyName,
          companyLogo: plan.companyLogo,
          // Structured so the panel can label each chip and route it to the surface
          // that resolves it.
          issues: plan.details.issues,
        })),
      },
    });
  } catch (error) {
    console.error("Error evaluating plans needing attention:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
