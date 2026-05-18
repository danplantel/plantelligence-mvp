import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { VideoStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") || "";
  const videoStatus =
    (req.nextUrl.searchParams.get("videoStatus") as VideoStatus) || undefined;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      throw new Error("Auth required");
    }

    const plans = await prisma.plan.findMany({
      where: {
        user: { email: session.user.email },
        clientName: search ? { contains: search, mode: "insensitive" } : undefined,
      },
      orderBy: { createdAt: "desc" },
    });

    const planIds = plans.map((p) => p.id);

    const videos = await prisma.video.findMany({
      where: {
        planId: { in: planIds },
        ...(videoStatus && { videoStatus }),
      },
      orderBy: { createdAt: "desc" },
    });

    const videosByPlanId = new Map<string, any[]>();
    videos.forEach((video) => {
      const key = String(video.planId);
      if (!videosByPlanId.has(key)) videosByPlanId.set(key, []);
      videosByPlanId.get(key)!.push(video);
    });

    const plansWithVideos = plans.map((plan) => {
      const list = videosByPlanId.get(String(plan.id)) || [];

      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

      return {
        ...plan,
        video: list[0] || null, // latest
        videos: list,
      };
    });

    return NextResponse.json({
      data: plansWithVideos,
      total: plansWithVideos.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to get plan" }, { status: 500 });
  }
}
