/**
 * hub-contacts.server — T7's read half.
 *
 * Spec T7 Part B item 1: *"The hub renders from profile + assignment. One source of
 * truth; contact details are never duplicated."*
 *
 * This builds the card array the Benefits Hub renders — My Benefits Team and the
 * benefit category pages — from assignments joined to profiles, instead of from the
 * plan's stored `keyContacts` array.
 *
 * Three things make that safe to swap in one place:
 *
 *  1. **The card `id` is the assignment's `contactId` when it has one.** Every
 *     `Benefit.supportContacts[].contactId` cross-reference keeps resolving, because
 *     the mirror stored the id the contact already had.
 *  2. **`showOnPortal` is derived from `showOnBenefitsHub`** (T7 Part B item 2: display
 *     off hides the person but keeps their admin access). The existing readers already
 *     filter on `showOnPortal`, so they keep working unchanged.
 *  3. **Category scope is expanded, not invented.** An assignment scoped to `all`
 *     reports every benefit category, which is exactly what the category-visibility
 *     filter (T7 Part B item 3) and the per-category readers expect.
 *
 * Deactivated profiles are excluded: T6 ends their access, and the hub is a surface for
 * live people.
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";
import { BENEFIT_CONTACT_CATEGORIES } from "@/lib/benefit-contacts";
import { readPlanContacts } from "./contact-mirror.server";

/**
 * A hub card. Deliberately shaped like the historical `KeyContact` row, because the
 * portal's readers, the card layouts and the CSS already speak that shape — the point
 * of T7 is to change where the DATA comes from, not to redesign the card.
 */
export interface HubContactCard {
  id: string;
  /** The row this card came from, so a management UI can address it. */
  assignmentId: string;
  profileId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  designation: string | null;
  email: string;
  phone: string | null;
  phoneExtension: string | null;
  headshot: string | null;
  companyName: string | null;
  companyLogo: string | null;
  /** Derived from `showOnBenefitsHub` (T7 Part B item 2). */
  showOnPortal: boolean;
  benefitsCategories: string[];
  benefitsCategory: string | null;
  contactType: "individual" | "team_support";
  role: string;
  /** Named explicitly, because the two roles differ and the advisor should see which. */
  personType: "team_member" | "collaborator";
  /** False for a Contact (no login), true once invited or active. */
  hasAccess: boolean;
}

export interface BuildHubContactsInput {
  organizationId: string;
  clientId: string;
  /** Only live people by default; the management screens ask for everything. */
  includeHidden?: boolean;
}

/**
 * Every assignment on this plan, joined to its profile, as hub cards.
 *
 * Ordered so the plan sponsor reads first and the rest keep a stable order: contacts
 * the advisor placed in the wizard carry a `contactDisplayOrder`, and profiles created
 * later simply append, which preserves today's card ordering.
 */
