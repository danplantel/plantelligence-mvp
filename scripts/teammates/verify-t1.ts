/**
 * T1 acceptance verification — spec page 4.
 *
 *   npx tsx scripts/teammates/verify-t1.ts [--keep]
 *
 * Asserts the four T1 acceptance criteria through the REAL data layer:
 *   1. Jane holds assignments on three plans from one profile.
 *   2. Editing Jane's profile in Org A does not change her profile in Org B.
 *   3. Partner companies never appear in Plan Sponsor search.
 *   4. Two collaborators from ABC Benefits share one company record.
 *
 * It builds isolated fixtures (`t1-verify-*`, email-tagged with a timestamp),
 * runs the assertions, then deletes everything it created. Pass `--keep` to
 * inspect the fixtures afterwards.
 *
 * Exit code is non-zero when any assertion fails.
 */
import { check, createPrisma, failureCount, summary } from "./shared";
import {
  createTeammateProfile,
  findOrCreateProfile,
  getTeammateProfile,
  listTeammateProfiles,
  updateTeammateProfile,
} from "../../lib/teammates/profiles.server";
import {
  findOrCreatePartnerCompany,
  getPartnerCompany,
} from "../../lib/teammates/companies.server";
import {
  getAssignmentPermissionSet,
  listAssignmentsForProfile,
  upsertAssignment,
} from "../../lib/teammates/assignments.server";
import {
  isExcludedFromPlanSponsor,
  parseCompanySearchScope,
} from "../../lib/teammates/company-scope";
import { getOrCreateOrganizationForUser } from "../../lib/organization";
import { TeammateDataError } from "../../lib/teammates/errors";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();

