import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, videoUrl, videoStatus, data } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 },
      );
    }

    

    // Find video by planId first
    const existingVideo = await prisma.video.findFirst({
      where: {
        planId: planId,
      },
    });

    if (!existingVideo) {
      return NextResponse.json(
        { error: "Video not found for this plan" },
        { status: 404 },
      );
    }

    // Update video by id
    const updatedVideo = await prisma.video.update({
      where: {
        id: existingVideo.id,
      },
      data: {
        ...(videoUrl && { videoUrl }),
        ...(videoStatus && { videoStatus }),
        ...(data && { data }),
      },
    });


    return NextResponse.json({
      success: true,
      data: updatedVideo,
    });
  } catch (error: any) {
    console.error("Error updating video:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update video" },
      { status: 500 },
    );
  }
}

