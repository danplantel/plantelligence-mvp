import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { deleteObjectFromR2, isR2Configured } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/r2/delete
 * Body: { key: string }
 * Deletes the object from R2. Auth required; key must start with org/{userId}/.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "R2 storage is not configured" },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const key = typeof body.key === "string" ? body.key.trim() : "";

    if (!key) {
      return NextResponse.json(
        { error: "Missing key in request body" },
        { status: 400 }
      );
    }

    const expectedPrefix = `org/${session.user.id}/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "Access denied to this object" },
        { status: 403 }
      );
    }

    const ok = await deleteObjectFromR2(key);
    if (!ok) {
      return NextResponse.json(
        { error: "Failed to delete object" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[R2 delete]", error);
    return NextResponse.json(
      { error: "Failed to delete object" },
      { status: 500 }
    );
  }
}
