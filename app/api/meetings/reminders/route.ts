export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  MEETING_REMINDER_EXCLUDED_STATUSES,
  MEETING_REMINDER_LIMIT,
  MEETING_REMINDER_WINDOW_DAYS,
  compareMeetingReminders,
  daysBetweenDateKeys,
  dateKeyToUtcDate,
  isDateKey,
  resolveMeetingReminderStatus,
  toMeetingDateKey,
  todayDateKey,
} from "@/lib/notifications/meeting-reminders";

/**
 * Upcoming meeting reminders for the header Notifications menu.
 *
 * Mirrors `app/api/documents/expiring/route.ts`: user-scoped, capped, and
 * limited to the exact day-of / 2-day / 7-day marks.
 *
 * Meeting dates are date-only values, so every tier and label is resolved from
 * the stored date's calendar day (see `toMeetingDateKey`). The viewer's
 * timezone is deliberately not consulted: this is a US-based scheduling app and
 * reminders must fire on the day the meeting is scheduled for, matching the
 * meetings calendar, wherever the viewer happens to be.
 *
 * The client still passes `?today=yyyy-MM-dd`; it is used only as a fallback
 * when the request arrives without a usable day key.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedToday = searchParams.get("today");
    const today = isDateKey(requestedToday)
      ? (requestedToday as string)
      : todayDateKey();


    // Pad the DB window by a day on each side so rows shifted by a timezone
    // offset are still fetched; the exact day keys are filtered below.
    const rangeStart = dateKeyToUtcDate(today, -1);
    const rangeEnd = dateKeyToUtcDate(today, MEETING_REMINDER_WINDOW_DAYS + 1);

    const meetings = await prisma.meeting.findMany({
      where: {
        userId: session.user.id,
        archived: false,
        status: { notIn: [...MEETING_REMINDER_EXCLUDED_STATUSES] },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        id: true,
        meeting: true,
        meetingType: true,
        client: true,
        clientId: true,
        date: true,
        time: true,
        timezone: true,
        format: true,
        status: true,
      },
      orderBy: { date: "asc" },
    });

    const reminders = meetings
      .map((meeting) => {
        const dateKey = toMeetingDateKey(meeting.date);
        if (!dateKey) return null;

        const daysUntil = daysBetweenDateKeys(today, dateKey);
        if (daysUntil === null) return null;

        const reminderStatus = resolveMeetingReminderStatus(daysUntil);
        if (!reminderStatus) return null;

        return {
          id: meeting.id,
          title: meeting.meeting,
          meetingType: meeting.meetingType,
          client: meeting.client,
          clientId: meeting.clientId,
          dateKey,
          time: meeting.time,
          timezone: meeting.timezone,
          format: meeting.format,
          status: meeting.status,
          daysUntil,
          reminderStatus,
        };
      })
      .filter((reminder): reminder is NonNullable<typeof reminder> => reminder !== null)
      .sort(compareMeetingReminders)
      .slice(0, MEETING_REMINDER_LIMIT);

    return NextResponse.json({ success: true, data: reminders });
  } catch (error) {
    console.error("Error fetching meeting reminders:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting reminders" },
      { status: 500 },
    );
  }
}
