import type { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";
import {
  contactCategories,
  mergeContactCategoryLists,
} from "@/lib/benefit-contacts";

const STABLE_ID_PREFIX = "onboarding-primary-advisor";

/**
 * The seeded advisor contact's id.
 *
 * ONE row carries every primary service category. It used to be one row per category
 * (`onboarding-primary-advisor-Retirement`, `…-Group-Health`, …), which made the advisor's
 * own card appear once per category in the Step 3 preview and on My Benefits Team. The
 * suffixed form is still recognised below, so drafts saved before this change are treated
 * as the same person and folded into the single row.
 */
const STABLE_ID = STABLE_ID_PREFIX;

/**
 * Advisor profile visuals (logo, headshot, etc.) on rows below belong to **per-category
 * key contacts** seeded from `primaryServiceCategories` — not the plan’s Step 1
 * “Company Logo” or brand header (those are client/plan assets only).
 */

/** Map User.primaryServiceCategories / wizard labels → Create Plan benefits categories */
export function primaryServiceLabelToBenefitsCategory(
  label: string,
): BenefitsCategory | null {
  switch (label) {
    case "Retirement":
      return "Retirement";
    case "Group Health":
      return "Group Health";
    case "Group Life":
      return "Group Life";
    case "Other":
      return "Other Benefits";
    default:
      return null;
  }
}

export function isOnboardingAdvisorContactId(id: string | undefined): boolean {
  return (
    typeof id === "string" &&
    (id === STABLE_ID || id.startsWith(`${STABLE_ID_PREFIX}-`))
  );
}

function isCompleteContactForCategory(
  contact: KeyContact,
  category: BenefitsCategory,
): boolean {
  const hasFirstName = !!(contact.firstName && contact.firstName.trim());
  const hasLastName = !!(contact.lastName && contact.lastName.trim());
  const hasEmail = !!(contact.email && contact.email.trim());
  const hasPhone = !!(contact.phone && contact.phone.trim());
  const complete = hasFirstName && hasLastName && (hasEmail || hasPhone);
  if (!complete) return false;
  const cats =
    contact.benefitsCategories ||
    (contact.benefitsCategory ? [contact.benefitsCategory] : []);
  return cats.includes(category);
}

export function hasCompleteContactForCategory(
  contacts: KeyContact[],
  category: BenefitsCategory,
): boolean {
  return contacts.some((c) => isCompleteContactForCategory(c, category));
}

/**
 * Build the advisor's own Key Contact row for the selected primary service categories.
 *
 * ONE row, carrying all of them (see `STABLE_ID`). Rows returned here are appended to the
 * plan's contacts, so anything that expects one row per category would bring the duplicate
 * card back.
 */
export function buildOnboardingAdvisorContactsForCategories(
  categories: BenefitsCategory[],
  profile: {
    name?: string;
    email?: string;
    organizationEmail?: string | null;
    phone?: string;
    phoneExtension?: string | null;
    title?: string;
    /** The advisor's professional designations (`User.designations`). */
    designations?: string[] | null;
    headshot?: string | null;
    organizationType?: string;
    /** User.organizationName — the advisor's organization, shown on their card. */
    organizationName?: string | null;
    advisorLogo?: string;
    advisorLogoUrl?: string;
    advisorLink?: string;
  },
): KeyContact[] {
  const unique = Array.from(
    new Set(
      (categories || []).filter(
        (category): category is BenefitsCategory => !!category,
      ),
    ),
  );
  if (unique.length === 0) return [];

  const fullName = (profile.name || "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "Advisor";
  const lastName = parts.slice(1).join(" ") || "Contact";

  const isPrimaryByCategory = unique.reduce<Record<string, boolean>>(
    (acc, category) => {
      acc[category] = true;
      return acc;
    },
    {},
  ) as Record<BenefitsCategory, boolean>;

  return [
    {
      id: STABLE_ID,
      contactType: "individual",
      benefitsCategories: unique,
      benefitsCategory: unique[0],
      role: "Advisor / Specialist",
      // Prefer the advisor's Organization Email on contact cards; fall back to
      // the login email when none is set ("can be the same if the user wants").
      email: profile.organizationEmail?.trim() || profile.email || "",
      phone: profile.phone || "",
      phoneExtension: profile.phoneExtension || undefined,
      firstName,
      lastName,
      title: profile.title || "",
      // The advisor's own credentials, taken from their profile (User.designations).
      // The builder previously copied their title, phone, headshot and company but
      // never their designations, so the logged-in user's own card was the one card
      // on every surface with no designations row.
      designations: Array.isArray(profile.designations)
        ? profile.designations.filter(
            (value) => typeof value === "string" && value.trim().length > 0,
          )
        : [],
      headshot: profile.headshot || undefined,
      name: fullName || `${firstName} ${lastName}`.trim(),
      // The advisor's own contact card shows their Organization Name
      // (User.organizationName). The organization *type* ("Advisor Firm") is not
      // a company name, so it is only a last-resort fallback.
      companyName:
        (profile.organizationName || "").trim() ||
        (profile.organizationType || "").trim(),
      companyLogo: profile.advisorLogo || profile.advisorLogoUrl || undefined,
      websiteUrl: profile.advisorLink || undefined,
      showOnPortal: true,
      isPrimaryOverall: false,
      isPrimaryByCategory,
      isPrimary: true,
      displayEmail: true,
      displayPhone: true,
    },
  ];
}

/**
 * Make sure the advisor's own contact covers every onboarding primary category.
 *
 * Idempotent: the seeded row is extended in place with the categories that still lack a
 * complete contact, and any extra seeded rows from a draft saved before the single-row
 * change are folded into it. One person, one row, one card.
 */
export function mergeOnboardingAdvisorContactsIntoKeyContacts(
  existing: KeyContact[],
  primaryServiceCategoryLabels: string[] | undefined | null,
  profile: Parameters<typeof buildOnboardingAdvisorContactsForCategories>[1],
): KeyContact[] {
  const labels = Array.isArray(primaryServiceCategoryLabels)
    ? primaryServiceCategoryLabels
    : [];
  const benefitCategories = labels
    .map(primaryServiceLabelToBenefitsCategory)
    .filter((c): c is BenefitsCategory => !!c);

  if (benefitCategories.length === 0) return existing;

  const missing = benefitCategories.filter(
    (bc) => !hasCompleteContactForCategory(existing, bc),
  );
  if (missing.length === 0) return existing;

  const seededRows = existing.filter((contact) =>
    isOnboardingAdvisorContactId(contact.id as string | undefined),
  );

  // Nothing seeded yet: add the single row carrying every missing category.
  if (seededRows.length === 0) {
    const [row] = buildOnboardingAdvisorContactsForCategories(missing, profile);
    return row ? [...existing, row] : existing;
  }

  // Keep the first seeded row, add the missing categories, and drop the other seeded
  // rows (a draft saved one-per-category). Position is preserved.
  const survivor = seededRows[0];
  const survivorId = String(survivor.id);
  const categories = mergeContactCategoryLists(
    seededRows.flatMap((contact) => contactCategories(contact)),
    missing,
  );

  const merged: KeyContact = {
    ...survivor,
    benefitsCategories: categories as KeyContact["benefitsCategories"],
    benefitsCategory: categories[0] as KeyContact["benefitsCategory"],
    isPrimaryByCategory: {
      ...((survivor.isPrimaryByCategory || {}) as Record<string, boolean>),
      ...missing.reduce<Record<string, boolean>>((acc, category) => {
        acc[category] = true;
        return acc;
      }, {}),
    } as KeyContact["isPrimaryByCategory"],
  };

  return existing.flatMap((contact) => {
    if (!isOnboardingAdvisorContactId(contact.id as string | undefined)) {
      return [contact];
    }
    return String(contact.id) === survivorId ? [merged] : [];
  });
}
