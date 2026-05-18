import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

interface RouteParams {
  params: { planId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const planId = params.planId;

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const body = await request.json();
    const {
      videoId,
      videoUrl,
      videoStatus = "completed",
      thumbnail,
      image,
      data,
    } = body ?? {};

    if (!videoUrl && !videoId) {
      return NextResponse.json(
        { error: "videoUrl or videoId is required" },
        { status: 400 },
      );
    }

    const plan = await prisma.plan.findFirst({
      where: {
        id: planId,
        userId: session.user.id,
      },
      select: {
        id: true,
        clientName: true,
        companyName: true,
        videos: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const videoPayload = {
      ...(videoId && { videoProviderId: videoId }),
      ...(videoUrl && { videoUrl }),
      ...(thumbnail && { thumbnail }),
      ...(image && { image }),
      videoStatus,
      ...(data && { data }),
      title:
        plan.companyName || plan.clientName
          ? `Plan Summary - ${plan.companyName || plan.clientName}`
          : "Plan Summary Video",
      description: plan.companyName
        ? `Plan summary video for ${plan.companyName}`
        : null,
      videoProvider: "heygen",
    };

    // Find existing video for this plan
    const existingVideo = await prisma.video.findFirst({
      where: {
        planId: plan.id,
      },
    });

    const updatedVideo = existingVideo
      ? await prisma.video.update({
          where: {
            id: existingVideo.id,
          },
          data: videoPayload,
        })
      : await prisma.video.create({
          data: {
            planId: plan.id,
            ...videoPayload,
          },
        });

    await prisma.plan.update({
      where: { id: plan.id },
      data: {
        videoStatus: videoStatus,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedVideo,
    });
  } catch (error: any) {
    console.error("Failed to save video to plan:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save video" },
      { status: 500 },
    );
  }
}

