/**
 * seats.server — Team Member seat metering (spec T3 Part B).
 *
 * Spec rules implemented here:
 *  1. "Only Team Members use seats. Contacts and Collaborators do not."
 *  2. "Pending invites reserve a seat and release automatically after 14 days."
 *  3. "At the seat limit, show an upgrade confirm, not a hard block. Only an
 *      Owner or Admin can confirm. Tier logic stays a placeholder until pricing
 *      is final."
 *  4. "Email-domain guess: a domain matching the organization defaults the
 *      invitee to Team Member."
 *
 * Two decisions the spec leaves open, resolved here and centralised so they are
 * one-line changes:
 *
 *  - **The owner occupies a seat.** The spec says only Team Members use seats and
 *    that the owner is the first Team Member, so the owner counts. If the product
 *    wants the owner free, set OWNER_CONSUMES_SEAT to false.
 *  - **A confirmed over-limit add raises `seatsIncluded` by one.** That is the
 *    placeholder for "they moved to a bigger tier" until pricing exists, and it
 *    keeps the meter honest instead of showing "6 of 5 used".
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";
import { TeammateDataError } from "./errors";
import { recordTeammateAuditEvent } from "./audit.server";
import { isOwnerOrAdminOfOrganization } from "./access.server";
import type {
  TeammatePersonType,
  TeammateProfileState,
} from "@/types/teammate";

/** How long a pending invite holds a seat before it is released (spec T3). */
export const INVITE_SEAT_HOLD_DAYS = 14;

/** Placeholder allowance when an Organization has no `seatsIncluded`. */
export const DEFAULT_SEATS_INCLUDED = 5;

/** Placeholder tier label until pricing is final. */
export const PLACEHOLDER_PLAN_TIER = "placeholder";

/** Does the owner consume one of the seats? See the module header. */
export const OWNER_CONSUMES_SEAT = true;

export interface SeatUsage {
  seatsIncluded: number;
  /**
   * True when the Organization has an explicit seat limit (`seatsIncluded` is
   * non-null). Until a billing surface exists this is false, and the UI shows
   * "X team members" rather than "X of Y seats in use" (Onboarding Step 5c).
   */
  hasSeatLimit: boolean;
  /** Consumed seats: owner + active Team Members + unexpired pending invites. */
  seatsUsed: number;
  /** Subset of `seatsUsed`: invites still inside the 14-day hold. */
  seatsPending: number;
  /** Active Team Member profiles (excluding the owner). */
  seatsActive: number;
  seatsAvailable: number;
  atLimit: boolean;
  planTier: string;
}

/** Has a pending invite passed the 14-day hold? */
export function isInviteExpired(
  invitedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!invitedAt) return true;
  const heldMs = INVITE_SEAT_HOLD_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - invitedAt.getTime() >= heldMs;
}

/**
 * The one definition of "this profile occupies a seat".
 *
 * It exists as one function because the meter and the two rosters that claim to list seat
 * holders each had their own filter, and they disagreed: a `contact`-state Key Contact
 * appeared on the dashboard's team panel while Settings → People & Access omitted it, and a
 * deactivated member was counted by neither yet shown by one.
 *
 * A profile holds a seat when it is NOT deactivated and is either Active, or Invited inside
 * the 14-day hold. Contacts, deactivated members and lapsed invites hold none. The owner is
 * not covered here: they are synthesized from `Organization.ownerUserId` rather than stored,
 * and their reserved seat is `OWNER_CONSUMES_SEAT`.
 */
