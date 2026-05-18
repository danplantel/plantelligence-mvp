import type { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";

const STABLE_ID_PREFIX = "onboarding-primary-advisor";

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

function stableIdForCategory(category: BenefitsCategory): string {
  const slug = category.replace(/\s+/g, "-");
  return `${STABLE_ID_PREFIX}-${slug}`;
}

export function isOnboardingAdvisorContactId(id: string | undefined): boolean {
  return typeof id === "string" && id.startsWith(`${STABLE_ID_PREFIX}-`);
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

/** Build one advisor row per selected primary service category (for keyContacts persistence). */
export function buildOnboardingAdvisorContactsForCategories(
  categories: BenefitsCategory[],
  profile: {
    name?: string;
    email?: string;
    phone?: string;
    phoneExtension?: string | null;
    title?: string;
    headshot?: string | null;
    company?: string;
    advisorLogo?: string;
    advisorLogoUrl?: string;
    advisorLink?: string;
  },
): KeyContact[] {
  const fullName = (profile.name || "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "Advisor";
  const lastName = parts.slice(1).join(" ") || "Contact";

  const out: KeyContact[] = [];
  const seen = new Set<BenefitsCategory>();

  for (const bc of categories) {
    if (!bc || seen.has(bc)) continue;
    seen.add(bc);
    const isPrimaryByCategory = {
      [bc]: true,
    } as Record<BenefitsCategory, boolean>;

    out.push({
      id: stableIdForCategory(bc),
      contactType: "individual",
      benefitsCategories: [bc],
      benefitsCategory: bc,
      role: "Advisor / Specialist",
      email: profile.email || "",
      phone: profile.phone || "",
      phoneExtension: profile.phoneExtension || undefined,
      firstName,
      lastName,
      title: profile.title || "",
      headshot: profile.headshot || undefined,
      name: fullName || `${firstName} ${lastName}`.trim(),
      companyName: profile.company || "",
      companyLogo: profile.advisorLogo || profile.advisorLogoUrl || undefined,
      websiteUrl: profile.advisorLink || undefined,
      showOnPortal: true,
      isPrimaryOverall: false,
      isPrimaryByCategory,
      isPrimary: true,
      displayEmail: true,
      displayPhone: true,
    });
  }
  return out;
}

/**
 * Append advisor contacts for onboarding primary categories when those categories
 * still have no complete contact (idempotent per stable id).
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

  const toAdd: KeyContact[] = [];
  for (const bc of benefitCategories) {
    if (hasCompleteContactForCategory(existing, bc)) continue;
    const seeded = buildOnboardingAdvisorContactsForCategories([bc], profile);
    const row = seeded[0];
    if (!row) continue;
    const already = existing.some((c) => c.id === row.id);
    if (!already) toAdd.push(row);
  }

  if (toAdd.length === 0) return existing;
  return [...existing, ...toAdd];
}
