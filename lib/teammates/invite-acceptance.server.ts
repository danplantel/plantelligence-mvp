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
import { buildUploadKey, putObjectBuffer } from "@/lib/r2";
import { categoryToSlug } from "@/lib/benefit-category-slug";
import {
  anchorTeammateUserToInvitingOrganization,
  getOrCreateOrganizationForUser,
  organizationDisplayName,
} from "@/lib/organization";
import { activateProfile, updateTeammateProfile } from "./profiles.server";
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
  /**
   * The plan being offered, and ONLY when the invitation covers exactly one.
   *
   * Null for several plans and for a seat that covers all of them: naming the first assignment
   * would tell the person they were invited to that plan and quietly leave out the rest of what
   * they were given.
   */
  planName?: string | null;
  /**
   * A named section, and only under the same condition as `planName` — with several assignments
   * a single "— Group Health." clause describes the first one and reads as the whole invitation.
   */
  sectionName?: string | null;
  /**
   * How many plans the invitation covers today. Paired with `allPlans`, this is what the page
   * words the scope from, so "…to help with Team Members LLC" cannot appear on an invitation
   * that gave somebody three plans.
   */
  planCount?: number;
  /**
   * The seat's own "All Plans" flag — every plan the organization has AND every one it creates
   * later. Deliberately not derived from `planCount`: one plan today with the flag set is still
   * "all of their plans", and that is the honest thing to say about a seat that will grow.
   */
  allPlans?: boolean;
  personType?: TeammatePersonType;
  /** Drives "create an account" vs "sign in to accept". */
  accountExists?: boolean;
  /** Where the person lands after accepting. */
  landingUrl?: string;
  /**
   * What the seat already holds for this person, so the acceptance form opens FILLED IN.
   *
   * These are the fields the advisor captured on the Key Contact they invited (or that the
   * profile has carried since), and asking the person to retype their own name and job title is
   * exactly the kind of duplicate entry the contact picker exists to avoid. They are also the
   * person's OWN details, sent to the holder of their invitation token and to nobody else.
   */
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  phoneExtension?: string | null;
  /** An R2 key — the form's editor resolves it for display. */
  headshot?: string | null;
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
      // Decides how the invitation's scope is worded — see `InvitationView`.
      allPlans: true,
      // Prefilled into the acceptance form — see `InvitationView`.
      firstName: true,
      lastName: true,
      jobTitle: true,
      phone: true,
      phoneExtension: true,
      headshot: true,
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

  // The firm's NAME, resolved exactly as the invitation email resolves it
  // (`organizationDisplayName`), so the page and the email cannot name the firm differently —
  // including the "on behalf of …" clause, which reads this value.
  const [organizationName, inviter, assignments, account] = await Promise.all([
    organizationDisplayName(organizationId),
    profile.invitedByUserId
      ? prisma.user.findUnique({
          where: { id: profile.invitedByUserId },
          select: { name: true, email: true },
        })
      : Promise.resolve(null),
    // ALL of them rather than the first: how many plans this invitation covers is exactly what
    // the page's sentence has to get right.
    prisma.planAssignment.findMany({
      where: { organizationId, profileId },
      orderBy: { createdAt: "asc" },
      select: { clientId: true, categoryScope: true, categories: true },
    }),
    prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true },
    }),
  ]);

  /** The one assignment, when there is exactly one — see `planName` above. */
  const singleAssignment = assignments.length === 1 ? assignments[0] : null;

  const plan = singleAssignment
    ? await prisma.client.findUnique({
        where: { id: singleAssignment.clientId },
        select: { companyName: true },
      })
    : null;
  const categories = Array.isArray(singleAssignment?.categories)
    ? (singleAssignment.categories as string[])
    : [];

  return {
    status: "ok",
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    jobTitle: profile.jobTitle,
    phone: profile.phone,
    phoneExtension: profile.phoneExtension,
    headshot: profile.headshot,
    inviterName: inviter?.name ?? inviter?.email ?? null,
    organizationName,
    planName: plan?.companyName ?? null,
    sectionName:
      singleAssignment?.categoryScope === "selected" && categories.length > 0
        ? categories.length === 1
          ? categories[0]
          : `${categories.length} sections`
        : null,
    planCount: assignments.length,
    allPlans: profile.allPlans,
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
  /**
   * The invited person's own details, collected while they accept.
   *
   * The acceptance form asks for the same fields the Key Contact form does, so an invited
   * teammate finishes their own profile instead of arriving as a name and an email — which is
   * what the invited-teammate gap was: the seat held whatever the inviting advisor had on the
   * Key Contact, and nothing else could ever fill it in until they signed in and found Settings.
   *
   * Written onto the SEAT (see the note in `acceptInvitation`), and only when supplied: an
   * absent key leaves whatever the invite seeded in place.
   */
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  phoneExtension?: string | null;
  /** An R2 key, an absolute URL, or a `data:` URL from a visitor who could not upload. */
  headshot?: string | null;
}

