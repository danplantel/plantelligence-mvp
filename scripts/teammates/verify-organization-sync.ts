/**
 * verify-organization-sync — acceptance for `syncOrganizationIdentity`.
 *
 * Not a spec ticket: this covers the organization-identity mirror that the T1–T9 work
 * relied on but never asserted, plus the two bugs it was written to fix.
 *
 *  1. an organization's `name` tracks a rename. Every invitation email greets the
 *     recipient with `Organization.name`, so a rename that never lands means invitations
 *     keep using the name captured at signup.
 *  2. `organizationEmail` tracks the profile. It is the first source for the T3
 *     Team-Member domain guess (`guessPersonTypeForEmail`), so a stale value makes the
 *     "same domain means Team Member" guess look wrong rather than stale.
 *  3. the firm profile (`organizationType` / `customOrganization` / `teamSize`) lands on
 *     the organization — the storage Settings → Organization used to keep in
 *     `wizardSessions[0]` instead, where it was scoped to one advisor.
 *  4. branding stays a true mirror, including the `advisorLogo || advisorLogoUrl` fallback
 *     (those two columns routinely hold the same image).
 *  5. a second sync writes nothing, which is what stops an ordinary profile save from
 *     bumping `Organization.updatedAt` on every request.
 *
 * Self-cleaning, like the other verify scripts: fixtures are removed in `finally`, and the
 * shared guards sweep them if the run is interrupted.
 */
import {
  getOrCreateOrganizationForUser,
  syncOrganizationIdentity,
} from "../../lib/organization";
import { guessPersonTypeForEmail } from "../../lib/teammates/seats.server";
import {
  check,
  createPrisma,
  failureCount,
  installFixtureGuards,
  summary,
  sweepStaleFixtures,
} from "./shared";

const STAMP = Date.now();

async function main(): Promise<void> {
  const prisma = createPrisma();
  installFixtureGuards(prisma, { exceptStamps: [STAMP] });
  await sweepStaleFixtures(prisma, { exceptStamps: [STAMP] });

  const created = { userIds: [] as string[], organizationIds: [] as string[] };

  try {
    console.log("Organization identity mirror");

    /* ── Fixtures ───────────────────────────────────────────────────────── */

    const owner = await prisma.user.create({
      data: {
        name: "T8 Verify Advisor",
        email: `t8-verify-owner-${STAMP}@example.test`,
        organizationName: `T8 Verify Org ${STAMP}`,
        // A domain of its OWN, distinct from the owner's login domain
        // (`example.test`), so the domain-guess assertions below can tell the two apart.
        organizationEmail: `old-${STAMP}@abbenefits.test`,
        organizationType: "independent",
        customOrganization: "",
        teamSize: "just_me",
        brandColor: "#111111",
        primaryColor: "#222222",
        secondaryColor: "#333333",
        advisorLogo: "r2/logo-old.png",
        backgroundImage: "r2/bg-old.png",
      },
      select: { id: true },
    });
    created.userIds.push(owner.id);

    const organizationId = await getOrCreateOrganizationForUser(owner.id);
    created.organizationIds.push(organizationId);

    /* ── Creation mirrors the owner ─────────────────────────────────────── */

    const asCreated = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    check(
      "creation mirrors the owner's organization name",
      asCreated.name === `T8 Verify Org ${STAMP}`,
      asCreated.name,
    );
    check(
      "creation mirrors organizationEmail",
      asCreated.organizationEmail === `old-${STAMP}@abbenefits.test`,
      String(asCreated.organizationEmail),
    );
    check(
      "creation mirrors the firm profile",
      asCreated.organizationType === "independent" &&
        asCreated.teamSize === "just_me",
      `${asCreated.organizationType} / ${asCreated.teamSize}`,
    );
    check(
      "creation mirrors branding",
      (asCreated.branding as Record<string, unknown> | null)?.brandColor ===
        "#111111",
      JSON.stringify(asCreated.branding),
    );

    const steady = await syncOrganizationIdentity(owner.id);
    check(
      "a settled organization has nothing to sync",
      steady.changed.length === 0,
      steady.changed.join(","),
    );

    /* ── What a profile / branding save now writes ──────────────────────── */

    await prisma.user.update({
      where: { id: owner.id },
      data: {
        organizationName: `T8 Verify Renamed ${STAMP}`,
        organizationEmail: `new-${STAMP}@elsewhere.test`,
        organizationType: "hybrid",
        customOrganization: `custom ${STAMP}`,
        teamSize: "6_20",
        brandColor: "#999999",
        advisorLogo: null,
        advisorLogoUrl: "r2/logo-url-new.png",
      },
    });

    const synced = await syncOrganizationIdentity(owner.id);
    const afterRename = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    check(
      "a rename reaches the organization (invitation emails read this)",
      afterRename.name === `T8 Verify Renamed ${STAMP}`,
      afterRename.name,
    );
    check(
      "a changed organizationEmail reaches the organization",
      afterRename.organizationEmail === `new-${STAMP}@elsewhere.test`,
      String(afterRename.organizationEmail),
    );
    check(
      "the firm profile is mirrored",
      afterRename.organizationType === "hybrid" &&
        afterRename.customOrganization === `custom ${STAMP}` &&
        afterRename.teamSize === "6_20",
      `${afterRename.organizationType} / ${afterRename.customOrganization} / ${afterRename.teamSize}`,
    );
    check(
      "branding follows the owner, falling back to advisorLogoUrl",
      (afterRename.branding as Record<string, unknown> | null)?.logo ===
        "r2/logo-url-new.png",
      JSON.stringify(afterRename.branding),
    );
    check(
      "the sync reports every field it changed",
      [
        "name",
        "organizationEmail",
        "organizationType",
        "customOrganization",
        "teamSize",
        "branding",
      ].every((field) => synced.changed.includes(field)),
      synced.changed.join(","),
    );

    /* ── The T3 domain guess, end to end ────────────────────────────────────
     *
     * A WIRING assertion, deliberately not an isolation of the mirror:
     * `getOrganizationDomains` unions the organization's `organizationEmail` with the
     * owner's own row, so a changed address reaches the guess through either one. That is
     * also why the email half of this sync fixes no live defect — the name half does.
     *
     * Both directions are asserted anyway: the list the guess builds is what T3's
     * "same domain ⇒ Team Member" rule rides on, and a mirror that wrote `null` would
     * silently narrow it.
     */

    check(
      "an invitee on the organization's current email domain is a Team Member",
      (await guessPersonTypeForEmail({
        organizationId,
        email: "someone@elsewhere.test",
      })) === "team_member",
    );
    check(
      "the previous domain no longer identifies the organization",
      (await guessPersonTypeForEmail({
        organizationId,
        email: "someone@abbenefits.test",
      })) === "collaborator",
    );

    const unchanged = await syncOrganizationIdentity(owner.id);
    check(
      "a second sync is inert (no updatedAt churn on ordinary saves)",
      unchanged.changed.length === 0,
      unchanged.changed.join(","),
    );
  } finally {
    // Children first, matching the order the shared sweep uses.
    await prisma.organization
      .deleteMany({ where: { id: { in: created.organizationIds } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: created.userIds } } })
      .catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }

  summary("Organization identity mirror");
  if (failureCount() > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
