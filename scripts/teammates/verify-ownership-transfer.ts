/**
 * Ownership handover verification.
 *
 *   npx tsx scripts/teammates/verify-ownership-transfer.ts [--keep]
 *
 * Asserts the rules `transferOrganizationOwnership` exists to keep, against the real data layer.
 * Every one of these is a fact that is cheap to state and expensive to discover in production:
 *
 *   1. A handover moves `Organization.ownerUserId` AND every `Client.userId` in the organization,
 *      so `resolveOrganizationIdForClient` still answers with the organization and the plan-scoped
 *      routes (`presign-upload` matches `{ id, userId: orgId }`) still find their clients.
 *   2. `getOrCreateOrganizationForUser(successor)` answers with the organization it was just given,
 *      which holds only while the successor owns exactly ONE organization — so the empty signup
 *      shell is retired.
 *   3. The successor ends up with no `TeammateProfile`: the owner holds no seat, and leaving the
 *      profile behind renders the same person twice.
 *   4. An org-level R2 key written before the handover still resolves for a live teammate AND for
 *      the new owner, and a new one under the new owner's segment resolves too. This is what
 *      `Organization.storageAnchorUserId` buys.
 *   5. Every ineligible `transferTo` is refused with a specific code and deletes NOTHING.
 *   6. The organization identity is copied onto the successor's `User` row, so the mirror does not
 *      re-brand the organization as the successor's personal setup on their next save.
 *   7. The §9k self-deletion path still works alongside it: a profile this login holds in ANOTHER
 *      organization is still flagged, and its Owner still notified.
 *
 * NOT asserted, deliberately: the `MarketingFlyer`, `Webinar`, `Meeting`, `MeetingCustomType` and
 * `FutureContact` re-anchors. They are the same `updateMany` call as `Plan` below, and building a
 * valid fixture for each would mean guessing required columns that this suite cannot check. The
 * `Client` and `Plan` moves prove the mechanism; the rest are one line each in the writer.
 *
 * Fixtures are `tow-verify-*` and are cleaned up unless `--keep` is passed. Exit code is non-zero
 * when any assertion fails.
 */
import {
  check,
  createPrisma,
  failureCount,
  installFixtureGuards,
  summary,
  sweepStaleFixtures,
} from "./shared";
import {
  getOrCreateOrganizationForUser,
  resolveOrganizationIdForClient,
} from "../../lib/organization";
import {
  describeOwnerDeletionImpact,
  listOwnershipSuccessors,
  requireOrganizationDeletionAcknowledged,
  transferOrganizationOwnership,
} from "../../lib/teammates/ownership.server";
import { resolveObjectAccess } from "../../lib/teammates/access.server";
import { markProfilesSelfDeletedByLogin } from "../../lib/teammates/profiles.server";
import {
  ORGANIZATION_OWNERSHIP_TYPE,
  PROFILE_SELF_DELETED_TYPE,
  notifySelfDeletedProfile,
} from "../../lib/notifications/notifications.server";
import { TeammateDataError } from "../../lib/teammates/errors";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();
const LOGO_KEY = `org/legacy-${STAMP}/logo.png`;
const BRAND_COLOR = "#123456";

/** Run a call that must refuse, and assert WHICH refusal it was. */
async function expectRefusal(
  label: string,
  run: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await run();
    check(label, false, "no error thrown");
  } catch (error) {
    const isTeammateError = error instanceof TeammateDataError;
    check(
      label,
      isTeammateError && error.code === expectedCode,
      isTeammateError ? `code ${error.code}` : String(error),
    );
  }
}

