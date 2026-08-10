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
    // Data format: { disclaimers: [...] }
    const disclaimers = data.disclaimers;

    // Find wizard session
    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: { userId: session.user.id, completed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "Wizard session not found" }, { status: 404 });
    }

    // Save disclaimers in employeePortalPreview.previewData
    // Check if employeePortalPreview exists
    const existingPreview = await prisma.newClientEmployeePortalPreview.findUnique({
      where: { sessionId: wizardSession.id },
    });

    const previewData = existingPreview?.previewData
      ? (existingPreview.previewData as any)
      : {};

    // Update previewData with disclaimers and footer background color preference
    const updatedPreviewData = {
      ...previewData,
      disclaimers,
      ...(data.footerBackground ? { footerBackground: data.footerBackground } : {}),
    };

    // Upsert employee portal preview with disclaimers
    await prisma.newClientEmployeePortalPreview.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        previewData: updatedPreviewData,
      },
      create: {
        sessionId: wizardSession.id,
        previewData: updatedPreviewData,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving disclaimers:", error);
    return NextResponse.json({ error: "Failed to save disclaimers" }, { status: 500 });
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
        employeePortalPreview: true,
      },
    });

    if (wizardSession) {
    }

    if (!wizardSession?.employeePortalPreview) {
      return NextResponse.json({ disclaimers: null });
    }

    const previewData = wizardSession.employeePortalPreview.previewData as any;
    
    const disclaimers = previewData?.disclaimers || null;
    if (Array.isArray(disclaimers)) {
    }

    // Return in format expected by loadStepData: { disclaimers: { disclaimers: [...] } }
    return NextResponse.json({ 
      disclaimers: {
        disclaimers: Array.isArray(disclaimers) ? disclaimers : (disclaimers ? [disclaimers] : [])
      }
    });
  } catch (error) {
    console.error("Error loading disclaimers:", error);
    return NextResponse.json({ error: "Failed to load disclaimers" }, { status: 500 });
  }
}

