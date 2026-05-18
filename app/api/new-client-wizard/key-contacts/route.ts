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

    // Find wizard session
    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: { userId: session.user.id, completed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "Wizard session not found" }, { status: 404 });
    }


    // Upsert key contacts data
    // Store entire data object to preserve fields like cardBackgroundColor, displayStyle, etc.
    const contactsData = {
      contacts: data.contacts || [],
      ...data
    };

    await prisma.newClientKeyContacts.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        contacts: contactsData as any,
      },
      create: {
        sessionId: wizardSession.id,
        contacts: contactsData as any,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving key contacts:", error);
    return NextResponse.json({ error: "Failed to save key contacts" }, { status: 500 });
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
        keyContacts: true,
      },
    });

    return NextResponse.json({ data: wizardSession?.keyContacts || null });
  } catch (error) {
    console.error("Error loading key contacts:", error);
    return NextResponse.json({ error: "Failed to load key contacts" }, { status: 500 });
  }
}
