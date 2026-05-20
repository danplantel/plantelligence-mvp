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
    console.log("📥 [branding POST] Received data keys:", Object.keys(rawData));

    // Validate the data
    const data = validateBranding(rawData);
    console.log("📥 [branding POST] Validated data keys:", Object.keys(data));

    // Find or create wizard session
    let wizardSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });
    console.log("📥 [branding POST] Found session:", wizardSession?.id || "none");

    if (!wizardSession) {
      wizardSession = await prisma.wizardSession.create({
        data: {
          userId: session.user.id,
          currentStep: 3,
          completed: false,
        }
      });
      console.log("📥 [branding POST] Created new session:", wizardSession.id);
    }

    const branding = await prisma.wizardBranding.upsert({
      where: {
        sessionId: wizardSession.id,
      },
      update: {
        logo: data.logo || undefined,
        logoFileName: data.logoFileName,
        backgroundImage: data.backgroundImage,
        backgroundFileName: data.backgroundFileName,
        organizationName: data.organizationName,
        website: data.website,
        missionStatement: data.missionStatement,
        brandColor: data.brandColor,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        aiAvatar: data.aiAvatar,
        avatarFileName: data.avatarFileName,
        subdomain: data.subdomain,
        updatedAt: new Date(),
      },
      create: {
        sessionId: wizardSession.id,
        logo: data.logo || "",
        logoFileName: data.logoFileName,
        backgroundImage: data.backgroundImage,
        backgroundFileName: data.backgroundFileName,
        organizationName: data.organizationName,
        website: data.website,
        missionStatement: data.missionStatement,
        brandColor: data.brandColor,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        aiAvatar: data.aiAvatar,
        avatarFileName: data.avatarFileName,
        subdomain: data.subdomain,
      },
    });
    console.log("📥 [branding POST] Saved branding ID:", branding.id);

    return NextResponse.json({ branding });
  } catch (error) {
    console.error("Error in POST /api/onboarding-wizard/branding:", error);

    if (error instanceof z.ZodError) {
      console.error("Validation errors:", error.errors);
      return NextResponse.json({
        error: "Validation failed",
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to save branding data", details: String(error) },
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
