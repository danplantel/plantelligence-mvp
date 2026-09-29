/**
 * invite-acceptance.server — T9: redeeming an invite.
 *
 * The invitation was one-directional until now. T4 and T5 send the email; nothing
 * turned it into access, because access is resolved by **login** — `resolvePlanAccess`
 * finds the `TeammateProfile` whose `loginUserId` equals the session's `userId` — and
 * nothing ever created that link. The helpers for it existed all along
 * (`activateProfile` moves the state to `active` *and* calls `linkLoginUserId`); this
 * module is the caller they never had.
 *
 * Two halves, deliberately separate:
 *
 *  - `loadInvitation` is read-only and safe to call on page render. It answers "what is
 *    being offered, and is it still redeemable?" without changing anything.
 *  - `acceptInvitation` is the write. It re-runs the same validation rather than trusting
 *    the page, because a link can be replayed or edited between render and submit.
 *
 * The governing rule: **never trust the token, trust the profile.** The token proves the
 * link was minted by us and has not expired; everything else — still invited, not
 * deactivated, not already accepted, right mailbox — is decided by re-reading the row.
 * That is also why revocation needs no bookkeeping: deactivate the person, remove the
 * assignment, or let the 14-day hold lapse, and the link stops working.
 *
 * Server-only.
 */

import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { categoryToSlug } from "@/lib/benefit-category-slug";
import { getOrCreateOrganizationForUser } from "@/lib/organization";
import { activateProfile } from "./profiles.server";
import { isInviteExpired } from "./seats.server";
import { verifyInviteToken } from "./invite-token.server";
import type { TeammatePersonType } from "@/types/teammate";

export type InvitationStatus =
  /** Redeemable. */
  | "ok"
  /** The link is malformed or its signature does not match. */
  | "invalid"
  /** Past the 14-day hold, so the seat was released. */
  | "expired"
  /** Already redeemed. The person should sign in instead. */
  | "already_accepted"
  /** Deactivated by the organization: all access ended. */
  | "deactivated"
  /** The profile is gone, or was never invited (still a `contact`). */
  | "revoked";

export interface InvitationView {
  status: InvitationStatus;
  /** Absent when the token itself could not be trusted. */
  email?: string;
  inviterName?: string | null;
  organizationName?: string | null;
  planName?: string | null;
  sectionName?: string | null;
  personType?: TeammatePersonType;
  /** Drives "create an account" vs "sign in to accept". */
  accountExists?: boolean;
  /** Where the person lands after accepting. */
  landingUrl?: string;
}

/** Where a person goes once they are active: the section they were invited to, or the hub. */
async function landingUrlFor(
  organizationId: string,
  profileId: string,
): Promise<string> {
  const assignment = await prisma.planAssignment.findFirst({
    where: { organizationId, profileId },
    orderBy: { createdAt: "asc" },
    select: { clientId: true, categoryScope: true, categories: true },
  });
  const categories = Array.isArray(assignment?.categories)
    ? (assignment?.categories as string[])
    : [];
  if (
    assignment &&
    assignment.categoryScope === "selected" &&
    categories.length > 0
  ) {
    return `/edit-benefit/${assignment.clientId}/${categoryToSlug(categories[0])}`;
  }
  // An all-categories assignment, or no assignment at all, has no single section to
  // land on — the plan list is the honest destination.
  return "/benefits";
}

/**
 * Validate a token against the live profile. Read-only.
 *
 * Order matters. `active` is checked **before** expiry, because an accepted invite is
 * obviously older than its own hold and would otherwise be reported as expired.
 */
