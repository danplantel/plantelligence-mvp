export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/notifications.server";

/**
 * POST /api/notifications/read
 *
 * Body `{ id }` marks one notification read; body `{ all: true }` marks them all.
 * Both are scoped by the session `userId`, so a caller can only read their own.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (body?.all === true) {
      const updated = await markAllNotificationsRead({
        userId: session.userId,
        organizationId: session.organizationId,
      });
      return NextResponse.json({ success: true, updated });
    }

    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json(
        { error: "Missing notification id" },
        { status: 400 },
      );
    }

    const updated = await markNotificationRead({ id, userId: session.userId });
    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error("[notifications/read] POST", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
