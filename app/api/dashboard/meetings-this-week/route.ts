export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { meetingsThisWeekWhere } from "@/lib/meetings-this-week";

/** Upper bound for the dashboard list. The tile's count is intentionally not capped. */
const MAX_MEETINGS = 25;

/**
 * Meetings falling inside the current scheduling week, backing the "Meetings this Week"
 * detail panel.
 *
 * Deliberately separate from `/api/meetings`: that endpoint returns the user's entire
 * meeting history and expects the caller to filter in the browser, which would make the
 * panel's contents a client-side reimplementation of the server's count.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const meetings = await prisma.meeting.findMany({
      where: meetingsThisWeekWhere(session.user.id),
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: MAX_MEETINGS,
      select: {
        id: true,
        meeting: true,
        date: true,
        time: true,
        timezone: true,
        status: true,
        // Plan the meeting belongs to. `client` is the denormalised name written at creation
        // time, while the relation is the authoritative source — reading both means the row
        // still shows a plan name if that denormalised copy is blank or stale.
        client: true,
        clientRecord: { select: { companyName: true } },
      },
    });

    return NextResponse.json({ success: true, data: meetings });
  } catch (error) {
    console.error("Error fetching this week's meetings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
