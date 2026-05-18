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
    
    const insuranceLicensing = await prisma.wizardInsuranceLicensing.upsert({
      where: {
        sessionId: data.sessionId || session.user.id,
      },
      update: {
        offersInsurance: data.offersInsurance,
        licenseTypes: data.licenseTypes || [],
        statesLicensed: data.statesLicensed || [],
        licenseNumbers: data.licenseNumbers || {},
        attestation: data.attestation || false,
      },
      create: {
        sessionId: data.sessionId || session.user.id,
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

    const insuranceLicensing = await prisma.wizardInsuranceLicensing.findFirst({
      where: {
        sessionId: session.user.id,
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
