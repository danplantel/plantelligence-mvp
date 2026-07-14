import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ClientInfoFormData } from "@/types/new-client-wizard";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data: ClientInfoFormData = await request.json();

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
          currentStep: 1,
          completed: false,
        }
      });
    } else {
      // Update current step to 1 if it's not already
      if (wizardSession.currentStep !== 1) {
        await prisma.newClientWizardSession.update({
          where: { id: wizardSession.id },
          data: { currentStep: 1 }
        });
      }
    }

    const clientInfo = await prisma.newClientCompanyBasics.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        companyName: data.companyData?.companyName || '',
        companyWebsite: data.companyData?.companyWebsite || '',
        companyLogo: data.companyData?.companyLogo || '',
        logoFileName: data.companyData?.logoFileName || '',
        primaryColor: data.companyData?.brandColor || '',
        secondaryColor: data.companyData?.secondaryColor || '',
        brandImages: [],
        updatedAt: new Date(),
      },
      create: {
        sessionId: wizardSession.id,
        companyName: data.companyData?.companyName || '',
        companyWebsite: data.companyData?.companyWebsite || '',
        companyLogo: data.companyData?.companyLogo || '',
        logoFileName: data.companyData?.logoFileName || '',
        primaryColor: data.companyData?.brandColor || '',
        secondaryColor: data.companyData?.secondaryColor || '',
        brandImages: [],
      }
    });

    return NextResponse.json({ clientInfo });
  } catch (error) {
    console.error("Error saving client info:", error);
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
      return NextResponse.json({ clientInfo: null });
    }

    const clientInfo = await prisma.newClientCompanyBasics.findUnique({
      where: { sessionId: wizardSession.id }
    });

    return NextResponse.json({ clientInfo });
  } catch (error) {
    console.error("Error fetching client info:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
