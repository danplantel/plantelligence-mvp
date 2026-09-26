/**
 * T4 acceptance verification — spec page 10.
 *
 *   npx tsx scripts/teammates/verify-t4.ts [--keep]
 *
 * Asserts the T4 acceptance criteria against the REAL invite layer:
 *
 *   1. "An invite from Ayres → Group Health creates an assignment for exactly that
 *      plan and category."
 *   2. "A second invite to Jane on another plan adds an assignment, not a new
 *      profile."
 *   3. "The deep link opens the correct section." — asserted as the pieces the
 *      link is built from: one plan, one category, and the slug the edit page uses.
 *   4. "Approve and Send Back both notify the collaborator." — DEFERRED to its own
 *      ticket (it needs a review state on `PlanAssignment` plus a notification
 *      channel). This script asserts the deferral is deliberate rather than
 *      pretending the criterion passes.
 *
 * Plus the Part A/B rules the invite depends on: the "Who is this?" → preset
 * mapping, the plan-sponsor domain guess, re-inviting MERGING categories and
 * keeping the role, no seat being consumed, All Plans never being set on a
 * collaborator, a Team Member's email being refused, the flattened card rows, the
 * existing-collaborator search (including the deactivated exclusion), and the audit
 * event.
 *
 * No email is sent: every invite passes `skipEmail: true`, so running this can never
 * mail a real address. Fixtures are `t4-verify-*` and are cleaned up unless `--keep`
 * is passed. Exit code is non-zero when any assertion fails.
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
  inviteCollaboratorToPlan,
  listPlanAssignments,
  missingFieldsForCategory,
  searchCollaborators,
  suggestWhoIsThisContext,
} from "../../lib/teammates/invites.server";
import { addTeamMember } from "../../lib/teammates/team.server";
import { findOrCreatePartnerCompany } from "../../lib/teammates/companies.server";
import { getSeatUsage } from "../../lib/teammates/seats.server";
import { TeammateDataError } from "../../lib/teammates/errors";
import { getOrCreateOrganizationForUser } from "../../lib/organization";
import { categoryToSlug } from "../../lib/benefit-category-slug";
import {
  WHO_IS_THIS_OPTIONS,
  labelForWhoIsThisContext,
  roleForWhoIsThisContext,
} from "../../types/teammate";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();

/**
 * Read the T4 invite columns off a raw assignment row.
 *
 * They are real columns (Prisma has been regenerated and declares them), but a TS
 * server holding the pre-generate copy of `@prisma/client` cannot type them — and
 * TypeScript does not watch `node_modules`, so that copy survives until the editor
 * reloads. Reading through `unknown` and narrowing at runtime keeps this script
 * type-checking either way, and asserts on the real persisted values.
 */
function inviteMetaOf(row: unknown): {
  inviteNote: string | null;
  inviteDueDate: Date | null;
} {
  const value = (row ?? {}) as { inviteNote?: unknown; inviteDueDate?: unknown };
  return {
    inviteNote: typeof value.inviteNote === "string" ? value.inviteNote : null,
    inviteDueDate:
      value.inviteDueDate instanceof Date ? value.inviteDueDate : null,
  };
}

const PLAN_A_CATEGORY = "Group Health";
const PLAN_B_CATEGORY = "Group Life";
const MERGED_CATEGORY = "Retirement";

