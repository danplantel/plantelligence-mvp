import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const data = await request.json();

    // Find or create wizard session
    let wizardSession = await prisma.wizardSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      wizardSession = await prisma.wizardSession.create({
        data: { userId },
      });
    }

    // Update or create disclaimers data
    await prisma.wizardDisclaimers.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        disclaimers: data.disclaimers || [],
      },
      create: {
        sessionId: wizardSession.id,
        disclaimers: data.disclaimers || [],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving disclaimers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Find the latest wizard session
    const wizardSession = await prisma.wizardSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      return NextResponse.json({ disclaimers: null });
    }

    // Get disclaimers data
    const disclaimers = await prisma.wizardDisclaimers.findUnique({
      where: { sessionId: wizardSession.id },
    });

    return NextResponse.json({ disclaimers });
  } catch (error) {
    console.error("Error loading disclaimers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