export function profileHoldsSeat(
  profile: {
    state: TeammateProfileState;
    invitedAt?: Date | null;
    deactivatedAt?: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (profile.deactivatedAt) return false;
  if (profile.state === "active") return true;
  if (profile.state === "invited") {
    return !isInviteExpired(profile.invitedAt, now);
  }
  return false;
}

/**
 * Current seat usage for an organization.
 *
 * Stale invites are excluded from `seatsUsed` whether or not the sweep in
 * `expireStaleInvites` has run, so the count is correct even before a sweep —
 * that is what makes "an expired invite releases it" hold immediately.
 */
export async function getSeatUsage(
  organizationId: string,
): Promise<SeatUsage> {
  const [organization, profiles] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        ownerUserId: true,
        seatsIncluded: true,
        planTier: true,
      },
    }),
    prisma.teammateProfile.findMany({
      // Team Members only; contacts and collaborators never hold a seat.
      where: { organizationId, type: "team_member" },
      select: { state: true, invitedAt: true, deactivatedAt: true },
    }),
  ]);

  const seatsIncluded = organization?.seatsIncluded ?? DEFAULT_SEATS_INCLUDED;
  const now = new Date();

  let seatsActive = 0;
  let seatsPending = 0;
  for (const profile of profiles) {
    // One predicate, shared with every roster that claims to list seat holders — see
    // `profileHoldsSeat`. Active is the only state that reports as Active; an unexpired
    // invite is the only other state the predicate admits.
    if (!profileHoldsSeat(profile, now)) continue;
    if (profile.state === "active") seatsActive += 1;
    else seatsPending += 1;
  }

  const ownerSeat =
    OWNER_CONSUMES_SEAT && organization?.ownerUserId ? 1 : 0;
  const seatsUsed = ownerSeat + seatsActive + seatsPending;

  return {
    seatsIncluded,
    hasSeatLimit: organization?.seatsIncluded != null,
    seatsUsed,
    seatsPending,
    seatsActive,
    seatsAvailable: Math.max(seatsIncluded - seatsUsed, 0),
    atLimit: seatsUsed >= seatsIncluded,
    planTier: organization?.planTier ?? PLACEHOLDER_PLAN_TIER,
  };
}

/**
 * Spec T3 item 2: "release automatically after 14 days".
 *
 * The meter already ignores stale invites, so this is about keeping the stored
 * state truthful: an expired invite returns to `contact` — the profile and all
 * its history stay, exactly as the Contact → Invited upgrade is reversible in the
 * other direction. Safe to call repeatedly.
 */
export async function expireStaleInvites(
  organizationId: string,
  actorUserId?: string,
): Promise<{ expired: number }> {
  const profiles = await prisma.teammateProfile.findMany({
    where: { organizationId, type: "team_member", state: "invited" },
    select: { id: true, email: true, invitedAt: true },
  });

  const now = new Date();
  const stale = profiles.filter((profile) =>
    isInviteExpired(profile.invitedAt, now),
  );
  if (stale.length === 0) return { expired: 0 };

  await prisma.teammateProfile.updateMany({
    where: { id: { in: stale.map((profile) => profile.id) } },
    data: { state: "contact" },
  });

  for (const profile of stale) {
    await recordTeammateAuditEvent({
      organizationId,
      // A sweep has no human actor; fall back to the organization owner so the
      // audit row is always attributable.
      actorUserId: actorUserId ?? (await organizationOwnerId(organizationId)) ?? organizationId,
      action: "profile_state_changed",
      profileId: profile.id,
      details: { from: "invited", to: "contact", reason: "invite_expired" },
    });
  }

  return { expired: stale.length };
}

/**
 * Spec T3 item 3. Returns the usage when the add may proceed.
 *
 * At the limit this throws a 409 with code `seat_limit` so the UI can render an
 * upgrade confirm (not a hard block). With `confirmUpgrade` set, only an
 * Owner/Admin may proceed, and the allowance is raised by one as the placeholder
 * for a tier upgrade.
 */
