export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOrgSession } from "@/lib/organization-session";
import { deleteNotification } from "@/lib/notifications/notifications.server";

/**
 * DELETE /api/notifications/[id] — remove one notification from the caller's own feed.
 *
 * A real delete, unlike the bell's meeting and document rows: those are DERIVED on every fetch, so
 * closing one is a browser-side dismissal that the next load would otherwise undo. A notification is
 * a stored row addressed to one person, so removing it is a write and every device agrees.
 *
 * Scoped by the session `userId`, which is the whole authorization: another member's notification id
 * removes nothing and answers 404 rather than 403 — saying "that exists but is not yours" would
 * confirm a row the caller may not know about.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json(
        { error: "Missing notification id" },
        { status: 400 },
      );
    }

    const removed = await deleteNotification({ id, userId: session.userId });
    if (removed === 0) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error("[notifications/[id]] DELETE", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
