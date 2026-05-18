import { SYNTHESIA_TEMPLATE_ID } from "@/constants/app";
import { videos } from "@/constants/data";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { InfoTypes } from "@/types/InfoTypes";
import axios from "axios";
import { randomInt } from "crypto";
import dayjs from "dayjs";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const listVideo = videos;
  listVideo.sort((a, b) => +b.videoId - +a.videoId);

  const session = await getServerSession(authOptions);

  return NextResponse.json({ session, data: listVideo });

  const userId = "66ad2b6783862bae810466f2";

  try {
    for (const video of listVideo) {
      const date = dayjs().add(-randomInt(10, 40), "days").toDate();
      const plan = await prisma.plan.create({
        data: {
          userId: userId,

          clientName: video.clientName,
          clientLogo: video.image,
          videoThemeColor: video.clientColor,

          createdAt: date,
          updatedAt: date,
        },
      });

      const newVideo = await prisma.video.create({
        data: {
          planId: new ObjectId(plan.id) as any,
          videoUrl: video.videoUrl,
          title: video.clientName,
          description: "",
          videoProvider: "default",
          videoProviderId: "null",
          videoStatus: "completed",
        },
      });
    }

    return NextResponse.json({
      message: "Sync successfully",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed Sync" }, { status: 500 });
  }
}
