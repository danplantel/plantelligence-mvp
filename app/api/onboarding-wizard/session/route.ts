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

    const wizardSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      },
      include: {
        clientProfile: true,
        teamSize: true,
        services: true,
        insuranceLicensing: true,
        teamMembers: true,
        branding: true,
        benefitTypes: true,
        employerScope: true,
      }
    });

    return NextResponse.json({ session: wizardSession });
  } catch (error) {
    console.error("Error fetching wizard session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
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
      return NextResponse.json({ session: existingSession });
    }

    const wizardSession = await prisma.wizardSession.create({
      data: {
        userId: session.user.id,
        currentStep: 1,
        completed: false,
      }
    });

    return NextResponse.json({ session: wizardSession });
  } catch (error) {
    console.error("Error creating wizard session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentStep } = body;

    if (typeof currentStep !== "number" || currentStep < 1 || currentStep > 5) {
      return NextResponse.json(
        { error: "Invalid currentStep value (must be 1-5)" },
        { status: 400 },
      );
    }

    const wizardSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      },
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "No active wizard session found" }, { status: 404 });
    }

    const updatedSession = await prisma.wizardSession.update({
      where: { id: wizardSession.id },
      data: { currentStep },
    });

    return NextResponse.json({
      success: true,
      session: updatedSession,
    });
  } catch (error) {
    console.error("Error updating wizard session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