export async function buildHubContacts(
  input: BuildHubContactsInput,
): Promise<HubContactCard[]> {
  const assignments = await prisma.planAssignment.findMany({
    where: {
      clientId: input.clientId,
      organizationId: input.organizationId,
      ...(input.includeHidden ? {} : { showOnBenefitsHub: true }),
    },
    orderBy: { createdAt: "asc" },
  });
  if (assignments.length === 0) return [];

  const profiles = await prisma.teammateProfile.findMany({
    where: {
      organizationId: input.organizationId,
      id: { in: assignments.map((assignment) => assignment.profileId) },
    },
  });
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const companyIds = [
    ...new Set(
      profiles
        .map((profile) => profile.companyId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const companies =
    companyIds.length > 0
      ? await prisma.teammateCompany.findMany({
          where: { organizationId: input.organizationId, id: { in: companyIds } },
          select: { id: true, name: true, logo: true },
        })
      : [];
  const companyById = new Map(companies.map((company) => [company.id, company]));

  const cards: HubContactCard[] = [];

  for (const assignment of assignments) {
    const profile = profileById.get(assignment.profileId);
    // An assignment whose profile is gone is not a person; skip it rather than render
    // a blank card.
    if (!profile) continue;
    if (profile.deactivatedAt) continue;

    const company = profile.companyId
      ? companyById.get(profile.companyId) ?? null
      : null;

    const categories =
      assignment.categoryScope === "all"
        ? [...BENEFIT_CONTACT_CATEGORIES]
        : Array.isArray(assignment.categories)
          ? (assignment.categories as string[])
          : [];

    const name =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
      profile.email;

    cards.push({
      // T7: the id every support-contact reference already uses; falls back to the
      // assignment for someone who was never a Key Contact.
      id: assignment.contactId ?? assignment.id,
      assignmentId: assignment.id,
      profileId: profile.id,
      name,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      title: profile.jobTitle ?? null,
      designation:
        Array.isArray(profile.designations) && profile.designations.length > 0
          ? (profile.designations as string[]).join(", ")
          : null,
      email: profile.email,
      phone: profile.phone ?? null,
      phoneExtension: profile.phoneExtension ?? null,
      headshot: profile.headshot ?? null,
      companyName: company?.name ?? null,
      companyLogo: company?.logo ?? null,
      showOnPortal: Boolean(assignment.showOnBenefitsHub),
      benefitsCategories: categories,
      benefitsCategory: categories[0] ?? null,
      // Team Members render through the support-team card, external people through the
      // individual one — the same split the wizard's cards use.
      contactType: profile.type === "team_member" ? "team_support" : "individual",
      role: assignment.role,
      personType: profile.type as "team_member" | "collaborator",
      hasAccess: profile.state !== "contact" && Boolean(profile.loginUserId),
    });
  }

  return cards;
}

/**
 * The portal payload's `keyContacts` value.
 *
 * Presentation settings (layout, card colours, logo scale) are NOT contact details, so
 * they stay on the stored blob and are passed through untouched while the cards
 * themselves come from profile + assignment. That keeps the six existing readers
 * working, because they read `{ contacts, displayStyle, … }`.
 */
export async function buildPortalKeyContacts(input: {
  organizationId: string;
  clientId: string;
  presentation: unknown;
}): Promise<unknown> {
  const contacts = await buildHubContacts({
    organizationId: input.organizationId,
    clientId: input.clientId,
  });

  // Presentation settings (layout, card colours, logo scale) only exist on the object
  // shape. A bare array carries contacts and nothing else, so it has no settings to
  // preserve — but its contacts must still be read.
  const presentation =
    input.presentation && typeof input.presentation === "object" && !Array.isArray(input.presentation)
      ? (input.presentation as Record<string, unknown>)
      : null;

  /**
   * Pass through any contact the mirror could not represent.
   *
   * A `TeammateProfile` requires an email, so a contact row without one cannot be
   * mirrored — and the organization OWNER is deliberately never mirrored (they are not
   * a teammate). Neither must silently vanish from a live hub because of that. Any
   * stored contact whose id is absent from the derived cards is appended unchanged, so
   * the switch to profile + assignment is non-destructive by construction rather than by
   * having migrated everything perfectly. The set shrinks to empty as coverage grows,
   * and it is residue rather than a second source of truth: nothing here is ever read
   * for a contact that DID mirror.
   *
   * `readPlanContacts` is what makes this work for the historical ARRAY shape: reading
   * `presentation.contacts` alone found nothing there, so the residue pass silently
   * dropped every unmirrored contact from array-shaped plans.
   */
  const derivedIds = new Set(contacts.map((card) => String(card.id)));
  const residue = readPlanContacts(input.presentation).filter((contact) => {
    const id = contact?.id;
    if (id === undefined || id === null || String(id).trim() === "") {
      // No id to match on, so it cannot be proven mirrored — keep it visible.
      return true;
    }
    return !derivedIds.has(String(id));
  });

  const merged = [...contacts, ...residue];

  // Array shape in, array shape out — the portal's readers accept either, and the
  // historical shape carried no settings to lose.
  if (!presentation) return merged;

  return { ...presentation, contacts: merged };
}
