export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getViewerAccess } from "@/lib/teammates/viewer-access.server";

/**
 * GET /api/teammates/viewer-access
 *
 * The signed-in user's chrome-level access: whether they are a Collaborator, and the
 * union of the grids they hold, so the sidebar can hide destinations with no grant.
 * This is NOT the enforcement point — the mutating routes are; a client that ignores
 * this response is still refused.
 *
 * Deliberately fails OPEN. A failed read returns "not a collaborator, no grid", so a
 * transient error never hides a page the user can actually reach. Briefly showing a
 * destination they cannot use is the harmless direction: the server refuses the action.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ isCollaborator: false, functions: null });
  }

  try {
    const access = await getViewerAccess(userId);
    return NextResponse.json(access);
  } catch (error) {
    console.error("[teammates/viewer-access]", error);
    return NextResponse.json({ isCollaborator: false, functions: null });
  }
}
