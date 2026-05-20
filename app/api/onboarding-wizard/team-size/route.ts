import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { TeamSizeFormData, TeamSize } from "@/types/wizard";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data: TeamSizeFormData = await request.json();

    // Find or create wizard session
    let wizardSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });

    if (!wizardSession) {
      wizardSession = await prisma.wizardSession.create({
        data: {
          userId: session.user.id,
          currentStep: 1,
          completed: false,
        }
      });
    }

    const teamSize = await prisma.wizardTeamSize.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        teamSize: data.teamSize,
        updatedAt: new Date(),
      },
      create: {
        sessionId: wizardSession.id,
        teamSize: data.teamSize,
      }
    });

    return NextResponse.json({ teamSize });
  } catch (error) {
    console.error("Error saving team size:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const wizardSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });

    if (!wizardSession) {
      return NextResponse.json({ teamSize: null });
    }

    const teamSize = await prisma.wizardTeamSize.findUnique({
      where: { sessionId: wizardSession.id }
    });

    return NextResponse.json({ teamSize });
  } catch (error) {
    console.error("Error fetching team size:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
