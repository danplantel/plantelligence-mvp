import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { DocumentData } from "@/types/new-client-wizard";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data: DocumentData = await request.json();
    

    let wizardSession = await prisma.newClientWizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });

    if (!wizardSession) {
      wizardSession = await prisma.newClientWizardSession.create({
        data: {
          userId: session.user.id,
          currentStep: 2,
          completed: false,
        }
      });
    } else {
      // Update current step to 2 if it's not already
      if (wizardSession.currentStep !== 2) {
        await prisma.newClientWizardSession.update({
          where: { id: wizardSession.id },
          data: { currentStep: 2 }
        });
      }
    }

    const documentData = await prisma.newClientComplianceDocuments.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        spdFile: data.spdFile,
        otherDocuments: data.otherDocuments || [],
        updatedAt: new Date(),
      },
      create: {
        sessionId: wizardSession.id,
        spdFile: data.spdFile,
        otherDocuments: data.otherDocuments || [],
      }
    });

    


    return NextResponse.json({ documentData });
  } catch (error) {
    console.error("Error saving document data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
      }
    });

    if (!wizardSession) {
      return NextResponse.json({ documentData: null });
    }

    const documentData = await prisma.newClientComplianceDocuments.findUnique({
      where: { sessionId: wizardSession.id }
    });

    return NextResponse.json({ documentData });
  } catch (error) {
    console.error("Error fetching document data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
