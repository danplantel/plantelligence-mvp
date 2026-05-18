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
    
    const benefitTypes = await prisma.wizardBenefitTypes.upsert({
      where: {
        sessionId: data.sessionId || session.user.id,
      },
      update: {
        benefitTypes: data.benefitTypes || [],
        customBenefitType: data.customBenefitType,
      },
      create: {
        sessionId: data.sessionId || session.user.id,
        benefitTypes: data.benefitTypes || [],
        customBenefitType: data.customBenefitType,
      },
    });

    return NextResponse.json({ benefitTypes });
  } catch (error) {
    console.error("Error saving benefit types:", error);
    return NextResponse.json(
      { error: "Failed to save benefit types data" },
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

    const benefitTypes = await prisma.wizardBenefitTypes.findFirst({
      where: {
        sessionId: session.user.id,
      },
    });

    return NextResponse.json({ benefitTypes });
  } catch (error) {
    console.error("Error loading benefit types:", error);
    return NextResponse.json(
      { error: "Failed to load benefit types data" },
      { status: 500 }
    );
  }
}
