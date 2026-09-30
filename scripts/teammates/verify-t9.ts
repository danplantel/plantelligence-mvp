/**
 * T9 verification — invite acceptance (linking a collaborator to a login).
 *
 *   npx tsx scripts/teammates/verify-t9.ts [--keep]
 *
 * There is no spec ticket for this: it is the missing second half of T4/T5. Until it
 * existed, nothing in the app created the `TeammateProfile.loginUserId` link that the
 * permission layer resolves access by, so an invited collaborator could never actually
 * sign in — every suite before this one created that link by hand.
 *
 * Asserted here:
 *  1. The token round-trips, and tampered / malformed / expired tokens are refused.
 *  2. The email guard: a valid signature for the wrong mailbox is refused.
 *  3. The profile guards: deactivated, revoked, never-invited and lapsed invites.
 *  4. Acceptance links the login, moves the profile to `active`, creates no second
 *     profile, and reuses an existing account WITHOUT overwriting its password.
 *  5. The seat invariant: acceptance converts a held seat into an occupied one and never
 *     changes `seatsUsed`.
 *  6. Replay is refused once accepted.
 *  7. Both audit rows land: the state change and the login link.
 *  8. The landing URL addresses the invited section when there is exactly one.
 *  9. The tenancy invariant: every login the flow creates owns an Organization, because
 *     `signIn` gives every new User one and acceptance creates a User outside `signIn`.
 *
 * No email is sent: the invite is raised with `skipEmail: true`, and the token is minted
 * exactly as `invites.server.ts` mints it.
 *
 * Fixtures are `t9-verify-*` and are cleaned up unless `--keep` is passed.
 *
 * Cleanup note: two of the logins this suite exercises (Jane's and the Team Member's) are
 * created INSIDE `acceptInvitation`, not by the script, so their ids are looked up and
 * tracked in `created.userIds` after the fact — and their personal Organizations are
 * removed by `ownerUserId` rather than by id, since the service created them. Tracking only
 * what the script creates is exactly how an earlier version stranded two Users with no
 * Organization and broke the next `verify-backfill`.
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
import { inviteCollaboratorToPlan } from "../../lib/teammates/invites.server";
import { addTeamMember } from "../../lib/teammates/team.server";
import { getSeatUsage } from "../../lib/teammates/seats.server";
import {
  inviteAcceptUrl,
  signInviteToken,
  verifyInviteToken,
} from "../../lib/teammates/invite-token.server";
import {
  acceptInvitation,
  loadInvitation,
} from "../../lib/teammates/invite-acceptance.server";
import { categoryToSlug } from "../../lib/benefit-category-slug";
import bcrypt from "bcryptjs";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();

/** Mint a token the way the invite does: from the profile's own `invitedAt`. */
async function tokenForProfile(
  prisma: ReturnType<typeof createPrisma>,
  profileId: string,
): Promise<string> {
  const profile = await prisma.teammateProfile.findUnique({
    where: { id: profileId },
    select: { organizationId: true, email: true, invitedAt: true },
  });
  if (!profile?.invitedAt) throw new Error("fixture: profile is not invited");
  return signInviteToken({
    profileId,
    organizationId: profile.organizationId,
    email: profile.email,
    invitedAt: profile.invitedAt,
  });
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
    console.log("T9 verification — invite acceptance");
    console.log("");

    /* ── Fixtures ───────────────────────────────────────────────────── */

    const owner = await prisma.user.create({
      data: {
        name: "T9 Verify Advisor",
        email: `t9-verify-owner-${STAMP}@example.test`,
        organizationName: `T9 Verify Org ${STAMP}`,
      },
      select: { id: true },
    });
    created.userIds.push(owner.id);
    const organizationId = await getOrCreateOrganizationForUser(owner.id);
    created.organizationIds.push(organizationId);

    const plan = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `Ayres ${STAMP}`,
        slug: `t9-verify-ayres-${STAMP}`,
        status: "Draft",
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(plan.id);

    const janeEmail = `t9-verify-jane-${STAMP}@abbenefits.test`;
    const invited = await inviteCollaboratorToPlan({
      organizationId,
      actorUserId: owner.id,
      clientId: plan.id,
      categories: ["Group Health"],
      email: janeEmail,
      name: "Jane Smith",
      // No mail leaves the machine.
      skipEmail: true,
      source: "key_contacts",
    });
    created.profileIds.push(invited.profileId);

    const janeToken = await tokenForProfile(prisma, invited.profileId);

    /* ── 1. The token itself ────────────────────────────────────────── */

    console.log("1. The token round-trips, and bad ones are refused");

    const verified = verifyInviteToken(janeToken);
    check(
      "a freshly minted token verifies",
      verified.ok === true,
      verified.ok ? "ok" : verified.reason,
    );
    check(
      "and carries the profile, organization and mailbox",
      verified.ok &&
        verified.payload.profileId === invited.profileId &&
        verified.payload.organizationId === organizationId &&
        verified.payload.email === janeEmail.toLowerCase(),
    );
    check(
      "the accept URL points at the public route",
      inviteAcceptUrl("https://example.test", "abc").endsWith("/accept-invite/abc"),
    );

    const tampered = `${janeToken.slice(0, -2)}xx`;
    const tamperedResult = verifyInviteToken(tampered);
    check(
      "a tampered signature is refused",
      tamperedResult.ok === false && tamperedResult.reason === "bad_signature",
      tamperedResult.ok ? "accepted!" : tamperedResult.reason,
    );

    const malformed = verifyInviteToken("not-a-token");
    check(
      "a malformed token is refused",
      malformed.ok === false && malformed.reason === "malformed",
      malformed.ok ? "accepted!" : malformed.reason,
    );

    // An invite minted 15 days ago is past the seat hold, so its token is past its exp.
    const staleToken = signInviteToken({
      profileId: invited.profileId,
      organizationId,
      email: janeEmail,
      invitedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    });
    const staleResult = verifyInviteToken(staleToken);
    check(
      "a token past the invite's 14-day window is refused as expired",
      staleResult.ok === false && staleResult.reason === "expired",
      staleResult.ok ? "accepted!" : staleResult.reason,
    );

    /* ── 2. The mailbox guard ───────────────────────────────────────── */

    console.log("");
    console.log("2. A valid signature for the wrong mailbox is refused");

    const wrongMailbox = signInviteToken({
      profileId: invited.profileId,
      organizationId,
      email: `someone-else-${STAMP}@example.test`,
      invitedAt: new Date(),
    });
    const wrongMailboxView = await loadInvitation(wrongMailbox);
    check(
      "the token is refused because it does not match the profile's address",
      wrongMailboxView.status === "invalid",
      wrongMailboxView.status,
    );

    /* ── 3. The profile guards ─────────────────────────────────────── */

    console.log("");
    console.log("3. The invitation is judged by the profile, not the token");

    const okView = await loadInvitation(janeToken);
    check(
      "a live invitation is redeemable",
      okView.status === "ok",
      okView.status,
    );
    check(
      "and it explains who invited them, to what",
      okView.inviterName === "T9 Verify Advisor" &&
        okView.planName === `Ayres ${STAMP}` &&
        okView.sectionName === "Group Health",
      `${okView.inviterName} / ${okView.planName} / ${okView.sectionName}`,
    );
    check(
      "no account exists yet, so the page will ask for a password",
      okView.accountExists === false,
    );
    check(
      "and the landing URL addresses the invited section",
      okView.landingUrl === `/edit-benefit/${plan.id}/${categoryToSlug("Group Health")}`,
      String(okView.landingUrl),
    );

    const unknownProfile = await loadInvitation(
      signInviteToken({
        profileId: "0123456789abcdef01234567",
        organizationId,
        email: janeEmail,
        invitedAt: new Date(),
      }),
    );
    check(
      "a token for a profile that no longer exists is revoked",
      unknownProfile.status === "revoked",
      unknownProfile.status,
    );

    // A profile that was never invited (still a Contact) must not be acceptable.
    const contactEmail = `t9-verify-contact-${STAMP}@abbenefits.test`;
    const contact = await prisma.teammateProfile.create({
      data: {
        organizationId,
        type: "collaborator",
        state: "contact",
        email: contactEmail,
      },
      select: { id: true },
    });
    created.profileIds.push(contact.id);
    const contactView = await loadInvitation(
      await tokenForProfile(prisma, contact.id).catch(() =>
        // A Contact has no `invitedAt`, so mint one by hand to prove the state guard —
        // this is the token a forged/never-sent invite would look like.
        signInviteToken({
          profileId: contact.id,
          organizationId,
          email: contactEmail,
          invitedAt: new Date(),
        }),
      ),
    );
    check(
      "a profile that was never invited is refused (still a Contact)",
      contactView.status === "revoked",
      contactView.status,
    );

    // Deactivated ends everything, token or not.
    await prisma.teammateProfile.update({
      where: { id: invited.profileId },
      data: { deactivatedAt: new Date() },
    });
    const deactivatedView = await loadInvitation(janeToken);
    check(
      "a deactivated profile is refused",
      deactivatedView.status === "deactivated",
      deactivatedView.status,
    );
    await prisma.teammateProfile.update({
      where: { id: invited.profileId },
      data: { deactivatedAt: null },
    });

    /* ── 4. Acceptance ─────────────────────────────────────────────── */

    console.log("");
    console.log("4. Accepting creates the login, links it, and activates the profile");

    const profilesBefore = await prisma.teammateProfile.count({
      where: { organizationId },
    });
    const seatsBefore = await getSeatUsage(organizationId);

    const accepted = await acceptInvitation({
      token: janeToken,
      name: "Jane Smith",
      password: "correct horse battery",
    });
    check(
      "acceptance succeeds",
      accepted.ok === true,
      accepted.ok ? "ok" : accepted.status,
    );
    check(
      "and it created the account, because none existed",
      accepted.ok === true && accepted.createdAccount === true,
    );

    const janeProfile = await prisma.teammateProfile.findUnique({
      where: { id: invited.profileId },
      select: { state: true, loginUserId: true, type: true },
    });
    check(
      "the profile is now active",
      janeProfile?.state === "active",
      String(janeProfile?.state),
    );
    check(
      "and the login is linked — the link access resolves by",
      Boolean(janeProfile?.loginUserId),
      String(janeProfile?.loginUserId),
    );
    check(
      "no second profile was created for that email",
      (await prisma.teammateProfile.count({ where: { organizationId } })) ===
        profilesBefore,
    );

    const janeLogin = await prisma.user.findUnique({
      where: { email: janeEmail },
      select: { id: true, password: true },
    });
    // The login was created INSIDE `acceptInvitation`, so this run has to remember it for
    // cleanup: a User the *service* creates is still this run's fixture. Missing this is
    // what previously stranded the accepted logins and broke the next `verify-backfill`.
    if (janeLogin?.id) created.userIds.push(janeLogin.id);
    check(
      "the login is the account the profile points at",
      janeLogin?.id === janeProfile?.loginUserId,
    );
    check(
      "and it holds a real password hash, so they can sign in normally",
      typeof janeLogin?.password === "string" &&
        janeLogin.password.startsWith("$2"),
      String(janeLogin?.password).slice(0, 7),
    );

    /* ── 5. Seats ──────────────────────────────────────────────────── */

    console.log("");
    console.log("5. Acceptance converts a held seat, and never changes seatsUsed");

    const seatsAfter = await getSeatUsage(organizationId);
    check(
      "a Collaborator acceptance changes no seat at all",
      seatsAfter.seatsUsed === seatsBefore.seatsUsed,
      `${seatsBefore.seatsUsed} -> ${seatsAfter.seatsUsed}`,
    );

    // A Team Member DOES hold a seat while invited, so acceptance must convert it.
    const teammateEmail = `t9-verify-teammate-${STAMP}@example.test`;
    const teammate = await addTeamMember({
      organizationId,
      actorUserId: owner.id,
      name: "T9 Teammate",
      email: teammateEmail,
      type: "team_member",
      planScope: "this_plan",
      planId: plan.id,
      categoryScope: "all",
      // Adding a Team Member now sends the T9 invitation email; a suite must not.
      skipEmail: true,
    });
    created.profileIds.push(teammate.profileId);

    const pendingSeats = await getSeatUsage(organizationId);
    check(
      "an invited Team Member holds a pending seat",
      pendingSeats.seatsPending === 1,
      `${pendingSeats.seatsPending}`,
    );

    const teammateToken = await tokenForProfile(prisma, teammate.profileId);
    const teammateAccepted = await acceptInvitation({
      token: teammateToken,
      name: "T9 Teammate",
      password: "correct horse battery",
    });
    check(
      "their acceptance succeeds too",
      teammateAccepted.ok === true,
      teammateAccepted.ok ? "ok" : teammateAccepted.status,
    );

    const activeSeats = await getSeatUsage(organizationId);
    check(
      "the pending seat became an active one",
      activeSeats.seatsPending === 0 && activeSeats.seatsActive === 1,
      `pending=${activeSeats.seatsPending} active=${activeSeats.seatsActive}`,
    );
    check(
      "and seatsUsed did not move — a held seat became an occupied one",
      activeSeats.seatsUsed === pendingSeats.seatsUsed,
      `${pendingSeats.seatsUsed} -> ${activeSeats.seatsUsed}`,
    );

    // Same as Jane: created by the service, so this run owns it for cleanup.
    const teammateLogin = await prisma.user.findUnique({
      where: { email: teammateEmail },
      select: { id: true },
    });
    if (teammateLogin?.id) created.userIds.push(teammateLogin.id);

    /* ── 6. Replay, and an existing account ───────────────────────── */

    console.log("");
    console.log("6. Replay is refused, and an existing account is never overwritten");

    const replay = await acceptInvitation({ token: janeToken });
    check(
      "accepting twice is refused as already accepted",
      replay.ok === false && replay.status === "already_accepted",
      replay.ok ? "accepted!" : replay.status,
    );
    check(
      "and the page is told to sign in instead",
      (await loadInvitation(janeToken)).status === "already_accepted",
    );

    const janePasswordAfterReplay = await prisma.user.findUnique({
      where: { email: janeEmail },
      select: { password: true },
    });
    check(
      "the replay attempt left the existing password untouched",
      janePasswordAfterReplay?.password === janeLogin?.password,
    );

    // A brand-new invitee whose email ALREADY has an account: reuse it, keep its password.
    const existingEmail = `t9-verify-existing-${STAMP}@abbenefits.test`;
    const existingPassword = bcrypt.hashSync("their own password", bcrypt.genSaltSync(10));
    const existingUser = await prisma.user.create({
      data: { name: "Already Here", email: existingEmail, password: existingPassword },
      select: { id: true },
    });
    created.userIds.push(existingUser.id);

    const reuseInvite = await inviteCollaboratorToPlan({
      organizationId,
      actorUserId: owner.id,
      clientId: plan.id,
      categories: ["Retirement"],
      email: existingEmail,
      skipEmail: true,
    });
    created.profileIds.push(reuseInvite.profileId);

    const reuseAccepted = await acceptInvitation({
      token: await tokenForProfile(prisma, reuseInvite.profileId),
      name: "Should Be Ignored",
      password: "a password they never chose",
    });
    check(
      "an invitation to an existing account is accepted",
      reuseAccepted.ok === true,
      reuseAccepted.ok ? "ok" : reuseAccepted.status,
    );
    check(
      "and reports that no account was created",
      reuseAccepted.ok === true && reuseAccepted.createdAccount === false,
    );
    const reusePasswordAfter = await prisma.user.findUnique({
      where: { id: existingUser.id },
      select: { password: true, name: true },
    });
    check(
      "their password was NOT overwritten by the invite",
      reusePasswordAfter?.password === existingPassword,
    );
    check(
      "and neither was their name",
      reusePasswordAfter?.name === "Already Here",
      String(reusePasswordAfter?.name),
    );

    /* ── 7. A short password is refused ───────────────────────────── */

    console.log("");
    console.log("7. A weak password is refused rather than hashed");

    const weakInvite = await inviteCollaboratorToPlan({
      organizationId,
      actorUserId: owner.id,
      clientId: plan.id,
      categories: ["Group Life"],
      email: `t9-verify-weak-${STAMP}@abbenefits.test`,
      skipEmail: true,
    });
    created.profileIds.push(weakInvite.profileId);
    const weakToken = await tokenForProfile(prisma, weakInvite.profileId);

    let weakRefused = false;
    try {
      await acceptInvitation({ token: weakToken, password: "short" });
    } catch (error) {
      weakRefused = (error as { code?: string }).code === "password_too_short";
    }
    check("a password under 8 characters is refused", weakRefused);
    check(
      "and the profile is still invited, not half-accepted",
      (await prisma.teammateProfile.findUnique({
        where: { id: weakInvite.profileId },
        select: { state: true, loginUserId: true },
      }))?.state === "invited",
    );

    /* ── 8. The audit trail ────────────────────────────────────────── */

    console.log("");
    console.log("8. Both audit rows land");

    const audit = await prisma.teammateAuditEvent.findMany({
      where: { organizationId, profileId: invited.profileId },
      select: { action: true, actorUserId: true },
    });
    const actions = new Set(audit.map((row) => row.action));
    check(
      "the state change is recorded",
      actions.has("profile_state_changed" as never),
      [...actions].join(", "),
    );
    check(
      "and the login link is recorded",
      actions.has("profile_login_linked" as never),
      [...actions].join(", "),
    );
    check(
      "the link is attributed to the login that was linked",
      audit.some(
        (row) =>
          row.action === "profile_login_linked" &&
          row.actorUserId === janeLogin?.id,
      ),
    );

    /* ── 9. The tenancy invariant ──────────────────────────────────── */

    // `signIn` gives every new User an Organization; acceptance creates a User *outside*
    // `signIn`, so it has to do the same. Without this the accepted login is the one User
    // with no `organizationId`, which `verify-backfill` reports as a regression.
    console.log("");
    console.log("9. Every login this flow creates owns an Organization");

    const acceptedLogins = await prisma.user.findMany({
      where: { email: { in: [janeEmail, teammateEmail] } },
      select: { id: true, email: true, organizationId: true },
    });
    check(
      "both accepted logins exist",
      acceptedLogins.length === 2,
      `${acceptedLogins.length}`,
    );
    check(
      "and each carries an organizationId — the invariant every User must satisfy",
      acceptedLogins.length === 2 &&
        acceptedLogins.every((row) => Boolean(row.organizationId)),
      acceptedLogins
        .filter((row) => !row.organizationId)
        .map((row) => row.email)
        .join(", ") || "all linked",
    );

    const ownedOrgs = await prisma.organization.count({
      where: { ownerUserId: { in: acceptedLogins.map((row) => row.id) } },
    });
    check(
      "with an Organization owned by that login, exactly as `signIn` would have made",
      ownedOrgs === acceptedLogins.length,
      `${ownedOrgs} of ${acceptedLogins.length}`,
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
      // By owner as well as by id: the acceptance flow creates a personal Organization for
      // a login that was created inside the service, so that org was never recorded in
      // `created.organizationIds`. Leaving it behind would fail `verify-backfill`'s
      // "every Organization references a real User as owner".
      await prisma.organization.deleteMany({
        where: {
          OR: [
            { id: { in: created.organizationIds } },
            { ownerUserId: { in: created.userIds } },
          ],
        },
      });
      console.log("");
      console.log("Fixtures cleaned up.");
    } else {
      console.log("");
      console.log("Fixtures kept (--keep).");
    }

    summary("T9 verification");
    if (failureCount() > 0) process.exitCode = 1;
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("T9 verification crashed:", error);
  process.exitCode = 1;
});