export async function loadInvitation(token: string): Promise<InvitationView> {
  const verified = verifyInviteToken(token);
  if (!verified.ok) {
    // A bad signature is indistinguishable from a tampered link, and both are "invalid".
    // An expired *signature* is reported as expired, which is the truthful copy.
    return { status: verified.reason === "expired" ? "expired" : "invalid" };
  }

  const { profileId, organizationId, email } = verified.payload;

  const profile = await prisma.teammateProfile.findFirst({
    where: { id: profileId, organizationId },
    select: {
      id: true,
      email: true,
      state: true,
      type: true,
      invitedAt: true,
      deactivatedAt: true,
      loginUserId: true,
      invitedByUserId: true,
    },
  });
  if (!profile) return { status: "revoked" };
  if (profile.deactivatedAt) return { status: "deactivated" };

  // The token travels by email, so a forwarded invite must not be redeemable by whoever
  // opens it. The mailbox is the identity here.
  if (profile.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { status: "invalid" };
  }

  if (profile.state === "active") {
    // Already accepted. Signing in is the right next step, not accepting again.
    return {
      status: "already_accepted",
      email: profile.email,
      landingUrl: await landingUrlFor(organizationId, profileId),
    };
  }
  if (profile.state !== "invited") return { status: "revoked" };
  if (isInviteExpired(profile.invitedAt)) return { status: "expired" };

  const [organization, inviter, assignment, account] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    profile.invitedByUserId
      ? prisma.user.findUnique({
          where: { id: profile.invitedByUserId },
          select: { name: true, email: true },
        })
      : Promise.resolve(null),
    prisma.planAssignment.findFirst({
      where: { organizationId, profileId },
      orderBy: { createdAt: "asc" },
      select: { clientId: true, categoryScope: true, categories: true },
    }),
    prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true },
    }),
  ]);

  const plan = assignment
    ? await prisma.client.findUnique({
        where: { id: assignment.clientId },
        select: { companyName: true },
      })
    : null;
  const categories = Array.isArray(assignment?.categories)
    ? (assignment?.categories as string[])
    : [];

  return {
    status: "ok",
    email: profile.email,
    inviterName: inviter?.name ?? inviter?.email ?? null,
    organizationName: organization?.name ?? null,
    planName: plan?.companyName ?? null,
    sectionName:
      assignment?.categoryScope === "selected" && categories.length > 0
        ? categories.length === 1
          ? categories[0]
          : `${categories.length} sections`
        : null,
    personType: profile.type as TeammatePersonType,
    accountExists: Boolean(account),
    landingUrl: await landingUrlFor(organizationId, profileId),
  };
}

export interface AcceptInvitationInput {
  token: string;
  /** Ignored when an account already exists for the invited email. */
  name?: string | null;
  password?: string | null;
}

export type AcceptInvitationResult =
  | {
      ok: true;
      status: "accepted";
      /** True when this call created the login; false when an existing one was linked. */
      createdAccount: boolean;
      email: string;
      landingUrl: string;
    }
  /**
   * A refusal carries the *same* status vocabulary as `loadInvitation`, including
   * `already_accepted`. Collapsing that one into "revoked" would tell a returning
   * invitee their invitation was withdrawn when in fact it worked and they should simply
   * sign in.
   */
  | { ok: false; status: Exclude<InvitationStatus, "ok"> };

/**
 * Redeem the invite: create or reuse the login, link it, and move the profile to
 * `active`.
 *
 * Re-validates from scratch instead of trusting anything the page knew, because the
 * request can arrive with a different token than the one that was rendered — or the same
 * one, twice.
 *
 * The password is hashed exactly as `POST /api/signup` does, so an accepted collaborator
 * is an ordinary credentials user afterwards and signs in through the normal form.
 */
export async function acceptInvitation(
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> {
  const view = await loadInvitation(input.token);
  if (view.status !== "ok") {
    // Nothing left to link, and the reason is passed through unchanged so the caller can
    // say "sign in instead" for an accepted invite rather than "withdrawn".
    return { ok: false, status: view.status };
  }
  if (!view.email) return { ok: false, status: "invalid" };

  const verified = verifyInviteToken(input.token);
  if (!verified.ok) return { ok: false, status: "invalid" };
  const { profileId, organizationId } = verified.payload;

  // An existing account keeps its own password: an invite must never become a way to
  // overwrite someone's credentials.
  let loginUserId: string;
  let createdAccount = false;
  const existing = await prisma.user.findUnique({
    where: { email: view.email },
    select: { id: true },
  });

  if (existing) {
    loginUserId = existing.id;
  } else {
    const password = (input.password ?? "").trim();
    if (password.length < 8) {
      // Surfaced as a plain refusal; the page collects a longer one.
      throw Object.assign(new Error("Choose a password of at least 8 characters."), {
        status: 400,
        code: "password_too_short",
      });
    }
    const created = await prisma.user.create({
      data: {
        name: (input.name ?? "").trim() || view.email,
        email: view.email,
        password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
      },
      select: { id: true },
    });
    loginUserId = created.id;
    createdAccount = true;
  }

  // T1's invariant is that every User owns an Organization, and `signIn` creates one for
  // every new account. This path creates an account *without* going through `signIn`, so it
  // has to do the same — otherwise an accepted collaborator is the one User in the database
  // with no `organizationId`, and both `verify-backfill` and the plan-creation stamps that
  // read it fail. Idempotent, so a reused account is simply topped up.
  //
  // This grants nothing extra: access is resolved by `TeammateProfile.loginUserId`, not by
  // the session's org, so the personal Organization owns no plans and the collaborator's
  // own session still resolves only the assignments they were invited to.
  await getOrCreateOrganizationForUser(loginUserId);

  // The one call T1 provided and nothing had ever made: state → active, login → linked,
  // both audited (`profile_state_changed`, `profile_login_linked`).
  await activateProfile({
    id: profileId,
    organizationId,
    actorUserId: loginUserId,
    loginUserId,
  });

  return {
    ok: true,
    status: "accepted",
    createdAccount,
    email: view.email,
    landingUrl: view.landingUrl ?? "/benefits",
  };
}
