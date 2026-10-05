/**
 * contact-mirror.server — T7's write half.
 *
 * Spec T7 Part B item 1: *"The hub renders from profile + assignment. One source of
 * truth; contact details are never duplicated."*
 *
 * The advisor still authors contacts the way they always have — the Key Contacts
 * wizard, the Edit Client tab, the Benefits contacts step — and those writes all end
 * up in `Client.keyContacts`. This module projects that array onto the teammate layer,
 * so profile + assignment is what the hub reads and `keyContacts` is only ever an
 * authoring surface.
 *
 * It is idempotent: call it after any write that touches `keyContacts`, and with the
 * whole array. It reconciles rather than appends.
 *
 * Four rules, each with a reason:
 *
 *  1. **A Contact gets a profile in the `contact` state and no login.** Contacts hold
 *     no seat (`getSeatUsage` counts only non-contact Team Members) and grant no access
 *     (the permission layer resolves people by login, and there is none).
 *  2. **Person type follows the organization's own domain rule** — the same
 *     `guessPersonTypeForEmail` the invite flow uses, so the advisor's own address
 *     mirrors as a Team Member and everyone else as a Collaborator.
 *  3. **A `contact`-state profile is synced from the contact; anything else is left
 *     alone.** Once someone is invited or active, T5 Part B item 2 applies: "once
 *     Active, the collaborator controls their own individual info. The advisor
 *     controls assignments and display." Overwriting an active person's job title from
 *     a stale contact row would be exactly the drift this module exists to remove.
 *  4. **Nothing here writes an audit event.** A mirror is a projection of the advisor's
 *     own contact data, not an access decision: it never changes an existing
 *     assignment's role, and a mirrored Viewer has no login through which to use it.
 *     Access changes stay audited where they are made (T4, T6).
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { findOrCreatePartnerCompany } from "./companies.server";
import {
  createTeammateProfile,
  findProfileByEmail,
  updateTeammateProfile,
} from "./profiles.server";
import { guessPersonTypeForEmail } from "./seats.server";
import {
  PERMISSION_FUNCTIONS,
  presetPermissionSet,
} from "@/types/teammate";

export interface MirrorPlanContactsInput {
  organizationId: string;
  actorUserId: string;
  clientId: string;
  /** Whatever `Client.keyContacts` holds: a `KeyContact[]` or `{ contacts: [...] }`. */
  keyContacts: unknown;
}

export interface MirrorPlanContactsResult {
  profilesCreated: number;
  profilesUpdated: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  assignmentsRemoved: number;
  /** Rows with no usable email — cannot become a profile, so they are not shown. */
  skipped: number;
  /**
   * Rows carrying the organization owner's own address. The owner is not a teammate
   * (see `organizationOwnerEmails` below), so these are skipped rather than mirrored.
   */
  skippedOwner: number;
  /** Stale owner profiles removed — the self-healing half of `skippedOwner`. */
  ownerProfilesRemoved: number;
}

/** Read the contacts array out of either storage shape. */
export function readPlanContacts(keyContacts: unknown): Record<string, unknown>[] {
  if (Array.isArray(keyContacts)) return keyContacts as Record<string, unknown>[];
  const raw = keyContacts as { contacts?: unknown; Contacts?: unknown } | null;
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.contacts)) return raw.contacts as Record<string, unknown>[];
    if (Array.isArray(raw.Contacts)) return raw.Contacts as Record<string, unknown>[];
  }
  return [];
}

/** The Viewer preset as a plain JSON object, for a freshly mirrored assignment. */
function viewerGridJson(): Prisma.InputJsonValue {
  const grid = presetPermissionSet("viewer");
  const out: Record<string, string> = {};
  for (const fn of PERMISSION_FUNCTIONS) out[fn] = grid[fn];
  return out;
}

/**
 * The addresses that identify this organization's owner.
 *
 * **The owner is not a teammate.** Their canonical representation is
 * `Organization.ownerUserId`, and `listOrgPeople` synthesizes their Team Member row from
 * it — the same rule `lib/teammates/onboarding-owner.ts` states for the wizard: *"It does
 * not create a TeammateProfile for the owner … storing a second copy would be a third
 * source of truth that could drift."*
 *
 * Without this, the mirror breaks that rule in the most visible way possible: Create Plan
 * Step 3 seeds the advisor's **own** contact into `Client.keyContacts`, so the owner got a
 * mirrored profile *and* a Viewer assignment, and Settings → Team Members then showed the
 * owner twice — the synthesized row plus a duplicate wearing Viewer.
 *
 * Both addresses are returned because the seeded contact is built from whichever identity
 * the wizard captured: `User.email` is the login identity and `User.organizationEmail` is
 * what advisor contact cards display (Create Plan Step 3). Either can end up as the
 * `email` on the mirror's input row.
 */