export async function assertSeatAvailable({
  organizationId,
  actorUserId,
  confirmUpgrade = false,
}: {
  organizationId: string;
  actorUserId: string;
  confirmUpgrade?: boolean;
}): Promise<SeatUsage> {
  const usage = await getSeatUsage(organizationId);
  if (!usage.atLimit) return usage;

  if (!confirmUpgrade) {
    throw new TeammateDataError(
      `All ${usage.seatsIncluded} seats are in use. Confirm to add another Team Member.`,
      409,
      "seat_limit",
    );
  }

  const privileged = await isOwnerOrAdminOfOrganization({
    userId: actorUserId,
    organizationId,
  });
  if (!privileged) {
    throw new TeammateDataError(
      "Only an Owner or Admin can add a Team Member beyond the seat limit.",
      403,
      "seat_limit_owner_only",
    );
  }

  // Placeholder for a tier upgrade: raise the allowance so the meter stays true.
  const raised = usage.seatsIncluded + 1;
  await prisma.organization.update({
    where: { id: organizationId },
    data: { seatsIncluded: raised },
  });
  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "seat_limit_upgrade_confirmed",
    details: { from: usage.seatsIncluded, to: raised, seatsUsed: usage.seatsUsed },
  });

  return {
    ...usage,
    seatsIncluded: raised,
    seatsAvailable: Math.max(raised - usage.seatsUsed, 0),
    atLimit: usage.seatsUsed >= raised,
  };
}

/* ──────────────────── Email-domain guess (item 4) ──────────────────── */

/** Lower-cased domain of an address, or null when it has none. */
export function emailDomain(email: string | null | undefined): string | null {
  const value = (email ?? "").trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return null;
  return value.slice(at + 1);
}

/**
 * Mailbox providers that identify a PERSON, not an organization.
 *
 * The T3 rule is "a domain matching the organization defaults the invitee to Team Member",
 * and that is sound only when the domain is a firm's own. When an owner signs up with a
 * personal address, the guess read their personal domain as the organization's — so on a
 * gmail-based account every OTHER gmail contact (a spouse, a friend, an unrelated third
 * party) was guessed `team_member`, mirrored as a `contact`-state Team Member and then
 * surfaced in the team roster where it never belonged.
 *
 * These domains are therefore ignored when the organization's domains are derived. A firm
 * on a real domain is unaffected; a firm whose only addresses are public gets no internal
 * domain, so its contacts default to Collaborator and the advisor overrides per invite.
 */
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
]);

/** Does this domain belong to a public mailbox provider rather than a firm? */
function isPublicEmailDomain(domain: string): boolean {
  return PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/**
 * Domains that identify this organization: its own organization email domain,
 * then the owner's organization/user email domains. The first entry that yields
 * a domain wins, but all are returned so `guessPersonTypeForEmail` can accept any
 * of them.
 *
 * Public mailbox providers are dropped — see `PUBLIC_EMAIL_DOMAINS`. A gmail address is
 * one person's mailbox, not a firm's identity, so it must never make every other gmail
 * contact an internal Team Member.
 */
export async function getOrganizationDomains(
  organizationId: string,
): Promise<string[]> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { organizationEmail: true, ownerUserId: true },
  });

  const owner = organization?.ownerUserId
    ? await prisma.user.findUnique({
        where: { id: organization.ownerUserId },
        select: { email: true, organizationEmail: true },
      })
    : null;

  const domains = [
    emailDomain(organization?.organizationEmail),
    emailDomain(owner?.organizationEmail),
    emailDomain(owner?.email),
  ].filter((domain): domain is string => {
    if (!domain) return false;
    return !isPublicEmailDomain(domain);
  });

  return [...new Set(domains)];
}

/**
 * Spec T3 item 4 / Core Concepts: "a domain matching the organization defaults to
 * Team Member; any other domain defaults to Collaborator. The user can override."
 *
 * This only produces a DEFAULT — callers must let the user override it, which is
 * why it returns the guess rather than imposing it.
 */
export async function guessPersonTypeForEmail({
  organizationId,
  email,
}: {
  organizationId: string;
  email: string;
}): Promise<TeammatePersonType> {
  const domains = await getOrganizationDomains(organizationId);
  const inviteeDomain = emailDomain(email);
  if (inviteeDomain && domains.includes(inviteeDomain)) {
    return "team_member";
  }
  return "collaborator";
}

/* ────────────────────────── internals ────────────────────────── */

async function organizationOwnerId(
  organizationId: string,
): Promise<string | null> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerUserId: true },
  });
  return organization?.ownerUserId ?? null;
}
