import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      meetingType,
      meeting: meetingTitle,
      client,
      clientId: planClientId,
      date,
      time,
      timezone,
      duration,
      format,
      platform,
      meetingLink,
      maxAttendees,
      description,
      address,
      city,
      state,
      zip,
      language,
      benefitsCategory,
      customBenefitsCategory,
      status,
    } = body;

    // Validate required fields
    if (!meetingType || !client || !date || !time || !duration || !format) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let resolvedClientId: string | undefined;
    if (
      planClientId &&
      typeof planClientId === "string" &&
      planClientId.trim()
    ) {
      const ownClient = await prisma.client.findFirst({
        where: { id: planClientId.trim(), userId: session.user.id },
        select: { id: true },
      });
      if (!ownClient) {
        return NextResponse.json(
          { error: "Invalid plan (client) for this user" },
          { status: 400 },
        );
      }
      resolvedClientId = ownClient.id;
    }

    // Fallback: attach meeting to client by company name when clientId was omitted (API clients,
    // Zapier, or legacy forms). Keeps portal hub queries (plan-scoped by clientId) reliable.
    if (!resolvedClientId && client && typeof client === "string") {
      const name = client.trim();
      if (name.length > 0) {
        const byName = await prisma.client.findFirst({
          where: {
            userId: session.user.id,
            companyName: { equals: name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (byName) {
          resolvedClientId = byName.id;
        }
      }
    }

    // Create meeting in database
    const meeting = await prisma.meeting.create({
      data: {
        userId: session.user.id,
        meeting: meetingTitle || meetingType, // Use meeting name if provided, fallback to meetingType
        meetingType,
        client,
        ...(resolvedClientId ? { clientId: resolvedClientId } : {}),
        date: new Date(date),
        time,
        timezone: timezone || null,
        duration,
        format,
        platform: platform || null,
        meetingLink: meetingLink || null,
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
        description: description || null,
        status: status || "Upcoming",
        attendees: 0,
        displayOnPortal: true,
        language: language || null,
        benefitsCategory: benefitsCategory || null,
        customBenefitsCategory: customBenefitsCategory || null,
        // Address fields
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
      },
    });

    return NextResponse.json(
      { 
        success: true, 
        data: meeting,
        message: "Meeting created successfully" 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating meeting:", error);
    return NextResponse.json(
      { error: "Failed to create meeting", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const status = searchParams.get("status") || "";
    const client = searchParams.get("client") || "";

    // Build where clause for filtering
    const where: any = {
      userId: session.user.id, // Filter by current user
    };
    
    if (search) {
      where.OR = [
        { meeting: { contains: search, mode: "insensitive" } },
        { client: { contains: search, mode: "insensitive" } },
      ];
    }
    
    // Filter by specific client name (exact match)
    if (client) {
      where.client = client;
    }
    
    if (type && type !== "all") {
      where.meetingType = type;
    }
    
    if (status && status !== "all") {
      where.status = status;
    }

    const meetings = await prisma.meeting.findMany({
      where,
      orderBy: { date: "desc" },
    });

    // Auto-update meeting statuses based on current time
    const now = new Date();
    const updatedMeetings = [];

    for (const meeting of meetings) {
      const meetingDate = new Date(meeting.date);
      const [hours, minutes] = meeting.time.split(':').map(Number);
      const meetingStartTime = new Date(meetingDate);
      meetingStartTime.setHours(hours, minutes, 0, 0);
      
      // Calculate meeting end time based on duration
      const durationMinutes = parseInt(meeting.duration.replace(/\D/g, '')) || 60;
      const meetingEndTime = new Date(meetingStartTime.getTime() + durationMinutes * 60000);

      let newStatus = meeting.status;

      if (meeting.status === "Scheduled" && now >= meetingStartTime && now < meetingEndTime) {
        newStatus = "In Progress";
      } else if (meeting.status === "In Progress" && now >= meetingEndTime) {
        newStatus = "Completed";
      } else if (meeting.status === "Scheduled" && now >= meetingEndTime) {
        newStatus = "Completed";
      }

      // Update status in database if it changed
      if (newStatus !== meeting.status) {
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { status: newStatus }
        });
      }

      updatedMeetings.push({
        ...meeting,
        status: newStatus
      });
    }

    return NextResponse.json(
      { 
        success: true, 
        data: updatedMeetings 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return NextResponse.json(
      { error: "Failed to fetch meetings", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}