/**
 * Exported for `contacts.server.ts`: the People & Access picker must not offer the owner
 * as somebody to promote, for the same reason the mirror must not create a profile for
 * them — the owner is not a teammate (see `onboarding-owner.ts`).
 */
export async function organizationOwnerEmails(
  organizationId: string,
): Promise<Set<string>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerUserId: true },
  });
  if (!organization?.ownerUserId) return new Set();

  const owner = await prisma.user.findUnique({
    where: { id: organization.ownerUserId },
    select: { email: true, organizationEmail: true },
  });

  const emails = new Set<string>();
  for (const value of [owner?.email, owner?.organizationEmail]) {
    const normalized = str(value).toLowerCase();
    if (normalized) emails.add(normalized);
  }
  return emails;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function emailOf(contact: Record<string, unknown>): string {
  return str(contact.email).toLowerCase();
}

function nameParts(contact: Record<string, unknown>): {
  firstName: string | null;
  lastName: string | null;
} {
  const first = str(contact.firstName);
  const last = str(contact.lastName);
  if (first || last) {
    return { firstName: first || null, lastName: last || null };
  }
  // Older rows only carry a single display name.
  const display = str(contact.displayName) || str(contact.name);
  if (!display) return { firstName: null, lastName: null };
  const [head, ...rest] = display.split(/\s+/).filter(Boolean);
  return {
    firstName: head ?? null,
    lastName: rest.length > 0 ? rest.join(" ") : null,
  };
}

function categoriesOf(contact: Record<string, unknown>): string[] {
  const many = contact.benefitsCategories;
  if (Array.isArray(many)) {
    return [...new Set(many.map((value) => str(value)).filter(Boolean))];
  }
  const one = str(contact.benefitsCategory);
  return one ? [one] : [];
}

function designationsOf(contact: Record<string, unknown>): string[] {
  const many = contact.designations;
  if (Array.isArray(many)) {
    return [...new Set(many.map((value) => str(value)).filter(Boolean))];
  }
  const one = str(contact.designation);
  return one ? [one] : [];
}

/**
 * Project this plan's contacts onto profiles + assignments.
 *
 * Safe to call on every save: it creates what is missing, updates what it owns, and
 * removes only mirrored assignments whose contact is gone.
 */
