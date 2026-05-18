export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pagePlacement = searchParams.get("pagePlacement");
    const clientId = searchParams.get("clientId");

    if (!pagePlacement) {
      return NextResponse.json(
        { error: "pagePlacement is required" },
        { status: 400 },
      );
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 },
      );
    }

    // First try to find by clientId (primary relation)
    let allVideos: any[] = await prisma.video.findMany({
      where: {
        pagePlacement: pagePlacement,
        clientId: clientId as any,
      } as any,
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      } as any,
    });

    // If not found by clientId, try by planId (legacy)
    if (allVideos.length === 0) {
      allVideos = await prisma.video.findMany({
        where: {
          pagePlacement: pagePlacement,
          planId: clientId,
        },
        include: {
          plan: {
            select: {
              id: true,
              clientName: true,
              companyName: true,
            },
          },
        },
      });
    }

    // Sort all videos by pageIndex (nulls last), then by createdAt
    allVideos.sort((a: any, b: any) => {
      // Handle null pageIndex - put them at the end
      if (a.pageIndex === null && b.pageIndex === null) {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (a.pageIndex === null) return 1; // a goes to end
      if (b.pageIndex === null) return -1; // b goes to end

      // Both have pageIndex, sort by it
      if (a.pageIndex !== b.pageIndex) {
        return a.pageIndex - b.pageIndex;
      }

      // Same pageIndex, sort by createdAt
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    // Convert to JourneyVideo format
    const journeyVideos = allVideos
      .filter((v) => v.videoUrl && v.videoStatus === "completed")
      .map((v) => ({
        id: v.id,
        title: v.title || "Untitled Video",
        thumbnail: v.thumbnail || v.image || "/placeholder.svg",
        duration: "0:00", // You might want to calculate this
        description: v.description || undefined,
        videoUrl: v.videoUrl,
        embedUrl: v.videoUrl,
      }));

    // Get featured video (first one or latest)
    const featuredVideo =
      journeyVideos.length > 0
        ? {
            ...journeyVideos[0],
            rating: "4.9",
            category: "Featured",
          }
        : null;

    return NextResponse.json({
      success: true,
      videos: journeyVideos,
      featuredVideo,
    });
  } catch (error: any) {
    console.error("Error fetching videos by placement:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch videos" },
      { status: 500 },
    );
  }
}

