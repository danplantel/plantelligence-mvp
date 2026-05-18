import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const customMeetings = await prisma.meetingCustomType.findMany({
      where: { userId: id },
      orderBy: { value: "asc" },
    });

    return NextResponse.json({ success: true, data: customMeetings });
  } catch (error) {
    console.error("GET /custom-meetings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch custom meetings" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { customMeetings } = await request.json();

    await prisma.meetingCustomType.deleteMany({
      where: { userId: id },
    });

    const created = await Promise.all(
      customMeetings.map((meeting: any) =>
        prisma.meetingCustomType.create({
          data: {
            value: meeting.value,
            label: meeting.label,
            description: meeting.description,
            userId: id,
          },
        })
      )
    );

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("PUT /custom-meetings error:", error);
    return NextResponse.json(
      { error: "Failed to save custom meetings" },
      { status: 500 }
    );
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {

    const { meetingId } = await request.json();

    if (!meetingId) {
      return NextResponse.json({ error: "meetingId required" }, { status: 400 });
    }

    const deleted = await prisma.meetingCustomType.delete({
      where: { id: meetingId },
    });

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("DELETE /custom-meetings error:", error);
    return NextResponse.json(
      { error: "Failed to delete custom meeting" },
      { status: 500 }
    );
  }
}
