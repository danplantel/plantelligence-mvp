import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const {
      meetingType,
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

    // Check if meeting exists and belongs to current user
    const existingMeeting = await prisma.meeting.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingMeeting) {
      return NextResponse.json(
        { error: "Meeting not found or access denied" },
        { status: 404 }
      );
    }

    let nextClientId: string | null | undefined = existingMeeting.clientId;
    if (planClientId !== undefined) {
      if (planClientId === null || planClientId === "") {
        nextClientId = null;
      } else if (typeof planClientId === "string" && planClientId.trim()) {
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
        nextClientId = ownClient.id;
      }
    }

    if (
      (nextClientId === null || nextClientId === undefined) &&
      client &&
      typeof client === "string"
    ) {
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
          nextClientId = byName.id;
        }
      }
    }

    // Update meeting with all provided data
    const updatedMeeting = await prisma.meeting.update({
      where: { id },
      data: {
        meeting: meetingType,
        ...(status ? { status } : {}),
        meetingType,
        client,
        clientId: nextClientId ?? null,
        date,
        time,
        timezone,
        duration,
        format,
        platform,
        meetingLink,
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
        description,
        address,
        city,
        state,
        zip,
        language: language || null,
        benefitsCategory: benefitsCategory || null,
        customBenefitsCategory: customBenefitsCategory || null,
      },
    });

    return NextResponse.json(
      { 
        success: true, 
        data: updatedMeeting,
        message: "Meeting updated successfully" 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating meeting:", error);
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ["Scheduled", "In Progress", "Completed", "Cancelled"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    // Check if meeting exists and belongs to current user
    const existingMeeting = await prisma.meeting.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingMeeting) {
      return NextResponse.json(
        { error: "Meeting not found or access denied" },
        { status: 404 }
      );
    }

    // Update meeting status
    const updatedMeeting = await prisma.meeting.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(
      { 
        success: true, 
        data: updatedMeeting,
        message: "Meeting status updated successfully" 
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update meeting status" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Check if meeting exists and belongs to current user
    const existingMeeting = await prisma.meeting.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingMeeting) {
      return NextResponse.json(
        { error: "Meeting not found or access denied" },
        { status: 404 }
      );
    }

    // Delete meeting
    await prisma.meeting.delete({
      where: { id },
    });

    return NextResponse.json(
      { 
        success: true, 
        message: "Meeting deleted successfully" 
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete meeting" },
      { status: 500 }
    );
  }
}