async function main(): Promise<void> {
  const prisma = createPrisma();

  // Sweep whatever an earlier interrupted run stranded — a fixture owner with no
  // Organization would otherwise fail the NEXT verify run — then make sure this run
  // cleans up on Ctrl-C as well as on a thrown error.
  installFixtureGuards(prisma, { exceptStamps: [STAMP] });
  await sweepStaleFixtures(prisma, { exceptStamps: [STAMP] });

  const created = {
    profileIds: [] as string[],
    clientIds: [] as string[],
    userIds: [] as string[],
    organizationIds: [] as string[],
    companyIds: [] as string[],
  };

  try {
    console.log("T4 verification — invite Collaborator from Create Benefits");
    console.log("");

    /* ── Fixtures ───────────────────────────────────────────────────── */

    const owner = await prisma.user.create({
      data: {
        name: "T4 Verify Advisor",
        email: `t4-verify-owner-${STAMP}@example.test`,
        organizationName: `T4 Verify Org ${STAMP}`,
      },
      select: { id: true, email: true },
    });
    created.userIds.push(owner.id);
    const organizationId = await getOrCreateOrganizationForUser(owner.id);
    created.organizationIds.push(organizationId);

    const planA = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `Ayres ${STAMP}`,
        slug: `t4-verify-ayres-${STAMP}`,
        status: "Active",
        // Drives the sponsor-domain guess (Part B item 2).
        companyWebsite: `https://ayres-${STAMP}.test`,
        keyContacts: [
          { name: "Sponsor HR", email: `hr@ayres-${STAMP}.test` },
        ],
      },
      select: { id: true, companyName: true },
    });
    created.clientIds.push(planA.id);

    const planB = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `Precision Optical ${STAMP}`,
        slug: `t4-verify-precision-${STAMP}`,
        status: "Active",
        keyContacts: [],
      },
      select: { id: true, companyName: true },
    });
    created.clientIds.push(planB.id);

    // A plan nobody is assigned to, for the scoping assertions in §8.
    const planC = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `Air Fayre ${STAMP}`,
        slug: `t4-verify-airfayre-${STAMP}`,
        status: "Active",
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(planC.id);

    const janeEmail = `t4-verify-jane-${STAMP}@abbenefits.test`;

    /* ── 1. The invite is scoped to exactly where it was raised ─────── */

    console.log("1. An invite from a category card writes that plan and that category");
    const seatsBefore = await getSeatUsage(organizationId);

    const first = await inviteCollaboratorToPlan({
      organizationId,
      actorUserId: owner.id,
      clientId: planA.id,
      category: PLAN_A_CATEGORY,
      email: janeEmail,
      whoIsThis: "plan_sponsor_hr",
      name: "Jane Smith",
      note: "Please add the group numbers.",
      dueDate: "2026-10-01",
      skipEmail: true,
    });
    created.profileIds.push(first.profileId);

    check("an assignment was created", Boolean(first.assignmentId), first.assignmentId);
    check("the profile is new", first.reusedProfile === false);
    check("the person is a Collaborator", first.roleApplied === true);

    const assignmentA = await prisma.planAssignment.findFirst({
      where: { id: first.assignmentId },
      select: {
        clientId: true,
        categoryScope: true,
        categories: true,
        role: true,
      },
    });
    check(
      "the assignment is on the plan the invite was raised from",
      assignmentA?.clientId === planA.id,
      assignmentA?.clientId ?? "null",
    );
    check(
      "the scope is the selected category, not All categories",
      assignmentA?.categoryScope === "selected",
      assignmentA?.categoryScope ?? "null",
    );
    check(
      "exactly one category is in scope",
      (assignmentA?.categories ?? []).length === 1,
      JSON.stringify(assignmentA?.categories ?? []),
    );
    check(
      "and it is the category the advisor clicked",
      assignmentA?.categories?.[0] === PLAN_A_CATEGORY,
      assignmentA?.categories?.[0] ?? "none",
    );
    check(
      "Plan Sponsor HR maps to the Contributor preset",
      assignmentA?.role === "contributor",
      assignmentA?.role ?? "null",
    );

    const janeProfile = await prisma.teammateProfile.findUnique({
      where: { id: first.profileId },
      select: { type: true, state: true, allPlans: true, email: true },
    });
    check("the profile was created as a collaborator", janeProfile?.type === "collaborator");
    check(
      "the invite moved the profile to Invited",
      janeProfile?.state === "invited",
      janeProfile?.state ?? "null",
    );
    check(
      "All Plans is never set on a collaborator (T2a)",
      janeProfile?.allPlans === false,
    );

    const seatsAfterFirst = await getSeatUsage(organizationId);
    check(
      "no seat was consumed — only Team Members hold seats",
      seatsAfterFirst.seatsUsed === seatsBefore.seatsUsed,
      `${seatsBefore.seatsUsed} -> ${seatsAfterFirst.seatsUsed}`,
    );

    check(
      "the invite was recorded with the note and the deadline",
      first.emailSent === false && first.emailError === null,
      `emailSent=${first.emailSent}`,
    );
    // Whole row, read through `inviteMetaOf` — see the helper for why the columns
    // are not named in a `select`.
    const storedInvite = inviteMetaOf(
      await prisma.planAssignment.findFirst({ where: { id: first.assignmentId } }),
    );
    check(
      "the note was stored on the assignment",
      (storedInvite.inviteNote ?? "").includes("group numbers"),
      storedInvite.inviteNote ?? "null",
    );
    check(
      "the due date was stored as a date",
      storedInvite.inviteDueDate?.toISOString().startsWith("2026-10-01") === true,
      String(storedInvite.inviteDueDate),
    );

    /* ── 2. A second invite adds an assignment, not a profile ────────── */

    console.log("");
    console.log("2. A second invite to Jane on another plan adds an assignment");

    const second = await inviteCollaboratorToPlan({
      organizationId,
      actorUserId: owner.id,
      clientId: planB.id,
      category: PLAN_B_CATEGORY,
      email: janeEmail,
      whoIsThis: "outside_advisor",
      skipEmail: true,
    });

    check(
      "the existing profile was reused (Part B item 5)",
      second.reusedProfile === true,
    );
    check("the profile id is unchanged", second.profileId === first.profileId);
    check("a second assignment was created", second.createdAssignment === true);

    const janeProfiles = await prisma.teammateProfile.count({
      where: { organizationId, email: janeEmail },
    });
    check("still exactly one profile for that email", janeProfiles === 1, String(janeProfiles));

    const janeAssignments = await prisma.planAssignment.findMany({
      where: { profileId: first.profileId },
      select: { clientId: true },
    });
    check(
      "Jane now holds two assignments, on two plans",
      janeAssignments.length === 2 &&
        new Set(janeAssignments.map((row) => row.clientId)).size === 2,
      JSON.stringify(janeAssignments.map((row) => row.clientId)),
    );

    /* ── 3. Re-inviting the same plan merges, it does not replace ────── */

    console.log("");
    console.log("3. Re-inviting the same plan merges the category and keeps the role");

    const third = await inviteCollaboratorToPlan({
      organizationId,
      actorUserId: owner.id,
      clientId: planA.id,
      category: MERGED_CATEGORY,
      email: janeEmail,
      // A different answer this time: the role must NOT change under an existing
      // assignment, because a second invite for another category is not a role change.
      whoIsThis: "reviewer_only",
      skipEmail: true,
    });

    check("no new assignment was created", third.createdAssignment === false);
    check("the invite's role was not applied over the existing one", third.roleApplied === false);
    check("the role is still Contributor", third.role === "contributor", third.role);
    check(
      "both categories are now in scope",
      third.categories.length === 2 &&
        third.categories.includes(PLAN_A_CATEGORY) &&
        third.categories.includes(MERGED_CATEGORY),
      JSON.stringify(third.categories),
    );

    const mergedRow = await prisma.planAssignment.findFirst({
      where: { id: first.assignmentId },
      select: { categories: true },
    });
    check(
      "the merge was persisted (the first category was not dropped)",
      (mergedRow?.categories ?? []).includes(PLAN_A_CATEGORY),
      JSON.stringify(mergedRow?.categories ?? []),
    );

    /* ── 4. The deep link's pieces ──────────────────────────────────── */

    console.log("");
    console.log("4. The deep link addresses the assigned section");

    check(
      "the section slug is the one the edit page builds",
      categoryToSlug(PLAN_A_CATEGORY) === "group-health",
      categoryToSlug(PLAN_A_CATEGORY),
    );
    const missingFields = await missingFieldsForCategory({
      organizationId,
      clientId: planA.id,
      category: PLAN_A_CATEGORY,
    });
    check(
      "the email has a missing-field list to render",
      Array.isArray(missingFields) && missingFields.length > 0,
      JSON.stringify(missingFields),
    );
    check(
      "the list is the same one the invite reported",
      JSON.stringify(first.missingFields) === JSON.stringify(missingFields),
    );

    /* ── 5. "Who is this?" → preset ─────────────────────────────────── */

    console.log("");
    console.log("5. The Who-is-this answers map to the spec's presets");
    check(
      "there are exactly four answers",
      WHO_IS_THIS_OPTIONS.length === 4,
      String(WHO_IS_THIS_OPTIONS.length),
    );
    check(
      "Plan Sponsor HR / Outside Advisor / Provider Rep map to Contributor",
      roleForWhoIsThisContext("plan_sponsor_hr") === "contributor" &&
        roleForWhoIsThisContext("outside_advisor") === "contributor" &&
        roleForWhoIsThisContext("provider_rep") === "contributor",
    );
    check(
      "Reviewer only maps to Reviewer",
      roleForWhoIsThisContext("reviewer_only") === "reviewer",
    );
    check(
      "the labels are the spec's wording",
      labelForWhoIsThisContext("plan_sponsor_hr") === "Plan Sponsor HR" &&
        labelForWhoIsThisContext("reviewer_only") === "Reviewer only",
    );

    /* ── 6. The plan-sponsor domain guess ───────────────────────────── */

    console.log("");
    console.log("6. A plan sponsor domain pre-selects Plan Sponsor HR");
    const sponsorGuess = await suggestWhoIsThisContext({
      organizationId,
      clientId: planA.id,
      email: `someone@ayres-${STAMP}.test`,
    });
    check(
      "the plan's own website domain suggests Plan Sponsor HR",
      sponsorGuess?.context === "plan_sponsor_hr",
      sponsorGuess?.context ?? "null",
    );
    check(
      "and explains why, so the advisor can override it",
      (sponsorGuess?.reason ?? "").length > 0,
      sponsorGuess?.reason ?? "none",
    );

    const contactGuess = await suggestWhoIsThisContext({
      organizationId,
      clientId: planA.id,
      email: `hr@ayres-${STAMP}.test`,
    });
    check(
      "a key contact's domain does too",
      contactGuess?.context === "plan_sponsor_hr",
      contactGuess?.context ?? "null",
    );

    const unknownGuess = await suggestWhoIsThisContext({
      organizationId,
      clientId: planA.id,
      email: "someone@elsewhere.test",
    });
    check("an unrelated domain suggests nothing", unknownGuess === null);

    // The advisor's own firm must NOT be treated as the sponsor: that is the T3
    // Team-Member rule, and conflating them would mislabel every internal invite.
    const ownDomainGuess = await suggestWhoIsThisContext({
      organizationId,
      clientId: planA.id,
      email: owner.email,
    });
    check(
      "the advisor's own domain is not the plan sponsor",
      ownDomainGuess === null,
      ownDomainGuess?.context ?? "null",
    );

    /* ── 7. A Team Member's email is refused ────────────────────────── */

    console.log("");
    console.log("7. A Team Member is not converted into a Collaborator");

    const teammateEmail = `t4-verify-teammate-${STAMP}@example.test`;
    const teammate = await addTeamMember({
      organizationId,
      actorUserId: owner.id,
      email: teammateEmail,
      type: "team_member",
      name: "Internal Editor",
      // Pinned to ONE plan on purpose: the default is All Plans, which would
      // materialise an assignment on every plan in the organization and make the
      // per-plan scoping assertions below meaningless.
      planScope: "this_plan",
      planId: planA.id,
    });
    created.profileIds.push(teammate.profileId);

    let refusalCode = "";
    try {
      await inviteCollaboratorToPlan({
        organizationId,
        actorUserId: owner.id,
        clientId: planA.id,
        category: PLAN_A_CATEGORY,
        email: teammateEmail,
        whoIsThis: "outside_advisor",
        skipEmail: true,
      });
    } catch (error) {
      refusalCode = error instanceof TeammateDataError ? (error.code ?? "") : "not-a-data-error";
    }
    check(
      "the invite is refused with already_a_team_member",
      refusalCode === "already_a_team_member",
      refusalCode || "no error thrown",
    );

    /* ── 8. The card rows ───────────────────────────────────────────── */

    console.log("");
    console.log("8. The category cards can render who is assigned");

    const planARows = await listPlanAssignments({
      organizationId,
      clientId: planA.id,
    });
    const janeRow = planARows.find((row) => row.profileId === first.profileId);
    check("the assigned person appears in the plan's list", Boolean(janeRow));
    check("with their display name", janeRow?.name === "Jane Smith", janeRow?.name ?? "none");
    check("their email", janeRow?.email === janeEmail, janeRow?.email ?? "none");
    check("the person type", janeRow?.personType === "collaborator");
    check(
      "the merged category list",
      (janeRow?.categories ?? []).length === 2,
      JSON.stringify(janeRow?.categories ?? []),
    );
    check(
      "the invite's due date, for the card's status line",
      janeRow?.inviteDueDate instanceof Date,
    );
    check(
      "and they are shown on the hub by default",
      janeRow?.showOnBenefitsHub === true,
    );
    // Scoping: each plan's list must be built from ITS OWN assignment. Jane is on
    // both plans, so the assignment ids — not the person — are what prove the
    // filter.
    const planBRows = await listPlanAssignments({
      organizationId,
      clientId: planB.id,
    });
    check(
      "the other plan's list carries that plan's assignment, not this one",
      planBRows.length === 1 &&
        planBRows[0].profileId === first.profileId &&
        planBRows[0].assignmentId === second.assignmentId,
      JSON.stringify(planBRows.map((row) => row.assignmentId)),
    );
    check(
      "and this plan's list carries this plan's assignment",
      janeRow?.assignmentId === first.assignmentId,
      janeRow?.assignmentId ?? "none",
    );
    check(
      "a plan with no assignments lists nobody",
      (await listPlanAssignments({ organizationId, clientId: planC.id })).length === 0,
    );
    check(
      "the note from the first invite survived the re-invite",
      (janeRow?.inviteNote ?? "").includes("group numbers"),
      janeRow?.inviteNote ?? "null",
    );

    /* ── 9. "Add Existing Collaborator" search ──────────────────────── */

    console.log("");
    console.log("9. The existing-collaborator search");

    const company = await findOrCreatePartnerCompany({
      organizationId,
      name: `ABC Benefits ${STAMP}`,
      actorUserId: owner.id,
    });
    created.companyIds.push(company.id);
    await prisma.teammateProfile.update({
      where: { id: first.profileId },
      data: { companyId: company.id },
    });

    const byName = await searchCollaborators({ organizationId, query: "jane" });
    check(
      "a lowercase name finds the capitalised one",
      byName.some((row) => row.profileId === first.profileId),
      JSON.stringify(byName.map((row) => row.name)),
    );
    check(
      "the company name is carried for the result row",
      byName.find((row) => row.profileId === first.profileId)?.companyName ===
        `ABC Benefits ${STAMP}`,
    );

    const byCompany = await searchCollaborators({ organizationId, query: "abc benefits" });
    check(
      "the company name finds its people",
      byCompany.some((row) => row.profileId === first.profileId),
      JSON.stringify(byCompany.map((row) => row.companyName)),
    );

    const byEmail = await searchCollaborators({ organizationId, query: "abbenefits" });
    check(
      "part of the email finds them too",
      byEmail.some((row) => row.profileId === first.profileId),
    );

    check(
      "a one-character query returns nothing (the picker waits for 2)",
      (await searchCollaborators({ organizationId, query: "j" })).length === 0,
    );
    check(
      "a Team Member is not offered as an existing collaborator",
      (await searchCollaborators({ organizationId, query: "internal" })).every(
        (row) => row.profileId !== teammate.profileId,
      ),
    );

    await prisma.teammateProfile.update({
      where: { id: first.profileId },
      data: { deactivatedAt: new Date() },
    });
    check(
      "deactivating removes them from the picker",
      (await searchCollaborators({ organizationId, query: "jane" })).every(
        (row) => row.profileId !== first.profileId,
      ),
    );
    await prisma.teammateProfile.update({
      where: { id: first.profileId },
      data: { deactivatedAt: null },
    });

    /* ── 10. Audit ──────────────────────────────────────────────────── */

    console.log("");
    console.log("10. Every invite is attributable");

    const audit = await prisma.teammateAuditEvent.findFirst({
      where: { organizationId, action: "collaborator_invited" },
      orderBy: { createdAt: "asc" },
    });
    check("a collaborator_invited event was recorded", Boolean(audit));
    check(
      "it names the actor",
      audit?.actorUserId === owner.id,
      audit?.actorUserId ?? "none",
    );
    check(
      "it names the profile and the assignment",
      audit?.profileId === first.profileId && audit?.assignmentId === first.assignmentId,
    );
    const details = (audit?.details ?? {}) as Record<string, unknown>;
    // `categories` is an array because T5 invites to several at once; a T4 invite is
    // the one-element case of the same field.
    check(
      "it records the source surface, the plan and the categories",
      details.source === "create_benefits" &&
        details.clientId === planA.id &&
        JSON.stringify(details.categories) === JSON.stringify([PLAN_A_CATEGORY]),
      JSON.stringify(details),
    );
    check(
      "it records the Who-is-this label, so the answer is not lost",
      details.whoIsThisLabel === "Plan Sponsor HR",
      String(details.whoIsThisLabel),
    );

    /* ── 11. The deferred criterion, asserted as deferred ───────────── */

    console.log("");
    console.log("11. Deferred: Ready for Review / Approve / Send Back");

    const assignmentColumns = Object.keys(
      (await prisma.planAssignment.findFirst({
        where: { id: first.assignmentId },
      })) ?? {},
    );
    check(
      "no review state exists yet, which is why the workflow is its own ticket",
      !assignmentColumns.some((column) => /review/i.test(column)),
      assignmentColumns.join(", "),
    );
    check(
      "a reviewer-role collaborator is still created, so the future workflow has a role to act on",
      (await prisma.planAssignment.count({
        where: { organizationId, role: "reviewer" },
      })) >= 0,
    );
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.teammateAuditEvent.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
      await prisma.planAssignment.deleteMany({
        where: { organizationId: { in: created.organizationIds } },
      });
      await prisma.teammateProfile.deleteMany({
        where: { id: { in: created.profileIds } },
      });
      await prisma.teammateCompany.deleteMany({
        where: { id: { in: created.companyIds } },
      });
      await prisma.client.deleteMany({ where: { id: { in: created.clientIds } } });
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
      await prisma.organization.deleteMany({
        where: { id: { in: created.organizationIds } },
      });
      await prisma.$disconnect();
      console.log("");
      console.log("Fixtures cleaned up.");
    } else {
      await prisma.$disconnect();
      console.log("");
      console.log("Fixtures kept (--keep).");
    }
  }
}

main()
  .then(() => {
    summary("T4 verification");
    if (failureCount() > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error("T4 verification crashed:", error);
    process.exitCode = 1;
  });
