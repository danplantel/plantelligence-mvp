import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

function normalizeId(id: any): string {
  if (!id) return "";
  if (typeof id === "string") return id;
  if (id.toString) return id.toString();
  return "";
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { videoId, pagePlacement, planId: providedPlanId } = body;

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const validPlacements = [
      "retirement",
      "health-insurance",
      "life-insurance",
      "wellness-programs",
      null,
    ];
    if (!validPlacements.includes(pagePlacement)) {
      return NextResponse.json({ error: "Invalid pagePlacement" }, { status: 400 });
    }

    // 1. Fetch video
    const video = await prisma.video.findUnique({ where: { id: videoId } });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // ✅ 2. Check if video has clientId (primary) or planId (legacy)
    const clientId = normalizeId((video as any).clientId);
    const planIdFromVideo = normalizeId(video.planId);
    // Use provided planId from frontend if video doesn't have planId in DB
    const planId = planIdFromVideo || normalizeId(providedPlanId);

    // ✅ 3. Verify access via Client (primary) or Plan (legacy)
    if (clientId) {
      // Video belongs to Client (Benefits Hub)
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { userId: true, companyName: true },
      });

      if (!client) {
        return NextResponse.json(
          { error: "Video does not have an associated client" },
          { status: 404 }
        );
      }

      if (client.userId !== userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      
    } else if (planId) {
      // Video belongs to Plan (legacy) - use provided planId or from video
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { userId: true },
      });

      if (!plan) {
        return NextResponse.json(
          { error: "Video does not have an associated plan" },
          { status: 404 }
        );
      }

      if (plan.userId !== userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      
    } else {
      // Video has neither clientId nor planId
      return NextResponse.json(
        { error: "Video does not have an associated client or plan. Please provide planId." },
        { status: 404 }
      );
    }

    // 4. Update
    const updatedVideo = await prisma.video.update({
      where: { id: videoId },
      data: {
        pagePlacement: pagePlacement,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: updatedVideo });
  } catch (error: any) {
    console.error("Error updating video placement:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