export async function mirrorPlanContacts(
  input: MirrorPlanContactsInput,
): Promise<MirrorPlanContactsResult> {
  const result: MirrorPlanContactsResult = {
    profilesCreated: 0,
    profilesUpdated: 0,
    assignmentsCreated: 0,
    assignmentsUpdated: 0,
    assignmentsRemoved: 0,
    skipped: 0,
    skippedOwner: 0,
    ownerProfilesRemoved: 0,
  };

  const plan = await prisma.client.findFirst({
    where: { id: input.clientId, organizationId: input.organizationId },
    select: { id: true, companyName: true },
  });
  if (!plan) return result;

  const contacts = readPlanContacts(input.keyContacts);
  const planCompanyName = str(plan.companyName).toLowerCase();
  const ownerEmails = await organizationOwnerEmails(input.organizationId);

  const existingAssignments = await prisma.planAssignment.findMany({
    where: { clientId: input.clientId, organizationId: input.organizationId },
  });
  const byProfileId = new Map(
    existingAssignments.map((assignment) => [assignment.profileId, assignment]),
  );
  const byContactId = new Map(
    existingAssignments
      .filter((assignment) => assignment.contactId)
      .map((assignment) => [assignment.contactId as string, assignment]),
  );

  const seenProfileIds = new Set<string>();

  for (const contact of contacts) {
    const email = emailOf(contact);
    const contactId = str(contact.id) || null;
    if (!email || !email.includes("@")) {
      result.skipped += 1;
      continue;
    }

    // The owner is skipped BEFORE anything is created, and deliberately NOT added to
    // `seenProfileIds` — leaving them out of that set is what makes the cleanup pass at
    // the end of this function treat a previously-mirrored owner as an orphan.
    if (ownerEmails.has(email)) {
      result.skippedOwner += 1;
      continue;
    }

    const categories = categoriesOf(contact);
    const designations = designationsOf(contact);
    const { firstName, lastName } = nameParts(contact);
    const jobTitle =
      str(contact.title) || str(contact.customRole) || str(contact.role) || null;
    const showOnBenefitsHub = contact.showOnPortal !== false;

    // ── company ──────────────────────────────────────────────────────────────
    // A Key Contact whose company IS the plan sponsor carries the plan's own company
    // name and logo. Creating a Partner/Provider row for it would put an employer into
    // the partner list, which T1 forbids — so the card falls back to the plan's own
    // branding, while only genuinely external firms become companies.
    let companyId: string | null = null;
    const contactCompany = str(contact.companyName);
    if (contactCompany && contactCompany.toLowerCase() !== planCompanyName) {
      const company = await findOrCreatePartnerCompany({
        organizationId: input.organizationId,
        name: contactCompany,
        logo: str(contact.companyLogo) || null,
        actorUserId: input.actorUserId,
      });
      companyId = company.id;
    }

    // ── profile ──────────────────────────────────────────────────────────────
    let profile = await findProfileByEmail(input.organizationId, email);
    if (!profile) {
      const type = await guessPersonTypeForEmail({
        organizationId: input.organizationId,
        email,
      });
      profile = await createTeammateProfile({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        type,
        // A Contact: no login, no seat, no invite sent.
        state: "contact",
        email,
        firstName,
        lastName,
        jobTitle,
        designations,
        phone: str(contact.phone) || null,
        phoneExtension: str(contact.phoneExtension) || null,
        headshot: str(contact.headshot) || null,
        benefitsSpecialty: categories,
        companyId,
        allPlans: false,
      });
      result.profilesCreated += 1;
    } else if (profile.state === "contact" && !profile.deactivatedAt) {
      // Rule 3: the contact is the source only while the person is still a Contact.
      await updateTeammateProfile({
        id: profile.id,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        data: {
          firstName,
          lastName,
          jobTitle,
          designations,
          phone: str(contact.phone) || null,
          phoneExtension: str(contact.phoneExtension) || null,
          headshot: str(contact.headshot) || null,
          benefitsSpecialty: categories,
          ...(companyId ? { companyId } : {}),
        },
      });
      result.profilesUpdated += 1;
    }

    seenProfileIds.add(profile.id);

    // ── assignment ───────────────────────────────────────────────────────────
    const existing =
      byProfileId.get(profile.id) ??
      (contactId ? byContactId.get(contactId) : undefined);

    if (!existing) {
      const created = await prisma.planAssignment.create({
        data: {
          organizationId: input.organizationId,
          profileId: profile.id,
          clientId: input.clientId,
          role: "viewer",
          permissionSet: viewerGridJson(),
          categoryScope: categories.length > 0 ? "selected" : "all",
          categories,
          showOnBenefitsHub,
          contactId,
          lastChangedByUserId: input.actorUserId,
          lastChangedAt: new Date(),
        },
      });
      byProfileId.set(profile.id, created);
      if (contactId) byContactId.set(contactId, created);
      result.assignmentsCreated += 1;
      continue;
    }

    // `contactId` is NOT "individual info" — it is the link the Benefits Hub resolves
    // through. `Benefit.supportContacts[].contactId` is matched against the hub card
    // id, and the card id is `assignment.contactId ?? assignment.id`. A person who was
    // added as a Team Member FIRST and then mirrored as a Key Contact (or vice versa)
    // has an assignment created before the id was known, so it stays null and every
    // benefit that points at that contact renders with no headshot, email or phone.
    // Backfilling the link restores those references and changes nothing else.
    if (contactId && !existing.contactId) {
      await prisma.planAssignment.update({
        where: { id: existing.id },
        data: {
          contactId,
          lastChangedByUserId: input.actorUserId,
          lastChangedAt: new Date(),
        },
      });
      byContactId.set(contactId, existing);
      result.assignmentsUpdated += 1;
    }

    // Only a mirrored, still-a-Contact assignment is synced. An invited or active
    // person's assignment belongs to T6: the advisor sets its role, categories and
    // visibility there, and this must not fight them.
    const isMirroredOnly = profile.state === "contact" && !profile.loginUserId;
    if (!isMirroredOnly) continue;

    // Rule 4: the role is never changed here.
    const needsSync =
      existing.contactId !== contactId ||
      existing.categoryScope !== (categories.length > 0 ? "selected" : "all") ||
      JSON.stringify(existing.categories) !== JSON.stringify(categories) ||
      existing.showOnBenefitsHub !== showOnBenefitsHub;

    if (needsSync) {
      await prisma.planAssignment.update({
        where: { id: existing.id },
        data: {
          contactId,
          categoryScope: categories.length > 0 ? "selected" : "all",
          categories,
          showOnBenefitsHub,
          lastChangedByUserId: input.actorUserId,
          lastChangedAt: new Date(),
        },
      });
      result.assignmentsUpdated += 1;
    }
  }

  // ── removals ───────────────────────────────────────────────────────────────
  // An assignment whose contact was deleted from the plan goes away — but only when it
  // is purely a mirror. If the person has a login or has moved past `contact`, their
  // access is real and only T6 may remove it.
  //
  // The test is deliberately ONLY "was this profile among the contacts we just saw".
  // An earlier version also required the profile to be absent from the plan's existing
  // assignments, which is vacuous — every existing assignment is keyed there by
  // definition — so a removed contact's row was never deleted. The profile-state guard
  // below is what protects real access, and it has to be the only thing that does.
  const orphaned = existingAssignments.filter(
    (assignment) =>
      assignment.contactId && !seenProfileIds.has(assignment.profileId),
  );

  for (const assignment of orphaned) {
    const profile = await prisma.teammateProfile.findFirst({
      where: { id: assignment.profileId, organizationId: input.organizationId },
      select: { state: true, loginUserId: true },
    });
    if (!profile) {
      await prisma.planAssignment.delete({ where: { id: assignment.id } });
      result.assignmentsRemoved += 1;
      continue;
    }
    if (profile.state === "contact" && !profile.loginUserId) {
      await prisma.planAssignment.delete({ where: { id: assignment.id } });
      result.assignmentsRemoved += 1;
    }
  }

  // ── self-healing: remove the owner's phantom profile ────────────────────────
  // Before the owner skip existed, mirroring the advisor's own contact left a real
  // `TeammateProfile` (type team_member, state contact, never signed in) plus its Viewer
  // assignment. The assignment is already gone — the orphan pass above removes it, because
  // the owner never enters `seenProfileIds`. What lingers is the profile row itself, which
  // still renders as a duplicate Team Member, so it has to go too.
  //
  // Bounded to what is unmistakably a mirror trace: a Contact that never signed in, is not
  // deactivated, and now holds no assignment at all. Anything else — a deactivated record,
  // a linked login, a profile someone still has access through — is left untouched.
  if (ownerEmails.size > 0) {
    const traces = await prisma.teammateProfile.findMany({
      where: {
        organizationId: input.organizationId,
        state: "contact",
        loginUserId: null,
        OR: [...ownerEmails].map((address) => ({
          email: { equals: address, mode: "insensitive" as const },
        })),
      },
      select: { id: true },
    });

    if (traces.length > 0) {
      const ids = traces.map((trace) => trace.id);
      const stillAssigned = await prisma.planAssignment.findMany({
        where: { profileId: { in: ids } },
        select: { profileId: true },
        distinct: ["profileId"],
      });
      const assigned = new Set(stillAssigned.map((row) => row.profileId));
      const removable = ids.filter((id) => !assigned.has(id));
      if (removable.length > 0) {
        await prisma.teammateProfile.deleteMany({
          where: { id: { in: removable } },
        });
        result.ownerProfilesRemoved = removable.length;
      }
    }
  }

  return result;
}

/**
 * Mirror without ever failing the caller's write.
 *
 * A save that has already committed must not be reported as failed because the
 * projection onto the teammate layer hit a problem: the advisor's data is safe either
 * way, and `npm run teammates:backfill-contacts` repairs the projection. Every route
 * that writes `Client.keyContacts` uses this, so a mirror fault is logged rather than
 * surfaced to the advisor.
 */
export async function mirrorPlanContactsSafely(
  input: MirrorPlanContactsInput,
): Promise<void> {
  try {
    await mirrorPlanContacts(input);
  } catch (error) {
    console.error("[teammates] contact mirror failed", error);
  }
}
