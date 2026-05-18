import prisma from "@/lib/prisma";
import dayjs from "dayjs";
import { NextRequest, NextResponse } from "next/server";

interface ICreateEventPayload {
  planId?: string;
  name: "page_view" | "video_start" | "video_complete";
}

export async function POST(req: NextRequest) {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  const ip = xForwardedFor?.split(",")[0]?.trim() || null;

  const date = dayjs().format("YYYY-MM-DD");

  const body: ICreateEventPayload = await req.json();

  if (!body.planId || !body.name) {
    throw new Error("Invalid body");
  }

  let userId = null;
  if (body.planId) {
    const plan = await prisma.plan.findFirst({
      where: {
        id: body.planId,
      },
    });

    if (plan) {
      userId = plan.userId;
    }
  }

  const hashKey = `${date}:${body.planId || ""}`;

  if (body.name === "page_view") {
    let newUniqueVisitorByDate = 0;
    let newUniqueVisitor = 0;
    if (ip) {
      const planAnalyticPageViewIpByDateKey = [
        `plan_pageView_date_ip`,
        date,
        body.planId || "",
        ip || "",
      ].join(":");
      const planAnalyticPageViewIpKey = `plan_pageView_ip:${date}:${
        body.planId || ""
      }:${ip || ""}`;

      const [ipDateExist, ipExist] = await Promise.all([
        prisma.keyStorage.findFirst({
          where: {
            key: planAnalyticPageViewIpByDateKey,
          },
        }),
        prisma.keyStorage.findFirst({
          where: {
            key: planAnalyticPageViewIpKey,
          },
        }),
      ]);

      if (!ipExist) {
        newUniqueVisitor = 1;
        prisma.keyStorage
          .create({
            data: {
              key: planAnalyticPageViewIpKey,
            },
          })
          .then()
          .catch(() => {});
      }
      if (!ipDateExist) {
        newUniqueVisitorByDate = 1;
        prisma.keyStorage
          .create({
            data: {
              key: planAnalyticPageViewIpByDateKey,
            },
          })
          .then()
          .catch(() => {});
      }
    }

    prisma.plan
      .update({
        where: {
          id: body.planId,
        },
        data: {
          pageView: { increment: 1 },
          uniqueVisitor: { increment: newUniqueVisitor },
        },
      })
      .then()
      .catch(() => {});
    prisma.planAnalytic
      .upsert({
        where: {
          key: hashKey,
        },
        update: {
          pageView: { increment: 1 },
          uniqueVisitor: { increment: newUniqueVisitorByDate },
        },
        create: {
          userId: userId,
          planId: body.planId,
          key: hashKey,
          date: date,
          pageView: 1,
          uniqueVisitor: newUniqueVisitorByDate,
        },
      })
      .then()
      .catch(() => {});
  }

  if (body.name === "video_start") {
    prisma.plan
      .update({
        where: {
          id: body.planId,
        },
        data: {
          videoPlay: { increment: 1 },
        },
      })
      .then()
      .catch(() => {});
    prisma.planAnalytic
      .upsert({
        where: {
          key: hashKey,
        },
        update: {
          videoPlay: { increment: 1 },
        },
        create: {
          userId: userId,
          planId: body.planId,
          key: hashKey,
          date: date,
          videoPlay: 1,
        },
      })
      .then()
      .catch(() => {});
  }

  if (body.name === "video_complete") {
    prisma.plan
      .update({
        where: {
          id: body.planId,
        },
        data: {
          videoComplete: { increment: 1 },
        },
      })
      .then()
      .catch(() => {});
    prisma.planAnalytic
      .upsert({
        where: {
          key: hashKey,
        },
        update: {
          videoComplete: { increment: 1 },
        },
        create: {
          userId: userId,
          planId: body.planId,
          key: hashKey,
          date: date,
          videoComplete: 1,
        },
      })
      .then()
      .catch(() => {});
  }

  prisma.planEvent
    .create({
      data: {
        planId: body.planId,
        name: body.name,
        ip: ip,
      },
    })
    .then()
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
