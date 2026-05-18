import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ServicesFormData, ServiceType } from "@/types/wizard";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data: ServicesFormData = await request.json();

    let wizardSession = await prisma.wizardSession.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      wizardSession = await prisma.wizardSession.create({
        data: { userId: session.user.id },
      });
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
