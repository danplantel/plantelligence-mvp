/**
 * T7 acceptance verification — spec page 12 (Benefits Hub Contact Display).
 *
 *   npx tsx scripts/teammates/verify-t7.ts [--keep]
 *
 * Asserts the three acceptance criteria against the REAL hub layer:
 *
 *   1. "Jane on Ayres → Group Health appears in both places on the Ayres hub and
 *      nowhere on other hubs." — `buildHubContacts` (the array the portal is built
 *      from) carries her for Ayres with that category, and not for the other plan.
 *      "Both places" is the team list and the category page, which read the SAME
 *      array, so the category-scoped and team-wide views are checked separately.
 *   2. "With display off, she disappears from the hub but can still edit."
 *   3. "Updating Jane's phone number in her profile updates every hub she appears
 *      on." — the point of the whole ticket: one source, many hubs.
 *
 * Plus Part B's rules: the hub renders from profile + assignment, hidden categories
 * render no contacts, and the mirror is idempotent and non-destructive.
 *
 * Fixtures are `t7-verify-*` and are cleaned up unless `--keep` is passed.
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
import { mirrorPlanContacts } from "../../lib/teammates/contact-mirror.server";
import {
  buildHubContacts,
  buildPortalKeyContacts,
} from "../../lib/teammates/hub-contacts.server";
import { createTeammateProfile } from "../../lib/teammates/profiles.server";
import { upsertAssignment } from "../../lib/teammates/assignments.server";
import { resolvePlanAccess } from "../../lib/teammates/access.server";
import {
  filterContactsByPortalVisibility,
  getCategoryPortalVisibility,
} from "../../lib/portal-category-visibility";
import { resolveCategoryContacts } from "../../lib/benefit-contacts";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();

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
    console.log("T7 verification — Benefits Hub contact display");
    console.log("");

    /* ── Fixtures ───────────────────────────────────────────────────── */

    const owner = await prisma.user.create({
      data: {
        name: "T7 Verify Advisor",
        email: `t7-verify-owner-${STAMP}@example.test`,
        organizationName: `T7 Verify Org ${STAMP}`,
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
        slug: `t7-verify-ayres-${STAMP}`,
        status: "Draft",
        keyContacts: [],
      },
      select: { id: true, companyName: true },
    });
    created.clientIds.push(ayres.id);

    const precision = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `Precision Optical ${STAMP}`,
        slug: `t7-verify-precision-${STAMP}`,
        status: "Draft",
        keyContacts: [],
      },
      select: { id: true, companyName: true },
    });
    created.clientIds.push(precision.id);

    const janeEmail = `t7-verify-jane-${STAMP}@abbenefits.test`;
    const janeContactId = `t7-contact-${STAMP}`;

    // Exactly what the wizard writes: a plan's `keyContacts` blob, with the shape the
    // hub's readers already understand.
    const ayresContacts = {
      contacts: [
        {
          id: janeContactId,
          firstName: "Jane",
          lastName: "Smith",
          title: "Benefits Manager",
          email: janeEmail,
          phone: "555-0100",
          headshot: null,
          companyName: "ABC Benefits",
          companyLogo: null,
          benefitsCategories: ["Group Health"],
          showOnPortal: true,
          isPrimary: true,
        },
      ],
      displayStyle: 2,
    };

    const mirrored = await mirrorPlanContacts({
      organizationId,
      actorUserId: owner.id,
      clientId: ayres.id,
      keyContacts: ayresContacts,
    });
    check(
      "the mirror created a profile and one assignment for the contact",
      mirrored.profilesCreated === 1 && mirrored.assignmentsCreated === 1,
      `profiles=${mirrored.profilesCreated} assignments=${mirrored.assignmentsCreated}`,
    );

    const janeProfile = await prisma.teammateProfile.findFirst({
      where: { organizationId, email: janeEmail },
    });
    if (!janeProfile) throw new Error("fixture: Jane profile missing");
    created.profileIds.push(janeProfile.id);

    check(
      "a mirrored contact is a Contact: no login, no seat-holding type",
      janeProfile.state === "contact" && janeProfile.loginUserId === null,
      `${janeProfile.state} / ${janeProfile.loginUserId}`,
    );
    check(
      "and it points at the Partner company the contact named",
      Boolean(janeProfile.companyId),
    );

    // The plan sponsor's own company must NOT become a Partner/Provider row.
    //
    // Checked on its OWN plan, because the mirror takes a plan's complete contact
    // list and reconciles against it — passing a partial list to Ayres would correctly
    // remove Jane, which is the behaviour section 5 relies on.
    const sponsorPlan = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `Sponsor Co ${STAMP}`,
        slug: `t7-verify-sponsor-plan-${STAMP}`,
        status: "Draft",
        keyContacts: [],
      },
      select: { id: true, companyName: true },
    });
    created.clientIds.push(sponsorPlan.id);

    await mirrorPlanContacts({
      organizationId,
      actorUserId: owner.id,
      clientId: sponsorPlan.id,
      keyContacts: {
        contacts: [
          {
            id: `t7-sponsor-${STAMP}`,
            firstName: "Pat",
            lastName: "Sponsor",
            email: `t7-verify-sponsor-${STAMP}@example.test`,
            // The plan's OWN company name — the plan sponsor IS the client company.
            companyName: sponsorPlan.companyName,
            companyLogo: null,
            benefitsCategories: ["Company / Plan Sponsor"],
            showOnPortal: true,
          },
        ],
      },
    });
    const sponsorProfile = await prisma.teammateProfile.findFirst({
      where: { organizationId, email: `t7-verify-sponsor-${STAMP}@example.test` },
    });
    if (sponsorProfile) created.profileIds.push(sponsorProfile.id);
    check(
      "a contact whose company IS the plan sponsor does not become a Partner company",
      sponsorProfile?.companyId === null,
      String(sponsorProfile?.companyId),
    );

    /* ── 1. Both places on this hub, nowhere else ───────────────────── */

    console.log("");
    console.log("1. Jane shows on the Ayres hub in both places, and on no other hub");

    const ayresCards = await buildHubContacts({
      organizationId,
      clientId: ayres.id,
    });
    const janeCard = ayresCards.find((card) => card.email === janeEmail);

    check(
      "the team list carries her",
      Boolean(janeCard),
      ayresCards.map((card) => card.email).join(", "),
    );
    check(
      "with the details Part A item 2 lists",
      janeCard?.name === "Jane Smith" &&
        janeCard?.title === "Benefits Manager" &&
        janeCard?.phone === "555-0100" &&
        janeCard?.companyName === "ABC Benefits",
      `${janeCard?.name} / ${janeCard?.title} / ${janeCard?.phone} / ${janeCard?.companyName}`,
    );
    check(
      "the card keeps the contact's own id, so existing cross-references resolve",
      janeCard?.id === janeContactId,
      String(janeCard?.id),
    );

    // "Both places" — the category page resolves through the benefit's support-contact
    // references, which is a different reader over the same array. This is the check
    // that the preserved `contactId` actually keeps those references working.
    const categoryResolved = resolveCategoryContacts({
      keyContacts: ayresCards as never,
      category: "Group Health",
      supportContacts: [{ contactId: janeContactId }] as never,
    });
    check(
      "the category page resolves her through the benefit's support-contact id",
      categoryResolved.team.some((entry) => entry.contact.email === janeEmail),
      JSON.stringify(categoryResolved.team.map((entry) => entry.contact.email)),
    );

    const precisionCards = await buildHubContacts({
      organizationId,
      clientId: precision.id,
    });
    check(
      "and she is on no other hub",
      !precisionCards.some((card) => card.email === janeEmail),
      precisionCards.map((card) => card.email).join(", "),
    );

    /* ── 2. Display off hides her, access is untouched ──────────────── */

    console.log("");
    console.log("2. With display off she leaves the hub but keeps her access");

    const janeAssignment = await prisma.planAssignment.findFirst({
      where: { profileId: janeProfile.id, clientId: ayres.id, organizationId },
    });
    if (!janeAssignment) throw new Error("fixture: Jane assignment missing");

    await prisma.planAssignment.update({
      where: { id: janeAssignment.id },
      data: { showOnBenefitsHub: false },
    });

    const afterDisplayOff = await buildHubContacts({
      organizationId,
      clientId: ayres.id,
    });
    check(
      "she disappears from the hub",
      !afterDisplayOff.some((card) => card.email === janeEmail),
      afterDisplayOff.map((card) => card.email).join(", "),
    );
    check(
      "the assignment itself is still there, so the access layer still sees her",
      (await prisma.planAssignment.count({ where: { id: janeAssignment.id } })) === 1,
    );

    // A person WITH a login is the real proof that display is display-only: a mirrored
    // Contact has no login, so it could never show the distinction.
    const editorLogin = await prisma.user.create({
      data: {
        name: "T7 Editor Login",
        email: `t7-verify-editor-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(editorLogin.id);

    const editor = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "collaborator",
      email: `t7-verify-editor-${STAMP}@abbenefits.test`,
      firstName: "Ed",
      lastName: "Editor",
      loginUserId: editorLogin.id,
    });
    created.profileIds.push(editor.id);

    const editorAssignment = await upsertAssignment({
      organizationId,
      profileId: editor.id,
      clientId: precision.id,
      actorUserId: owner.id,
      role: "editor",
      categoryScope: "all",
      categories: [],
      showOnBenefitsHub: false,
    });

    check(
      "a person with display off is absent from the hub",
      !(await buildHubContacts({ organizationId, clientId: precision.id })).some(
        (card) => card.profileId === editor.id,
      ),
    );
    const editorAccess = await resolvePlanAccess({
      userId: editorLogin.id,
      clientIdOrSlug: precision.id,
      permission: "create_benefits",
      level: "edit",
    });
    check(
      "but can still edit — display is not access (T7 Part B item 2)",
      editorAccess.allowed === true,
      "reason" in editorAccess ? String(editorAccess.reason) : "allowed",
    );
    check(
      "and the assignment still reports display off",
      (await prisma.planAssignment.findFirst({ where: { id: editorAssignment.id } }))
        ?.showOnBenefitsHub === false,
    );

    // Restore Jane's display for the propagation check below.
    await prisma.planAssignment.update({
      where: { id: janeAssignment.id },
      data: { showOnBenefitsHub: true },
    });

    /* ── 3. One profile, every hub ──────────────────────────────────── */

    console.log("");
    console.log("3. A profile edit reaches every hub she appears on");

    // Put Jane on a second plan, so "every hub" means something.
    await mirrorPlanContacts({
      organizationId,
      actorUserId: owner.id,
      clientId: precision.id,
      keyContacts: {
        contacts: [
          {
            id: `t7-jane-precision-${STAMP}`,
            firstName: "Jane",
            lastName: "Smith",
            title: "Benefits Manager",
            email: janeEmail,
            phone: "555-0100",
            benefitsCategories: ["Group Health"],
            showOnPortal: true,
          },
        ],
      },
    });

    const hubCount = (await prisma.planAssignment.count({
      where: { profileId: janeProfile.id, organizationId },
    }));
    check("she is assigned to both plans from ONE profile", hubCount === 2, `${hubCount}`);

    await prisma.teammateProfile.update({
      where: { id: janeProfile.id },
      data: { phone: "555-0199" },
    });

    const ayresPhone = (await buildHubContacts({
      organizationId,
      clientId: ayres.id,
    })).find((card) => card.email === janeEmail)?.phone;
    const precisionPhone = (await buildHubContacts({
      organizationId,
      clientId: precision.id,
    })).find((card) => card.email === janeEmail)?.phone;

    check(
      "the new number shows on the first hub",
      ayresPhone === "555-0199",
      String(ayresPhone),
    );
    check(
      "and on the second — one source, many hubs",
      precisionPhone === "555-0199",
      String(precisionPhone),
    );

    /* ── 4. Hidden categories render no contacts ────────────────────── */

    console.log("");
    console.log("4. A hidden category renders none of its contacts");

    // Jane is in Group Health, so THAT is the category to hide: hiding a category she
    // is not in would leave her visible and prove nothing.
    const visibility = getCategoryPortalVisibility({
      Retirement: true,
      "Group Health": false,
      "Group Life": true,
      Other: true,
    });
    const filtered = filterContactsByPortalVisibility(
      ayresCards as unknown as Record<string, unknown>[],
      visibility,
    );
    check(
      "a card in a hidden category is filtered out",
      !filtered.some((contact) => contact.email === janeEmail),
      filtered.map((c) => String(c.email)).join(", "),
    );
    check(
      "and the same card survives when its category is visible",
      filterContactsByPortalVisibility(
        ayresCards as unknown as Record<string, unknown>[],
        getCategoryPortalVisibility({ "Group Health": true }),
      ).some((contact) => contact.email === janeEmail),
    );

    /* ── 5. Idempotent, and removals only take the mirror ──────────── */

    console.log("");
    console.log("5. The mirror reconciles rather than duplicating");

    const second = await mirrorPlanContacts({
      organizationId,
      actorUserId: owner.id,
      clientId: ayres.id,
      keyContacts: ayresContacts,
    });
    check(
      "re-running it creates nothing",
      second.profilesCreated === 0 && second.assignmentsCreated === 0,
      `profiles=${second.profilesCreated} assignments=${second.assignmentsCreated}`,
    );
    check(
      "and there is still exactly one profile for her email",
      (await prisma.teammateProfile.count({ where: { organizationId, email: janeEmail } })) === 1,
    );

    await mirrorPlanContacts({
      organizationId,
      actorUserId: owner.id,
      clientId: ayres.id,
      keyContacts: { contacts: [], displayStyle: 2 },
    });
    check(
      "removing the contact removes her mirrored assignment",
      (await prisma.planAssignment.count({
        where: { profileId: janeProfile.id, clientId: ayres.id, organizationId },
      })) === 0,
    );
    check(
      "but leaves the assignment on the plan she is still a contact of",
      (await prisma.planAssignment.count({
        where: { profileId: janeProfile.id, clientId: precision.id, organizationId },
      })) === 1,
    );

    // An invited person's assignment belongs to T6, not the mirror.
    const invited = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "collaborator",
      email: `t7-verify-invited-${STAMP}@abbenefits.test`,
      firstName: "Ivy",
      lastName: "Invited",
    });
    created.profileIds.push(invited.id);
    await upsertAssignment({
      organizationId,
      profileId: invited.id,
      clientId: ayres.id,
      actorUserId: owner.id,
      role: "contributor",
      categoryScope: "all",
      categories: [],
    });
    await prisma.teammateProfile.update({
      where: { id: invited.id },
      data: { state: "invited" },
    });
    const before = await prisma.planAssignment.findFirst({
      where: { profileId: invited.id, clientId: ayres.id },
    });
    await mirrorPlanContacts({
      organizationId,
      actorUserId: owner.id,
      clientId: ayres.id,
      keyContacts: { contacts: [], displayStyle: 2 },
    });
    check(
      "the mirror never removes an invited person's assignment (T6 owns it)",
      (await prisma.planAssignment.count({ where: { id: before?.id } })) === 1,
    );

    /* ── 6. Unmirrorable contacts cannot vanish ────────────────────── */

    console.log("");
    console.log("6. A contact the mirror cannot represent still renders");

    const noEmailId = `t7-no-email-${STAMP}`;
    const residue = await buildPortalKeyContacts({
      organizationId,
      clientId: ayres.id,
      presentation: {
        displayStyle: 2,
        contacts: [
          { id: noEmailId, name: "No Email Person", showOnPortal: true },
        ],
      },
    });
    const residueContacts = (residue as { contacts: Record<string, unknown>[] }).contacts;
    check(
      "a contact with no email is passed through instead of silently dropped",
      residueContacts.some((contact) => contact.id === noEmailId),
      JSON.stringify(residueContacts.map((c) => c.id)),
    );
    check(
      "and the presentation settings survive the rebuild",
      (residue as { displayStyle?: number }).displayStyle === 2,
      String((residue as { displayStyle?: number }).displayStyle),
    );
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.planAssignment.deleteMany({
        where: { organizationId: { in: created.organizationIds } },
      });
      await prisma.teammateProfile.deleteMany({
        where: { id: { in: created.profileIds } },
      });
      await prisma.teammateCompany.deleteMany({
        where: { organizationId: { in: created.organizationIds } },
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

    summary("T7 verification");
    if (failureCount() > 0) process.exitCode = 1;
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("T7 verification crashed:", error);
  process.exitCode = 1;
});
