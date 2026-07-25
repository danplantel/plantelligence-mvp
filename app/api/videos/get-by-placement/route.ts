export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** Returns true when the string looks like a MongoDB ObjectID (24 hex chars). */
function isObjectId(v: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(v);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pagePlacement = searchParams.get("pagePlacement");
    const clientIdParam = searchParams.get("clientId");

    if (!pagePlacement) {
      return NextResponse.json(
        { error: "pagePlacement is required" },
        { status: 400 },
      );
    }

    if (!clientIdParam) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 },
      );
    }

    // Resolve clientId — it may be a slug (e.g. "g-loomis") rather than a MongoDB ObjectID.
    let clientId = clientIdParam;
    if (!isObjectId(clientIdParam)) {
      const client = await prisma.client.findFirst({
        where: { slug: clientIdParam },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ success: true, videos: [], featuredVideo: null });
      }
      clientId = client.id;
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

    // If not found by clientId, try by planId (legacy).
    // Only attempt when the param looks like a valid ObjectID — a slug
    // such as "g-loomis" can never match a planId and would throw P2023.
    if (allVideos.length === 0 && isObjectId(clientIdParam)) {
      allVideos = await prisma.video.findMany({
        where: {
          pagePlacement: pagePlacement,
          planId: clientIdParam,
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

