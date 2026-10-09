import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deletePlansAndScopedDataForUser } from "@/lib/delete-user-plans-and-scoped-data";
import { deleteOrganizationForOwner } from "@/lib/teammates/organization-cleanup.server";
import { markProfilesSelfDeletedByLogin } from "@/lib/teammates/profiles.server";

/**
 * DELETE /api/profile/delete
 * Deletes the authenticated user's profile and all associated data.
 * This is irreversible.
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 0. Delete MarketingAsset records FIRST — they reference both User and Client,
    //    so they must be cleared before either parent can be deleted.
    await prisma.marketingAsset.deleteMany({ where: { userId } });

    // 1. Delete plans and scoped data (clients, documents, meetings, etc.)
    await deletePlansAndScopedDataForUser(userId);

    // 2. Delete wizard session data — use $transaction to ensure atomicity
    const wizardSessionIds = (
      await prisma.wizardSession.findMany({
        where: { userId },
        select: { id: true },
      })
    ).map((s) => s.id);

    if (wizardSessionIds.length > 0) {
      // ONE batch transaction, not Promise.all: ten concurrent deletes checked out ten pooled
      // connections at once, which is what made account deletion the request most likely to
      // trip the pooled endpoint's limit (observed as P1001 part-way through the cascade).
      // A batch uses a single connection and is atomic.
      await prisma.$transaction([
        prisma.wizardUserSetup.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardBranding.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardClientProfile.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardTeamSize.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardServices.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardInsuranceLicensing.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardTeamMembers.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardDisclaimers.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardEmployerScope.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardBenefitTypes.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
      ]);
      await prisma.wizardSession.deleteMany({ where: { userId } });
    }

    // 3. Delete remaining user-scoped data (MarketingAsset already handled above).
    //    `task` belongs here: its `User` FK is Restrict like the rest, so an account
    //    that ever saved a dashboard task failed on the final User delete. Batched into one
    //    transaction for the same reason as the wizard deletes above.
    await prisma.$transaction([
      prisma.task.deleteMany({ where: { userId } }),
      prisma.meetingCustomType.deleteMany({ where: { userId } }),
      prisma.futureContact.deleteMany({ where: { userId } }),
      prisma.headshot.deleteMany({ where: { userId } }),
    ]);

    // 4. Delete the organization this user owns, and the teammate layer inside it.
    //
    // The teammate models carry NO foreign keys — `Organization.ownerUserId`,
    // `TeammateProfile.organizationId`, `PlanAssignment.*` and `TeammateAuditEvent.*` are
    // plain scalars — so nothing else removes them. Omitting this left an ownerless
    // Organization behind on every account deletion, which `verify-backfill` reports as
    // "every Organization references a real User as owner — 1 orphaned". See
    // lib/teammates/organization-cleanup.server.ts.
    await deleteOrganizationForOwner(userId);

    // 4b. Preserve the seats this login was holding in organizations it does NOT own.
    //
    // A person invited into somebody else's organization holds a `TeammateProfile` there
    // whose `loginUserId` is this account. Step 4 only touches organizations this user
    // OWNS, so without this those profiles would survive as Active-looking seats whose
    // owner no longer exists — still counted by the meter, but with nothing on screen to
    // explain it and no way to release it.
    //
    // The profile is flagged, not deleted, and the flag deliberately does NOT release the
    // seat: an Owner or Admin confirms the deletion from the People & Access seat card,
    // which removes the profile and only then gives the seat back. Runs BEFORE the `User`
    // row is deleted, because the profiles are found by `loginUserId`.
    try {
      await markProfilesSelfDeletedByLogin(userId);
    } catch (error) {
      // Best-effort: deleting your own account must not be blocked by a teammate
      // bookkeeping write. The profiles simply stay unmarked, which is the state they were
      // already in before this feature existed.
      console.error(
        "[profile/delete] failed to flag teammate profiles as self-deleted",
        error,
      );
    }

    // 5. Delete the user account itself
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user profile:", error);
    return NextResponse.json(
      {
        error:
          "Failed to delete profile. " +
          (error instanceof Error ? error.message : ""),
      },
      { status: 500 },
    );
  }
}
