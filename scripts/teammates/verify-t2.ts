/**
 * T2 acceptance verification — spec page 5.
 *
 *   npx tsx scripts/teammates/verify-t2.ts [--keep]
 *
 * Asserts the three T2 acceptance criteria against the REAL enforcement layer
 * (`lib/teammates/access.server.ts`) — the same functions the API routes call,
 * not a re-implementation:
 *
 *   1. "A Contributor on Ayres → Group Health cannot open Ayres → Retirement or
 *       any other plan, through the UI or the API."
 *   2. "A Viewer cannot save edits."
 *   3. "A signed document URL is refused to an unassigned user."
 *
 * Plus the Part B item 4 invariant: "At least one Owner must always exist on an
 * organization."
 *
 * Builds isolated fixtures (`t2-verify-*`), runs the assertions, then deletes
 * everything it created. Pass `--keep` to inspect the fixtures afterwards.
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
  NO_ACCESS_MESSAGE,
  assertOrganizationKeepsAnOwner,
  countOrganizationOwners,
  listAccessiblePlanIds,
  requirePlanAccess,
  resolveObjectAccess,
  resolvePlanAccess,
} from "../../lib/teammates/access.server";
import { getAuthorizedClient } from "../../lib/teammates/plan-guard.server";
import {
  createTeammateProfile,
  deactivateTeammateProfile,
  reactivateTeammateProfile,
} from "../../lib/teammates/profiles.server";
import { upsertAssignment } from "../../lib/teammates/assignments.server";
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
    assignmentIds: [] as string[],
    profileIds: [] as string[],
    clientIds: [] as string[],
    userIds: [] as string[],
    organizationIds: [] as string[],
  };

  try {
    console.log("T2 verification — permission enforcement layer");
    console.log("");

    /* ── Fixtures ───────────────────────────────────────────────────── */

    // The advisor who owns Ayres. This is the session identity of an owner.
    const advisor = await prisma.user.create({
      data: {
        name: `T2 Verify Advisor ${STAMP}`,
        email: `t2-verify-advisor-${STAMP}@example.test`,
        organizationName: `T2 Verify Org ${STAMP}`,
      },
      select: { id: true },
    });
    created.userIds.push(advisor.id);
    const organizationId = await getOrCreateOrganizationForUser(advisor.id);
    created.organizationIds.push(organizationId);

    // Three logins that are NOT the owner: a contributor, a viewer, and someone
    // with no assignment at all.
    const contributorLogin = await prisma.user.create({
      data: {
        name: `T2 Contributor ${STAMP}`,
        email: `t2-verify-contributor-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    const viewerLogin = await prisma.user.create({
      data: {
        name: `T2 Viewer ${STAMP}`,
        email: `t2-verify-viewer-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    const unassignedLogin = await prisma.user.create({
      data: {
        name: `T2 Unassigned ${STAMP}`,
        email: `t2-verify-unassigned-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(
      contributorLogin.id,
      viewerLogin.id,
      unassignedLogin.id,
    );

    // Ayres + a second plan the contributor is NOT assigned to.
    const ayresSlug = `t2-verify-ayres-${STAMP}`;
    const ayres = await prisma.client.create({
      data: {
        userId: advisor.id,
        organizationId,
        companyName: `t2-verify-Ayres-${STAMP}`,
        slug: ayresSlug,
        keyContacts: [],
      },
      select: { id: true },
    });
    const precisionOptical = await prisma.client.create({
      data: {
        userId: advisor.id,
        organizationId,
        companyName: `t2-verify-Precision-Optical-${STAMP}`,
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(ayres.id, precisionOptical.id);

    // Contributor: assigned to Ayres, scoped to Group Health only.
    const contributor = await createTeammateProfile({
      organizationId,
      actorUserId: advisor.id,
      type: "collaborator",
      email: `t2-verify-contributor-person-${STAMP}@abc.test`,
      firstName: "Connie",
      lastName: "Contributor",
      loginUserId: contributorLogin.id,
    });
    created.profileIds.push(contributor.id);
    created.assignmentIds.push(
      (
        await upsertAssignment({
          organizationId,
          profileId: contributor.id,
          clientId: ayres.id,
          actorUserId: advisor.id,
          role: "contributor",
          categoryScope: "selected",
          categories: ["Group Health"],
        })
      ).id,
    );

    // Viewer: assigned to Ayres, every category, read-only.
    const viewer = await createTeammateProfile({
      organizationId,
      actorUserId: advisor.id,
      type: "collaborator",
      email: `t2-verify-viewer-person-${STAMP}@abc.test`,
      firstName: "Vic",
      lastName: "Viewer",
      loginUserId: viewerLogin.id,
    });
    created.profileIds.push(viewer.id);
    created.assignmentIds.push(
      (
        await upsertAssignment({
          organizationId,
          profileId: viewer.id,
          clientId: ayres.id,
          actorUserId: advisor.id,
          role: "viewer",
          categoryScope: "all",
        })
      ).id,
    );

    /* ── Criterion 1 ────────────────────────────────────────────────── */

    console.log(
      "1. A Contributor on Ayres -> Group Health cannot open Ayres -> Retirement or any other plan",
    );

    const inScope = await resolvePlanAccess({
      userId: contributorLogin.id,
      clientIdOrSlug: ayres.id,
      category: "Group Health",
      permission: "create_benefits",
      level: "edit",
    });
    check(
      "assigned plan + assigned category + edit is ALLOWED",
      inScope.allowed,
      inScope.allowed ? undefined : inScope.reason,
    );
    check(
      "the grant is attributed to the teammate, not the owner",
      inScope.allowed && inScope.kind === "teammate",
    );

    const wrongCategory = await resolvePlanAccess({
      userId: contributorLogin.id,
      clientIdOrSlug: ayres.id,
      category: "Retirement",
      permission: "create_benefits",
      level: "edit",
    });
    check(
      "Ayres -> Retirement is DENIED",
      !wrongCategory.allowed,
      wrongCategory.allowed ? "was allowed" : undefined,
    );
    check(
      "the denial reason is category_not_assigned",
      !wrongCategory.allowed && wrongCategory.reason === "category_not_assigned",
      !wrongCategory.allowed ? wrongCategory.reason : undefined,
    );

    const otherPlan = await resolvePlanAccess({
      userId: contributorLogin.id,
      clientIdOrSlug: precisionOptical.id,
    });
    check(
      "an unassigned plan (Precision Optical) is DENIED",
      !otherPlan.allowed,
      otherPlan.allowed ? "was allowed" : undefined,
    );
    check(
      "the denial reason is not_assigned",
      !otherPlan.allowed && otherPlan.reason === "not_assigned",
      !otherPlan.allowed ? otherPlan.reason : undefined,
    );

    // The throwing form is what the API routes actually use.
    let apiStatus: number | undefined;
    let apiMessage: string | undefined;
    try {
      await requirePlanAccess({
        userId: contributorLogin.id,
        clientIdOrSlug: ayres.id,
        category: "Retirement",
        permission: "create_benefits",
        level: "edit",
      });
    } catch (error) {
      apiStatus = (error as TeammateDataError).status;
      apiMessage = (error as TeammateDataError).message;
    }
    check(
      "requirePlanAccess refuses Ayres -> Retirement for the API layer",
      apiStatus === 403,
      `status ${apiStatus}`,
    );
    check(
      "the refusal carries the spec's no-access copy",
      apiMessage === NO_ACCESS_MESSAGE,
      apiMessage,
    );

    /* ── Criterion 2 ────────────────────────────────────────────────── */

    console.log("");
    console.log("2. A Viewer cannot save edits");

    const viewerRead = await resolvePlanAccess({
      userId: viewerLogin.id,
      clientIdOrSlug: ayres.id,
      permission: "create_benefits",
      level: "view",
    });
    check("the Viewer can READ the plan", viewerRead.allowed);

    const viewerWrite = await resolvePlanAccess({
      userId: viewerLogin.id,
      clientIdOrSlug: ayres.id,
      permission: "create_benefits",
      level: "edit",
    });
    check(
      "the Viewer CANNOT save edits",
      !viewerWrite.allowed,
      viewerWrite.allowed ? "was allowed" : undefined,
    );
    check(
      "the denial reason is permission_denied",
      !viewerWrite.allowed && viewerWrite.reason === "permission_denied",
      !viewerWrite.allowed ? viewerWrite.reason : undefined,
    );

    // A collaborator can never hold the locked rows, even via a hand-built grid.
    const viewerPublish = await resolvePlanAccess({
      userId: viewerLogin.id,
      clientIdOrSlug: ayres.id,
      permission: "publish",
      level: "allowed",
    });
    check(
      "the Viewer cannot publish",
      !viewerPublish.allowed,
      viewerPublish.allowed ? "was allowed" : undefined,
    );

    /* ── Criterion 3 ────────────────────────────────────────────────── */

    console.log("");
    console.log("3. A signed document URL is refused to an unassigned user");

    // A realistic key: org/{orgId}/plans/{planId}/documents/{category}/file
    const documentKey = `org/${organizationId}/plans/${ayres.id}/documents/group-health/t2-verify.pdf`;

    const unassignedObject = await resolveObjectAccess({
      userId: unassignedLogin.id,
      key: documentKey,
    });
    check(
      "an unassigned user is refused the document URL",
      !unassignedObject.allowed,
      unassignedObject.allowed ? "was allowed" : undefined,
    );

    const assignedObject = await resolveObjectAccess({
      userId: viewerLogin.id,
      key: documentKey,
    });
    check(
      "an assigned Viewer IS allowed the document URL (read-only)",
      assignedObject.allowed,
      assignedObject.allowed ? undefined : assignedObject.reason,
    );

    const ownerObject = await resolveObjectAccess({
      userId: advisor.id,
      key: documentKey,
    });
    check("the owner is allowed the document URL", ownerObject.allowed);

    // Cross-plan: the contributor holds Ayres, not Precision Optical.
    const crossPlanKey = `org/${organizationId}/plans/${precisionOptical.id}/documents/group-health/t2-verify.pdf`;
    const crossPlanObject = await resolveObjectAccess({
      userId: contributorLogin.id,
      key: crossPlanKey,
    });
    check(
      "the key's PLAN segment is enforced, not just the org prefix",
      !crossPlanObject.allowed,
      crossPlanObject.allowed ? "was allowed" : undefined,
    );

    // A legacy org-level key (no plan segment) still resolves by ownership.
    const legacyKey = `org/${advisor.id}/uploads/t2-verify.png`;
    const legacyObject = await resolveObjectAccess({
      userId: advisor.id,
      key: legacyKey,
    });
    check("a legacy org-level key still works for its owner", legacyObject.allowed);

    /* ── Part B item 4: at least one Owner ───────────────────────────── */

    console.log("");
    console.log("4. At least one Owner must always exist on an organization");

    const liveOwnerCount = await countOrganizationOwners(organizationId);
    check(
      "an organization with a live owner User counts one owner",
      liveOwnerCount === 1,
      `count ${liveOwnerCount}`,
    );

    // Fixture for the failure path: an organization whose owning User is gone
    // (the exact orphan case seen in T1), holding a single Owner-role assignment.
    const ghostUserId = "6a9b1976b81208c857a6922b";
    const ghostOrg = await prisma.organization.create({
      data: {
        name: `t2-verify-ghost-${STAMP}`,
        ownerUserId: ghostUserId,
      },
      select: { id: true },
    });
    created.organizationIds.push(ghostOrg.id);

    // The ghost organization needs a plan of its own: upsertAssignment refuses to
    // attach a plan that belongs to a different organization, which is correct.
    const ghostPlan = await prisma.client.create({
      data: {
        userId: advisor.id,
        organizationId: ghostOrg.id,
        companyName: `t2-verify-ghost-plan-${STAMP}`,
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(ghostPlan.id);

    const ghostProfile = await createTeammateProfile({
      organizationId: ghostOrg.id,
      actorUserId: advisor.id,
      type: "team_member",
      email: `t2-verify-ghost-${STAMP}@example.test`,
      loginUserId: viewerLogin.id,
    });
    created.profileIds.push(ghostProfile.id);
    const ghostAssignment = await upsertAssignment({
      organizationId: ghostOrg.id,
      profileId: ghostProfile.id,
      clientId: ghostPlan.id,
      actorUserId: advisor.id,
      role: "owner",
      categoryScope: "all",
    });
    created.assignmentIds.push(ghostAssignment.id);

    const ghostCount = await countOrganizationOwners(ghostOrg.id);
    check(
      "an organization whose owner User is gone counts only its Owner-role member",
      ghostCount === 1,
      `count ${ghostCount}`,
    );

    let lastOwnerBlocked = false;
    let lastOwnerCode: string | undefined;
    try {
      await assertOrganizationKeepsAnOwner({
        organizationId: ghostOrg.id,
        excludingAssignmentIds: [ghostAssignment.id],
      });
    } catch (error) {
      lastOwnerBlocked = true;
      lastOwnerCode = (error as TeammateDataError).code;
    }
    check(
      "removing the last Owner is REFUSED",
      lastOwnerBlocked,
      lastOwnerBlocked ? undefined : "was allowed",
    );
    check(
      "the refusal is reported as last_owner",
      lastOwnerCode === "last_owner",
      lastOwnerCode,
    );

    // And a healthy organization is never blocked.
    let healthyThrew = false;
    try {
      await assertOrganizationKeepsAnOwner({ organizationId });
    } catch {
      healthyThrew = true;
    }
    check("a healthy organization is not blocked", !healthyThrew);

    /* ── 5. Plan lists show only accessible plans ───────────────────── */

    console.log("");
    console.log(
      "5. Plan lists show only accessible plans (the /api/clients scope)",
    );

    const ownerPlanIds = await listAccessiblePlanIds(advisor.id);
    check(
      "the owner sees both of their plans",
      ownerPlanIds.includes(ayres.id) &&
        ownerPlanIds.includes(precisionOptical.id),
      ownerPlanIds.join(", "),
    );

    const contributorPlanIds = await listAccessiblePlanIds(contributorLogin.id);
    check(
      "the Contributor sees the plan they are assigned to",
      contributorPlanIds.includes(ayres.id),
      contributorPlanIds.join(", "),
    );
    check(
      "the Contributor does NOT see the unassigned plan",
      !contributorPlanIds.includes(precisionOptical.id),
      contributorPlanIds.join(", "),
    );

    const unassignedPlanIds = await listAccessiblePlanIds(unassignedLogin.id);
    check(
      "a login with no ownership and no assignment sees no plans",
      unassignedPlanIds.length === 0,
      unassignedPlanIds.join(", "),
    );

    // Deactivating a teammate must remove their plans from every list.
    await deactivateTeammateProfile({
      id: contributor.id,
      organizationId,
      actorUserId: advisor.id,
    });
    const deactivatedPlanIds = await listAccessiblePlanIds(contributorLogin.id);
    check(
      "deactivating a teammate removes their plans from the list",
      !deactivatedPlanIds.includes(ayres.id),
      deactivatedPlanIds.join(", "),
    );
    await reactivateTeammateProfile({
      id: contributor.id,
      organizationId,
      actorUserId: advisor.id,
    });

    /* ── 6. The guard the migrated routes now use ───────────────────── */

    console.log("");
    console.log("6. getAuthorizedClient — the migrated routes' drop-in guard");

    const ownerRow = await getAuthorizedClient({
      clientIdOrSlug: ayres.id,
      userId: advisor.id,
    });
    check("the owner gets the client row", ownerRow?.id === ayres.id);

    const teammateRow = await getAuthorizedClient({
      clientIdOrSlug: ayres.id,
      userId: contributorLogin.id,
      permission: "documents",
      level: "edit",
    });
    check(
      "an assigned Contributor gets the row for a documents write",
      teammateRow?.id === ayres.id,
    );

    const bySlugRow = await getAuthorizedClient({
      clientIdOrSlug: ayresSlug,
      userId: contributorLogin.id,
    });
    check("lookup by slug resolves the same plan", bySlugRow?.id === ayres.id);

    const unassignedRow = await getAuthorizedClient({
      clientIdOrSlug: ayres.id,
      userId: unassignedLogin.id,
    });
    check("an unassigned login gets null", unassignedRow === null);

    const viewerWriteRow = await getAuthorizedClient({
      clientIdOrSlug: ayres.id,
      userId: viewerLogin.id,
      permission: "documents",
      level: "edit",
    });
    check(
      "a Viewer gets null for a documents WRITE (read-only)",
      viewerWriteRow === null,
    );

    const viewerReadRow = await getAuthorizedClient({
      clientIdOrSlug: ayres.id,
      userId: viewerLogin.id,
      permission: "documents",
      level: "view",
    });
    check(
      "the same Viewer gets the row for a documents READ",
      viewerReadRow?.id === ayres.id,
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
    summary("T2 verification");
    if (failureCount() > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error("T2 verification crashed:", error);
    process.exitCode = 1;
  });
