import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    
    const teamMembers = await prisma.wizardTeamMembers.upsert({
      where: {
        sessionId: data.sessionId || session.user.id,
      },
      update: {
        members: data.members || [],
      },
      create: {
        sessionId: data.sessionId || session.user.id,
        members: data.members || [],
      },
    });

    return NextResponse.json({ teamMembers });
  } catch (error) {
    console.error("Error saving team members:", error);
    return NextResponse.json(
      { error: "Failed to save team members data" },
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

    const teamMembers = await prisma.wizardTeamMembers.findFirst({
      where: {
        sessionId: session.user.id,
      },
    });

    return NextResponse.json({ teamMembers });
  } catch (error) {
    console.error("Error loading team members:", error);
    return NextResponse.json(
      { error: "Failed to load team members data" },
      { status: 500 }
    );
  }
}
