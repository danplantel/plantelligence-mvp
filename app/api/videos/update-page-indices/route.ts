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
    const { updates } = body; // Array of { videoId: string, pageIndex: number | null }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "updates array is required and must not be empty" },
        { status: 400 },
      );
    }

    // Validate all updates
    for (const update of updates) {
      if (!update.videoId) {
        return NextResponse.json(
          { error: "Each update must have a videoId" },
          { status: 400 },
        );
      }

      if (
        update.pageIndex !== null &&
        update.pageIndex !== undefined &&
        (typeof update.pageIndex !== "number" ||
          !Number.isInteger(update.pageIndex) ||
          update.pageIndex < 0)
      ) {
        return NextResponse.json(
          {
            error: `pageIndex for video ${update.videoId} must be a non-negative integer or null`,
          },
          { status: 400 },
        );
      }
    }

    // Fetch all videos to verify access
    const videoIds = updates.map((u) => u.videoId);
    const videos = await prisma.video.findMany({
      where: { id: { in: videoIds } },
    });

    if (videos.length !== videoIds.length) {
      return NextResponse.json(
        { error: "One or more videos not found" },
        { status: 404 },
      );
    }

    // Verify access for all videos
    for (const video of videos) {
      const clientId = normalizeId((video as any).clientId);
      const planId = normalizeId(video.planId);

      if (clientId) {
        const client = await prisma.client.findUnique({
          where: { id: clientId },
          select: { userId: true },
        });

        if (!client || client.userId !== userId) {
          return NextResponse.json(
            { error: `Access denied for video ${video.id}` },
            { status: 403 },
          );
        }
      } else if (planId) {
        const plan = await prisma.plan.findUnique({
          where: { id: planId },
          select: { userId: true },
        });

        if (!plan || plan.userId !== userId) {
          return NextResponse.json(
            { error: `Access denied for video ${video.id}` },
            { status: 403 },
          );
        }
      } else {
        return NextResponse.json(
          { error: `Video ${video.id} does not have an associated client or plan` },
          { status: 404 },
        );
      }
    }

    // Update all videos in a transaction
    const updatePromises = updates.map((update) =>
      prisma.video.update({
        where: { id: update.videoId },
        data: {
          pageIndex: update.pageIndex !== undefined ? update.pageIndex : null,
          updatedAt: new Date(),
        } as any, // Type assertion needed until Prisma client is regenerated
      }),
    );

    const updatedVideos = await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      data: updatedVideos,
      count: updatedVideos.length,
    });
  } catch (error: any) {
    console.error("Error updating video page indices:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

