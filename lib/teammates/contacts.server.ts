/**
 * contacts.server — the address book behind the People & Access picker.
 *
 * A "contact" here is a `TeammateProfile` in the `contact` state: somebody the organization
 * already knows because they appear on a plan's Key Contacts, but who has never been given
 * access. The T7 mirror creates them (`contact-mirror.server.ts`), and a Contact is
 * deliberately inert — no login, no seat, no invitation.
 *
 * This module exists so the Add modal can offer those people rather than making an advisor
 * retype a name and email the system already holds. It is a READING module:
 * [`addTeamMember`](./team.server.ts) owns the promotion itself, including the seat gate
 * and the state transition. Keeping the two apart means the picker cannot quietly become a
 * second write path, and the seat check stays in the one place that already enforces it.
 *
 * Server-only. Every function takes an explicit `organizationId`.
 */

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { organizationOwnerEmails } from "./contact-mirror.server";

/**
 * How many contacts the picker shows before the advisor types anything.
 *
 * Search is the primary interaction, but an empty search box is invisible: an advisor who
 * does not already know a contact exists would never find them. A short browse list is what
 * makes the affordance discoverable, so this is a product number, not a performance one.
 */
export const CONTACT_BROWSE_LIMIT = 20;

export interface PromotableContactRow {
  profileId: string;
  name: string;
  email: string;
  headshot: string | null;
  jobTitle: string | null;
  companyName: string | null;
  /**
   * How many plans this person already appears on. The advisor's real question when
   * scanning the list is "who is this?", and "4 plans" answers it far better than an email
   * address on its own.
   */
  planCount: number;
}

/**
 * Contacts that can be promoted to Team Members.
 *
 * The `state: "contact"` filter is the whole specification. Somebody `invited` or `active`
 * already has access, so they are not a promotion candidate — giving them more plans is a
 * different action on a different screen. An invite that lapsed back to `contact` after
 * `INVITE_SEAT_HOLD_DAYS` does return here, and that is correct: they need promoting again,
 * and `setProfileState` now gives them a fresh invite window when they are.
 *
 * The owner is excluded because the owner is not a teammate — the same rule the mirror
 * follows, documented in `onboarding-owner.ts`.
 *
 * Matching happens in the database with `mode: "insensitive"`. On PostgreSQL that operator
 * exists, which matters: a case-sensitive match would mean typing "jane" never finds
 * "Jane Smith".
 */
export async function searchPromotableContacts({
  organizationId,
  query,
  limit,
}: {
  organizationId: string;
  /** Empty or whitespace returns the browse list rather than nothing. */
  query: string;
  limit?: number;
}): Promise<PromotableContactRow[]> {
  const needle = (query ?? "").trim();
  const searching = needle.length > 0;

  const where: Prisma.TeammateProfileWhereInput = {
    organizationId,
    state: "contact",
    // One predicate is enough on PostgreSQL, where "never set" and an explicit clear are
    // both NULL (docs/teammates-module.md §7.3).
    deactivatedAt: null,
  };
  if (searching) {
    where.OR = [
      { firstName: { contains: needle, mode: "insensitive" } },
      { lastName: { contains: needle, mode: "insensitive" } },
      { email: { contains: needle, mode: "insensitive" } },
      // Job title is searched too: advisors think of people as "the HR consultant", and
      // the title is already stored from the Key Contact.
      { jobTitle: { contains: needle, mode: "insensitive" } },
    ];
  }

  const [ownerEmails, profiles] = await Promise.all([
    organizationOwnerEmails(organizationId),
    prisma.teammateProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: searching ? (limit ?? 8) : CONTACT_BROWSE_LIMIT,
    }),
  ]);

  const candidates = profiles.filter(
    (profile) => !ownerEmails.has(profile.email.trim().toLowerCase()),
  );
  if (candidates.length === 0) return [];

  // Company names come from one query rather than one per row: `companyId` is a plain
  // scalar here, because the teammate models carry no relations
  // (docs/teammates-module.md §7.4), so there is nothing to `include`.
  const companyIds = [
    ...new Set(
      candidates
        .map((profile) => profile.companyId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [companies, planCounts] = await Promise.all([
    companyIds.length > 0
      ? prisma.teammateCompany.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    // One grouped count instead of a count per candidate, so the row list costs a fixed
    // number of queries however many contacts are shown.
    prisma.planAssignment.groupBy({
      by: ["profileId"],
      where: {
        organizationId,
        profileId: { in: candidates.map((profile) => profile.id) },
      },
      _count: { _all: true },
    }),
  ]);

  const companyNameById = new Map(
    companies.map((company) => [company.id, company.name]),
  );
  const planCountByProfile = new Map(
    planCounts.map((row) => [row.profileId, row._count._all]),
  );

  return candidates.map((profile) => ({
    profileId: profile.id,
    name:
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.email,
    email: profile.email,
    headshot: profile.headshot ?? null,
    jobTitle: profile.jobTitle ?? null,
    companyName: profile.companyId
      ? (companyNameById.get(profile.companyId) ?? null)
      : null,
    planCount: planCountByProfile.get(profile.id) ?? 0,
  }));
}
