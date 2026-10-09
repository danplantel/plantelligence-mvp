export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { listNotifications } from "@/lib/notifications/notifications.server";

/**
 * GET /api/notifications
 *
 * The caller's own persisted notifications for the session's organization, newest
 * first, with an unread count for the bell badge. Every value is scoped by the
 * session `userId`, so one member can never read another's.
 */
export async function GET() {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items, unreadCount } = await listNotifications({
      userId: session.userId,
      organizationId: session.organizationId,
    });

    return NextResponse.json({ success: true, data: items, unreadCount });
  } catch (error) {
    console.error("[notifications] GET", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
