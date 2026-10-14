/**
 * identity.server — the ONE place a login id becomes a person.
 *
 * A person exists twice in this product: as a LOGIN (`User`) and, when they hold a seat in an
 * organization, as a PROFILE (`TeammateProfile`). The two carry their own name and their own picture,
 * and the record that matters is usually the SEAT — the self-service profile is what a teammate edits
 * and what the organization sees.
 *
 * Anything that renders a person therefore has to consult both. Until this module existed, each
 * surface decided for itself how: the DM rail fell back to the seat and showed pictures, while the
 * comments resolvers read the login alone and drew a monogram for every teammate who is not the
 * Owner. That was the whole bug — a Collaborator's picture lives on their seat, and the comments UI
 * never looked at it. Two surfaces rendering the same person differently is not a styling difference;
 * it is two answers to one question.
 *
 * So the precedence lives here, once:
 *
 *  - NAME — the seat's `firstName`/`lastName` when there is a seat, else the login's own name;
 *  - PICTURE — the login's own picture first, then the seat's. The login is the account's own image
 *    and the seat is the fallback, which is the order the DM rail already shipped with; keeping it is
 *    what makes this a fix for the comments UI rather than a change of behaviour in the DM rail.
 *
 * A surface may still choose its own WORDING for an absent name — a DM prefers an email to nothing,
 * a comment says "Unknown user" — but it may not invent its own precedence, which is how the two
 * panels drifted apart in the first place.
 *
 * Server-only: it reads the database.
 */

import prisma from "@/lib/prisma";

/** A person, as every surface needs them: one name, one picture, one standing. */
export interface PersonIdentity {
  userId: string;
  /** Seat first+last when there is a seat, else the login's own name. Null only when neither exists. */
  name: string | null;
  email: string;
  /** The login's picture, else the seat's, else null. */
  headshot: string | null;
  /** The seat's `type` ("team_member" | "collaborator"), or null for a login holding no seat. */
  seatType: string | null;
  /** True for the organization's `ownerUserId`, who holds no seat at all. */
  isOrganizationOwner: boolean;
}

/**
 * Resolve a batch of login ids to identities, in ONE pair of reads.
 *
 * The seat lookup is scoped by organization because that is the organization whose roster is being
 * rendered: a login can in principle be anchored to more than one organization (a self-deleted profile
 * that was revived somewhere else), and picking up the wrong seat would put another company's name on
 * this one's comments.
 *
 * A missing id simply yields no entry — a comment by a deleted login renders as "Removed user" rather
 * than as a nameless person with a stale name.
 */
export async function loadPersonIdentities(input: {
  organizationId: string;
  userIds: string[];
}): Promise<Map<string, PersonIdentity>> {
  const ids = [...new Set(input.userIds.filter(Boolean))];
  const identities = new Map<string, PersonIdentity>();
  if (ids.length === 0) return identities;

  const [users, organization, seats] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, headshot: true },
    }),
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { ownerUserId: true },
    }),
    prisma.teammateProfile.findMany({
      where: { organizationId: input.organizationId, loginUserId: { in: ids } },
      select: {
        loginUserId: true,
        type: true,
        firstName: true,
        lastName: true,
        headshot: true,
      },
    }),
  ]);

  const seatByUserId = new Map(seats.map((seat) => [seat.loginUserId, seat]));

  for (const user of users) {
    const seat = seatByUserId.get(user.id);
    const seatName = seat
      ? [seat.firstName, seat.lastName]
          .map((part) => (part ?? "").trim())
          .filter(Boolean)
          .join(" ")
      : "";

    // A login with neither a seat nor ownership is a removed teammate whose account survives; the
    // standing is left as "not the owner, no seat" and each caller decides what to call that. Guessing
    // "collaborator" over-claims nothing, which is why the DM rail reads it that way.
    identities.set(user.id, {
      userId: user.id,
      name: seatName || user.name?.trim() || null,
      email: user.email,
      headshot: user.headshot ?? seat?.headshot ?? null,
      seatType: seat?.type ?? null,
      isOrganizationOwner: organization?.ownerUserId === user.id,
    });
  }

  return identities;
}
