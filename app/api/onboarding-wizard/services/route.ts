import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ServicesFormData, ServiceType } from "@/types/wizard";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data: ServicesFormData = await request.json();
    console.log("📥 Services POST received:", data);

    let wizardSession = await prisma.wizardSession.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      wizardSession = await prisma.wizardSession.create({
        data: { userId: session.user.id },
      });
      console.log("✨ Created new wizard session:", wizardSession.id);
    } else {
      console.log("📋 Found existing wizard session:", wizardSession.id);
    }

    const services = await prisma.wizardServices.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        services: data.services,
        updatedAt: new Date(),
      },
      create: {
        sessionId: wizardSession.id,
        services: data.services,
      }
    });

    console.log("✅ Services saved to WizardServices:", services);
    return NextResponse.json({ services });
  } catch (error) {
    console.error("❌ API - Error saving services:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const wizardSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!wizardSession) {
      return NextResponse.json({ services: null });
    }

    const services = await prisma.wizardServices.findUnique({
      where: { sessionId: wizardSession.id }
    });


    return NextResponse.json({ services });
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
