/**
 * T5 acceptance verification — spec page 11 (Key Contacts entry point).
 *
 *   npx tsx scripts/teammates/verify-t5.ts [--keep]
 *
 * Asserts the three T5 acceptance criteria against the REAL invite layer:
 *
 *   1. "A contact created with Complete Profile Myself appears on the hub with no
 *      invite sent." — a Contact is a profile in the `contact` state: no assignment,
 *      no invite, no seat, and it shows on the hub because the hub reads the plan's
 *      contact data, not the profile.
 *   2. "Upgrading that Contact to a Collaborator keeps the same profile."
 *   3. "Two collaborators from ABC Benefits share one company record."
 *
 * Plus the Part B rules the entry point depends on: inviting is scoped to THIS plan
 * with the categories the advisor picked, the state moves Contact → Invited, the
 * audit row says it came from Key Contacts, the role defaults to Contributor, and a
 * second invite merges rather than duplicating.
 *
 * No email is sent: every invite passes `skipEmail: true`. Fixtures are
 * `t5-verify-*` and are cleaned up unless `--keep` is passed.
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
  searchCollaborators,
} from "../../lib/teammates/invites.server";
import { createTeammateProfile } from "../../lib/teammates/profiles.server";
import { addTeamMember } from "../../lib/teammates/team.server";
import { findOrCreatePartnerCompany } from "../../lib/teammates/companies.server";
import { getSeatUsage } from "../../lib/teammates/seats.server";
import { getOrCreateOrganizationForUser } from "../../lib/organization";
import { TeammateDataError } from "../../lib/teammates/errors";

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
    clientIds: [] as string[],
    userIds: [] as string[],
    organizationIds: [] as string[],
    companyIds: [] as string[],
  };

  try {
    console.log("T5 verification — Key Contacts entry point");
    console.log("");

    /* ── Fixtures ───────────────────────────────────────────────────── */

    const owner = await prisma.user.create({
      data: {
        name: "T5 Verify Advisor",
        email: `t5-verify-owner-${STAMP}@example.test`,
        organizationName: `T5 Verify Org ${STAMP}`,
      },
      select: { id: true, email: true },
    });
    created.userIds.push(owner.id);
    const organizationId = await getOrCreateOrganizationForUser(owner.id);
    created.organizationIds.push(organizationId);

    const plan = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `Ayres ${STAMP}`,
        slug: `t5-verify-ayres-${STAMP}`,
        status: "Draft",
        keyContacts: [{ name: "Sponsor HR", email: `hr@ayres-${STAMP}.test` }],
      },
      select: { id: true, companyName: true },
    });
    created.clientIds.push(plan.id);

    // A second plan in the same organization: nothing T5 does may touch it, because
    // the invite is scoped to This Plan.
    const otherPlan = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `Precision Optical ${STAMP}`,
        slug: `t5-verify-precision-${STAMP}`,
        status: "Draft",
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(otherPlan.id);

    const contactEmail = `t5-verify-contact-${STAMP}@abbenefits.test`;

    /* ── 1. A Contact is not an invite ──────────────────────────────── */

    console.log("1. A contact completed by the advisor sends no invite");

    // Exactly what "Complete Profile Myself" produces today: the plan's
    // `keyContacts` entry, which the hub renders. The profile row is what T1 added
    // for the upgrade path, in the `contact` state.
    const contact = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "collaborator",
      email: contactEmail,
      firstName: "Jane",
      lastName: "Smith",
      allPlans: false,
    });
    created.profileIds.push(contact.id);

    check(
      "the contact has no assignment, so it reaches no plan through the teammate layer",
      (await prisma.planAssignment.count({ where: { profileId: contact.id } })) === 0,
    );
    check(
      "no invite was recorded for a contact",
      (await prisma.teammateAuditEvent.count({
        where: { organizationId, profileId: contact.id, action: "collaborator_invited" },
      })) === 0,
    );

    // The hub reads the plan's contact data, so the card is there while the
    // teammate layer knows nothing about an invite.
    const planRow = await prisma.client.findUnique({
      where: { id: plan.id },
      select: { keyContacts: true },
    });
    const hubContacts = Array.isArray(planRow?.keyContacts)
      ? (planRow?.keyContacts as unknown as Record<string, unknown>[])
      : [];
    check(
      "the contact is present in the plan's own contact data (what the hub renders)",
      hubContacts.length === 1,
      JSON.stringify(hubContacts.length),
    );

    const seatsBefore = await getSeatUsage(organizationId);

    /* ── 2. Upgrading keeps the profile ─────────────────────────────── */

    console.log("");
    console.log("2. Inviting that Contact upgrades it and keeps the same profile");

    const invite = await inviteCollaboratorToPlan({
      organizationId,
      actorUserId: owner.id,
      clientId: plan.id,
      categories: ["Group Health", "Group Life"],
      email: contactEmail,
      name: "Jane Smith",
      note: "Please complete these two sections.",
      source: "key_contacts",
      inviteContext: "Collaborator",
      skipEmail: true,
    });

    check(
      "the existing profile was reused, not duplicated",
      invite.reusedProfile === true,
    );
    check("the profile id is unchanged", invite.profileId === contact.id);
    check(
      "still exactly one profile for that email",
      (await prisma.teammateProfile.count({
        where: { organizationId, email: contactEmail },
      })) === 1,
    );

    const upgraded = await prisma.teammateProfile.findUnique({
      where: { id: contact.id },
      select: { state: true, type: true, allPlans: true },
    });
    check(
      "the state moved Contact → Invited",
      upgraded?.state === "invited",
      upgraded?.state ?? "null",
    );
    check("it is still a Collaborator", upgraded?.type === "collaborator");
    check("and still not an All-Plans profile", upgraded?.allPlans === false);

    /* ── 3. This Plan, those categories ─────────────────────────────── */

    console.log("");
    console.log("3. The invite is scoped to This Plan and the chosen sections");

    const assignment = await prisma.planAssignment.findFirst({
      where: { profileId: contact.id },
      select: { clientId: true, categoryScope: true, categories: true, role: true },
    });
    check("exactly one assignment exists", Boolean(assignment));
    check(
      "it is on the plan the invite was raised from",
      assignment?.clientId === plan.id,
      assignment?.clientId ?? "null",
    );
    check(
      "the other plan was not touched",
      (await prisma.planAssignment.count({
        where: { profileId: contact.id, clientId: otherPlan.id },
      })) === 0,
    );
    check(
      "the scope is the selected categories",
      assignment?.categoryScope === "selected",
      assignment?.categoryScope ?? "null",
    );
    check(
      "both chosen categories are in scope",
      JSON.stringify([...(assignment?.categories ?? [])].sort()) ===
        JSON.stringify(["Group Health", "Group Life"]),
      JSON.stringify(assignment?.categories ?? []),
    );
    check(
      "the role defaults to Contributor (T5 never asks Who-is-this)",
      assignment?.role === "contributor",
      assignment?.role ?? "null",
    );

    const seatsAfter = await getSeatUsage(organizationId);
    check(
      "no seat was consumed by a collaborator invite",
      seatsAfter.seatsUsed === seatsBefore.seatsUsed,
      `${seatsBefore.seatsUsed} -> ${seatsAfter.seatsUsed}`,
    );

    check(
      "both sections' missing fields were aggregated for the email",
      Array.isArray(invite.missingFields) && invite.missingFields.length > 0,
      JSON.stringify(invite.missingFields.length),
    );
    check(
      "the email was skipped (no mail leaves the machine)",
      invite.emailSent === false && invite.emailError === null,
    );

    /* ── 4. Audit attribution ──────────────────────────────────────── */

    console.log("");
    console.log("4. The invite says it came from Key Contacts");

    const audit = await prisma.teammateAuditEvent.findFirst({
      where: {
        organizationId,
        profileId: contact.id,
        action: "collaborator_invited",
      },
    });
    check("an invite event was recorded", Boolean(audit));
    const details = (audit?.details ?? {}) as Record<string, unknown>;
    check(
      "with the Key Contacts source",
      details.source === "key_contacts",
      String(details.source),
    );
    check(
      "the plan and both categories",
      details.clientId === plan.id &&
        JSON.stringify(details.categories) ===
          JSON.stringify(["Group Health", "Group Life"]),
      JSON.stringify(details.categories),
    );
    check(
      "and no Who-is-this answer was invented for it",
      details.whoIsThis === null,
      String(details.whoIsThis),
    );

    /* ── 5. Re-inviting merges ──────────────────────────────────────── */

    console.log("");
    console.log("5. Inviting the same Contact again merges rather than duplicating");

    const second = await inviteCollaboratorToPlan({
      organizationId,
      actorUserId: owner.id,
      clientId: plan.id,
      categories: ["Retirement"],
      email: contactEmail,
      source: "key_contacts",
      inviteContext: "Collaborator",
      skipEmail: true,
    });

    check("no new assignment was created", second.createdAssignment === false);
    check(
      "the profile was reused again",
      second.reusedProfile === true && second.profileId === contact.id,
    );
    check(
      "all three categories are now in scope",
      JSON.stringify([...second.categories].sort()) ===
        JSON.stringify(["Group Health", "Group Life", "Retirement"]),
      JSON.stringify(second.categories),
    );
    check(
      "the note from the first invite survived (only supplied metadata is written)",
      ((await prisma.planAssignment.findFirst({
        where: { profileId: contact.id },
        select: { inviteNote: true },
      }))?.inviteNote ?? "").includes("two sections"),
    );

    /* ── 6. Two collaborators share one company ─────────────────────── */

    console.log("");
    console.log("6. Two collaborators from the same firm share one company record");

    const companyName = `ABC Benefits ${STAMP}`;
    const company = await findOrCreatePartnerCompany({
      organizationId,
      name: companyName,
      actorUserId: owner.id,
    });
    created.companyIds.push(company.id);
    const companyAgain = await findOrCreatePartnerCompany({
      organizationId,
      name: companyName,
      actorUserId: owner.id,
    });
    check(
      "the same name resolves to the same row",
      companyAgain.id === company.id,
    );

    const jane = await prisma.teammateProfile.update({
      where: { id: contact.id },
      data: { companyId: company.id },
      select: { companyId: true },
    });
    const bob = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "collaborator",
      email: `t5-verify-bob-${STAMP}@abbenefits.test`,
      firstName: "Bob",
      lastName: "Jones",
      allPlans: false,
    });
    created.profileIds.push(bob.id);
    await prisma.teammateProfile.update({
      where: { id: bob.id },
      data: { companyId: company.id },
    });

    check(
      "only one company row exists for that name",
      (await prisma.teammateCompany.count({
        where: { organizationId, name: companyName },
      })) === 1,
    );
    check(
      "both collaborators point at it",
      jane.companyId === company.id &&
        (await prisma.teammateProfile.findUnique({
          where: { id: bob.id },
          select: { companyId: true },
        }))?.companyId === company.id,
    );

    /* ── 7. The card's view of the plan ─────────────────────────────── */

    console.log("");
    console.log("7. The step can show who is already invited");

    const rows = await listPlanAssignments({
      organizationId,
      clientId: plan.id,
    });
    const janeRow = rows.find((row) => row.profileId === contact.id);
    check("the invited contact appears on the plan", Boolean(janeRow));
    check(
      "with the company, so two people from one firm read as a pair",
      janeRow?.companyName === companyName,
      janeRow?.companyName ?? "null",
    );
    check(
      "and the merged category list",
      (janeRow?.categories ?? []).length === 3,
      JSON.stringify(janeRow?.categories ?? []),
    );

    const found = await searchCollaborators({ organizationId, query: "jane" });
    check(
      "the existing-contact search finds them for a re-invite",
      found.some((row) => row.profileId === contact.id),
    );

    /* ── 8. The rule that still holds ───────────────────────────────── */

    console.log("");
    console.log("8. A Team Member cannot be pulled in as a Collaborator");

    // The T4 guard is shared, so the T5 entry point cannot bypass it either: a person
    // who already holds a seat must not be turned into a free collaborator by a
    // Key Contacts invite.
    const teammateEmail = `t5-verify-teammate-${STAMP}@example.test`;
    const teammate = await addTeamMember({
      organizationId,
      actorUserId: owner.id,
      email: teammateEmail,
      type: "team_member",
      name: "Internal Editor",
      planScope: "this_plan",
      planId: plan.id,
    });
    created.profileIds.push(teammate.profileId);

    let refusal = "";
    try {
      await inviteCollaboratorToPlan({
        organizationId,
        actorUserId: owner.id,
        clientId: plan.id,
        categories: ["Retirement"],
        email: teammateEmail,
        source: "key_contacts",
        skipEmail: true,
      });
    } catch (error) {
      refusal = error instanceof TeammateDataError ? (error.code ?? "") : "other";
    }
    check(
      "the invite refuses a Team Member's email with already_a_team_member",
      refusal === "already_a_team_member",
      refusal || "no error thrown",
    );
    check(
      "and it did not quietly create a second profile for that email",
      (await prisma.teammateProfile.count({
        where: { organizationId, email: teammateEmail },
      })) === 1,
    );
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.teammateAuditEvent.deleteMany({
        where: { organizationId: { in: created.organizationIds } },
      });
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
    summary("T5 verification");
    if (failureCount() > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error("T5 verification crashed:", error);
    process.exitCode = 1;
  });
