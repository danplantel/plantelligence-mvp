export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get active plans count (from Plan table)
    const activePlansCount = await prisma.plan.count({
      where: {
        userId
      }
    });

    // Get upcoming meetings count (scheduled and in-progress meetings in the future)
          const now = new Date();
          const upcomingMeetingsCount = await prisma.meeting.count({
            where: {
              OR: [
                {
                  status: "In Progress"
                },
                {
                  status: "Scheduled",
                  date: {
                    gte: now
                  }
                }
              ]
            }
          });

    // Also get all meetings for debugging
    const allMeetings = await prisma.meeting.findMany({
      select: {
        id: true,
        meeting: true,
        status: true,
        date: true,
        time: true
      }
    });
    
    // Log each meeting's date comparison
    allMeetings.forEach((meeting, index) => {
      const meetingDate = new Date(meeting.date);
      const isUpcoming = meetingDate >= now;
    });

    // Get upcoming meetings for debugging
    const upcomingMeetings = await prisma.meeting.findMany({
      where: {
        status: {
          in: ["Scheduled", "In Progress"]
        },
        date: {
          gte: now
        }
      },
      select: {
        id: true,
        meeting: true,
        status: true,
        date: true,
        time: true
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        activePlans: activePlansCount,
        upcomingMeetings: upcomingMeetingsCount
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