async function main(): Promise<void> {
  const prisma = createPrisma();

  installFixtureGuards(prisma, { exceptStamps: [STAMP] });
  await sweepStaleFixtures(prisma, { exceptStamps: [STAMP] });

  const created = {
    userIds: [] as string[],
    organizationIds: [] as string[],
    profileIds: [] as string[],
    clientIds: [] as string[],
    planIds: [] as string[],
  };

  try {
    console.log("Ownership handover verification");
    console.log("");

    /* ── Fixtures ───────────────────────────────────────────────────── */

    // The owner who is about to leave. Branding is set on the User row because that is the source
    // `getOrCreateOrganizationForUser` builds the Organization from — and what the copy-forward
    // step exists to protect.
    const owner = await prisma.user.create({
      data: {
        name: `TOW Verify Owner ${STAMP}`,
        email: `tow-verify-owner-${STAMP}@example.test`,
        organizationName: `TOW Verify Org ${STAMP}`,
        organizationEmail: `firm-${STAMP}@abbenefits.test`,
        brandColor: BRAND_COLOR,
        advisorLogo: LOGO_KEY,
      },
      select: { id: true },
    });
    created.userIds.push(owner.id);
    const organizationId = await getOrCreateOrganizationForUser(owner.id);
    created.organizationIds.push(organizationId);

    const plans: string[] = [];
    for (const name of ["Alpha", "Beta"]) {
      const client = await prisma.client.create({
        data: {
          userId: owner.id,
          organizationId,
          companyName: `TOW Verify Plan ${name} ${STAMP}`,
          keyContacts: [],
        },
        select: { id: true },
      });
      created.clientIds.push(client.id);
      plans.push(client.id);
    }

    // The legacy `Plan` model, which has no `organizationId` and is anchored only by `userId`.
    const legacyPlan = await prisma.plan.create({
      data: { userId: owner.id, clientName: `TOW Verify Legacy ${STAMP}` },
      select: { id: true },
    });
    created.planIds.push(legacyPlan.id);

    // ── The successor: a login with a seat in the organization, and an empty signup shell of
    //    their own — the artifact every account has, and the one the handover must retire.
    const successor = await prisma.user.create({
      data: {
        name: `TOW Verify Successor ${STAMP}`,
        email: `tow-verify-successor-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(successor.id);
    const successorShellId = await getOrCreateOrganizationForUser(successor.id);
    created.organizationIds.push(successorShellId);
    // Mirrors `anchorTeammateUserToInvitingOrganization`: an invited teammate's `organizationId`
    // is the inviting organization, not the shell they were minted.
    await prisma.user.update({
      where: { id: successor.id },
      data: { organizationId },
    });
    const successorProfile = await prisma.teammateProfile.create({
      data: {
        organizationId,
        loginUserId: successor.id,
        type: "team_member",
        state: "active",
        role: "admin",
        firstName: "Tow",
        lastName: `Successor ${STAMP}`,
        email: `tow-verify-successor-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.profileIds.push(successorProfile.id);

    // A second live teammate, used for the "pre-existing object still resolves" read.
    const teammate = await prisma.user.create({
      data: {
        name: `TOW Verify Teammate ${STAMP}`,
        email: `tow-verify-teammate-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(teammate.id);
    const teammateProfile = await prisma.teammateProfile.create({
      data: {
        organizationId,
        loginUserId: teammate.id,
        type: "team_member",
        state: "active",
        role: "viewer",
        firstName: "Tow",
        lastName: `Teammate ${STAMP}`,
        email: `tow-verify-teammate-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.profileIds.push(teammateProfile.id);

    // A Collaborator — an external party, and never a successor.
    const collaborator = await prisma.user.create({
      data: {
        name: `TOW Verify Collaborator ${STAMP}`,
        email: `tow-verify-collaborator-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(collaborator.id);
    const collaboratorProfile = await prisma.teammateProfile.create({
      data: {
        organizationId,
        loginUserId: collaborator.id,
        type: "collaborator",
        state: "active",
        firstName: "Tow",
        lastName: `Collaborator ${STAMP}`,
        email: `tow-verify-collaborator-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.profileIds.push(collaboratorProfile.id);

    // An invitation that was never accepted: a seat with no login.
    const invitedOnlyProfile = await prisma.teammateProfile.create({
      data: {
        organizationId,
        type: "team_member",
        state: "invited",
        role: "editor",
        firstName: "Tow",
        lastName: `Invited ${STAMP}`,
        email: `tow-verify-invited-${STAMP}@example.test`,
        invitedAt: new Date(),
      },
      select: { id: true },
    });
    created.profileIds.push(invitedOnlyProfile.id);

    // A seat whose login IS the departing owner — the "you already own this" case.
    const ownerOwnProfile = await prisma.teammateProfile.create({
      data: {
        organizationId,
        loginUserId: owner.id,
        type: "team_member",
        state: "active",
        role: "owner",
        firstName: "Tow",
        lastName: `Owner Self ${STAMP}`,
        email: `tow-verify-owner-self-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.profileIds.push(ownerOwnProfile.id);

    // A dual-role account: a teammate here who ALSO runs a workspace with a plan in it. Handing
    // an organization to them would mean merging two, which this feature does not do.
    const dualRole = await prisma.user.create({
      data: {
        name: `TOW Verify Dual ${STAMP}`,
        email: `tow-verify-dual-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(dualRole.id);
    const dualOrganizationId = await getOrCreateOrganizationForUser(dualRole.id);
    created.organizationIds.push(dualOrganizationId);
    const dualClient = await prisma.client.create({
      data: {
        userId: dualRole.id,
        organizationId: dualOrganizationId,
        companyName: `TOW Verify Dual Plan ${STAMP}`,
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(dualClient.id);
    const dualProfile = await prisma.teammateProfile.create({
      data: {
        organizationId,
        loginUserId: dualRole.id,
        type: "team_member",
        state: "active",
        role: "editor",
        firstName: "Tow",
        lastName: `Dual ${STAMP}`,
        email: `tow-verify-dual-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.profileIds.push(dualProfile.id);

    // A second organization, owned by somebody else, in which the departing owner holds a
    // Collaborator profile — the §9k path that must keep working after the handover.
    const otherOwner = await prisma.user.create({
      data: {
        name: `TOW Verify Other Owner ${STAMP}`,
        email: `tow-verify-other-${STAMP}@example.test`,
        organizationName: `TOW Verify Other Org ${STAMP}`,
      },
      select: { id: true },
    });
    created.userIds.push(otherOwner.id);
    const otherOrganizationId = await getOrCreateOrganizationForUser(otherOwner.id);
    created.organizationIds.push(otherOrganizationId);
    const elsewhereProfile = await prisma.teammateProfile.create({
      data: {
        organizationId: otherOrganizationId,
        loginUserId: owner.id,
        type: "collaborator",
        state: "active",
        firstName: "Tow",
        lastName: `Elsewhere ${STAMP}`,
        email: `tow-verify-owner-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.profileIds.push(elsewhereProfile.id);

    /* ── 1. Eligibility ─────────────────────────────────────────────── */

    console.log("1. Who may take over");

    const successors = await listOwnershipSuccessors({
      organizationId,
      excludingUserId: owner.id,
    });
    const successorIds = successors.map((person) => person.profileId);

    check(
      "the live Team Member with a login and an empty shell is offered",
      successorIds.includes(successorProfile.id),
      successorIds.join(", "),
    );
    check(
      "the second live Team Member is offered",
      successorIds.includes(teammateProfile.id),
    );
    check(
      "a Collaborator is never a successor",
      !successorIds.includes(collaboratorProfile.id),
    );
    check(
      "an un-accepted invitation is never a successor",
      !successorIds.includes(invitedOnlyProfile.id),
    );
    check(
      "the owner's own seat is not offered back to them",
      !successorIds.includes(ownerOwnProfile.id),
    );
    check(
      "somebody who runs their own workspace with a plan is excluded",
      !successorIds.includes(dualProfile.id),
    );
    check(
      "the successor carries a name and a role for the picker",
      successors.every((person) => person.name.length > 0 && Boolean(person.role)),
    );

    const impact = await describeOwnerDeletionImpact(owner.id);
    check("an owner is reported as owning an organization", impact.ownsOrganization);
    check(
      "the plan count is the organization's plans",
      impact.plans === 2,
      `plans ${impact.plans}`,
    );
    check(
      "the impact read only offers eligible successors",
      impact.successors.length === 2,
      `successors ${impact.successors.length}`,
    );
    check(
      "a login that owns nothing is not treated as an owner",
      (await describeOwnerDeletionImpact(teammate.id)).ownsOrganization === false,
    );

    /* ── 2. Refusals delete nothing ─────────────────────────────────── */

    console.log("");
    console.log("2. Every ineligible handover is refused, and changes nothing");

    const transfer = (toProfileId: string, fromUserId = owner.id) =>
      transferOrganizationOwnership({
        organizationId,
        fromUserId,
        toProfileId,
        actorUserId: fromUserId,
      });

    await expectRefusal(
      "a Collaborator is refused",
      () => transfer(collaboratorProfile.id),
      "successor_not_team_member",
    );
    await expectRefusal(
      "a seat with no login is refused",
      () => transfer(invitedOnlyProfile.id),
      "successor_has_no_login",
    );
    await expectRefusal(
      "the owner cannot hand the organization to themselves",
      () => transfer(ownerOwnProfile.id),
      "successor_is_owner",
    );
    await expectRefusal(
      "a dual-role account with their own plans is refused",
      () => transfer(dualProfile.id),
      "successor_owns_another_organization",
    );
    await expectRefusal(
      "somebody who does not own the organization cannot hand it over",
      () => transfer(successorProfile.id, teammate.id),
      "not_owner",
    );
    await expectRefusal(
      "an unknown profile id is refused",
      () => transfer("tow-verify-nonexistent"),
      "successor_not_team_member",
    );

    const afterRefusals = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { ownerUserId: true, storageAnchorUserId: true },
    });
    check(
      "no refusal moved the owner",
      afterRefusals.ownerUserId === owner.id && afterRefusals.storageAnchorUserId === null,
      JSON.stringify(afterRefusals),
    );
    check(
      "no refusal deleted a plan",
      (await prisma.client.count({ where: { id: { in: plans } } })) === 2,
    );
    check(
      "no refusal removed the successor's seat",
      (await prisma.teammateProfile.count({ where: { id: successorProfile.id } })) === 1,
    );

    /* ── 2b. The acknowledgement gate ───────────────────────────────── */

    console.log("");
    console.log("2b. An organization cannot be deleted silently");

    const gate = (options: {
      userId: string;
      acknowledged?: boolean;
      transferring?: boolean;
    }) =>
      requireOrganizationDeletionAcknowledged({
        userId: options.userId,
        acknowledged: options.acknowledged ?? false,
        transferring: options.transferring ?? false,
      });

    const allows = async (userId: string, transferring = false) =>
      gate({ userId, transferring })
        .then(() => true)
        .catch(() => false);

    // The bug this exists for: the onboarding wizard's "Cancel signup" called the delete endpoint
    // directly, so an Owner's organization, its plans and its teammates' access all went behind a
    // dialog that mentioned only "your account".
    await expectRefusal(
      "a delete that never mentioned the organization is refused",
      () => gate({ userId: owner.id }),
      "organization_would_be_deleted",
    );
    check(
      "the warning dialog's acknowledgement is accepted",
      await gate({ userId: owner.id, acknowledged: true })
        .then(() => true)
        .catch(() => false),
    );
    check("a handover is its own acknowledgement", await allows(owner.id, true));

    // …and the abandon-signup path must still work: an owner with an EMPTY organization is not
    // asked to confirm anything, because there is nothing to lose.
    const silentUser = await prisma.user.create({
      data: {
        name: `TOW Verify Silent ${STAMP}`,
        email: `tow-verify-silent-${STAMP}@example.test`,
        organizationName: `TOW Verify Silent Org ${STAMP}`,
      },
      select: { id: true },
    });
    created.userIds.push(silentUser.id);
    const silentOrganizationId = await getOrCreateOrganizationForUser(silentUser.id);
    created.organizationIds.push(silentOrganizationId);
    check(
      "an owner with an empty organization is let through",
      await allows(silentUser.id),
      "the abandon-signup case",
    );
    check(
      "somebody who owns nothing is let through",
      await allows(teammate.id),
    );

    /* ── 3. The handover ────────────────────────────────────────────── */

    console.log("");
    console.log("3. The handover moves the workspace, not just the name");

    const result = await transferOrganizationOwnership({
      organizationId,
      fromUserId: owner.id,
      toProfileId: successorProfile.id,
      actorUserId: owner.id,
    });

    check("both plans moved", result.moved.plans === 2, `plans ${result.moved.plans}`);
    check(
      "the legacy Plan row moved",
      result.moved.retirementPlans === 1,
      `retirement plans ${result.moved.retirementPlans}`,
    );
    check("the successor's own seat was released", result.releasedSeat);
    check(
      "the successor's empty signup organization was retired",
      result.retiredOrganizations === 1,
      `retired ${result.retiredOrganizations}`,
    );
    check(
      "the identity copy-forward left the mirror nothing to change",
      result.identityChanged.length === 0,
      result.identityChanged.join(", "),
    );
    check("the new owner was told", result.notifiedSuccessor);

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { ownerUserId: true, storageAnchorUserId: true },
    });
    check("the organization has a new owner", organization.ownerUserId === successor.id);
    check(
      "the storage anchor records where the existing bytes are",
      organization.storageAnchorUserId === owner.id,
      `anchor ${organization.storageAnchorUserId}`,
    );

    const clients = await prisma.client.findMany({
      where: { id: { in: plans } },
      select: { userId: true, organizationId: true },
    });
    check(
      "every plan in the organization is anchored to the new owner",
      clients.every((client) => client.userId === successor.id),
      clients.map((client) => client.userId).join(", "),
    );
    check(
      "every plan carries the organizationId",
      clients.every((client) => client.organizationId === organizationId),
    );
    check(
      "a plan still resolves to its organization",
      (await resolveOrganizationIdForClient(plans[0])) === organizationId,
    );
    // A pure read, not `getOrCreateOrganizationForUser(owner.id)`: that helper CREATES an
    // organization when the caller owns none, so using it here would assert the fact while
    // stranding a brand-new empty organization as a fixture. It is a real (if unlikely) side effect
    // of a handover whose deletion then fails, which is why the delete route treats a failed
    // handover as fatal — see `app/api/profile/delete/route.ts`.
    check(
      "the old owner no longer owns this organization",
      (await prisma.organization.count({ where: { ownerUserId: owner.id } })) === 0,
    );
    check(
      "the new owner resolves to exactly this organization",
      (await getOrCreateOrganizationForUser(successor.id)) === organizationId,
    );
    check(
      "the new owner owns exactly one organization",
      (await prisma.organization.count({ where: { ownerUserId: successor.id } })) === 1,
    );

    const movedLegacyPlan = await prisma.plan.findUniqueOrThrow({
      where: { id: legacyPlan.id },
      select: { userId: true },
    });
    check("the legacy plan follows its owner", movedLegacyPlan.userId === successor.id);

    check(
      "the successor's own seat is gone — the owner holds no seat",
      (await prisma.teammateProfile.count({ where: { id: successorProfile.id } })) === 0,
    );
    check(
      "the successor's assignments are gone with it",
      (await prisma.planAssignment.count({
        where: { profileId: successorProfile.id },
      })) === 0,
    );

    const successorUser = await prisma.user.findUniqueOrThrow({
      where: { id: successor.id },
      select: {
        organizationId: true,
        organizationName: true,
        organizationEmail: true,
        brandColor: true,
        advisorLogo: true,
      },
    });
    check(
      "the organization's identity was copied onto the new owner's row",
      successorUser.organizationName === `TOW Verify Org ${STAMP}` &&
        successorUser.brandColor === BRAND_COLOR &&
        successorUser.advisorLogo === LOGO_KEY,
      JSON.stringify(successorUser),
    );
    check(
      "the new owner's tenancy mirror points at the organization",
      successorUser.organizationId === organizationId,
    );

    const audit = await prisma.teammateAuditEvent.findFirst({
      where: { organizationId, action: "organization_ownership_transferred" },
      select: { actorUserId: true, details: true },
    });
    check("the handover is on the audit trail", Boolean(audit));
    check("the audit row names the actor", audit?.actorUserId === owner.id);

    const promotion = await prisma.notification.findFirst({
      where: { userId: successor.id, type: ORGANIZATION_OWNERSHIP_TYPE },
      select: { id: true },
    });
    check("the new owner has a notification about it", Boolean(promotion));

    /* ── 4. Files keep resolving ────────────────────────────────────── */

    console.log("");
    console.log("4. Files written before the handover still resolve");

    const legacySegmentKey = `org/${owner.id}/uploads/advisor/headshot/${STAMP}-old.png`;
    const newSegmentKey = `org/${successor.id}/uploads/advisor/headshot/${STAMP}-new.png`;

    check(
      "a live teammate can still read an object under the PREVIOUS owner's segment",
      (await resolveObjectAccess({ userId: teammate.id, key: legacySegmentKey })).allowed,
    );
    check(
      "the new owner can read it too — their only claim is ownership",
      (await resolveObjectAccess({ userId: successor.id, key: legacySegmentKey })).allowed,
    );
    check(
      "an object uploaded under the new owner's own segment resolves",
      (await resolveObjectAccess({ userId: successor.id, key: newSegmentKey })).allowed,
    );
    check(
      "a stranger is still refused the organization's objects",
      (await resolveObjectAccess({ userId: otherOwner.id, key: legacySegmentKey })).allowed ===
        false,
    );
    check(
      "a deactivated seat is still refused",
      (
        await (async () => {
          await prisma.teammateProfile.update({
            where: { id: teammateProfile.id },
            data: { deactivatedAt: new Date() },
          });
          const result = await resolveObjectAccess({
            userId: teammate.id,
            key: legacySegmentKey,
          });
          await prisma.teammateProfile.update({
            where: { id: teammateProfile.id },
            data: { deactivatedAt: null },
          });
          return result;
        })()
      ).allowed === false,
    );

    /* ── 5. §9k still works alongside it ────────────────────────────── */

    console.log("");
    console.log("5. Self-deletion in another organization still flags and notifies");

    const flagged = await markProfilesSelfDeletedByLogin(owner.id);
    check(
      "the departing owner's Collaborator profile elsewhere is flagged",
      flagged.flagged.some((profile) => profile.id === elsewhereProfile.id),
      JSON.stringify(flagged.flagged),
    );
    const flaggedProfile = await prisma.teammateProfile.findUniqueOrThrow({
      where: { id: elsewhereProfile.id },
      select: { selfDeletedAt: true },
    });
    check("the flag was written", Boolean(flaggedProfile.selfDeletedAt));

    // The flag and the notification are two steps on purpose: `markProfilesSelfDeletedByLogin`
    // writes data, and the DELETION ROUTE then loops what it flagged and notifies (step 4c). This
    // suite asserts them separately because collapsing them into one call here would hide the fact
    // that flagging alone has no side effects — which is what lets the route treat the notification
    // as best-effort without losing the marker.
    const countNotifications = () =>
      prisma.notification.count({
        where: { userId: otherOwner.id, type: PROFILE_SELF_DELETED_TYPE },
      });
    check("flagging alone notifies nobody", (await countNotifications()) === 0);

    const notified = await notifySelfDeletedProfile({
      organizationId: otherOrganizationId,
      profileId: elsewhereProfile.id,
      actorUserId: owner.id,
    });
    check("the notification was addressed to one recipient", notified === 1, `${notified}`);
    check(
      "the other organization's owner was notified",
      (await countNotifications()) === 1,
    );
    // …and NOT the organization the departing owner just handed over, which is the mistake a
    // handover could plausibly introduce: the flag is per profile, the notification per
    // organization, and the two are only kept together by the caller naming the right one.
    check(
      "the new owner of the handed-over organization was not told about it",
      (await prisma.notification.count({
        where: { userId: successor.id, type: PROFILE_SELF_DELETED_TYPE },
      })) === 0,
    );
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.notification.deleteMany({
        where: { userId: { in: created.userIds } },
      });
      await prisma.planAssignment.deleteMany({
        where: { profileId: { in: created.profileIds } },
      });
      await prisma.teammateProfile.deleteMany({
        where: { id: { in: created.profileIds } },
      });
      await prisma.client.deleteMany({ where: { id: { in: created.clientIds } } });
      await prisma.plan.deleteMany({ where: { id: { in: created.planIds } } });
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
      await prisma.organization.deleteMany({
        where: { id: { in: created.organizationIds } },
      });
      console.log("");
      console.log("Fixtures cleaned up.");
    } else {
      console.log("");
      console.log(`Fixtures kept (--keep). Stamp: ${STAMP}`);
    }

    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    summary("Ownership handover verification");
    if (failureCount() > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error("Ownership handover verification crashed:", error);
    process.exitCode = 1;
  });
