/**
 * T3 acceptance verification — spec page 10.
 *
 *   npx tsx scripts/teammates/verify-t3.ts [--keep]
 *
 * Asserts the three T3 acceptance criteria against the REAL seat and team layers:
 *
 *   1. "An invite fills a seat; an expired invite releases it."
 *   2. "Onboarding completes whether or not the team step is skipped."
 *   3. "The owner appears as the first Team Member after onboarding."
 *
 * Plus the Part A/B rules those depend on: only Team Members consume seats, the
 * 14-day hold, the email-domain guess, the upgrade-confirm gate requiring an
 * Owner/Admin, and the "All Plans + All Categories" defaults.
 *
 * Fixtures are `t3-verify-*` and are cleaned up unless `--keep` is passed.
 * Exit code is non-zero when any assertion fails.
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
  DEFAULT_SEATS_INCLUDED,
  INVITE_SEAT_HOLD_DAYS,
  expireStaleInvites,
  getSeatUsage,
  guessPersonTypeForEmail,
} from "../../lib/teammates/seats.server";
import {
  addTeamMember,
  listTeamMembers,
  updateTeamMember,
} from "../../lib/teammates/team.server";
import { withOwnerPrefill } from "../../lib/teammates/onboarding-owner";
import { teamMembersSchema } from "../../lib/wizard-validation";
import {
  describeAllRoles,
  describeRole,
} from "../../lib/teammates/role-summary";
import {
  BINARY_PERMISSION_FUNCTIONS,
  PERMISSION_FUNCTIONS,
} from "../../types/teammate";
import { TeammateDataError } from "../../lib/teammates/errors";
import { getOrCreateOrganizationForUser } from "../../lib/organization";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();

async function main(): Promise<void> {
  const prisma = createPrisma();

  // Sweep whatever an earlier interrupted run stranded — a fixture owner with no
  // Organization would otherwise fail the NEXT verify run — then make sure this run
  // cleans up on Ctrl-C as well as on a thrown error.
  installFixtureGuards(prisma, { exceptStamps: [STAMP] });
  await sweepStaleFixtures(prisma, { exceptStamps: [STAMP] });

  const created = {
    profileIds: [] as string[],
    assignmentIds: [] as string[],
    clientIds: [] as string[],
    userIds: [] as string[],
    organizationIds: [] as string[],
  };

  try {
    console.log("T3 verification — team member management + seat counter");
    console.log("");

    /* ── Fixtures ───────────────────────────────────────────────────── */

    const owner = await prisma.user.create({
      data: {
        name: "T3 Verify Owner",
        email: `t3-verify-owner-${STAMP}@example.test`,
        organizationName: `T3 Verify Org ${STAMP}`,
      },
      select: { id: true, email: true, name: true },
    });
    created.userIds.push(owner.id);
    const organizationId = await getOrCreateOrganizationForUser(owner.id);
    created.organizationIds.push(organizationId);

    const plans: string[] = [];
    for (const name of ["Ayres", "Precision Optical"]) {
      const client = await prisma.client.create({
        data: {
          userId: owner.id,
          organizationId,
          companyName: `t3-verify-${name}-${STAMP}`,
          keyContacts: [],
        },
        select: { id: true },
      });
      created.clientIds.push(client.id);
      plans.push(client.id);
    }

    // A non-owner login, used to prove an Editor/Viewer cannot confirm an
    // over-limit add.
    const outsider = await prisma.user.create({
      data: {
        name: "T3 Verify Outsider",
        email: `t3-verify-outsider-${STAMP}@other.test`,
      },
      select: { id: true },
    });
    created.userIds.push(outsider.id);

    const track = (result: { profileId: string; assignmentIds: string[] }) => {
      created.profileIds.push(result.profileId);
      created.assignmentIds.push(...result.assignmentIds);
    };

    /* ── Criterion 1: an invite fills a seat ─────────────────────────── */

    console.log("1. An invite fills a seat; an expired invite releases it");

    const initial = await getSeatUsage(organizationId);
    check(
      "only the owner holds a seat to begin with",
      initial.seatsUsed === 1 && initial.seatsPending === 0,
      `used ${initial.seatsUsed}, pending ${initial.seatsPending}`,
    );
    check(
      "the organization falls back to the placeholder allowance",
      initial.seatsIncluded === DEFAULT_SEATS_INCLUDED,
      `included ${initial.seatsIncluded}`,
    );

    const invited = await addTeamMember({
      organizationId,
      actorUserId: owner.id,
      name: "T3 Verify Invitee",
      email: `t3-verify-invitee-${STAMP}@example.test`,
      type: "team_member",
      role: "editor",
    });
    track(invited);

    const afterInvite = await getSeatUsage(organizationId);
    check(
      "the invite consumes a seat",
      afterInvite.seatsUsed === 2,
      `used ${afterInvite.seatsUsed}`,
    );
    check(
      "and it is reported as a pending invite",
      afterInvite.seatsPending === 1,
      `pending ${afterInvite.seatsPending}`,
    );

    // Spec Part A item 2 default: All Plans + All Categories.
    check(
      'the default plan access is "All Plans"',
      invited.assignmentIds.length === plans.length,
      `${invited.assignmentIds.length} assignments for ${plans.length} plans`,
    );

    const inviteeProfile = await prisma.teammateProfile.findUnique({
      where: { id: invited.profileId },
      select: { state: true, allPlans: true, type: true },
    });
    check(
      "the invitee is stored in the Invited state",
      inviteeProfile?.state === "invited",
      `state ${inviteeProfile?.state}`,
    );
    check(
      "a Team Member with All Plans carries the allPlans flag",
      inviteeProfile?.allPlans === true,
    );

    const inviteeAssignment = await prisma.planAssignment.findFirst({
      where: { profileId: invited.profileId },
      select: { categoryScope: true },
    });
    check(
      'the default category access is "All"',
      inviteeAssignment?.categoryScope === "all",
      `scope ${inviteeAssignment?.categoryScope}`,
    );

    /* ── Criterion 1b: expiry releases the seat ──────────────────────── */

    // Age the invite past the 14-day hold.
    const staleInvitedAt = new Date(
      Date.now() - (INVITE_SEAT_HOLD_DAYS + 1) * 24 * 60 * 60 * 1000,
    );
    await prisma.teammateProfile.update({
      where: { id: invited.profileId },
      data: { invitedAt: staleInvitedAt },
    });

    const afterExpiry = await getSeatUsage(organizationId);
    check(
      "an expired invite stops holding a seat",
      afterExpiry.seatsUsed === 1 && afterExpiry.seatsPending === 0,
      `used ${afterExpiry.seatsUsed}, pending ${afterExpiry.seatsPending}`,
    );

    const sweep = await expireStaleInvites(organizationId, owner.id);
    check(
      "the sweep releases exactly the expired invite",
      sweep.expired === 1,
      `expired ${sweep.expired}`,
    );

    const sweptProfile = await prisma.teammateProfile.findUnique({
      where: { id: invited.profileId },
      select: { state: true },
    });
    check(
      "the expired invite returns to Contact, keeping the profile",
      sweptProfile?.state === "contact",
      `state ${sweptProfile?.state}`,
    );
    check(
      "the seat stays released after the sweep",
      (await getSeatUsage(organizationId)).seatsUsed === 1,
    );

    /* ── Seats are Team-Member-only ──────────────────────────────────── */

    console.log("");
    console.log("   Only Team Members use seats (spec Part B item 1)");

    const guessedTeam = await guessPersonTypeForEmail({
      organizationId,
      email: `someone-${STAMP}@example.test`,
    });
    const guessedExternal = await guessPersonTypeForEmail({
      organizationId,
      email: `someone-${STAMP}@elsewhere.test`,
    });
    check(
      "a matching domain guesses Team Member",
      guessedTeam === "team_member",
      guessedTeam,
    );
    check(
      "another domain guesses Collaborator",
      guessedExternal === "collaborator",
      guessedExternal,
    );

    const seatsBeforeCollaborator = (await getSeatUsage(organizationId)).seatsUsed;
    const collaborator = await addTeamMember({
      organizationId,
      actorUserId: owner.id,
      name: "T3 Verify Collaborator",
      email: `t3-verify-collab-${STAMP}@elsewhere.test`,
      // No explicit type: the domain guess decides.
    });
    track(collaborator);
    check(
      "the domain guess was applied to the new person",
      collaborator.personType === "collaborator",
      collaborator.personType,
    );
    check(
      "adding a Collaborator consumes no seat",
      (await getSeatUsage(organizationId)).seatsUsed === seatsBeforeCollaborator,
      `used ${(await getSeatUsage(organizationId)).seatsUsed}`,
    );

    /* ── The upgrade confirm gate (Part B item 3) ────────────────────── */

    console.log("");
    console.log("   At the limit: an upgrade confirm, not a hard block");

    // One seat, already taken by the owner.
    await prisma.organization.update({
      where: { id: organizationId },
      data: { seatsIncluded: 1 },
    });

    let limitCode: string | undefined;
    let limitStatus: number | undefined;
    try {
      await addTeamMember({
        organizationId,
        actorUserId: owner.id,
        name: "T3 Over Limit",
        email: `t3-verify-overlimit-${STAMP}@example.test`,
        type: "team_member",
      });
    } catch (error) {
      limitCode = (error as TeammateDataError).code;
      limitStatus = (error as TeammateDataError).status;
    }
    check(
      "adding past the limit raises seat_limit (409), not a hard block",
      limitCode === "seat_limit" && limitStatus === 409,
      `code ${limitCode}, status ${limitStatus}`,
    );

    let outsiderCode: string | undefined;
    try {
      await addTeamMember({
        organizationId,
        actorUserId: outsider.id,
        name: "T3 Outsider",
        email: `t3-verify-outsider-add-${STAMP}@example.test`,
        type: "team_member",
        confirmUpgrade: true,
      });
    } catch (error) {
      outsiderCode = (error as TeammateDataError).code;
    }
    check(
      "only an Owner/Admin can confirm the over-limit add",
      outsiderCode === "seat_limit_owner_only",
      `code ${outsiderCode}`,
    );

    const confirmed = await addTeamMember({
      organizationId,
      actorUserId: owner.id,
      name: "T3 Confirmed",
      email: `t3-verify-confirmed-${STAMP}@example.test`,
      type: "team_member",
      confirmUpgrade: true,
    });
    track(confirmed);

    const afterConfirm = await getSeatUsage(organizationId);
    check(
      "a confirmed add succeeds and raises the allowance (placeholder tier logic)",
      afterConfirm.seatsIncluded === 2 && afterConfirm.seatsUsed === 2,
      `included ${afterConfirm.seatsIncluded}, used ${afterConfirm.seatsUsed}`,
    );

    /* ── Criterion 3: the owner is the first Team Member ─────────────── */

    console.log("");
    console.log("3. The owner appears as the first Team Member");

    const team = await listTeamMembers(organizationId);
    check("the team list is not empty", team.length > 0, `${team.length} rows`);
    check(
      "the FIRST row is the owner",
      team[0]?.isOwner === true,
      `first row isOwner=${team[0]?.isOwner}`,
    );
    check(
      "the owner row carries the owner's identity and the Owner role",
      team[0]?.email === owner.email && team[0]?.role === "owner",
      `${team[0]?.email} / ${team[0]?.role}`,
    );
    check(
      "the owner is Active",
      team[0]?.status === "active",
      `status ${team[0]?.status}`,
    );
    check(
      "the owner's plan access summary covers every plan",
      team[0]?.planAccess.scope === "all" &&
        team[0].planAccess.planIds.length === plans.length,
      `scope ${team[0]?.planAccess.scope}`,
    );

    const inviteeRow = team.find((row) => row.profileId === invited.profileId);
    check(
      "an invited member is listed with status, role and access",
      inviteeRow?.status === "contact" &&
        inviteeRow?.role === "editor" &&
        inviteeRow?.planAccess.scope === "all" &&
        inviteeRow?.categoryAccess.scope === "all",
      `${inviteeRow?.status} / ${inviteeRow?.role} / ${inviteeRow?.planAccess.scope} / ${inviteeRow?.categoryAccess.scope}`,
    );

    /* ── Criterion 2: independent of the onboarding team step ────────── */

    console.log("");
    console.log(
      "2. Onboarding completes whether or not the team step is skipped",
    );

    // The team step writes `WizardTeamMembers.members`; skipping it leaves no
    // row at all. The Team list must therefore be derived from the Organization
    // and the owner User, never from the wizard — which is what makes the step
    // genuinely skippable. This fixture organization has NO wizard session, so
    // asserting the owner still appears proves that dependency does not exist.
    const wizardSessions = await prisma.wizardSession.count({
      where: { userId: owner.id },
    });
    check(
      "the fixture has no onboarding team step data",
      wizardSessions === 0,
      `${wizardSessions} wizard sessions`,
    );

    const teamWithoutStep = await listTeamMembers(organizationId);
    check(
      "the owner still appears with no team step data",
      teamWithoutStep[0]?.isOwner === true,
    );
    check(
      "and the team list itself is derived, not stored",
      teamWithoutStep.length === team.length,
      `${teamWithoutStep.length} vs ${team.length}`,
    );

    // The step itself: valid when empty (so it can be skipped) and seeded with
    // the owner first (Part A item 4).
    const emptyStep = teamMembersSchema.safeParse({ members: [] });
    check(
      "an empty team step passes validation — the step can be skipped",
      emptyStep.success,
      emptyStep.success ? undefined : JSON.stringify(emptyStep.error.issues),
    );

    const prefilled = withOwnerPrefill([], {
      name: "T3 Verify Owner",
      email: owner.email,
    });
    check(
      "the owner is pre-filled as the FIRST member",
      prefilled.length === 1 && prefilled[0]?.isOwner === true,
      `${prefilled.length} rows`,
    );

    const withOthers = withOwnerPrefill(
      [{ name: "Jane", email: "jane@example.test", role: "assistant" }],
      { name: "T3 Verify Owner", email: owner.email },
    );
    check(
      "the owner comes first and existing members follow",
      withOthers[0]?.isOwner === true &&
        withOthers[1]?.email === "jane@example.test",
      withOthers.map((member) => member.email).join(", "),
    );
    check(
      "the prefill is idempotent (safe to run on every render)",
      withOwnerPrefill(withOthers, {
        name: "T3 Verify Owner",
        email: owner.email,
      }) === withOthers,
    );
    check(
      "with no owner identity available yet, nothing is inserted",
      withOwnerPrefill([], { name: null, email: null }).length === 0,
    );

    /* ── Editing a Team Member (the Edit modal's data path) ──────────── */

    console.log("");
    console.log("   Editing a Team Member");

    // `confirmed` was added with the defaults: All Plans + All categories.
    const edited = await updateTeamMember({
      organizationId,
      actorUserId: owner.id,
      profileId: confirmed.profileId,
      name: "T3 Renamed Member",
      role: "viewer",
      planScope: "certain_plans",
      planIds: [plans[0]],
      categoryScope: "certain",
      categories: ["Group Health"],
    });

    const afterEdit = await prisma.teammateProfile.findUnique({
      where: { id: confirmed.profileId },
      select: { firstName: true, lastName: true, allPlans: true },
    });
    check(
      "the name is split and saved",
      afterEdit?.firstName === "T3" && afterEdit?.lastName === "Renamed Member",
      `${afterEdit?.firstName} ${afterEdit?.lastName}`,
    );
    check(
      "narrowing the plan scope clears the All Plans flag",
      afterEdit?.allPlans === false,
      `allPlans ${afterEdit?.allPlans}`,
    );
    check(
      "assignments for the dropped plans are removed",
      edited.removedAssignmentIds.length === plans.length - 1,
      `removed ${edited.removedAssignmentIds.length} of ${plans.length - 1}`,
    );
    check(
      "exactly one assignment remains",
      edited.assignmentIds.length === 1,
      `${edited.assignmentIds.length} assignments`,
    );

    const editedAssignment = await prisma.planAssignment.findUnique({
      where: { id: edited.assignmentIds[0] },
      select: { role: true, categoryScope: true, categories: true, clientId: true },
    });
    check(
      "the role is updated on the surviving assignment",
      editedAssignment?.role === "viewer",
      `role ${editedAssignment?.role}`,
    );
    check(
      "the category scope is updated",
      editedAssignment?.categoryScope === "selected" &&
        (editedAssignment?.categories ?? []).includes("Group Health"),
      `${editedAssignment?.categoryScope} / ${(editedAssignment?.categories ?? []).join(", ")}`,
    );
    check(
      "the surviving assignment is the plan we kept",
      editedAssignment?.clientId === plans[0],
    );

    /* ── The roles explainer must match what the API enforces ────────── */

    console.log("");
    console.log("   The Settings roles explainer matches the enforced grids");

    const { teamMembers: describedTeam, collaborators: describedCollab } =
      describeAllRoles();

    // Completeness: every function in the grid must appear in exactly one bucket,
    // so the explainer can never silently omit a capability.
    const accountedFor = describedTeam.every((capability) => {
      const total =
        capability.edit.length +
        capability.view.length +
        capability.none.length +
        capability.allowed.length +
        capability.notAllowed.length;
      return total === PERMISSION_FUNCTIONS.length;
    });
    check(
      "every function is described for every role (nothing omitted)",
      accountedFor,
      `expected ${PERMISSION_FUNCTIONS.length} per role`,
    );

    const binaryLabels = BINARY_PERMISSION_FUNCTIONS.length;
    const ownerRole = describeRole("owner");
    check(
      "Owner is described as having no No Access rows",
      ownerRole.none.length === 0,
      ownerRole.none.join(", "),
    );
    check(
      "Owner is described with every binary row Allowed",
      ownerRole.allowed.length === binaryLabels &&
        ownerRole.notAllowed.length === 0,
    );

    const adminRole = describeRole("admin");
    check(
      "Admin can publish and invite",
      adminRole.allowed.length === binaryLabels,
      `${adminRole.allowed.length} of ${binaryLabels} allowed`,
    );
    check(
      "Admin cannot see billing",
      adminRole.none.includes("Billing"),
      adminRole.none.join(", "),
    );

    const editorRole = describeRole("editor");
    check(
      "Editor is not allowed to publish or delete",
      editorRole.notAllowed.includes("Publish") &&
        editorRole.notAllowed.includes("Delete"),
      editorRole.notAllowed.join(", "),
    );

    const viewerRole = describeRole("viewer");
    check("Viewer is described as read-only", viewerRole.isReadOnly);
    check(
      "Viewer can edit nothing at all",
      viewerRole.edit.length === 0,
      viewerRole.edit.join(", "),
    );

    // The hard rule: whatever role a collaborator holds, the locked rows stay locked.
    const collaboratorLeaks = describedCollab.filter(
      (capability) =>
        capability.allowed.length > 0 || capability.none.includes("Billing") === false,
    );
    check(
      "no collaborator preset is described as allowed to publish, invite or delete",
      describedCollab.every((capability) => capability.allowed.length === 0),
      describedCollab.map((c) => `${c.label}:${c.allowed.join("|")}`).join(", "),
    );
    check(
      "the collaborator explanation is consistent",
      collaboratorLeaks.length === 0,
      collaboratorLeaks.map((c) => c.label).join(", "),
    );
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.planAssignment.deleteMany({
        where: { id: { in: created.assignmentIds } },
      });
      await prisma.teammateProfile.deleteMany({
        where: { id: { in: created.profileIds } },
      });
      await prisma.client.deleteMany({ where: { id: { in: created.clientIds } } });
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
    summary("T3 verification");
    if (failureCount() > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error("T3 verification crashed:", error);
    process.exitCode = 1;
  });
