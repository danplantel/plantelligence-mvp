import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ClientProfileFormData, OrganizationType } from "@/types/wizard";
import { validateClientProfile } from "@/lib/wizard-validation";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawData = await request.json();
    console.log("📥 [client-profile POST] Received data:", JSON.stringify(rawData));
    
    // Validate the data
    const data = validateClientProfile(rawData);
    console.log("📥 [client-profile POST] Validated data:", JSON.stringify(data));

    let wizardSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });
    console.log("📥 [client-profile POST] Found session:", wizardSession?.id || "none");

    if (!wizardSession) {
      wizardSession = await prisma.wizardSession.create({
        data: {
          userId: session.user.id,
          currentStep: 1,
          completed: false,
        }
      });
      console.log("📥 [client-profile POST] Created new session:", wizardSession.id);
    }

    const clientProfile = await prisma.wizardClientProfile.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        organizationType: data.organizationType,
        customOrganization: data.customOrganization,
        updatedAt: new Date(),
      },
      create: {
        sessionId: wizardSession.id,
        organizationType: data.organizationType,
        customOrganization: data.customOrganization,
      }
    });
    console.log("📥 [client-profile POST] Saved clientProfile:", JSON.stringify(clientProfile));

    return NextResponse.json({ clientProfile });
  } catch (error) {
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Validation failed", 
        details: error.errors 
      }, { status: 400 });
    }
    
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
      return NextResponse.json({ clientProfile: null });
    }

    const clientProfile = await prisma.wizardClientProfile.findUnique({
      where: { sessionId: wizardSession.id }
    });

    return NextResponse.json({ clientProfile });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
