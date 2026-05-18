import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { headline, bodyText, isAIGenerated } = data;

    // Find wizard session
    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: { userId: session.user.id, completed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "Wizard session not found" }, { status: 404 });
    }
    

    // Upsert welcome statement data
    await prisma.newClientWelcomeStatement.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        headline,
        bodyText,
        isAIGenerated,
      },
      create: {
        sessionId: wizardSession.id,
        headline,
        bodyText,
        isAIGenerated,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving welcome statement:", error);
    return NextResponse.json({ error: "Failed to save welcome statement" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: { userId: session.user.id, completed: false },
      orderBy: { createdAt: "desc" },
      include: {
        welcomeStatement: true,
      },
    });

    return NextResponse.json({ data: wizardSession?.welcomeStatement || null });
  } catch (error) {
    console.error("Error loading welcome statement:", error);
    return NextResponse.json({ error: "Failed to load welcome statement" }, { status: 500 });
  }
}
