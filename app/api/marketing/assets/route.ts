import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// ── Shared helpers ──

async function assertOwnership(clientId: string, userId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, userId: true },
  });
  if (!client) return { error: "Client not found", status: 404 as const };
  if (client.userId !== userId) return { error: "Forbidden", status: 403 as const };
  return { client };
}

// ── GET /api/marketing/assets?clientId=xxx[&type=xxx] ──

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const type = searchParams.get("type"); // optional filter
    const status = searchParams.get("status"); // optional filter

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const gate = await assertOwnership(clientId, userId);
    if ("error" in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const where: Record<string, unknown> = {
      clientId,
      userId,
    };
    if (type) where.type = type;
    if (status) where.status = status;

    const assets = await prisma.marketingAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: assets });
  } catch (error) {
    console.error("GET /api/marketing/assets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── POST /api/marketing/assets ──

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, type, status, headline, body: bodyText, ctaText, startDate, endDate, bgColor, data } = body;

    if (!clientId || !type || !headline) {
      return NextResponse.json(
        { error: "Missing required fields: clientId, type, headline" },
        { status: 400 },
      );
    }

    const gate = await assertOwnership(clientId, userId);
    if ("error" in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const asset = await prisma.marketingAsset.create({
      data: {
        clientId,
        userId,
        type,
        status: status || "Draft",
        headline,
        body: bodyText || "",
        ctaText: ctaText || "",
        startDate: startDate || null,
        endDate: endDate || null,
        bgColor: bgColor || "#23919c",
        data: data || undefined,
      },
    });

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (error) {
    console.error("POST /api/marketing/assets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
