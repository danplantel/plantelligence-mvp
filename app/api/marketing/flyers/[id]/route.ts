import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/marketing/flyers/[id]
 * Body: { archived?: boolean, title?: string | null }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const flyerId = params.id?.trim();
    if (!flyerId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const existing = await prisma.marketingFlyer.findFirst({
      where: {
        id: flyerId,
        client: { userId },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      archived?: boolean;
      title?: string | null;
    };

    const data: {
      archivedAt?: Date | null;
      title?: string | null;
    } = {};

    if (typeof body.archived === "boolean") {
      data.archivedAt = body.archived ? new Date() : null;
    }

    if (body.title !== undefined) {
      data.title = body.title?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update (archived, title)" },
        { status: 400 },
      );
    }

    const updated = await prisma.marketingFlyer.update({
      where: { id: flyerId },
      data,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        archivedAt: updated.archivedAt?.toISOString() ?? null,
        title: updated.title,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[PATCH /api/marketing/flyers/[id]]", e);
    return NextResponse.json(
      { error: "Failed to update flyer" },
      { status: 500 },
    );
  }
}