async function main(): Promise<void> {
  const prisma = createPrisma();

  const created = {
    assignmentIds: [] as string[],
    profileIds: [] as string[],
    companyIds: [] as string[],
    clientIds: [] as string[],
    userIds: [] as string[],
    organizationIds: [] as string[],
  };

  try {
    console.log("T1 verification — Team & Collaborator Access data model");
    console.log("");

    /* ── Fixtures ───────────────────────────────────────────────────── */

    const userA = await prisma.user.create({
      data: {
        name: `T1 Verify A ${STAMP}`,
        email: `t1-verify-a-${STAMP}@example.test`,
        organizationName: `T1 Verify Org A ${STAMP}`,
      },
      select: { id: true },
    });
    created.userIds.push(userA.id);
    const orgA = await getOrCreateOrganizationForUser(userA.id);
    created.organizationIds.push(orgA);

    const userB = await prisma.user.create({
      data: {
        name: `T1 Verify B ${STAMP}`,
        email: `t1-verify-b-${STAMP}@example.test`,
        organizationName: `T1 Verify Org B ${STAMP}`,
      },
      select: { id: true },
    });
    created.userIds.push(userB.id);
    const orgB = await getOrCreateOrganizationForUser(userB.id);
    created.organizationIds.push(orgB);

    // Org A's three plans (the spec's example: Ayres, Precision Optical, Air Fayre).
    const planSeeds = ["Ayres", "Precision Optical", "Air Fayre"];
    const plans: { id: string }[] = [];
    for (const seed of planSeeds) {
      const client = await prisma.client.create({
        data: {
          userId: userA.id,
          organizationId: orgA,
          companyName: `t1-verify-${seed}-${STAMP}`,
          keyContacts: [],
        },
        select: { id: true },
      });
      created.clientIds.push(client.id);
      plans.push(client);
    }

    // One partner company, shared by two collaborators.
    const abc = await findOrCreatePartnerCompany({
      organizationId: orgA,
      name: "ABC Benefits",
      actorUserId: userA.id,
    });
    created.companyIds.push(abc.id);

    const janeEmail = `jane-${STAMP}@abc.test`;
    const jane = await createTeammateProfile({
      organizationId: orgA,
      actorUserId: userA.id,
      type: "collaborator",
      email: janeEmail,
      firstName: "Jane",
      lastName: "Smith",
      companyId: abc.id,
    });
    created.profileIds.push(jane.id);

    const bob = await createTeammateProfile({
      organizationId: orgA,
      actorUserId: userA.id,
      type: "collaborator",
      email: `bob-${STAMP}@abc.test`,
      firstName: "Bob",
      lastName: "Jones",
      companyId: abc.id,
    });
    created.profileIds.push(bob.id);

    // The same human being in a second organization: one login, two profiles.
    const janeInOrgB = await createTeammateProfile({
      organizationId: orgB,
      actorUserId: userB.id,
      type: "collaborator",
      email: janeEmail,
      firstName: "Jane",
      lastName: "Smith",
      phone: "+1 555 0000",
    });
    created.profileIds.push(janeInOrgB.id);

    for (const plan of plans) {
      const assignment = await upsertAssignment({
        organizationId: orgA,
        profileId: jane.id,
        clientId: plan.id,
        actorUserId: userA.id,
        role: "contributor",
      });
      created.assignmentIds.push(assignment.id);
    }

    /* ── Criterion 1 ────────────────────────────────────────────────── */

    console.log("1. Jane holds assignments on three plans from one profile");

    const janeAssignments = await listAssignmentsForProfile(jane.id, orgA);
    check(
      "three assignments exist",
      janeAssignments.length === 3,
      `got ${janeAssignments.length}`,
    );
    check(
      "assignments are spread across the three distinct plans",
      new Set(janeAssignments.map((a) => a.clientId)).size === 3,
    );

    const janeProfilesInOrgA = await listTeammateProfiles(orgA, {
      search: janeEmail,
    });
    check(
      "exactly one Jane profile exists in Org A",
      janeProfilesInOrgA.length === 1,
      `got ${janeProfilesInOrgA.length}`,
    );
    check(
      "that profile is the one holding the assignments",
      janeProfilesInOrgA[0]?.id === jane.id,
    );

    // The grid proves "store the full permission set on each assignment".
    const storedGrid = getAssignmentPermissionSet(janeAssignments[0]);
    check(
      "the full 14-function permission grid is stored on the assignment",
      Object.keys(storedGrid).length === 14,
      `got ${Object.keys(storedGrid).length}`,
    );
    check(
      "collaborator hard block survived persistence: Publish is Not Allowed",
      storedGrid.publish === "not_allowed",
    );
    check(
      "contributor preset applied: Documents is Edit",
      storedGrid.documents === "edit",
    );

    /* ── Criterion 2 ────────────────────────────────────────────────── */

    console.log("");
    console.log("2. Editing Jane's profile in Org A does not change her profile in Org B");

    await updateTeammateProfile({
      id: jane.id,
      organizationId: orgA,
      actorUserId: userA.id,
      data: { phone: "+1 555 1111" },
    });

    const janeAfterEditA = await getTeammateProfile(jane.id, orgA);
    const janeAfterEditB = await getTeammateProfile(janeInOrgB.id, orgB);
    check(
      "Org A profile reflects the edit",
      janeAfterEditA?.phone === "+1 555 1111",
      `got ${janeAfterEditA?.phone}`,
    );
    check(
      "Org B profile is untouched",
      janeAfterEditB?.phone === "+1 555 0000",
      `got ${janeAfterEditB?.phone}`,
    );
    check(
      "the two profiles are distinct rows",
      janeAfterEditA?.id !== janeAfterEditB?.id,
    );
    check(
      "Org B cannot read Org A's profile by id",
      (await getTeammateProfile(jane.id, orgB)) === null,
    );

    /* ── Criterion 3 ────────────────────────────────────────────────── */

    console.log("");
    console.log("3. Partner companies never appear in Plan Sponsor search");

    const storedAbc = await getPartnerCompany(abc.id, orgA);
    check(
      "the company is stored as a Partner/Provider entity",
      storedAbc?.entityType === "partner_provider",
      `got ${storedAbc?.entityType}`,
    );

    // The route derives this set from TeammateCompany rows; assert the lookup
    // the route performs actually finds the partner company.
    const partnerRowsForQuery = await prisma.teammateCompany.findMany({
      where: {
        organizationId: orgA,
        name: { contains: "ABC", mode: "insensitive" },
      },
      select: { name: true },
    });
    check(
      "the route's partner-name lookup finds the company",
      partnerRowsForQuery.length === 1,
      `got ${partnerRowsForQuery.length}`,
    );

    const partnerNames = partnerRowsForQuery.map((c) => c.name);
    check(
      "the Plan Sponsor rule withholds the partner company",
      isExcludedFromPlanSponsor("ABC Benefits", partnerNames) === true,
    );
    check(
      "case and whitespace variants are also withheld",
      isExcludedFromPlanSponsor("  abc benefits ", partnerNames) === true,
    );
    check(
      "an unrelated employer name is NOT withheld",
      isExcludedFromPlanSponsor("Ayres Manufacturing", partnerNames) === false,
    );
    check(
      "the plan_sponsor scope parses",
      parseCompanySearchScope("plan_sponsor") === "plan_sponsor",
    );
    check(
      "an unknown scope falls back to the legacy mixed list",
      parseCompanySearchScope("nonsense") === "all",
    );

    /* ── Criterion 4 ────────────────────────────────────────────────── */

    console.log("");
    console.log("4. Two collaborators from ABC Benefits share one company record");

    const reusedCompany = await findOrCreatePartnerCompany({
      organizationId: orgA,
      name: "abc benefits",
      actorUserId: userA.id,
    });
    check(
      "a case-insensitive repeat lookup reuses the same row",
      reusedCompany.id === abc.id,
      `${reusedCompany.id} !== ${abc.id}`,
    );

    const companyRowCount = await prisma.teammateCompany.count({
      where: {
        organizationId: orgA,
        name: { equals: "ABC Benefits", mode: "insensitive" },
      },
    });
    check(
      "only one ABC Benefits company row exists",
      companyRowCount === 1,
      `got ${companyRowCount}`,
    );
    check(
      "Jane and Bob both point at that company",
      jane.companyId === abc.id && bob.companyId === abc.id,
    );

    const profilesForCompany = await prisma.teammateProfile.count({
      where: { organizationId: orgA, companyId: abc.id },
    });
    check(
      "both profiles count against the same company",
      profilesForCompany === 2,
      `got ${profilesForCompany}`,
    );

    // Supports the T4 acceptance criterion "a second invite to Jane on another
    // plan adds an assignment, not a new profile".
    const reusedProfile = await findOrCreateProfile({
      organizationId: orgA,
      actorUserId: userA.id,
      type: "collaborator",
      email: janeEmail,
    });
    check(
      "a repeat invite by email reuses Jane's existing profile",
      reusedProfile.id === jane.id,
    );

    // Isolation of the company scope itself.
    const crossOrgCompany = await getPartnerCompany(abc.id, orgB);
    check(
      "Org B cannot read Org A's partner company",
      crossOrgCompany === null,
    );

    // The reuse rule is enforced at the only writer, not just in
    // `findOrCreateProfile`: a caller that bypasses it must be refused rather
    // than silently creating the duplicate profile the spec forbids.
    let duplicateRejected = false;
    let duplicateCode: string | undefined;
    try {
      await createTeammateProfile({
        organizationId: orgA,
        actorUserId: userA.id,
        type: "collaborator",
        email: janeEmail,
      });
    } catch (error) {
      duplicateRejected = true;
      duplicateCode = (error as TeammateDataError).code;
    }
    check(
      "a direct duplicate create for an existing email is refused",
      duplicateRejected,
    );
    check(
      "the refusal is reported as profile_email_exists",
      duplicateCode === "profile_email_exists",
      `got ${duplicateCode}`,
    );
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.planAssignment.deleteMany({
        where: { id: { in: created.assignmentIds } },
      });
      await prisma.teammateProfile.deleteMany({
        where: { id: { in: created.profileIds } },
      });
      await prisma.teammateCompany.deleteMany({
        where: { id: { in: created.companyIds } },
      });
      await prisma.client.deleteMany({
        where: { id: { in: created.clientIds } },
      });
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
    summary("T1 verification");
    if (failureCount() > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error("T1 verification crashed:", error);
    process.exitCode = 1;
  });
