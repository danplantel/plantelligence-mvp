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
    
    const employerScope = await prisma.wizardEmployerScope.upsert({
      where: {
        sessionId: data.sessionId || session.user.id,
      },
      update: {
        servesMultipleEmployers: data.servesMultipleEmployers || false,
      },
      create: {
        sessionId: data.sessionId || session.user.id,
        servesMultipleEmployers: data.servesMultipleEmployers || false,
      },
    });

    return NextResponse.json({ employerScope });
  } catch (error) {
    console.error("Error saving employer scope:", error);
    return NextResponse.json(
      { error: "Failed to save employer scope data" },
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

    const employerScope = await prisma.wizardEmployerScope.findFirst({
      where: {
        sessionId: session.user.id,
      },
    });

    return NextResponse.json({ employerScope });
  } catch (error) {
    console.error("Error loading employer scope:", error);
    return NextResponse.json(
      { error: "Failed to load employer scope data" },
      { status: 500 }
    );
  }
}
