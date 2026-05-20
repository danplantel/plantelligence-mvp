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
    const { spdFile, retirementPlanDocuments, otherDocuments, recordkeeper } = data;

    // Find wizard session
    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: { userId: session.user.id, completed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "Wizard session not found" }, { status: 404 });
    }
    

    // Get existing data to preserve fields if not provided
    const existing = await prisma.newClientComplianceDocuments.findUnique({
      where: { sessionId: wizardSession.id },
    });

    // Upsert compliance documents data
    // Only update fields if they're explicitly provided (not undefined)
    const updateData: any = {
      spdFile: spdFile !== undefined ? spdFile : existing?.spdFile,
      recordkeeper: recordkeeper !== undefined ? (recordkeeper || null) : existing?.recordkeeper,
    };

    // Only update retirementPlanDocuments if explicitly provided. This is the
    // Step 4 upload surface for Benefits Hub documents; dropping it here means
    // publish has no source rows to create portal documents from.
    if (retirementPlanDocuments !== undefined) {
      updateData.retirementPlanDocuments = retirementPlanDocuments;
    } else {
      updateData.retirementPlanDocuments = existing?.retirementPlanDocuments || null;
    }

    // Only update otherDocuments if it's explicitly provided
    if (otherDocuments !== undefined) {
      updateData.otherDocuments = otherDocuments;
    }

    await prisma.newClientComplianceDocuments.upsert({
      where: { sessionId: wizardSession.id },
      update: updateData,
      create: {
        sessionId: wizardSession.id,
        spdFile: spdFile || null,
        otherDocuments: otherDocuments || [],
        retirementPlanDocuments: retirementPlanDocuments || [],
        recordkeeper: recordkeeper || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving compliance documents:", error);
    return NextResponse.json({ error: "Failed to save compliance documents" }, { status: 500 });
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
        complianceDocuments: true,
      },
    });

    return NextResponse.json({ data: wizardSession?.complianceDocuments || null });
  } catch (error) {
    console.error("Error loading compliance documents:", error);
    return NextResponse.json({ error: "Failed to load compliance documents" }, { status: 500 });
  }
}
