import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !("id" in session.user)) {
      console.error("Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as SessionUser).id;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const clientId = searchParams.get("clientId") || "";

    const where: Prisma.VideoWhereInput = {
      plan: {
        userId,
        ...(clientId ? { id: clientId } : {}),
      },
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        {
          plan: {
            OR: [
              { clientName: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const videos = await prisma.video.findMany({
      where,
      select: {
        // ✅ Use select instead of include to safely handle null plans
        id: true,
        planId: true,
        videoUrl: true,
        videoStatus: true,
        title: true,
        description: true,
        createdAt: true,
        videoProvider: true,
        videoProviderId: true,
        thumbnail: true,
        image: true,
        data: true,
        plan: {
          select: {
            id: true,
            clientName: true,
            companyName: true,
            clientLogo: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // ✅ Filter out videos without plan (select allows plan to be null, but we don't want to return them)
    const videosWithPlan = videos.filter((video) => video.plan !== null);

    return NextResponse.json({ success: true, data: videosWithPlan });
  } catch (error) {
    console.error("Error fetching videos: ", error);
    return NextResponse.json(
      { error: "Error fetching videos" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !("id" in session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as SessionUser).id;
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("id");

    if (!videoId) {
      return NextResponse.json(
        { error: "Video id is required" },
        { status: 400 },
      );
    }

    

    // ✅ Validate videoId format (should be MongoDB ObjectId - 24 hex characters)
    if (videoId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(videoId)) {
      console.error("❌ Invalid videoId format:", videoId);
      return NextResponse.json(
        { error: "Invalid video ID format" },
        { status: 400 },
      );
    }

    // ✅ Try to find video by database ID (MongoDB ObjectId)
    // Handle both string and ObjectId formats
    let video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    // If not found, try with ObjectId conversion
    if (!video) {
      try {
        const { ObjectId } = await import("mongodb");
        if (ObjectId.isValid(videoId)) {
          const videoObjectId = new ObjectId(videoId);
          video = await prisma.video.findUnique({
            where: { id: videoObjectId as any },
          });
        }
      } catch (error) {
        console.error("❌ Error converting videoId to ObjectId:", error);
      }
    }

    if (!video) {
      console.error("❌ Video not found:", videoId);
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 },
      );
    }

    

    // Check if video has a plan and if user has access to that plan
    // Convert planId to string if it's ObjectId
    const planIdStr = String(video.planId);

    // Try to find plan - handle both ObjectId and string formats
    let plan = await prisma.plan.findUnique({
      where: { id: planIdStr },
      select: {
        id: true,
        userId: true,
      },
    });

    // If not found, try with ObjectId format
    if (!plan && planIdStr.length === 24) {
      try {
        const { ObjectId } = await import("mongodb");
        if (ObjectId.isValid(planIdStr)) {
          const planObjectId = new ObjectId(planIdStr);
          plan = await prisma.plan.findUnique({
            where: { id: planObjectId as any },
            select: {
              id: true,
              userId: true,
            },
          });
        }
      } catch (error) {
        console.error("❌ Error converting planId to ObjectId:", error);
      }
    }

    // ✅ If video has no plan → auto-delete corrupted video
    if (!plan) {
      console.warn("⚠️ Video has no plan. Auto-deleting corrupted video:", {
        videoId: video.id,
        planId: video.planId,
        userId,
      });

      // Delete video without plan checks
      await prisma.video.delete({
        where: { id: videoId },
      });

      

      return NextResponse.json({
        success: true,
        deletedVideoId: video.id,
        warning: "Video had no plan and was auto-deleted",
      });
    }

    // ✅ If video has plan → check user access
    if (plan.userId !== userId) {
      console.error("❌ Access denied:", {
        videoId: video.id,
        planUserId: plan.userId,
        requestUserId: userId,
      });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const planId = plan.id;

    

    // ✅ Delete video using database ID
    await prisma.video.delete({
      where: { id: videoId },
    });

    // Update plan's videoStatus to null (optional - only if this was the only video)
    // Check if there are other videos for this plan
    const remainingVideos = await prisma.video.findMany({
      where: { planId: planId },
      select: { id: true },
    });

    // Only clear videoStatus if no videos remain
    if (remainingVideos.length === 0) {
      await prisma.plan.update({
        where: { id: planId },
        data: {
          videoStatus: null,
        },
      });
    }

    

    return NextResponse.json({
      success: true,
      deletedVideoId: video.id,
    });
  } catch (error: any) {
    console.error("❌ Error deleting video:", {
      error,
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: error?.message || "Failed to delete video" },
      { status: 500 },
    );
  }
}
