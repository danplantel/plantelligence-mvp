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

    let orderedIds: string[];
    try {
      const body = await request.json();
      orderedIds = Array.isArray(body?.orderedIds)
        ? body.orderedIds.map((id: unknown) => String(id)).filter(Boolean)
        : [];
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
    }

    // Only reorder documents that belong to the current advisor's clients.
    const owned = await prisma.document.findMany({
      where: {
        id: { in: orderedIds },
        client: { userId: session.user.id },
      },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((d) => d.id));

    // Preserve the order provided by the client, skipping any unowned ids.
    const updates = orderedIds
      .filter((id) => ownedSet.has(id))
      .map((id, index) =>
        prisma.document.update({
          where: { id },
          data: { sortOrder: index },
          select: { id: true },
        }),
      );

    if (updates.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const data = await prisma.$transaction(updates);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error reordering documents:", error);
    return NextResponse.json({ error: "Failed to reorder documents" }, { status: 500 });
  }
}
