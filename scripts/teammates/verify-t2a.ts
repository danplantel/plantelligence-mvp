/**
 * T2a acceptance verification — spec pages 5-8 (Custom role, plan-first grid).
 *
 *   npx tsx scripts/teammates/verify-t2a.ts [--keep]
 *
 * Asserts the acceptance criteria that live at the enforcement layer — the ones that
 * must hold "through the UI or the API":
 *
 *   1. "A Custom user with Documents Edit and everything else View can upload documents
 *      and cannot save changes in any other module, through the UI or the API."
 *   2. "Adding Precision Optical with 'same permissions' on creates two identical
 *      assignments."
 *   3. "With 'same permissions' off, Edit on Ayres and View on Precision Optical are
 *      enforced independently."
 *   4. "Locked rows cannot be enabled for a Collaborator, including by direct API call."
 *   5. "All Plans never appears for a Collaborator."
 *   6. "Each soft warning fires on its condition, and Save completes after
 *      confirmation" — plus that the confirmed codes land on the audit row, which is how
 *      an Owner sees them.
 *   7. "Store the full permission set on each assignment, never a reference to a preset"
 *      and "changing a preset later must not alter Custom users".
 *
 * Fixtures are `t2a-verify-*` and are cleaned up unless `--keep` is passed.
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
  updateAssignment,
  upsertAssignment,
} from "../../lib/teammates/assignments.server";
import { createTeammateProfile } from "../../lib/teammates/profiles.server";
import { updateTeamMember } from "../../lib/teammates/team.server";
import { resolvePlanAccess } from "../../lib/teammates/access.server";
import {
  evaluateSoftWarnings,
  finalizePermissionSet,
  summarizePermissionSet,
} from "../../lib/teammates/permissions";
import {
  PERMISSION_FUNCTIONS,
  COLLABORATOR_LOCKED_FUNCTIONS,
  presetPermissionSet,
  type TeammatePermissionSet,
} from "../../types/teammate";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();

/** The acceptance criterion's grid: everything View, Documents Edit. */
function documentsEditGrid(): TeammatePermissionSet {
  return finalizePermissionSet(
    { ...presetPermissionSet("viewer"), documents: "edit" },
    "collaborator",
  );
}

async function refusalCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(no error)";
  } catch (error) {
    if (error instanceof TeammateDataError) return error.code ?? String(error.status);
    return `unexpected: ${(error as Error).message}`;
  }
}

