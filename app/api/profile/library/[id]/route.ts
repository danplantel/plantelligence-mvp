import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { deleteObjectFromR2 } from "@/lib/r2";

/**
 * DELETE /api/profile/library/[id] — drop one file from the advisor's library.
 *
 * The row and the R2 object are removed together. The object delete is
 * best-effort: if R2 misses it, the file is already gone from every picker, and
 * a stray object costs storage but breaks nothing — the reverse (bytes deleted,
 * row kept) would leave a tile that fails to download.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Scoped by userId so one account can never delete another's asset by id.
    const asset = await prisma.userAsset.findFirst({
      where: { id: params.id, userId },
      select: { id: true, key: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await prisma.userAsset.delete({ where: { id: asset.id } });
    await deleteObjectFromR2(asset.key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[profile/library] delete failed:", error);
    return NextResponse.json(
      { error: "Could not remove that file" },
      { status: 500 },
    );
  }
}
