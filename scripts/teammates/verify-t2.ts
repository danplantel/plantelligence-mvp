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
  categoryWithinScope,
  countOrganizationOwners,
  listAccessiblePlanIds,
  listOwnCategoryScopedPlans,
  requirePlanAccess,
  resolveObjectAccess,
  resolvePlanAccess,
} from "../../lib/teammates/access.server";
import { getAuthorizedClient } from "../../lib/teammates/plan-guard.server";
import { getViewerRoleLabel } from "../../lib/teammates/viewer-role.server";
import {
  createTeammateProfile,
  deactivateTeammateProfile,
  reactivateTeammateProfile,
} from "../../lib/teammates/profiles.server";
import { upsertAssignment } from "../../lib/teammates/assignments.server";
import { TeammateDataError } from "../../lib/teammates/errors";
import { mayUsePath } from "../../lib/teammates/nav-access";
import { createPermissionChecker } from "../../lib/teammates/permission-levels";
import { PRESET_PERMISSION_GRIDS } from "../../types/teammate";
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
    // …and the SECTION scope has to go with it, not just the plan. A deactivated profile
    // that still contributed a scope would keep a revoked assignment's rows on /benefits.
    const deactivatedScopes = await listOwnCategoryScopedPlans(contributorLogin.id);
    check(
      "deactivating a teammate also drops their category scopes",
      deactivatedScopes.size === 0,
      `size=${deactivatedScopes.size}`,
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

    /* ── 7. The chrome rule for Collaborators ───────────────────────── */

    console.log("");
    console.log("7. A Collaborator's chrome is narrowed by ONE shared rule");

    // Pure, so this needs no fixtures — but it IS worth asserting, because it is the rule the
    // sidebar hides a link by (`visibleNavItems`) and the dashboard layout refuses a typed URL
    // by (`canUseThisPage`). One map, both outcomes, which is the whole point of the module.
    const contributorViewer = {
      isCollaborator: true,
      can: createPermissionChecker(PRESET_PERMISSION_GRIDS.contributor),
    };
    const viewerViewer = {
      isCollaborator: true,
      can: createPermissionChecker(PRESET_PERMISSION_GRIDS.viewer),
    };
    const ownerViewer = {
      isCollaborator: false,
      can: createPermissionChecker(null),
    };

    const collaboratorHidden = [
      "/dashboard",
      "/clients",
      "/documents",
      "/communications",
      "/new-client",
      "/new-benefits",
    ];
    for (const path of collaboratorHidden) {
      check(
        `a Collaborator cannot reach ${path} — hidden and refused`,
        mayUsePath(path, contributorViewer) === false,
        String(mayUsePath(path, contributorViewer)),
      );
    }
    check(
      "...including every child of a hidden group, matched by prefix",
      mayUsePath("/clients/cmv5f0yhp003f4tklcw2aisun", contributorViewer) === false &&
        mayUsePath("/communications/meetings", contributorViewer) === false &&
        mayUsePath("/communications/marketing", contributorViewer) === false,
    );
    check(
      "an Owner (or Team Member) is never narrowed by this rule",
      collaboratorHidden.every((path) => mayUsePath(path, ownerViewer)),
    );
    check(
      "and the Collaborator keeps the destinations they were invited for",
      mayUsePath("/benefits", contributorViewer) === true &&
        mayUsePath("/edit-benefit/plan-id/group-health", contributorViewer) === true &&
        mayUsePath("/edit-client/cmv5f0yhp003f4tklcw2aisun", contributorViewer) === true,
    );

    // The Create Benefit wizard is the one entry that used to follow the GRID, and it no longer
    // does: `/new-benefits` is hidden for every Collaborator. The pairing below is the point —
    // `create_benefits: edit` is ALSO the function the benefit editor saves under, so the row must
    // stay granted or a Contributor could not save the sections they were invited for. What is
    // refused is CREATION, not the permission.
    check(
      "no Collaborator may create a benefit from scratch — not even a Contributor whose grid says edit",
      mayUsePath("/new-benefits", contributorViewer) === false,
    );
    check(
      "…and a read-only Collaborator (Viewer / Reviewer) is refused the same way",
      mayUsePath("/new-benefits", viewerViewer) === false,
    );
    check(
      "the wizard is hidden WITHOUT revoking create_benefits: edit — the editor saves under it",
      contributorViewer.can("create_benefits", "edit") === true &&
        viewerViewer.can("create_benefits", "edit") === false,
    );

    // The capability the hidden `/documents` page must NOT have taken away. The library is
    // hidden because it is the advisor's workspace, not because a Collaborator lost the
    // function — if this ever fails, the page was hidden by revoking a permission, and the
    // chrome and the grid are then stating two different rules.
    check(
      "hiding the documents library did not revoke the documents function",
      contributorViewer.can("documents", "edit") === true,
    );

    // And the same pairing for the Communications hub. The SECTION is hidden because its three
    // children are one cross-plan hub; the grid row and the per-plan surface are untouched, since
    // a plan's meetings render inside the plan (`PlanMeetingsSection` on the Edit Plan page) and
    // that page is exactly where a collaborator works.
    check(
      "hiding the Communications hub did not revoke the meetings function",
      contributorViewer.can("meetings", "edit") === true,
    );

    /* ── 8. /benefits narrows to the assignment's SECTIONS ──────────── */

    console.log("");
    console.log("8. /benefits rows follow the assignment's category scope, not just the plan");

    // The page makes two reads: `/api/clients` (which plans) and `/api/benefits` (which rows).
    // The first was already scoped by `listAccessiblePlanIds`; this is the second half, and the
    // criterion it protects is one line long — a Contributor invited for Group Health must not
    // be shown the plan's other three sections.
    const contributorScopes = await listOwnCategoryScopedPlans(contributorLogin.id);
    check(
      "a Contributor scoped to Group Health has exactly one scoped plan",
      contributorScopes.size === 1,
      String(contributorScopes.size),
    );

    const contributorAyresScope = contributorScopes.get(ayres.id) ?? [];
    check(
      "…and it is Ayres, pinned to Group Health alone",
      contributorAyresScope.length === 1 &&
        categoryWithinScope(contributorAyresScope, "Group Health") === true,
      JSON.stringify(contributorAyresScope),
    );
    check(
      "…so the plan's other three sections are outside the scope",
      categoryWithinScope(contributorAyresScope, "Retirement") === false &&
        categoryWithinScope(contributorAyresScope, "Group Life") === false &&
        categoryWithinScope(contributorAyresScope, "Company / Plan Sponsor") === false,
    );

    // An `all` scope is NOT a narrowing, so the plan is simply absent from the map — which is
    // exactly what leaves the route's rows for it untouched.
    const viewerScopes = await listOwnCategoryScopedPlans(viewerLogin.id);
    check(
      "an all-categories Viewer has no scoped plan, so every section stays",
      viewerScopes.size === 0,
      String(viewerScopes.size),
    );

    // The Owner owns the plans directly and holds no assignment; an unassigned login has no
    // profile at all. Both are the "never narrowed" case, so both must produce an empty map
    // rather than an entry that filters them down to nothing.
    check(
      "an Owner is never narrowed by this rule",
      (await listOwnCategoryScopedPlans(advisor.id)).size === 0,
    );
    check(
      "…and neither is a login with no teammate profile",
      (await listOwnCategoryScopedPlans(unassignedLogin.id)).size === 0,
    );

    // The comparison the filter is built on, pinned directly: the wizard's "Custom" hub is the
    // stored "Company / Plan Sponsor", and the legacy portal names map onto the canonical
    // categories. A filter that missed an alias would hide the very hub the assignment names.
    check(
      "the alias mapping matches the one resolvePlanAccessForPlan uses",
      categoryWithinScope(["Custom"], "Company / Plan Sponsor") === true &&
        categoryWithinScope(["Company / Plan Sponsor"], "Custom") === true &&
        categoryWithinScope(["Group Health"], "Health Insurance") === true &&
        categoryWithinScope(["Wellness Programs"], "Other") === true &&
        categoryWithinScope(["Group Health"], "Retirement") === false,
    );

    // Two live profiles for the SAME login, with different scopes on one plan, union their
    // lists — and a section named twice is listed once. `getViewerAccess` already unions the
    // grids of multiple profiles for this same reason.
    const contributorTwin = await createTeammateProfile({
      organizationId,
      actorUserId: advisor.id,
      type: "collaborator",
      email: `t2-verify-contributor-twin-${STAMP}@abc.test`,
      firstName: "Connie",
      lastName: "Contributor Twin",
      loginUserId: contributorLogin.id,
    });
    created.profileIds.push(contributorTwin.id);
    created.assignmentIds.push(
      (
        await upsertAssignment({
          organizationId,
          profileId: contributorTwin.id,
          clientId: ayres.id,
          actorUserId: advisor.id,
          role: "contributor",
          categoryScope: "selected",
          categories: ["Group Health", "Group Life"],
        })
      ).id,
    );
    const unionedAyres =
      (await listOwnCategoryScopedPlans(contributorLogin.id)).get(ayres.id) ?? [];
    check(
      "two live profiles on one plan union their lists, de-duplicated on the alias",
      unionedAyres.length === 2 &&
        categoryWithinScope(unionedAyres, "Group Health") === true &&
        categoryWithinScope(unionedAyres, "Group Life") === true,
      JSON.stringify(unionedAyres),
    );

    /* ── 9. The role badge the header renders ───────────────────────── */

    console.log("");
    console.log("9. The header says what the viewer IS, from one shared rule");

    // The badge above the name in `user-nav`, resolved by `getViewerRoleLabel`. Two sources, and
    // the ORDER is the rule: the SEAT first, then "no seat at all" as the owner's signature.
    check(
      "the organization's owner reads Owner — they hold no seat at all",
      (await getViewerRoleLabel(advisor.id)) === "Owner",
    );
    // A login with no seat at all is the OWNER's signature in this codebase — `getViewerAccess`
    // applies the same rule, and an advisor never has a TeammateProfile.
    check(
      "a login with no seat reads Owner, matching the chrome's own 'no profile' rule",
      (await getViewerRoleLabel(unassignedLogin.id)) === "Owner",
    );
    // A Collaborator seat reads "Collaborator" whatever preset it holds: that is the product's
    // word for these people ("Invite Collaborator", the Collaborators section), while the preset
    // name is the invite dialog's internal vocabulary. `collaborator-card.tsx` refuses to print
    // "Contributor" beside a name for exactly this reason.
    check(
      "a Contributor seat reads Collaborator, not the preset's own name",
      (await getViewerRoleLabel(contributorLogin.id)) === "Collaborator",
    );
    // The trap that fixes this module's ordering, made concrete on a fixture of its own. An
    // invited login commonly OWNS an Organization — the T1 backfill created one per User, and
    // `resolveOrganizationId` creates one on demand — so "owns an organization" cannot be the
    // owner test. Reading it first reported EVERY collaborator as an Owner, which is the same
    // trap `/accept-invite` documents for the tenancy anchor. A dedicated login is used here
    // because the run's Viewer login carries a second, unrelated seat — see the last check below.
    const invitedLogin = await prisma.user.create({
      data: {
        name: `T2 Invited ${STAMP}`,
        email: `t2-verify-invited-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(invitedLogin.id);
    const invitedSeat = await createTeammateProfile({
      organizationId,
      actorUserId: advisor.id,
      type: "collaborator",
      role: "contributor",
      email: `t2-verify-invited-person-${STAMP}@abc.test`,
      firstName: "Ida",
      lastName: "Invited",
      loginUserId: invitedLogin.id,
    });
    created.profileIds.push(invitedSeat.id);
    created.assignmentIds.push(
      (
        await upsertAssignment({
          organizationId,
          profileId: invitedSeat.id,
          clientId: ayres.id,
          actorUserId: advisor.id,
          role: "contributor",
          categoryScope: "selected",
          categories: ["Group Health"],
        })
      ).id,
    );
    const invitedOwnOrganizationId = await getOrCreateOrganizationForUser(
      invitedLogin.id,
    );
    created.organizationIds.push(invitedOwnOrganizationId);
    const invitedOwnOrganization = await prisma.organization.findUnique({
      where: { id: invitedOwnOrganizationId },
      select: { ownerUserId: true },
    });
    check(
      "an invited login really does own an organization of its own (the trap is real, not hypothetical)",
      invitedOwnOrganization?.ownerUserId === invitedLogin.id,
    );
    check(
      "…and STILL reads Collaborator, because the SEAT outranks ownership",
      (await getViewerRoleLabel(invitedLogin.id)) === "Collaborator",
    );

    // An invitation raised before any plan exists — a seat with nothing attached to it yet. It
    // still reads as a Collaborator, because the badge describes the SEAT rather than what it has
    // so far been given.
    const pendingSeat = await createTeammateProfile({
      organizationId,
      actorUserId: advisor.id,
      type: "collaborator",
      role: "reviewer",
      email: `t2-verify-pending-${STAMP}@abc.test`,
      firstName: "Pat",
      lastName: "Pending",
      loginUserId: unassignedLogin.id,
    });
    created.profileIds.push(pendingSeat.id);
    check(
      "a collaborator seat with no assignment yet still reads Collaborator",
      (await getViewerRoleLabel(unassignedLogin.id)) === "Collaborator",
    );

    // An INTERNAL seat is the other half of the rule, and the only case where the role summary
    // runs at all: a Team Member reads the role they hold, in the words the Settings team list
    // uses — a Collaborator would not be told apart from one another by a preset name.
    const staffLogin = await prisma.user.create({
      data: {
        name: `T2 Staff ${STAMP}`,
        email: `t2-verify-staff-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(staffLogin.id);
    const staff = await createTeammateProfile({
      organizationId,
      actorUserId: advisor.id,
      type: "team_member",
      email: `t2-verify-staff-person-${STAMP}@abc.test`,
      firstName: "Sam",
      lastName: "Staff",
      loginUserId: staffLogin.id,
    });
    created.profileIds.push(staff.id);
    check(
      "a Team Member seat with no role and no assignment reads Team Member",
      (await getViewerRoleLabel(staffLogin.id)) === "Team Member",
    );

    // …and the SUMMARY: with assignments, the most privileged of them wins — the same rule the
    // Settings team list applies, so the two surfaces cannot describe one person differently.
    created.assignmentIds.push(
      (
        await upsertAssignment({
          organizationId,
          profileId: staff.id,
          clientId: ayres.id,
          actorUserId: advisor.id,
          role: "viewer",
          categoryScope: "all",
        })
      ).id,
    );
    created.assignmentIds.push(
      (
        await upsertAssignment({
          organizationId,
          profileId: staff.id,
          clientId: precisionOptical.id,
          actorUserId: advisor.id,
          role: "editor",
          categoryScope: "all",
        })
      ).id,
    );
    check(
      "…while a Team Member with two plans reads the most privileged (Viewer + Editor → Editor)",
      (await getViewerRoleLabel(staffLogin.id)) === "Editor",
    );

    // One login can back seats in SEVERAL organizations — the T1 model allows it — and this run's
    // Viewer login is one of those: a Collaborator seat on Ayres AND the Owner-role Team Member
    // seat of the ghost organization built for the one-Owner test above. The badge reports the
    // most privileged thing the login IS anywhere, so it reads Owner: not because ownership
    // outranks a seat (the check above proves it does not), but because the summary across their
    // seats does.
    check(
      "a login holding an Owner seat in another organization reads Owner",
      (await getViewerRoleLabel(viewerLogin.id)) === "Owner",
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
