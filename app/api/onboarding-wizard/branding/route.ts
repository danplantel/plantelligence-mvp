import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { validateBranding } from "@/lib/wizard-validation";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawData = await request.json();

    // Validate the data
    const data = validateBranding(rawData);

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
          currentStep: 3,
          completed: false,
        }
      });
    }

    const branding = await prisma.wizardBranding.upsert({
      where: {
        sessionId: wizardSession.id,
      },
      update: {
        logo: data.logo,
        logoFileName: data.logoFileName,
        backgroundImage: data.backgroundImage,
        backgroundFileName: data.backgroundFileName,
        organizationName: data.organizationName,
        website: data.website,
        missionStatement: data.missionStatement,
        brandColor: data.brandColor,
        aiAvatar: data.aiAvatar,
        avatarFileName: data.avatarFileName,
        subdomain: data.subdomain,
        updatedAt: new Date(),
      },
      create: {
        sessionId: wizardSession.id,
        logo: data.logo,
        logoFileName: data.logoFileName,
        backgroundImage: data.backgroundImage,
        backgroundFileName: data.backgroundFileName,
        organizationName: data.organizationName,
        website: data.website,
        missionStatement: data.missionStatement,
        brandColor: data.brandColor,
        aiAvatar: data.aiAvatar,
        avatarFileName: data.avatarFileName,
        subdomain: data.subdomain,
      },
    });

    return NextResponse.json({ branding });
  } catch (error) {

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation failed",
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to save branding data" },
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


    // First try to find incomplete session
    let wizardSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      },
      orderBy: { createdAt: "desc" },
    });


    // If no incomplete session, try to find the most recent session (including completed)
    if (!wizardSession) {
      wizardSession = await prisma.wizardSession.findFirst({
        where: {
          userId: session.user.id,
        },
        orderBy: { createdAt: "desc" },
      });
    }


    if (!wizardSession) {
      return NextResponse.json({ branding: null });
    }

    const branding = await prisma.wizardBranding.findUnique({
      where: {
        sessionId: wizardSession.id,
      }
    });

    return NextResponse.json({ branding });
  } catch (error) {
    console.error("Error in GET /api/onboarding-wizard/branding:", error);
    return NextResponse.json(
      { error: "Failed to load branding data" },
      { status: 500 }
    );
  }
}
