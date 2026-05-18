import { SYNTHESIA_API_KEY } from "@/constants/app";
import prisma from "@/lib/prisma";
import sendEmail from "@/lib/sendMail";
import axios from "axios";
import dayjs from "dayjs";
import { NextRequest, NextResponse } from "next/server";

const mailTemplate = `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background-color: #f6f9fc; color: #333333; padding: 20px; margin: 0;">
    <div width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
      <h2 style="margin-top: 0; color: #111111;">Your PlanTelligence Benefits Portal and related content have generated</h2>
      <p style="font-size: 16px; line-height: 1.5;">
        You can find the link on your client dashboard and review the <strong>Plan Summary Video</strong> in the <strong>Content Library</strong>
      </p>
      <p style="font-size: 16px; line-height: 1.5;">
        Contact us if you need support:
        <a href="mailto:support@plantelligence.ai" style="color: #0070f3;">support@plantelligence.ai</a>
      </p>
    </div>
  </body>
</html>

`;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const plansNotCompleted = await prisma.plan.findMany({
    select: {
      id: true,
      idIndex: true,
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
      videoStatus: true,
      videos: {
        select: {
          id: true,
          videoProviderId: true,
        },
        take: 1,
      },
    },
    where: {
      videoStatus: {
        not: "completed",
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 3,
  });

  for (const plan of plansNotCompleted) {
    const video = plan.videos?.[0];
    if (!video?.videoProviderId) {
      continue;
    }

    const synthesiaResponse = await axios.get(
      "https://api.synthesia.io/v2/videos/" + video.videoProviderId,
      {
        headers: {
          Authorization: SYNTHESIA_API_KEY,
        },
      },
    );
    const status = synthesiaResponse.data?.status;
    if (status === "complete") {
      await Promise.all([
        prisma.plan.update({
          where: {
            id: plan.id,
          },
          data: {
            videoStatus: "completed",
          },
        }),
        video ? prisma.video.update({
          where: {
            id: video.id,
          },
          data: {
            videoStatus: "completed",
            data: synthesiaResponse.data,
            videoUrl: synthesiaResponse.data?.download,
            thumbnail: synthesiaResponse.data?.thumbnail?.image,
          },
        }) : Promise.resolve(null),
        prisma.mailTask.create({
          data: {
            to: plan?.user?.email,
            subject:
              "Your PlanTelligence Benefits Portal and related content have generated",
            html: mailTemplate,
            sendAt: dayjs().add(10, "m").toDate(),
          },
        }),
      ]);
    }
  }

  return NextResponse.json({ ok: true });
}