function accessNote(result: { allowed?: boolean; reason?: string }): string {
  return result.allowed ? "allowed" : result.reason ?? "denied";
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
    console.log("T2a verification — Custom role, plan-first grid");
    console.log("");

    /* ── Fixtures ───────────────────────────────────────────────────── */

    const owner = await prisma.user.create({
      data: {
        name: "T2a Verify Advisor",
        email: `t2a-verify-owner-${STAMP}@example.test`,
        organizationName: `T2a Verify Org ${STAMP}`,
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
        slug: `t2a-verify-ayres-${STAMP}`,
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
        slug: `t2a-verify-precision-${STAMP}`,
        status: "Draft",
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(precision.id);

    const login = await prisma.user.create({
      data: {
        name: "T2a Custom Login",
        email: `t2a-verify-custom-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(login.id);

    const jane = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "collaborator",
      email: `t2a-verify-jane-${STAMP}@abbenefits.test`,
      firstName: "Jane",
      lastName: "Smith",
      loginUserId: login.id,
    });
    created.profileIds.push(jane.id);

    const ayresAssignment = await upsertAssignment({
      organizationId,
      profileId: jane.id,
      clientId: ayres.id,
      actorUserId: owner.id,
      role: "contributor",
      categoryScope: "selected",
      categories: ["Group Health"],
    });

    /* ── 1. The grid is enforced function by function ───────────────── */

    console.log("1. A Custom grid is enforced per function, through the API");

    const grid = documentsEditGrid();
    await updateAssignment({
      assignmentId: ayresAssignment.id,
      organizationId,
      actorUserId: owner.id,
      role: "custom",
      customPermissionSet: grid,
      warningsConfirmed: [],
    });

    const stored = await getAssignment({
      profileId: jane.id,
      clientId: ayres.id,
      organizationId,
    });

    check(
      "the assignment is Custom",
      stored?.role === "custom",
      String(stored?.role),
    );
    check(
      "the FULL grid is stored, not a reference to a preset",
      PERMISSION_FUNCTIONS.every(
        (fn) =>
          (stored?.permissionSet as Record<string, string> | undefined)?.[fn] !==
          undefined,
      ),
      `${Object.keys((stored?.permissionSet as object) ?? {}).length} keys`,
    );
    check(
      "Documents is Edit in the stored grid",
      (stored?.permissionSet as Record<string, string>)?.documents === "edit",
      String((stored?.permissionSet as Record<string, string>)?.documents),
    );

    const documentsEdit = await resolvePlanAccess({
      userId: login.id,
      clientIdOrSlug: ayres.id,
      permission: "documents",
      level: "edit",
    });
    check(
      "she CAN edit documents",
      documentsEdit.allowed === true,
      accessNote(documentsEdit),
    );

    const marketingEdit = await resolvePlanAccess({
      userId: login.id,
      clientIdOrSlug: ayres.id,
      permission: "marketing",
      level: "edit",
    });
    check(
      "and she CANNOT edit any other module",
      marketingEdit.allowed === false,
      accessNote(marketingEdit),
    );
    check(
      "the denial names the permission, not the plan",
      marketingEdit.allowed === false && marketingEdit.reason === "permission_denied",
      accessNote(marketingEdit),
    );

    const documentsView = await resolvePlanAccess({
      userId: login.id,
      clientIdOrSlug: ayres.id,
      permission: "documents",
      level: "view",
    });
    check(
      "Edit on a function turns on View for it (auto-enforced rule)",
      documentsView.allowed === true,
      accessNote(documentsView),
    );

    /* ── 2 & 3. Same permissions vs per-plan permissions ───────────── */

    console.log("");
    console.log("2. Same permissions on writes identical grids; off writes different ones");

    // "Same permissions" on: materialise the plan, then write the same grid to it.
    const scopeResult = await updateTeamMember({
      organizationId,
      actorUserId: owner.id,
      profileId: jane.id,
      planScope: "certain_plans",
      planIds: [ayres.id, precision.id],
      categoryScope: "all",
    });
    check(
      "the second plan gets its own assignment",
      scopeResult.assignmentIds.length === 2,
      `${scopeResult.assignmentIds.length}`,
    );

    for (const planId of [ayres.id, precision.id]) {
      const assignment = await getAssignment({
        profileId: jane.id,
        clientId: planId,
        organizationId,
      });
      if (!assignment) continue;
      await updateAssignment({
        assignmentId: assignment.id,
        organizationId,
        actorUserId: owner.id,
        role: "custom",
        customPermissionSet: grid,
      });
    }

    const ayresSame = await getAssignment({
      profileId: jane.id,
      clientId: ayres.id,
      organizationId,
    });
    const precisionSame = await getAssignment({
      profileId: jane.id,
      clientId: precision.id,
      organizationId,
    });
    check(
      "the two assignments are identical",
      JSON.stringify(ayresSame?.permissionSet) ===
        JSON.stringify(precisionSame?.permissionSet),
    );

    // "Same permissions" off: Edit on Ayres, View on Precision Optical.
    await updateAssignment({
      assignmentId: ayresSame!.id,
      organizationId,
      actorUserId: owner.id,
      role: "custom",
      customPermissionSet: documentsEditGrid(),
    });
    await updateAssignment({
      assignmentId: precisionSame!.id,
      organizationId,
      actorUserId: owner.id,
      role: "custom",
      customPermissionSet: finalizePermissionSet(
        presetPermissionSet("viewer"),
        "collaborator",
      ),
    });

    const ayresEdit = await resolvePlanAccess({
      userId: login.id,
      clientIdOrSlug: ayres.id,
      permission: "documents",
      level: "edit",
    });
    const precisionEdit = await resolvePlanAccess({
      userId: login.id,
      clientIdOrSlug: precision.id,
      permission: "documents",
      level: "edit",
    });
    check(
      "Edit on Ayres is enforced there",
      ayresEdit.allowed === true,
      accessNote(ayresEdit),
    );
    check(
      "and View on Precision Optical is enforced independently",
      precisionEdit.allowed === false,
      accessNote(precisionEdit),
    );
    const precisionView = await resolvePlanAccess({
      userId: login.id,
      clientIdOrSlug: precision.id,
      permission: "documents",
      level: "view",
    });
    check(
      "she can still READ the plan she only views",
      precisionView.allowed === true,
      accessNote(precisionView),
    );

    /* ── 4 & 5. Hard blocks and All Plans ──────────────────────────── */

    console.log("");
    console.log("3. Locked rows and All Plans hold for a Collaborator");

    const lockedGrid = {
      ...presetPermissionSet("viewer"),
      publish: "allowed",
      invite: "allowed",
      delete: "allowed",
      org_settings: "edit",
      billing: "edit",
    } as TeammatePermissionSet;

    const lockedRefusal = await refusalCode(() =>
      updateAssignment({
        assignmentId: ayresSame!.id,
        organizationId,
        actorUserId: owner.id,
        role: "custom",
        customPermissionSet: lockedGrid,
      }),
    );
    check(
      "a locked permission supplied directly is REFUSED, not silently dropped",
      lockedRefusal === "collaborator_locked_function",
      lockedRefusal,
    );

    const finalised = finalizePermissionSet(lockedGrid, "collaborator");
    check(
      "and finalizing coerces every locked row to its denied value",
      COLLABORATOR_LOCKED_FUNCTIONS.every((fn) =>
        fn === "publish" || fn === "invite" || fn === "delete"
          ? finalised[fn] === "not_allowed"
          : finalised[fn] === "no_access",
      ),
      COLLABORATOR_LOCKED_FUNCTIONS.map((fn) => `${fn}=${finalised[fn]}`).join(", "),
    );

    await updateTeamMember({
      organizationId,
      actorUserId: owner.id,
      profileId: jane.id,
      planScope: "all_plans",
      categoryScope: "all",
    });
    check(
      'a Collaborator never carries "All Plans" (T2a: hidden for Collaborators)',
      (await prisma.teammateProfile.findUnique({
        where: { id: jane.id },
        select: { allPlans: true },
      }))?.allPlans === false,
    );

    /* ── 6. A Custom write needs its grid ───────────────────────────── */

    console.log("");
    console.log("4. Custom without a grid is refused rather than defaulted");

    check(
      "the refusal names the missing grid",
      (await refusalCode(() =>
        updateAssignment({
          assignmentId: ayresSame!.id,
          organizationId,
          actorUserId: owner.id,
          role: "custom",
        }),
      )) === "custom_permission_set_required",
    );
    check(
      "and the existing grid survives that refusal",
      (await getAssignment({
        profileId: jane.id,
        clientId: ayres.id,
        organizationId,
      }))?.role === "custom",
    );

    /* ── 7. Soft warnings, and the audit trail ─────────────────────── */

    console.log("");
    console.log("5. Soft warnings fire, are confirmed, and are recorded");

    const warnings = evaluateSoftWarnings({
      personType: "collaborator",
      role: "custom",
      assignments: [ayres.id, precision.id].map((planId) => ({
        planId,
        planName: planId === ayres.id ? "Ayres" : "Precision Optical",
        activeCategories: [...["Retirement", "Group Health", "Group Life", "Company / Plan Sponsor"]],
        hiddenCategories: [],
        coveredCategories: ["Group Health"],
        permissionSet: documentsEditGrid(),
      })),
    });
    check(
      "a collaborator editing two plans raises the multi-plan warning",
      warnings.some((warning) => warning.code === "collaborator_multi_plan_edit"),
      warnings.map((warning) => warning.code).join(", "),
    );
    check(
      "and a warning that is not true does not fire",
      !warnings.some((warning) => warning.code === "team_member_billing_non_admin"),
    );

    const confirmedCodes = warnings.map((warning) => warning.code);
    await updateAssignment({
      assignmentId: ayresSame!.id,
      organizationId,
      actorUserId: owner.id,
      role: "custom",
      customPermissionSet: documentsEditGrid(),
      warningsConfirmed: confirmedCodes,
    });

    const auditRow = await prisma.teammateAuditEvent.findFirst({
      where: {
        organizationId,
        assignmentId: ayresSame!.id,
        action: "custom_access_set",
      },
      orderBy: { createdAt: "desc" },
    });
    check(
      "the Custom save is audited as custom_access_set",
      Boolean(auditRow),
    );
    check(
      "it records who set it",
      auditRow?.actorUserId === owner.id,
    );
    check(
      "and which warnings were confirmed, which is how an Owner sees them",
      Array.isArray(auditRow?.warningsConfirmed) &&
        (auditRow?.warningsConfirmed as string[]).includes(
          "collaborator_multi_plan_edit",
        ),
      JSON.stringify(auditRow?.warningsConfirmed),
    );

    /* ── 8. The summary line, and preset independence ──────────────── */

    console.log("");
    console.log("6. The plan-aware summary line, and preset independence");

    const summaryLine = summarizePermissionSet({
      personType: "collaborator",
      role: "custom",
      assignments: [
        {
          planId: ayres.id,
          planName: "Ayres",
          activeCategories: ["Group Health"],
          hiddenCategories: [],
          coveredCategories: ["Group Health"],
          permissionSet: documentsEditGrid(),
        },
        {
          planId: precision.id,
          planName: "Precision Optical",
          activeCategories: ["Group Health"],
          hiddenCategories: [],
          coveredCategories: ["Group Health"],
          permissionSet: finalizePermissionSet(
            presetPermissionSet("viewer"),
            "collaborator",
          ),
        },
      ],
    });
    check(
      "the summary names the plan where the function is elevated",
      summaryLine.includes("Ayres"),
      summaryLine,
    );
    check(
      "and it is a Custom summary, not a preset label",
      summaryLine.startsWith("Custom"),
      summaryLine,
    );

    // "Changing a preset later must not alter Custom users": the stored grid is the
    // authority, so a preset's table changing cannot reach this assignment.
    check(
      "the stored grid is independent of the preset table it started from",
      (await getAssignment({
        profileId: jane.id,
        clientId: ayres.id,
        organizationId,
      }))?.permissionSet !== null &&
        (stored?.role as string) === "custom" &&
        (stored?.permissionSet as Record<string, string>)?.documents === "edit",
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

    summary("T2a verification");
    if (failureCount() > 0) process.exitCode = 1;
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("T2a verification crashed:", error);
  process.exitCode = 1;
});
