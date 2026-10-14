/**
 * person-card.server — one person, as a profile card shows them.
 *
 * The comments rail lets a reader click a colleague's name and see who they are. That is a small
 * read with three separate obligations, and each one is a promise this module has to keep:
 *
 *  1. LOOK LIKE THE REST OF THE PRODUCT. The card must not invent a name or a face: a teammate's
 *     photo lives on their SEAT while the Owner has no seat at all, which is precisely the split
 *     `identity.server` exists to resolve. So the name and the picture come from
 *     `loadPersonIdentities` — the same call every comment author and DM row already goes through —
 *     rather than from a fresh reading of `User`.
 *
 *  2. STAY INSIDE THE ORGANIZATION. Clicking a name must not become a way to read any account in
 *     the product: `loadPersonIdentities` will happily resolve a `User` id belonging to another
 *     company, so the card is only produced for someone the viewer's own DIRECTORY lists — the
 *     Owner, or the holder of a seat in this organization. Anyone else yields null and the route
 *     answers 404, because "who is this?" has no answer here rather than an embarrassing one.
 *
 *  3. OFFER ONLY WHAT WOULD SUCCEED. `canMessage` is read from that SAME directory entry's
 *     `selectable` flag — the exact value `canMessageUser` derives, from the exact list
 *     `POST /api/messages/threads` will be checked against. A Message button that the API then
 *     refuses is the one failure mode this surface must not have (the same reason
 *     `listMentionableUsers` and `listDirectDirectory` were each collapsed to one predicate).
 *
 * The details — title, phone, extension, designations — follow the SAME precedence Settings → Profile
 * uses: the SEAT first, then the login's own row. The order matters, because the seat is the record
 * the organization keeps and the self-service Profile edits, while the login's copy is what an
 * account created at signup carries. It matters most for the Owner, who holds no seat at all: reading
 * the seat alone left their card with no title, no phone and no credentials, which is the whole
 * reason both sources are consulted. The seat read is scoped by organization — NOT
 * `findTeammateProfileForUser`, which takes a login's EARLIEST seat across every organization it has
 * ever held, so a login anchored to two companies could show this company's card with the other one's
 * job title on it.
 *
 * The PICTURE deliberately does not follow that order: it comes from `loadPersonIdentities`, which
 * puts the login's image first, so the face on this card is the same face the rail is already drawing
 * beside the name that was clicked.
 *
 * Server-only: it reads the database.
 */

import prisma from "@/lib/prisma";
import { loadPersonIdentities } from "@/lib/teammates/identity.server";
import { listDirectDirectory } from "@/lib/messages/directory.server";
import {
  mostPrivilegedRole,
  PERSON_TYPE_LABELS,
  PRESET_ROLE_LABELS,
  type TeammateAssignmentRole,
} from "@/types/teammate";
// The shape itself lives in the dependency-free sibling so the client dialog can name it without
// pulling this module — and Prisma — into the browser bundle.
import type { PersonCard } from "./person-card";

/**
 * The card for `userId`, or null when they are not someone this organization may be shown.
 *
 * Null is the answer for a deleted login AND for a login that belongs to another organization —
 * deliberately one return value for both, because the caller has nothing different to do with them:
 * neither is a person this viewer can be told about.
 */
export async function getPersonCard(input: {
  organizationId: string;
  viewerUserId: string;
  userId: string;
}): Promise<PersonCard | null> {
  const userId = input.userId.trim();
  if (!userId) return null;

  const [identities, directory, seat, login, organization] = await Promise.all([
    loadPersonIdentities({
      organizationId: input.organizationId,
      userIds: [userId],
    }),
    // The membership test and the messaging test in one read: whoever is absent from this list is
    // not part of the organization as far as the card is concerned.
    listDirectDirectory({
      organizationId: input.organizationId,
      viewerUserId: input.viewerUserId,
    }),
    // Scoped by organization on purpose — see the module note. Only the fields the card shows.
    prisma.teammateProfile.findFirst({
      where: { organizationId: input.organizationId, loginUserId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        jobTitle: true,
        phone: true,
        phoneExtension: true,
        designations: true,
        role: true,
      },
    }),
    // The account's OWN copy of those details — the fallback for anyone holding no seat, which is
    // every Owner. A teammate's live on their seat; the Owner's were captured at signup.
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        title: true,
        phone: true,
        phoneExtension: true,
        designations: true,
      },
    }),
    // The organization's shared address: the second Email row Settings → Profile shows.
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { organizationEmail: true },
    }),
  ]);

  // No `User` row means no name, no picture and nobody to message — a comment by a deleted login
  // already renders as "Removed user", and its author is not clickable.
  const identity = identities.get(userId);
  if (!identity) return null;

  const isSelf = userId === input.viewerUserId;

  // The viewer's own card is always theirs to open, even though the directory excludes them
  // (it lists who you may TALK to, not who you are). For everyone else the directory entry is both
  // the permission to look and the verdict on messaging.
  const entry = isSelf
    ? null
    : directory.find((candidate) => candidate.userId === userId);
  if (!isSelf && !entry) return null;

  // The role is per-assignment (one row per plan), so a person on several plans can hold several.
  // Summarised with the same `mostPrivilegedRole` rule Settings → People & Access uses, so the card
  // cannot chip someone "Viewer" while the team list calls them "Admin".
  let roleLabel: string | null = null;
  if (identity.isOrganizationOwner) {
    roleLabel = PRESET_ROLE_LABELS.owner;
  } else if (seat) {
    const assignments = await prisma.planAssignment.findMany({
      where: { profileId: seat.id },
      select: { role: true },
    });
    const role =
      assignments.length > 0
        ? mostPrivilegedRole(
            assignments.map(
              (assignment) => assignment.role as TeammateAssignmentRole,
            ),
          )
        : (seat.role as TeammateAssignmentRole | null);
    roleLabel = role ? PRESET_ROLE_LABELS[role] : null;
  }

  const standingLabel = identity.isOrganizationOwner
    ? PRESET_ROLE_LABELS.owner
    : seat?.type === "team_member"
      ? PERSON_TYPE_LABELS.team_member
      : seat?.type === "collaborator"
        ? PERSON_TYPE_LABELS.collaborator
        : // Unreachable while the directory gate above holds (it lists only the Owner and seat
          // holders), but a card with no standing at all would be worse than a vague one.
          "Teammate";

  // Seat first, then the login — the precedence Settings → Profile uses, and the only way the
  // Owner's card carries a title, a phone and credentials at all. Resolved once, here, rather than
  // four slightly different `??` chains that could drift apart in the JSX-facing object below.
  const jobTitle = seat?.jobTitle || login?.title || null;
  const phone = seat?.phone || login?.phone || null;
  const phoneExtension = seat?.phoneExtension || login?.phoneExtension || null;
  const designations =
    seat?.designations && seat.designations.length > 0
      ? seat.designations
      : (login?.designations ?? []);

  return {
    userId,
    name: identity.name?.trim() || identity.email,
    email: identity.email,
    organizationEmail: organization?.organizationEmail?.trim() || null,
    headshot: identity.headshot,
    standingLabel,
    roleLabel,
    jobTitle,
    phone,
    phoneExtension,
    designations,
    isSelf,
    // A directory entry that is listed but not selectable is a real colleague the viewer simply may
    // not message yet (an invite not accepted, or a collaborator sharing no plan). The card still
    // renders — it just does not offer the button.
    canMessage: Boolean(entry?.selectable),
  };
}
