export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrgSession } from "@/lib/organization-session";
import { requireOrganizationPermission } from "@/lib/teammates/access.server";
import { TeammateDataError } from "@/lib/teammates/errors";

/**
 * GET /api/organization — the caller's own organization.
 *
 * Reads the tenancy root the caller belongs to, resolved from the SESSION rather than from
 * the URL or the body. That is the whole security model for this route: there is no way to
 * name a different organization, so it cannot be used to read someone else's. It follows the
 * rule `lib/organization-session.ts` documents — the JWT's `organizationId` is treated as a
 * hint and `resolveOrganizationId` confirms (and backfills) it, so a stale token cannot scope
 * the request to the wrong org.
 *
 * Gated on `org_settings: view`, the same permission the Settings → Team tab requires, because
 * this is organization-management data. A Collaborator can never hold that permission (their
 * rows are hard-blocked), so they get a 403 rather than a payload.
 *
 * The fields returned are the organization's own: its identity (`name`, `organizationEmail`),
 * the firm profile, and the seat allowance fields. Two deliberate omissions:
 *
 *  - **`branding`** is a derived mirror of the owner's `User` row and has no reader, so
 *    shipping it here would invite a second source of truth next to `/api/profile`, which is
 *    where branding is actually read and written.
 *  - **seat USAGE** (used / pending / available) is computed by `getSeatUsage`, not stored, and
 *    the Settings tab already receives it from `/api/teammates/team`. Adding it here would be a
 *    third place to fetch the same meter.
 *
 * Only GET for now. Writes belong with the screen that needs them.
 */
export async function GET() {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireOrganizationPermission({
      userId: session.userId,
      organizationId: session.organizationId,
      permission: "org_settings",
      level: "view",
    });

    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        name: true,
        organizationEmail: true,
        organizationType: true,
        customOrganization: true,
        teamSize: true,
        // Kept: the client needs it to answer "am I the owner?" without a second request,
        // and the reserved-seat rule is viewer-aware because the seat belongs to the
        // organization rather than to the reader (docs/teammates-module.md §6).
        ownerUserId: true,
        // The T3 placeholders. Read-only until a billing surface exists.
        seatsIncluded: true,
        planTier: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Unreachable in practice: `getOrgSession` resolves, creating the organization when a
    // session predates T1. Handled anyway so a missing row is a 404 rather than a null body.
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, organization });
  } catch (error) {
    if (error instanceof TeammateDataError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[organization] GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
