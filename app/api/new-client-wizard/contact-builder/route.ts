import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const CONTACT_FIELDS = {
  id: true,
  sessionId: true,
  fullName: true,
  title: true,
  companyName: true,
  orgType: true,
  customRole: true,
  description: true,
  showOnPortal: true,
  enableContactButton: true,
  email: true,
  phone: true,
  meetingLink: true,
  headshot: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function resolveWizardSessionId(
  userId: string,
  preferredSessionId?: string | null,
) {
  if (preferredSessionId) {
    const session = await prisma.newClientWizardSession.findFirst({
      where: { id: preferredSessionId, userId },
      select: { id: true },
    });

    if (session) {
      return session.id;
    }
  }

  const latestSession = await prisma.newClientWizardSession.findFirst({
    where: { userId, completed: false },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return latestSession?.id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const requestedSessionId = searchParams.get("sessionId");

    const wizardSessionId = await resolveWizardSessionId(
      session.user.id,
      requestedSessionId,
    );

    if (!wizardSessionId) {
      return NextResponse.json({ contactBuilder: null }, { status: 200 });
    }

    const contact = await prisma.newClientContactBuilder.findUnique({
      where: { sessionId: wizardSessionId },
      select: CONTACT_FIELDS,
    });

    return NextResponse.json(
      { contactBuilder: contact ?? null },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Error loading contact builder:", error);
    return NextResponse.json(
      { error: "Failed to load contact builder" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const {
      sessionId,
      fullName,
      title,
      companyName,
      orgType,
      customRole,
      description,
      showOnPortal = false,
      enableContactButton = false,
      email,
      phone,
      meetingLink,
      headshot,
    } = body;

    let wizardSessionId = await resolveWizardSessionId(
      session.user.id,
      sessionId,
    );

    if (!wizardSessionId) {
      const newSession = await prisma.newClientWizardSession.create({
        data: {
          userId: session.user.id,
        },
        select: { id: true },
      });

      wizardSessionId = newSession.id;
    }

    if (!fullName || !title || !companyName || !orgType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const contact = await prisma.newClientContactBuilder.upsert({
      where: { sessionId: wizardSessionId },
      update: {
        fullName,
        title,
        companyName,
        orgType,
        customRole,
        description,
        showOnPortal,
        enableContactButton,
        email,
        phone,
        meetingLink,
        headshot,
      },
      create: {
        sessionId: wizardSessionId,
        fullName,
        title,
        companyName,
        orgType,
        customRole,
        description,
        showOnPortal,
        enableContactButton,
        email,
        phone,
        meetingLink,
        headshot,
      },
    });

    return NextResponse.json({ success: true, data: contact }, { status: 200 });
  } catch (error: any) {
    console.error(" Error saving contact builder:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Duplicate entry for this sessionId" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to save contact builder",
        message: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
