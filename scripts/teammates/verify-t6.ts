/**
 * T6 acceptance verification — spec page 11 (Assignment Management Screen).
 *
 *   npx tsx scripts/teammates/verify-t6.ts [--keep]
 *
 * Asserts the four T6 acceptance criteria against the REAL data layer:
 *
 *   1. "Adding Jane to Precision Optical takes one screen." — one access save adds
 *      the assignment without creating a second profile.
 *   2. "A removed assignment revokes access on the next request."
 *   3. "A deactivated user cannot log in to that organization." — the login loses
 *      every plan, which is the enforcement layer's half of that rule.
 *   4. "Delete Profile is blocked while assignments remain."
 *
 * Plus Part B's own rules: Remove ends access immediately, Deactivate keeps the
 * profile, Delete is only possible with no assignments, no action deletes content,
 * and every change is logged with who and when.
 *
 * And the two things this ticket added on top: `updateAssignment` (the per-assignment
 * role + "Show on Benefits Hub" controls) and `getMembershipDetail` (the screen's
 * single read).
 *
 * Fixtures are `t6-verify-*` and are cleaned up unless `--keep` is passed.
 */
import {
  check,
  createPrisma,
  failureCount,
  installFixtureGuards,
  summary,
  sweepStaleFixtures,
} from "./shared";
import { getOrCreateOrganizationForUser } from "../../lib/organization";
import { TeammateDataError } from "../../lib/teammates/errors";
import {
  getAssignment,
  listAssignmentsForProfile,
  removeAssignment,
  updateAssignment,
  upsertAssignment,
} from "../../lib/teammates/assignments.server";
import {
  createTeammateProfile,
  deactivateTeammateProfile,
  deleteTeammateProfile,
  setProfileState,
} from "../../lib/teammates/profiles.server";
import {
  getMembershipDetail,
  updateTeamMember,
} from "../../lib/teammates/team.server";
import {
  listAccessiblePlanIds,
  resolvePlanAccess,
} from "../../lib/teammates/access.server";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();

/**
 * The detail line for a `resolvePlanAccess` result. The returned union only carries
 * `reason` on its denial member, so it is read through its optional shape rather than
 * narrowed at every call site.
 */
function accessNote(result: { allowed?: boolean; reason?: string }): string {
  return result.allowed ? "allowed" : result.reason ?? "denied";
}

/** The API layer turns a TeammateDataError into its status + code. */
async function refusalCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(no error)";
  } catch (error) {
    if (error instanceof TeammateDataError) return error.code ?? String(error.status);
    return `unexpected: ${(error as Error).message}`;
  }
}

