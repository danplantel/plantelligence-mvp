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
      where: {
        userId: session.user.id,
        completed: false,
      }
    });

    if (!wizardSession) {
      wizardSession = await prisma.wizardSession.create({
        data: {
          userId: session.user.id,
        }
      });
    }

    const insuranceLicensing = await prisma.wizardInsuranceLicensing.upsert({
      where: {
        sessionId: wizardSession.id,
      },
      update: {
        offersInsurance: data.offersInsurance,
        licenseTypes: data.licenseTypes || [],
        statesLicensed: data.statesLicensed || [],
        licenseNumbers: data.licenseNumbers || {},
        attestation: data.attestation || false,
        updatedAt: new Date(),
      },
      create: {
        sessionId: wizardSession.id,
        offersInsurance: data.offersInsurance,
        licenseTypes: data.licenseTypes || [],
        statesLicensed: data.statesLicensed || [],
        licenseNumbers: data.licenseNumbers || {},
        attestation: data.attestation || false,
      },
    });

    return NextResponse.json({ insuranceLicensing });
  } catch (error) {
    console.error("Error saving insurance licensing:", error);
    return NextResponse.json(
      { error: "Failed to save insurance licensing data" },
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

    const wizardSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });

    if (!wizardSession) {
      return NextResponse.json({ insuranceLicensing: null });
    }

    const insuranceLicensing = await prisma.wizardInsuranceLicensing.findUnique({
      where: {
        sessionId: wizardSession.id,
      },
    });

    return NextResponse.json({ insuranceLicensing });
  } catch (error) {
    console.error("Error loading insurance licensing:", error);
    return NextResponse.json(
      { error: "Failed to load insurance licensing data" },
      { status: 500 }
    );
  }
}
