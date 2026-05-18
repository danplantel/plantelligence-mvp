import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      },
      include: {
        companyBasics: true,
        welcomeStatement: true,
        keyContacts: true,
        complianceDocuments: true,
        employeePortalPreview: true,
      }
    });

    return NextResponse.json({ session: wizardSession });
  } catch (error) {
    console.error("Error fetching new client wizard session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if there's already an active session
    const existingSession = await prisma.newClientWizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });

    if (existingSession) {
      return NextResponse.json({ session: existingSession });
    }

    // Create new session
    const newSession = await prisma.newClientWizardSession.create({
      data: {
        userId: session.user.id,
        currentStep: 1,
        completed: false,
      }
    });

    return NextResponse.json({ session: newSession });
  } catch (error) {
    console.error("Error creating new client wizard session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentStep } = await request.json();

    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "No active wizard session" }, { status: 404 });
    }

    const updatedSession = await prisma.newClientWizardSession.update({
      where: { id: wizardSession.id },
      data: { currentStep }
    });

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error("Error updating wizard session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
