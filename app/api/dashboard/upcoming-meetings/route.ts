export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveMeetingStartMs } from "@/lib/meeting-start-at";
import {
  startOfSchedulingDayUtc,
  upcomingMeetingsWhere,
} from "@/lib/upcoming-meetings";

/** Size of the dashboard's "Upcoming Meetings" list. */
const MAX_UPCOMING_MEETINGS = 4;

/**
 * Rows fetched before the per-row time filter runs. The list wants the *soonest* meetings and
 * candidates are ordered by date ascending, so a cap this far above the list size cannot
 * starve the result — it only bounds pathological data.
 */
const MAX_CANDIDATES = 25;

const tally = (values: (string | null | undefined)[]) =>
  values.reduce<Record<string, number>>((acc, value) => {
    const key = value == null ? "(null)" : String(value);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

/**
 * The next few meetings for the dashboard rail, soonest first.
 *
 * Distinct from `/api/dashboard/meetings-this-week`, which is scoped to the current
 * scheduling week for the "Meetings this Week" tile. This one looks forward past the end
 * of the week, which is what an upcoming list should do.
 *
 * Pass `?debug=1` in development to get a breakdown of the user's meetings instead of the
 * list, which shows at a glance which field the row filter is rejecting.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const wantsDebug =
      request.nextUrl.searchParams.get("debug") === "1" &&
      process.env.NODE_ENV !== "production";

    if (wantsDebug) {
      // Temporary diagnostic: every meeting this user owns, unfiltered, summarised.
      const rows = await prisma.meeting.findMany({
        where: { userId },
        select: { status: true, archived: true, date: true, startAtUtc: true },
      });

      const dates = rows
        .map((row) => row.date)
        .sort((a, b) => a.getTime() - b.getTime());

      return NextResponse.json({
        success: true,
        data: [],
        debug: {
          windowStartUtc: startOfSchedulingDayUtc(),
          totalForUser: rows.length,
          statusCounts: tally(rows.map((row) => row.status)),
          archivedCounts: tally(rows.map((row) => String(row.archived))),
          withStartAtUtc: rows.filter((row) => row.startAtUtc != null).length,
          earliestDate: dates[0]?.toISOString() ?? null,
          latestDate: dates[dates.length - 1]?.toISOString() ?? null,
        },
      });
    }

    const now = new Date();

    const candidates = await prisma.meeting.findMany({
      where: upcomingMeetingsWhere(userId, now),
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: MAX_CANDIDATES,
      select: {
        id: true,
        meeting: true,
        date: true,
        time: true,
        timezone: true,
        status: true,
        startAtUtc: true,
        // Denormalised client name — what the row shows as the plan.
        client: true,
        clientId: true,
      },
    });

    const nowMs = now.getTime();

    const meetings = candidates
      .map((meeting) => ({
        meeting,
        startMs: resolveMeetingStartMs(meeting),
      }))
      // A meeting already under way stays on the list. Everything else whose start has passed
      // drops out, which is the precision the day-scoped query cannot provide. A row whose
      // instant cannot be derived is kept rather than hidden.
      .filter(
        ({ meeting, startMs }) =>
          meeting.status === "In Progress" ||
          startMs === null ||
          startMs >= nowMs,
      )
      // Soonest first, with underivable rows last rather than sorting to the top on a null.
      .sort(
        (a, b) =>
          (a.startMs ?? Number.MAX_SAFE_INTEGER) -
          (b.startMs ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, MAX_UPCOMING_MEETINGS)
      .map(({ meeting }) => meeting);

    return NextResponse.json({ success: true, data: meetings });
  } catch (error) {
    console.error("Error fetching upcoming meetings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
