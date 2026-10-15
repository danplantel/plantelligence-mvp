/**
 * ownership.server — handing an organization from one owner to another.
 *
 * ## The problem this exists for
 *
 * Deleting your own account (`DELETE /api/profile/delete`) is unconditional. For an Owner with
 * teammates that means the whole business goes: step 1 removes their plans by `userId`, and step 4
 * removes the Organization along with every TeammateProfile, PlanAssignment and DirectThread in it.
 * The dialog asked them to type their own email and never mentioned the organization once.
 *
 * So the deletion flow now asks who should take over, and this module is the writer behind that
 * answer. It is deliberately a REUSABLE function rather than a branch inside the delete route: a
 * standalone "Transfer ownership" action is the obvious next ticket, and nothing in here is
 * specific to deletion.
 *
 * ## Two invariants it has to preserve
 *
 * **The owner and the plans must agree.** `Organization.ownerUserId` is the tenancy root, but a
 * plan is also anchored by legacy `Client.userId`, and several paths DERIVE one from the other —
 * `invites.server.ts` resolves the org from `client.userId`, `presign-upload` matches a client with
 * `{ id, userId: orgId }`, `isPlanOwner` reads the legacy anchor. A handover that moved only
 * `ownerUserId` would leave plans nobody can upload a document to. Re-anchoring them is not
 * cosmetic; it is what makes the handover coherent, and it is also what SAVES them from the
 * deletion cascade, which is keyed on `userId` and therefore stops matching whatever moved first.
 *
 * **One organization per owner.** `ownerUserId` carries no unique constraint and the schema says
 * "one per advisor User", but every signup creates one (`auth-options.ts`), so a teammate already
 * owns an empty shell of their own. `findFirst({ where: { ownerUserId } })` would then be a coin
 * flip for the person we just promoted — see `retireEmptyOrganizations`.
 *
 * ## Order
 *
 * Verify, re-anchor, copy the identity, promote, drop the successor's seat, retire the shells,
 * record. Nothing destructive happens until the promotion has succeeded, and a refusal leaves the
 * data exactly as it was. Server-only.
 */

import prisma from "@/lib/prisma";
import { syncOrganizationIdentity } from "@/lib/organization";
import { notifyOwnershipTransferred } from "@/lib/notifications/notifications.server";
import { recordTeammateAuditEvent } from "@/lib/teammates/audit.server";
import { deleteOrganizationTeammateData } from "@/lib/teammates/organization-cleanup.server";
import { TeammateDataError } from "@/lib/teammates/errors";
import {
  mostPrivilegedRole,
  type TeammateAssignmentRole,
} from "@/types/teammate";

/** Somebody who may be handed an organization: an identity the picker can render. */
export interface OwnershipSuccessor {
  profileId: string;
  /** The login this seat belongs to. Always present — a seat without one cannot take over. */
  userId: string;
  name: string;
  email: string;
  headshot: string | null;
  /** Their most privileged existing role, for the picker's badge. */
  role: TeammateAssignmentRole;
}

/** What the Owner stands to lose, for the two dialogs in the deletion flow. */
export interface OwnerDeletionImpact {
  ownsOrganization: boolean;
  organizationId: string | null;
  organizationName: string | null;
  /** Plans that would be deleted with the account. */
  plans: number;
  /** Live Team Member seats, the departing owner excluded (they hold no seat). */
  teamMembers: number;
  /** Live Collaborators — external people, whose access dies with the organization. */
  collaborators: number;
  /** Who could take over. Empty is what routes the UI to the warning dialog. */
  successors: OwnershipSuccessor[];
}

