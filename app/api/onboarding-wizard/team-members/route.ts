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
    
    // Find or create wizard session
    let wizardSession = await prisma.wizardSession.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      wizardSession = await prisma.wizardSession.create({
        data: { userId: session.user.id },
      });
    }

    const teamMembers = await prisma.wizardTeamMembers.upsert({
      where: {
        sessionId: wizardSession.id,
      },
      update: {
        members: data.members || [],
        updatedAt: new Date(),
      },
      create: {
        sessionId: wizardSession.id,
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

    // Find the latest wizard session
    const wizardSession = await prisma.wizardSession.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      return NextResponse.json({ teamMembers: null });
    }

    const teamMembers = await prisma.wizardTeamMembers.findUnique({
      where: {
        sessionId: wizardSession.id,
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
