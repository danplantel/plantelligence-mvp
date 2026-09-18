import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ObjectId } from "mongodb";

/**
 * Bulk delete for the Replays list, where several webinars can be selected and
 * removed in one action.
 *
 * The filter is always scoped to the session user, so a crafted id list can never
 * touch another advisor's webinars. Ids that aren't usable ObjectIds are dropped
 * rather than failing the whole batch — one bad id shouldn't block the rest.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const ids: unknown = body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No webinars selected" },
        { status: 400 }
      );
    }

    const validIds = ids.filter(
      (id): id is string => typeof id === "string" && ObjectId.isValid(id)
    );

    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "No valid webinars selected" },
        { status: 400 }
      );
    }

    const result = await prisma.webinar.deleteMany({
      where: { id: { in: validIds }, userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (error) {
    console.error("Error deleting webinars:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