function displayName(profile: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  return (
    [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
    profile.email
  );
}

/**
 * Who may take over an organization.
 *
 * The predicate is deliberately narrow, and every clause is a refusal the UI should never have to
 * explain after the fact:
 *
 *  - **Team Members only.** A Collaborator is an outside party; handing them the organization is a
 *    different product decision, not a successor selection.
 *  - **With a login.** An invitation that was never accepted has no `loginUserId` and no `User`, so
 *    there is nobody to promote.
 *  - **Active, not deactivated, not self-deleted.** A deactivated seat's access has ended; a
 *    self-deleted profile's login is gone. Promoting either would hand the organization to a person
 *    who cannot sign in and collect it.
 *  - **Not already running a workspace.** Somebody who owns another organization WITH content is a
 *    dual-role account, and the honest answer there is "this needs a merge we do not do", not a
 *    quiet two-organization owner. An EMPTY shell is fine — that is the signup artifact every
 *    teammate has, and the transfer retires it.
 *
 * Results are ordered admins first, then by name, so the picker is stable between renders.
 */
export async function listOwnershipSuccessors({
  organizationId,
  excludingUserId,
}: {
  organizationId: string;
  excludingUserId: string;
}): Promise<OwnershipSuccessor[]> {
  const profiles = await prisma.teammateProfile.findMany({
    where: {
      organizationId,
      type: "team_member",
      state: "active",
      deactivatedAt: null,
      selfDeletedAt: null,
      loginUserId: { not: null },
    },
    select: {
      id: true,
      loginUserId: true,
      firstName: true,
      lastName: true,
      email: true,
      headshot: true,
      role: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const candidates = profiles.filter(
    (profile) => profile.loginUserId && profile.loginUserId !== excludingUserId,
  );
  if (candidates.length === 0) return [];

  const loginIds = [...new Set(candidates.map((c) => c.loginUserId as string))];
  const profileIds = candidates.map((profile) => profile.id);

  const [logins, assignments, otherOrganizations] = await Promise.all([
    // The login must still resolve. A seat can name a `User` that was deleted by the very flow
    // this picker serves — see `markProfilesSelfDeletedByLogin` — and a promotion to a missing
    // account would strand the organization with nobody able to sign into it.
    prisma.user.findMany({
      where: { id: { in: loginIds } },
      select: { id: true },
    }),
    prisma.planAssignment.findMany({
      where: { organizationId, profileId: { in: profileIds } },
      select: { profileId: true, role: true },
    }),
    prisma.organization.findMany({
      where: { ownerUserId: { in: loginIds }, id: { not: organizationId } },
      select: { id: true, ownerUserId: true },
    }),
  ]);

  const liveLogins = new Set(logins.map((login) => login.id));
  const rolesByProfile = new Map<string, TeammateAssignmentRole[]>();
  for (const assignment of assignments) {
    const list = rolesByProfile.get(assignment.profileId) ?? [];
    list.push(assignment.role);
    rolesByProfile.set(assignment.profileId, list);
  }

  // Which of those other organizations actually hold something. Two grouped counts rather than a
  // query per organization: the list is small, but a handover must not be an N+1 in the request
  // that deletes an account.
  const otherIds = otherOrganizations.map((organization) => organization.id);
  const busyOwnerIds = new Set<string>();
  if (otherIds.length > 0) {
    const [clients, profilesThere] = await Promise.all([
      prisma.client.groupBy({
        by: ["organizationId"],
        where: { organizationId: { in: otherIds } },
        _count: { _all: true },
      }),
      prisma.teammateProfile.groupBy({
        by: ["organizationId"],
        where: { organizationId: { in: otherIds } },
        _count: { _all: true },
      }),
    ]);
    const busyOrganizationIds = new Set<string>();
    for (const row of [...clients, ...profilesThere]) {
      if (row.organizationId && row._count._all > 0) busyOrganizationIds.add(row.organizationId);
    }
    for (const organization of otherOrganizations) {
      if (busyOrganizationIds.has(organization.id) && organization.ownerUserId) {
        busyOwnerIds.add(organization.ownerUserId);
      }
    }
  }

  const successors: OwnershipSuccessor[] = [];
  for (const profile of candidates) {
    const loginUserId = profile.loginUserId as string;
    if (!liveLogins.has(loginUserId)) continue;
    if (busyOwnerIds.has(loginUserId)) continue;

    const roles = rolesByProfile.get(profile.id);
    successors.push({
      profileId: profile.id,
      userId: loginUserId,
      name: displayName(profile),
      email: profile.email,
      headshot: profile.headshot,
      // Assignment roles summarise the person; the profile's own `role` is the fallback for a seat
      // that has no assignment yet (an invite raised before any plan existed).
      role: mostPrivilegedRole(
        roles && roles.length > 0
          ? roles
          : [profile.role ?? "contributor"],
      ),
    });
  }

  const rank = (role: TeammateAssignmentRole): number =>
    role === "owner" ? 0 : role === "admin" ? 1 : 2;

  return successors.sort(
    (a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name),
  );
}

/**
 * What the deletion dialogs ask for, in one read.
 *
 * One endpoint rather than two because the UI cannot choose between the picker and the warning
 * until it knows whether a successor exists — and both dialogs need the same organization name.
 */
export async function describeOwnerDeletionImpact(
  userId: string,
): Promise<OwnerDeletionImpact> {
  const organization = await prisma.organization.findFirst({
    where: { ownerUserId: userId },
    select: { id: true, name: true },
  });

  if (!organization) {
    return {
      ownsOrganization: false,
      organizationId: null,
      organizationName: null,
      plans: 0,
      teamMembers: 0,
      collaborators: 0,
      successors: [],
    };
  }

  const [plans, liveProfiles, successors] = await Promise.all([
    prisma.client.count({
      where: { OR: [{ organizationId: organization.id }, { userId }] },
    }),
    // Live only: a deactivated profile already lost its access and a self-deleted one has no
    // login, so neither is somebody the warning is warning about.
    prisma.teammateProfile.findMany({
      where: {
        organizationId: organization.id,
        state: "active",
        deactivatedAt: null,
        selfDeletedAt: null,
      },
      select: { type: true },
    }),
    listOwnershipSuccessors({
      organizationId: organization.id,
      excludingUserId: userId,
    }),
  ]);

  return {
    ownsOrganization: true,
    organizationId: organization.id,
    organizationName: organization.name,
    plans,
    teamMembers: liveProfiles.filter((p) => p.type === "team_member").length,
    collaborators: liveProfiles.filter((p) => p.type === "collaborator").length,
    successors,
  };
}

/**
 * The gate a silent deletion has to pass.
 *
 * ## Why this is server-side
 *
 * The warning dialog is a UI affordance, and a UI affordance is not a rule. Two callers already
 * existed for `DELETE /api/profile/delete` (Settings, and the onboarding wizard's "Cancel signup"),
 * and the second one deleted an Owner's whole organization — plans, teammates and their access —
 * behind a dialog that only ever mentioned "your account". A guard that lives only in the Settings
 * component would have left that path exactly as it was, and would leave the next caller to
 * remember to copy it.
 *
 * So the destructive branch now has to be ASKED FOR explicitly, by whichever caller has shown the
 * consequences:
 *
 *  - `?transferTo=` — the handover dialog. Handing the organization over IS the acknowledgement.
 *  - `?confirmOrganization=true` — the warning dialog was shown and accepted.
 *  - neither — refused with a 409 when the organization has anything in it.
 *
 * An **empty organization** is let through: there is nothing to lose, no successor to offer, and
 * this is precisely the "abandon signup" case the wizard's cancel exists for. The gate is about
 * content, not about ownership.
 */
export async function requireOrganizationDeletionAcknowledged({
  userId,
  acknowledged,
  transferring,
}: {
  userId: string;
  /** The caller passed `?confirmOrganization=true` — the warning was shown. */
  acknowledged: boolean;
  /** The caller passed `?transferTo=` — the organization is being handed over. */
  transferring: boolean;
}): Promise<void> {
  if (acknowledged || transferring) return;

  const impact = await describeOwnerDeletionImpact(userId);
  if (!impact.ownsOrganization) return;
  const hasContent =
    impact.plans > 0 ||
    impact.teamMembers > 0 ||
    impact.collaborators > 0;
  if (!hasContent) return;

  throw new TeammateDataError(
    "This account owns an organization with plans or teammates in it, and deleting it would take their access with it. Delete your profile from Settings → Profile, where you can choose who takes the organization over — or confirm that it should be deleted.",
    409,
    "organization_would_be_deleted",
  );
}

export interface OwnershipTransferResult {
  organizationId: string;
  fromUserId: string;
  toUserId: string;
  /** Whether the new owner was told. False only if the notification write failed. */
  notifiedSuccessor: boolean;
  /** Rows re-anchored to the successor, by model. */
  moved: {
    plans: number;
    retirementPlans: number;
    marketingFlyers: number;
    webinars: number;
    meetings: number;
    meetingTypes: number;
    futureContacts: number;
  };
  /** Empty signup shells retired so the one-organization-per-owner invariant holds. */
  retiredOrganizations: number;
  /** Whether the successor's own seat was released (it is theirs no longer). */
  releasedSeat: boolean;
  /**
   * Fields `syncOrganizationIdentity` still had to write after the identity copy-forward. An empty
   * array is the expected answer; anything else means the copy missed a field, and it is returned
   * rather than swallowed so the audit row can say so.
   */
  identityChanged: string[];
}

/**
 * Hand an organization to one of its Team Members.
 *
 * Throws `TeammateDataError` for every refusal, with a 409 and a code, so a caller can surface the
 * reason and — critically — delete nothing. This function never destroys data: retiring the
 * successor's OWN empty shells is the only delete, and those are empty by construction.
 *
 * Called BEFORE the deletion cascade on purpose. If it throws, the account is not deleted at all:
 * "we could not hand your organization over" is a request that must not half-succeed.
 */
export async function transferOrganizationOwnership({
  organizationId,
  fromUserId,
  toProfileId,
  actorUserId,
}: {
  organizationId: string;
  fromUserId: string;
  toProfileId: string;
  actorUserId: string;
}): Promise<OwnershipTransferResult> {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, ownerUserId: fromUserId },
    select: {
      id: true,
      name: true,
      organizationEmail: true,
      organizationType: true,
      customOrganization: true,
      teamSize: true,
      branding: true,
      storageAnchorUserId: true,
    },
  });
  if (!organization) {
    throw new TeammateDataError(
      "Only the organization's current owner can hand it over.",
      409,
      "not_owner",
    );
  }

  // Re-read and re-verify the successor. The posted profile id is a client's claim about a person,
  // and every clause below is one a caller could otherwise skip by editing the request.
  const profile = await prisma.teammateProfile.findFirst({
    where: { id: toProfileId, organizationId, type: "team_member" },
    select: {
      id: true,
      loginUserId: true,
      state: true,
      deactivatedAt: true,
      selfDeletedAt: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!profile) {
    throw new TeammateDataError(
      "That person is not a Team Member of this organization.",
      409,
      "successor_not_team_member",
    );
  }
  if (profile.loginUserId === fromUserId) {
    throw new TeammateDataError(
      "You already own this organization.",
      409,
      "successor_is_owner",
    );
  }
  if (!profile.loginUserId) {
    throw new TeammateDataError(
      "That person has not signed in yet, so there is nobody to hand the organization to.",
      409,
      "successor_has_no_login",
    );
  }
  if (profile.deactivatedAt) {
    throw new TeammateDataError(
      "That person's access is deactivated.",
      409,
      "successor_deactivated",
    );
  }
  if (profile.selfDeletedAt) {
    throw new TeammateDataError(
      "That person deleted their own account.",
      409,
      "successor_self_deleted",
    );
  }
  if (profile.state !== "active") {
    throw new TeammateDataError(
      "That person has not accepted their invitation yet.",
      409,
      "successor_not_active",
    );
  }

  const toUserId = profile.loginUserId;
  const login = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true },
  });
  if (!login) {
    throw new TeammateDataError(
      "That person's login no longer exists.",
      409,
      "successor_login_missing",
    );
  }

  // A successor who runs a workspace of their own cannot take this one over: two organizations per
  // owner breaks every `findFirst({ where: { ownerUserId } })` in the codebase, and merging them is
  // out of scope. Empty shells are the expected case (every signup creates one) and are retired
  // below.
  const otherOrganizations = await prisma.organization.findMany({
    where: { ownerUserId: toUserId, id: { not: organizationId } },
    select: { id: true },
  });
  const emptyOrganizationIds: string[] = [];
  for (const other of otherOrganizations) {
    const [plans, profiles] = await Promise.all([
      prisma.client.count({ where: { organizationId: other.id } }),
      prisma.teammateProfile.count({ where: { organizationId: other.id } }),
    ]);
    if (plans > 0 || profiles > 0) {
      throw new TeammateDataError(
        "That person already runs their own organization with plans in it. Handing this one over would need the two merged, which is not supported.",
        409,
        "successor_owns_another_organization",
      );
    }
    emptyOrganizationIds.push(other.id);
  }

  // ── Re-anchor, before anything destructive runs ──────────────────────────────────────────────
  //
  // The deletion cascade (`deletePlansAndScopedDataForUser`) is keyed on `userId`, so whatever
  // moves first is spared by it with no exception list to keep in sync and no edit to that
  // function. What moves is the organization's CONTENT. `Task` deliberately does not: its
  // `userId` is the assignee, and moving it would drop the departing owner's to-do list onto the
  // successor's dashboard.
  const meetingsByClient = await prisma.meeting.findMany({
    where: { clientRecord: { userId: fromUserId } },
    select: { id: true },
  });
  const meetingIdsByClient = meetingsByClient.map((meeting) => meeting.id);

  const [
    clients,
    retirementPlans,
    marketingFlyers,
    webinars,
    futureContacts,
    meetingsByOwner,
    meetingsByClientUpdate,
    meetingTypes,
  ] = await prisma.$transaction([
    prisma.client.updateMany({
      // Both anchors, because both are used to reach a plan's organization and a plan that keeps
      // the legacy owner would fail `presign-upload`'s `{ id, userId: orgId }` match.
      where: { OR: [{ organizationId }, { userId: fromUserId }] },
      data: { userId: toUserId, organizationId },
    }),
    prisma.plan.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    }),
    prisma.marketingFlyer.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    }),
    prisma.webinar.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    }),
    prisma.futureContact.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    }),
    prisma.meeting.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    }),
    prisma.meeting.updateMany({
      where: { id: { in: meetingIdsByClient } },
      data: { userId: toUserId },
    }),
    // Paired with the meetings above: a moved meeting must keep a custom type its new owner can
    // resolve. A name collision with one of the successor's own types surfaces as a unique
    // violation out of this transaction, which fails the handover rather than corrupting it.
    prisma.meetingCustomType.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    }),
  ]);

  // ── The identity copy-forward, then the promotion ────────────────────────────────────────────
  //
  // `syncOrganizationIdentity` mirrors name, organization email, firm profile and branding FROM
  // the OWNER's User row onto the Organization — and only while they are the owner. Promoting
  // without this step would leave the organization describing itself with the PREVIOUS owner's
  // values until the successor's next profile save, at which point the mirror would helpfully
  // rewrite the organization's name and branding as the successor's personal ones. Copying first
  // is what makes the two agree, so the next sync is a no-op.
  const branding = (organization.branding ?? {}) as Record<string, string | null>;
  const logo = branding.logo ?? null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: toUserId },
      data: {
        organizationId,
        organizationName: organization.name,
        organizationEmail: organization.organizationEmail ?? null,
        organizationType: organization.organizationType ?? null,
        customOrganization: organization.customOrganization ?? null,
        teamSize: organization.teamSize ?? null,
        brandColor: branding.brandColor ?? null,
        primaryColor: branding.primaryColor ?? null,
        secondaryColor: branding.secondaryColor ?? null,
        advisorLogo: logo,
        advisorLogoUrl: logo,
        backgroundImage: branding.backgroundImage ?? null,
      },
    }),
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        ownerUserId: toUserId,
        // ??= on purpose: the FIRST handover records where the bytes are, and later ones must not
        // move the anchor to an owner whose segment holds nothing.
        storageAnchorUserId: organization.storageAnchorUserId ?? fromUserId,
      },
    }),
  ]);

  // ── The successor holds no seat ──────────────────────────────────────────────────────────────
  //
  // The owner is synthesized from `Organization.ownerUserId` and is deliberately NOT a teammate
  // (`contact-mirror.server.ts` skips them, `listOrgPeople` builds their row from the User). Left
  // in place their profile would render as a SECOND card for the same person — the duplicate that
  // `scripts/repair/remove-owner-duplicate-seat.ts` exists to clean up — and would consume a seat
  // nobody needs. Removed with its assignments, in the same request as the promotion.
  await prisma.$transaction([
    prisma.planAssignment.deleteMany({
      where: { profileId: profile.id, organizationId },
    }),
    prisma.teammateProfile.delete({ where: { id: profile.id } }),
  ]);

  const retired = await retireEmptyOrganizations(emptyOrganizationIds);

  // Now that exactly one organization names the successor, the mirror can be re-derived and will
  // find nothing to change. The result is returned rather than assumed.
  let identityChanged: string[] = [];
  try {
    const sync = await syncOrganizationIdentity(toUserId);
    identityChanged = sync.changed;
  } catch (error) {
    // A drifted mirror must not fail a handover that has already happened — the same posture the
    // profile and branding write paths take.
    console.error("[ownership] organization identity sync failed after handover", error);
  }

  // Tell the new owner. The only signal that reaches them — from their side the organization simply
  // appears in their workspace, already carrying the previous owner's branding.
  //
  // Best-effort: the handover has happened by this point, so a failed notification must not turn a
  // success into an error the caller would retry, which would then find nothing left to transfer.
  let notifiedSuccessor = false;
  try {
    await notifyOwnershipTransferred({
      organizationId,
      newOwnerUserId: toUserId,
      organizationName: organization.name,
      actorUserId,
    });
    notifiedSuccessor = true;
  } catch (error) {
    console.error("[ownership] successor notification failed", error);
  }

  const successorName = displayName(profile);
  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "organization_ownership_transferred",
    details: {
      fromUserId,
      toUserId,
      successorProfileId: profile.id,
      successorName,
      successorEmail: profile.email,
      moved: {
        plans: clients.count,
        retirementPlans: retirementPlans.count,
        marketingFlyers: marketingFlyers.count,
        webinars: webinars.count,
        meetings: meetingsByOwner.count + meetingsByClientUpdate.count,
        meetingTypes: meetingTypes.count,
        futureContacts: futureContacts.count,
      },
      retiredOrganizations: retired,
      storageAnchorUserId: organization.storageAnchorUserId ?? fromUserId,
      identityChanged,
      notifiedSuccessor,
    },
  });

  return {
    organizationId,
    fromUserId,
    toUserId,
    moved: {
      plans: clients.count,
      retirementPlans: retirementPlans.count,
      marketingFlyers: marketingFlyers.count,
      webinars: webinars.count,
      meetings: meetingsByOwner.count + meetingsByClientUpdate.count,
      meetingTypes: meetingTypes.count,
      futureContacts: futureContacts.count,
    },
    retiredOrganizations: retired,
    releasedSeat: true,
    identityChanged,
    notifiedSuccessor,
  };
}

/**
 * Delete the successor's own empty organizations.
 *
 * Every signup creates an Organization (`auth-options.ts`), so a teammate who accepted an invite
 * owns one too — an empty shell nobody has ever seen. It has to go, not because it is harmful in
 * itself but because `ownerUserId` has no unique constraint and the whole codebase resolves an
 * owner's organization with `findFirst({ where: { ownerUserId } })` and no ordering. Left behind,
 * the person we just promoted could be answered with their empty shell instead of the workspace
 * they now own — in `getOrCreateOrganizationForUser`, which their every request calls.
 *
 * The caller has already verified each one holds no plans and no profiles.
 */
async function retireEmptyOrganizations(
  organizationIds: string[],
): Promise<number> {
  let retired = 0;
  for (const organizationId of organizationIds) {
    // The sweep is belt-and-braces rather than expected: the guard above checks the two counts,
    // but a company or an audit row could still be attached, and `deleteOrganizationForOwner`'s
    // lesson is that the teammate models carry no foreign keys to clean them up.
    await deleteOrganizationTeammateData(organizationId);
    await prisma.organization.delete({ where: { id: organizationId } });
    retired += 1;
  }
  return retired;
}
