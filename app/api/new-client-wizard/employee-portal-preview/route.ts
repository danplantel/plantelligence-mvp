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
    const incoming = data && typeof data === "object" ? data : {};

    // Find wizard session and existing preview (if any)
    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: { userId: session.user.id, completed: false },
      orderBy: { createdAt: "desc" },
      include: { employeePortalPreview: true },
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "Wizard session not found" }, { status: 404 });
    }

    // Merge incoming with existing previewData so we never wipe categoryPortalVisibility or benefits when only one is sent
    const existingData =
      (wizardSession.employeePortalPreview?.previewData as Record<string, unknown>) || {};
    const toStore = { ...existingData, ...incoming };

    await prisma.newClientEmployeePortalPreview.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        previewData: toStore as any,
      },
      create: {
        sessionId: wizardSession.id,
        previewData: toStore as any,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving employee portal preview:", error);
    return NextResponse.json({ error: "Failed to save employee portal preview" }, { status: 500 });
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

    return NextResponse.json({ data: wizardSession?.employeePortalPreview || null });
  } catch (error) {
    console.error("Error loading employee portal preview:", error);
    return NextResponse.json({ error: "Failed to load employee portal preview" }, { status: 500 });
  }
}
