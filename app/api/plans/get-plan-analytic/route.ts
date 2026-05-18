import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import dayjs from "dayjs";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

interface ICreateEventPayload {
  planId?: string;
  videoId?: string;
  startDate?: string;
  endDate?: string;
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") || "";
  const planId = req.nextUrl.searchParams.get("planId") || "";
  const startDate = req.nextUrl.searchParams.get("startDate") || "";
  const endDate = req.nextUrl.searchParams.get("endDate") || "";
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      throw new Error("Auth required");
    }


    const startDateDayjs = dayjs(startDate).startOf("day");
    const endDateDayjs = dayjs(endDate).endOf("day");

    const filter: any = {
      plan: {},
    };
    if (planId) {
      filter.plan.id = planId;
    }
    // if (videoId) {
    //   filter.plan.video = {
    //     id: videoId,
    //   };
    // }
    if (startDate) {
      filter.plan.createdAt = {
        gte: startDateDayjs.toDate(),
      };
    }
    if (endDate) {
      filter.plan.createdAt = {
        lte: endDateDayjs.toDate(),
      };
    }

    const plans = await prisma.planAnalytic.findMany({
      where: {
        user: {
          email: session?.user?.email,
        },
        createdAt: {
          lte: dayjs().toDate(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const diff = endDateDayjs.diff(startDateDayjs, "day");


    const map: Record<string, any> = {};

    for (let i = 0; i <= diff; i++) {
      const key = startDateDayjs.add(i, "day").format("MM/DD/YYYY");
      map[key] = {
        date: key,
        pageView: 0,
        uniqueVisitor: 0,
        videoPlay: 0,
        videoComplete: 0,
      };
    }

    for (const plan of plans) {
      const key = dayjs(plan?.createdAt).format("MM/DD/YYYY");
      if (map[key]) {
        map[key].pageView += plan.pageView;
        map[key].uniqueVisitor += plan.uniqueVisitor;
        map[key].videoPlay += plan.videoPlay;
        map[key].videoComplete += plan.videoComplete;
      }
    }

    return NextResponse.json({
      data: Object.values(map),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get plan" }, { status: 500 });
  }
}
