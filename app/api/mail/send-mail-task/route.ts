import prisma from "@/lib/prisma";
import sendEmail from "@/lib/sendMail";
import dayjs from "dayjs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }
  const mails = await prisma.mailTask.findMany({
    where: {
      sendAt: {
        lte: dayjs().toDate(),
      },
    },
    take: 10,
  });

  for (const mail of mails) {
    try {
      await sendEmail({
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
      });
      await prisma.mailTask.delete({
        where: {
          id: mail.id,
        },
      });
    } catch (error) {
    }
  }

  return NextResponse.json({ ok: true });
}