async function main(): Promise<void> {
  const prisma = createPrisma();

  installFixtureGuards(prisma, { exceptStamps: [STAMP] });
  await sweepStaleFixtures(prisma, { exceptStamps: [STAMP] });

  const created = {
    profileIds: [] as string[],
    clientIds: [] as string[],
    userIds: [] as string[],
    organizationIds: [] as string[],
  };

  try {
    console.log("T6 verification — Assignment Management screen");
    console.log("");

    /* ── Fixtures ───────────────────────────────────────────────────── */

    const owner = await prisma.user.create({
      data: {
        name: "T6 Verify Advisor",
        email: `t6-verify-owner-${STAMP}@example.test`,
        organizationName: `T6 Verify Org ${STAMP}`,
      },
      select: { id: true },
    });
    created.userIds.push(owner.id);
    const organizationId = await getOrCreateOrganizationForUser(owner.id);
    created.organizationIds.push(organizationId);

    const ayres = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `Ayres ${STAMP}`,
        slug: `t6-verify-ayres-${STAMP}`,
        status: "Draft",
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(ayres.id);

    const precision = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `Precision Optical ${STAMP}`,
        slug: `t6-verify-precision-${STAMP}`,
        status: "Draft",
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(precision.id);

    // Jane's LOGIN is what the enforcement layer keys on; the profile is what the
    // advisor manages. T1 keeps them separate on purpose.
    const janeLogin = await prisma.user.create({
      data: {
        name: "T6 Jane Login",
        email: `t6-verify-jane-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(janeLogin.id);

    const jane = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "collaborator",
      email: `t6-verify-jane-${STAMP}@abbenefits.test`,
      firstName: "Jane",
      lastName: "Smith",
      loginUserId: janeLogin.id,
    });
    created.profileIds.push(jane.id);
    // The real flow invites her (Contact → Invited); `createTeammateProfile` only
    // makes the row, so the state is moved explicitly rather than assumed.
    await setProfileState({
      id: jane.id,
      organizationId,
      actorUserId: owner.id,
      state: "invited",
    });

    const ayresAssignment = await upsertAssignment({
      organizationId,
      profileId: jane.id,
      clientId: ayres.id,
      actorUserId: owner.id,
      role: "contributor",
      categoryScope: "selected",
      categories: ["Group Health"],
    });

    /* ── 1. Adding a plan is one save, one profile ──────────────────── */

    console.log("1. Adding Jane to Precision Optical takes one screen");

    const profilesBefore = await prisma.teammateProfile.count({
      where: { organizationId },
    });

    const saved = await updateTeamMember({
      organizationId,
      actorUserId: owner.id,
      profileId: jane.id,
      planScope: "certain_plans",
      planIds: [ayres.id, precision.id],
      categoryScope: "all",
    });

    check(
      "one save produced an assignment on each plan",
      saved.assignmentIds.length === 2,
      `${saved.assignmentIds.length} assignment(s)`,
    );
    check(
      "nothing was removed, because both plans stayed ticked",
      saved.removedAssignmentIds.length === 0,
      `${saved.removedAssignmentIds.length} removed`,
    );
    check(
      "no second profile was created for Jane",
      (await prisma.teammateProfile.count({ where: { organizationId } })) ===
        profilesBefore,
    );

    const detail = await getMembershipDetail({ organizationId, profileId: jane.id });
    check(
      "the screen's reader lists both assignments",
      detail.assignments.length === 2,
      `${detail.assignments.length}`,
    );
    check(
      "each assignment carries its plan's NAME, not just an id",
      detail.assignments.every((row) =>
        [ayres.id, precision.id].includes(row.clientId) &&
        row.planName.includes("Ayres") === (row.clientId === ayres.id),
      ),
      detail.assignments.map((row) => row.planName).join(", "),
    );
    check(
      "the reader also offers the organization's plans for the checklist",
      detail.plans.length >= 2,
      `${detail.plans.length} plan(s)`,
    );
    check(
      "the header identifies the person and their type",
      detail.profile.name === "Jane Smith" &&
        detail.profile.personType === "collaborator" &&
        detail.profile.state === "invited",
      `${detail.profile.name} / ${detail.profile.personType} / ${detail.profile.state}`,
    );
    check(
      "Delete is reported as blocked while assignments remain",
      detail.canDeleteProfile === false,
    );

    /* ── 2. The per-assignment controls are per assignment ─────────── */

    console.log("");
    console.log("2. Role and hub visibility are per assignment");

    const precisionAssignment = await getAssignment({
      profileId: jane.id,
      clientId: precision.id,
      organizationId,
    });
    if (!precisionAssignment) throw new Error("fixture: precision assignment missing");

    // Step 1's bulk save set BOTH assignments to All categories, so put a known
    // partial scope back before testing that a role-only edit leaves it alone.
    await updateAssignment({
      assignmentId: ayresAssignment.id,
      organizationId,
      actorUserId: owner.id,
      categoryScope: "selected",
      categories: ["Group Health"],
    });

    await updateAssignment({
      assignmentId: precisionAssignment.id,
      organizationId,
      actorUserId: owner.id,
      role: "viewer",
    });

    const precisionAfter = await getAssignment({
      profileId: jane.id,
      clientId: precision.id,
      organizationId,
    });
    const ayresAfter = await getAssignment({
      profileId: jane.id,
      clientId: ayres.id,
      organizationId,
    });

    check(
      "the edited assignment takes the new role",
      precisionAfter?.role === "viewer",
      String(precisionAfter?.role),
    );
    check(
      "the OTHER assignment is untouched — one screen, independent rows",
      ayresAfter?.role === "contributor",
      String(ayresAfter?.role),
    );
    check(
      "a role-only edit does not reset the category scope",
      ayresAfter?.categoryScope === "selected" &&
        (ayresAfter?.categories as string[])?.includes("Group Health") === true,
      `${ayresAfter?.categoryScope} / ${JSON.stringify(ayresAfter?.categories)}`,
    );

    await updateAssignment({
      assignmentId: ayresAssignment.id,
      organizationId,
      actorUserId: owner.id,
      showOnBenefitsHub: false,
    });
    const ayresVisibility = await getAssignment({
      profileId: jane.id,
      clientId: ayres.id,
      organizationId,
    });
    check(
      "display can be turned off",
      ayresVisibility?.showOnBenefitsHub === false,
    );
    check(
      "a visibility-only edit does not change the role (T7 item 2: display off keeps admin access)",
      ayresVisibility?.role === "contributor",
      String(ayresVisibility?.role),
    );

    // T2a has landed since this suite was written, so the rule changed shape: `custom`
    // is no longer unavailable, it is REFUSED WITHOUT A GRID. The grid itself is
    // covered by verify-t2a; what this suite guards is that the screen's path cannot
    // store a Custom role with no permissions behind it.
    check(
      "Custom without a grid is refused, so no role can be stored with no permissions",
      (await refusalCode(() =>
        updateAssignment({
          assignmentId: ayresAssignment.id,
          organizationId,
          actorUserId: owner.id,
          role: "custom",
        }),
      )) === "custom_permission_set_required",
    );

    /* ── 3. Remove Assignment revokes access immediately ───────────── */

    console.log("");
    console.log("3. A removed assignment revokes access on the next request");

    const beforeRemoval = await resolvePlanAccess({
      userId: janeLogin.id,
      clientIdOrSlug: precision.id,
      permission: "create_benefits",
      level: "view",
    });
    check(
      "Jane can read Precision Optical while she is assigned to it",
      beforeRemoval.allowed === true,
      accessNote(beforeRemoval),
    );

    await removeAssignment({
      assignmentId: precisionAssignment.id,
      organizationId,
      actorUserId: owner.id,
    });

    const afterRemoval = await resolvePlanAccess({
      userId: janeLogin.id,
      clientIdOrSlug: precision.id,
      permission: "create_benefits",
      level: "view",
    });
    check(
      "the very next request is denied",
      afterRemoval.allowed === false,
      accessNote(afterRemoval),
    );
    check(
      "and the plan is gone from her plan list",
      !(await listAccessiblePlanIds(janeLogin.id)).includes(precision.id),
    );
    check(
      "she keeps the plan she is still assigned to",
      (await listAccessiblePlanIds(janeLogin.id)).includes(ayres.id),
    );

    /* ── 4. Deactivate ends access but keeps the profile ───────────── */

    console.log("");
    console.log("4. Deactivate ends access and keeps the profile");

    await deactivateTeammateProfile({
      id: jane.id,
      organizationId,
      actorUserId: owner.id,
    });

    check(
      "the profile row survives deactivation",
      (await prisma.teammateProfile.count({ where: { id: jane.id } })) === 1,
    );
    check(
      "every plan disappears from her list, so an organization-scoped read is refused",
      (await listAccessiblePlanIds(janeLogin.id)).length === 0,
      (await listAccessiblePlanIds(janeLogin.id)).join(", "),
    );
    check(
      "a deactivated person cannot be given a new plan until reactivated",
      (await refusalCode(() =>
        upsertAssignment({
          organizationId,
          profileId: jane.id,
          clientId: precision.id,
          actorUserId: owner.id,
          role: "contributor",
        }),
      )) === "profile_deactivated",
    );

    /* ── 5. Delete Profile is blocked while assignments remain ─────── */

    console.log("");
    console.log("5. Delete Profile is blocked while assignments remain");

    check(
      "the guard refuses with profile_has_assignments",
      (await refusalCode(() =>
        deleteTeammateProfile({
          id: jane.id,
          organizationId,
          actorUserId: owner.id,
        }),
      )) === "profile_has_assignments",
    );

    const remaining = await listAssignmentsForProfile(jane.id, organizationId);
    for (const assignment of remaining) {
      await removeAssignment({
        assignmentId: assignment.id,
        organizationId,
        actorUserId: owner.id,
      });
    }

    const emptied = await getMembershipDetail({ organizationId, profileId: jane.id });
    check(
      "with every assignment removed the screen now allows the delete",
      emptied.canDeleteProfile === true,
      `${emptied.assignments.length} left`,
    );

    const planStillThere = await prisma.client.count({
      where: { id: { in: [ayres.id, precision.id] } },
    });

    await deleteTeammateProfile({
      id: jane.id,
      organizationId,
      actorUserId: owner.id,
    });
    check(
      "the profile is gone",
      (await prisma.teammateProfile.count({ where: { id: jane.id } })) === 0,
    );
    check(
      "no action deleted content: both plans survive every step above",
      planStillThere === 2 &&
        (await prisma.client.count({
          where: { id: { in: [ayres.id, precision.id] } },
        })) === 2,
      `${planStillThere} plan(s) before the delete`,
    );

    /* ── 6. Every change is logged with who and when ───────────────── */

    console.log("");
    console.log("6. Every change is logged with who and when");

    const audit = await prisma.teammateAuditEvent.findMany({
      where: { organizationId },
    });
    const actions = new Set(audit.map((row) => row.action));

    for (const expected of [
      "assignment_created",
      "assignment_role_changed",
      "assignment_visibility_changed",
      "assignment_removed",
      "profile_deactivated",
      "profile_deleted",
    ]) {
      check(
        `the trail records ${expected}`,
        actions.has(expected as never),
        [...actions].join(", "),
      );
    }
    check(
      "every row names the acting user",
      audit.every((row) => row.actorUserId === owner.id),
    );
    check(
      "and carries a timestamp",
      audit.every((row) => row.createdAt instanceof Date),
    );

    /* ── 7. All Plans stays Team-Member-only ───────────────────────── */

    console.log("");
    console.log("7. All Plans remains a Team-Member concept");

    const secondJane = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "collaborator",
      email: `t6-verify-jane2-${STAMP}@abbenefits.test`,
      firstName: "Janet",
      lastName: "Smith",
    });
    created.profileIds.push(secondJane.id);

    await updateTeamMember({
      organizationId,
      actorUserId: owner.id,
      profileId: secondJane.id,
      planScope: "all_plans",
      categoryScope: "all",
    });
    const secondProfile = await prisma.teammateProfile.findUnique({
      where: { id: secondJane.id },
      select: { allPlans: true },
    });
    check(
      'a Collaborator never carries the "All Plans" flag (spec T2a / Open Decisions)',
      secondProfile?.allPlans === false,
      String(secondProfile?.allPlans),
    );
    check(
      "the scope still materialises one assignment per existing plan",
      (await listAssignmentsForProfile(secondJane.id, organizationId)).length === 2,
    );
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.planAssignment.deleteMany({
        where: { organizationId: { in: created.organizationIds } },
      });
      await prisma.teammateAuditEvent.deleteMany({
        where: { organizationId: { in: created.organizationIds } },
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
      console.log("Fixtures kept (--keep).");
    }

    summary("T6 verification");
    if (failureCount() > 0) process.exitCode = 1;
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("T6 verification crashed:", error);
  process.exitCode = 1;
});