/**
 * Store whatever the image editor handed back as an R2 KEY.
 *
 * On this PUBLIC page the invitee has no session, and every upload route is session-gated
 * (`/api/r2/upload`, `/api/r2/presign-upload`), so `uploadFileToR2` fails and
 * `universal-image-editor-modal` deliberately falls back to handing back the cropped image as an
 * inline `data:` URL. Writing that verbatim would put a few hundred kilobytes of base64 in a text
 * column, so it is uploaded from here instead — under the organization's own prefix, in the same
 * `org/{orgId}/uploads/advisor/headshot/` shape every other teammate headshot uses, which is what
 * `resolveObjectAccess` and `<Headshot>` expect to find.
 *
 * An R2 key or absolute URL (an invitee who happens to be signed in) is passed through untouched.
 * A failed upload returns null: no photo is the honest outcome, and a half-valid value would
 * render as a broken image on every contact card they appear on.
 */
async function storeInviteeHeadshot(
  organizationId: string,
  headshot: string | null | undefined,
): Promise<string | null> {
  const value = (headshot ?? "").trim();
  if (!value) return null;
  if (!value.startsWith("data:")) return value;

  const match = /^data:([^;,]+);base64,(.+)$/s.exec(value);
  if (!match) return null;

  const [, contentType, base64] = match;
  const extension = /png/i.test(contentType)
    ? "png"
    : /jpe?g/i.test(contentType)
      ? "jpg"
      : "png";
  // The R2 prefix is keyed by the OWNER's userId, not by the Organization id: every existing
  // teammate headshot lives at `org/{ownerUserId}/uploads/advisor/headshot/…`, and
  // `resolveObjectAccess` reads that segment as a user. Filing this photo under the organization
  // id would put it somewhere the rest of the app never looks — the seat would hold a key that
  // renders as a broken image.
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerUserId: true },
  });
  const key = buildUploadKey({
    orgId: organization?.ownerUserId ?? organizationId,
    subPath: "advisor/headshot",
    fileName: `invitee-headshot.${extension}`,
  });

  const stored = await putObjectBuffer({
    key,
    body: Buffer.from(base64, "base64"),
    contentType,
  });
  return stored ? key : null;
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

  // The name the account is created with, preferring the two parts the form now collects: a
  // single "Your name" cannot be split reliably ("Mary Jane Watson"), and the profile is what
  // people see.
  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || (input.name ?? "").trim();

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
        name: displayName || view.email,
        email: view.email,
        password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
      },
      select: { id: true },
    });
    loginUserId = created.id;
    createdAccount = true;
  }

  // The one call T1 provided and nothing had ever made: state → active, login → linked,
  // both audited (`profile_state_changed`, `profile_login_linked`).
  //
  // It runs BEFORE the anchoring below, and that order is load-bearing: `activateProfile` is
  // what writes `TeammateProfile.loginUserId`, and being somebody's teammate is precisely how
  // the account's organization is now decided.
  await activateProfile({
    id: profileId,
    organizationId,
    actorUserId: loginUserId,
    loginUserId,
  });

  // ── Their own details, onto their SEAT ─────────────────────────────────────────
  //
  // The seat is where an invited teammate's title, phone, extension and photo actually live:
  // People & Access, the dashboard header and the plan's contact cards all read them from
  // `TeammateProfile` (see `seatProfileSource`), and the Profile tab treats them as the fallback
  // behind the account's own row. Writing them onto the account instead would put them somewhere
  // nothing reads for a teammate.
  //
  // Only the fields that were supplied are patched, because an ABSENT key means "leave it alone"
  // to this writer: the invite seeded several of these from the Key Contact the person was
  // invited as, and somebody who fills in their phone but no title must not blank the title.
  const headshot = await storeInviteeHeadshot(organizationId, input.headshot);
  const jobTitle = (input.jobTitle ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const phoneExtension = (input.phoneExtension ?? "").trim();

  if (firstName || lastName || jobTitle || phone || phoneExtension || headshot) {
    await updateTeammateProfile({
      id: profileId,
      organizationId,
      actorUserId: loginUserId,
      data: {
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(jobTitle ? { jobTitle } : {}),
        ...(phone ? { phone } : {}),
        ...(phoneExtension ? { phoneExtension } : {}),
        ...(headshot ? { headshot } : {}),
      },
    });
  }

  // Anchor the account to the organization that invited it.
  //
  // NOT `getOrCreateOrganizationForUser`, which is what used to be here. That helper answers
  // "the organization this User OWNS" and therefore MINTS one when there is none — so every
  // accepted invitation created a brand-new, empty organization owned by the invitee, and
  // `getOrgSession()` then scoped their whole session to it. The invited person ended up with
  // a workspace of their own instead of the seat they were given, and the firm that invited
  // them never saw them arrive.
  //
  // The T1 invariant it was guarding — every User has an `organizationId` — is still honoured:
  // the anchor is the inviting organization. The fallback covers the one case where there is
  // nothing to anchor to (a profile deleted between the two calls), so that invariant cannot
  // be lost by this change.
  const anchored = await anchorTeammateUserToInvitingOrganization(loginUserId);
  if (!anchored) {
    await getOrCreateOrganizationForUser(loginUserId);
  }

  return {
    ok: true,
    status: "accepted",
    createdAccount,
    email: view.email,
    landingUrl: view.landingUrl ?? "/benefits",
  };
}
