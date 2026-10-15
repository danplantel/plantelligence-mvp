import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deletePlansAndScopedDataForUser } from "@/lib/delete-user-plans-and-scoped-data";
import { deleteOrganizationForOwner } from "@/lib/teammates/organization-cleanup.server";
import { markProfilesSelfDeletedByLogin } from "@/lib/teammates/profiles.server";
import { notifySelfDeletedProfile } from "@/lib/notifications/notifications.server";
import {
  requireOrganizationDeletionAcknowledged,
  transferOrganizationOwnership,
  type OwnershipTransferResult,
} from "@/lib/teammates/ownership.server";
import { TeammateDataError } from "@/lib/teammates/errors";

/**
 * DELETE /api/profile/delete
 * Deletes the authenticated user's profile and all associated data.
 * This is irreversible.
 *
 * ## `?transferTo=<profileId>` — the organization survives its owner
 *
 * For an Owner with teammates this request used to be a business-ending accident: step 1 removes
 * their plans by `userId` and step 4 removes the Organization with every teammate in it, and the
 * only thing the caller was asked to do was type their own email. The dialog now asks who should
 * take over, and passes their `TeammateProfile` id here.
 *
 * The handover runs FIRST — before any destructive step — and a refusal (409) returns without
 * deleting anything. That is the one part of this handler that must not be best-effort: the
 * flagging block further down swallows failures because an account deletion must not be blocked by
 * bookkeeping, but "we could not hand your organization over" has to stop the request, or the
 * caller would lose the organization they were trying to save.
 *
 * The handover also moves the plans (`Client.userId` and the rest of §3.3 of
 * plans/owner-self-deletion-handover.md), which is what spares them: the cascade below is keyed on
 * `userId`, so it simply stops matching what moved.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 0. Ask for permission to destroy an organization, and hand it over when asked to — both
    //    before a single row is deleted.
    //
    // The acknowledgement gate comes first and is the reason it exists server-side rather than in
    // the dialog: this endpoint has more than one caller, and the second one (the onboarding
    // wizard's "Cancel signup") deleted an Owner's organization, its plans and its teammates'
    // access behind a dialog that mentioned only "your account". A caller must now SAY which
    // consequence it showed — `transferTo` or `confirmOrganization` — or be refused.
    const searchParams = request.nextUrl.searchParams;
    const transferToProfileId = searchParams.get("transferTo")?.trim() ?? "";
    const acknowledgedOrganization =
      searchParams.get("confirmOrganization") === "true";

    try {
      await requireOrganizationDeletionAcknowledged({
        userId,
        acknowledged: acknowledgedOrganization,
        transferring: Boolean(transferToProfileId),
      });
    } catch (error) {
      const status = error instanceof TeammateDataError ? error.status : 500;
      console.error("[profile/delete] organization deletion not acknowledged", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "This account owns an organization.",
          ...(error instanceof TeammateDataError && error.code
            ? { code: error.code }
            : {}),
        },
        { status },
      );
    }

    // The profile id is re-read and re-verified inside the writer: a client-supplied id is a claim
    // about a person, and trusting it here would be a way to hand a workspace to an arbitrary
    // login. Only an eligible Team Member of THIS organization can be promoted.
    const ownedOrganization = await prisma.organization.findFirst({
      where: { ownerUserId: userId },
      select: { id: true },
    });

    let transferred: OwnershipTransferResult | null = null;
    if (ownedOrganization && transferToProfileId) {
      try {
        transferred = await transferOrganizationOwnership({
          organizationId: ownedOrganization.id,
          fromUserId: userId,
          toProfileId: transferToProfileId,
          actorUserId: userId,
        });
      } catch (error) {
        const status = error instanceof TeammateDataError ? error.status : 500;
        console.error("[profile/delete] ownership handover failed", error);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Could not hand the organization over.",
            ...(error instanceof TeammateDataError && error.code
              ? { code: error.code }
              : {}),
          },
          { status },
        );
      }
    }

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
    const purgedOrganization = await deleteOrganizationForOwner(userId);

    // 4b. Preserve the ACCESS this login holds in organizations it does NOT own.
    //
    // A person invited into somebody else's organization holds a `TeammateProfile` there whose
    // `loginUserId` is this account — a Team Member seat, or a Collaborator's set of plan
    // assignments. Step 4 only touches organizations this user OWNS, so without this those
    // profiles would survive as Active-looking access whose owner no longer exists: still granting
    // reach, but with nothing on screen to explain it and no way to release it.
    //
    // The profile is flagged, not deleted, and the flag deliberately does NOT revoke anything: an
    // Owner or Admin confirms the deletion on the surface that owns the person — People & Access
    // for a Team Member, the plan's own Collaborators list for a collaborator — which removes the
    // profile and only then gives the seat back. Runs BEFORE the `User` row is deleted, because the
    // profiles are found by `loginUserId`.
    try {
      const flagged = await markProfilesSelfDeletedByLogin(userId);

      // 4c. Tell the Owner and every Admin of each organization still holding access for this
      // person — for BOTH kinds. The confirmation they are being asked for lives on a surface
      // nobody has a reason to open, so without this the marker sat there invisible.
      //
      // Best-effort and PER PROFILE: one organization's notification failing must not stop the
      // others, and must not block the account deletion.
      for (const profile of flagged.flagged) {
        try {
          await notifySelfDeletedProfile({
            organizationId: profile.organizationId,
            profileId: profile.id,
            actorUserId: userId,
          });
        } catch (error) {
          console.error(
            "[profile/delete] failed to notify about the self-deleted profile",
            profile.id,
            error,
          );
        }
      }
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

    // The outcome is reported rather than assumed. The dialog has two destructive modes and this
    // response is the only account of which one happened: "your organization was handed over" and
    // "your organization was deleted" are the same `success: true` otherwise, and the success
    // screen has to say one of them.
    return NextResponse.json({
      success: true,
      organization: transferred
        ? {
            transferred: true as const,
            organizationId: transferred.organizationId,
            newOwnerUserId: transferred.toUserId,
            moved: transferred.moved,
          }
        : {
            transferred: false as const,
            // What the cascade removed. An owner who handed the organization over (or owned
            // nothing) reports zeros here, which is exactly right.
            organizations: purgedOrganization.organizations,
            profiles: purgedOrganization.profiles,
            assignments: purgedOrganization.assignments,
            companies: purgedOrganization.companies,
            auditEvents: purgedOrganization.auditEvents,
            directThreads: purgedOrganization.directThreads,
          },
    });
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
