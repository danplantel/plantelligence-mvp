import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { customMeetings } = await request.json();

    return NextResponse.json({ success: true, data: customMeetings });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save custom meetings" }, { status: 500 });
  }
}
