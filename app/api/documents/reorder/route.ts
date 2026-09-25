import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolvePlanAccess } from "@/lib/teammates/access.server";

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

    // Only reorder documents on plans the caller may edit.
    //
    // The previous filter used the relation `client: { userId: session.user.id }`,
    // which hard-codes ownership and therefore refused every teammate. The plan
    // is authorized per client through the T2 guard instead, and reordering is a
    // document write, so it requires `documents: edit` (a Viewer is refused).
    const candidates = await prisma.document.findMany({
      where: { id: { in: orderedIds } },
      select: { id: true, clientId: true },
    });

    const allowedClientIds = new Set<string>();
    for (const clientId of new Set(candidates.map((d) => d.clientId))) {
      const access = await resolvePlanAccess({
        userId: session.user.id,
        clientIdOrSlug: clientId,
        permission: "documents",
        level: "edit",
      });
      if (access.allowed) allowedClientIds.add(clientId);
    }

    const ownedSet = new Set(
      candidates
        .filter((d) => allowedClientIds.has(d.clientId))
        .map((d) => d.id),
    );

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
