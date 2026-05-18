import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });

    if (existingSession) {
      return NextResponse.json({ 
        error: "User already has an active wizard session",
        sessionId: existingSession.id 
      }, { status: 400 });
    }

    const newSession = await prisma.wizardSession.create({
      data: {
        userId: session.user.id,
        completed: false,
      }
    });

    return NextResponse.json({ 
      success: true, 
      sessionId: newSession.id,
      message: "New wizard session created" 
    });
  } catch (error) {
    console.error("Error creating new wizard session:", error);
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
      return NextResponse.json({ session: null });
    }

    return NextResponse.json({ session: wizardSession });
  } catch (error) {
    console.error("Error getting wizard session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
