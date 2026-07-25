import { BenefitsCategory } from "@/types/new-client-wizard";
import { normalizeBenefitsCategoryForCompleteness } from "@/lib/benefit-completeness";

/** Shared hub card copy + assets (matches portal `defaultBenefits` in `portal-benefits.tsx`). */
export interface HubBenefitDefault {
  id: string;
  title: string;
  description: string;
  image: string;
  partnerLogo: string;
  buttonText: string;
  href: string;
  category: BenefitsCategory;
}

const BASE: Record<string, HubBenefitDefault> = {
  Retirement: {
    id: "retirement",
    title: "Retirement Plan Benefits",
    description:
      "Enrollment guidance, investment options, and retirement resources to help you build a more secure financial future.",
    partnerLogo: "/benefits-logo/Waypoint-WEB.webp",
    image:
      "/benefits-logo/Beach-Summer-Couple-on-Island-Vacation-Holiday-1536x960.webp",
    buttonText: "RETIREMENT BENEFITS>",
    href: "/retirement",
    category: "Retirement",
  },
  "Group Health": {
    id: "health",
    title: "Health Insurance",
    description:
      "Comprehensive health, dental, and vision benefits to help you and your family stay healthy and protected.",
    partnerLogo: "/benefits-logo/Integrity_H_CMYK.jpeg",
    image: "/benefits-logo/Integrity.jpg",
    buttonText: "HEALTH BENEFITS>",
    href: "/health-insurance",
    category: "Group Health",
  },
  "Group Life": {
    id: "life",
    title: "Life Insurance",
    description:
      "Life and disability insurance designed to help protect your income and ensure peace of mind for your family.",
    partnerLogo: "/benefits-logo/Sun-Life-Financial.jpg",
    image:
      "/benefits-logo/Hiking-Couple-Looking-Enjoying-Sunset-View-on-Hike.webp",
    buttonText: "LIFE INSURANCE BENEFITS>",
    href: "/life-insurance",
    category: "Group Life",
  },
  "Other Benefits": {
    id: "other",
    title: "Other Benefits",
    description:
      "Additional benefits and resources selected for your team. Add details in the Create Benefits flow.",
    partnerLogo: "/benefits-logo/wellhub.png",
    image: "/benefits-logo/doing-yoga-1536x960.webp",
    buttonText: "OTHER BENEFITS>",
    href: "/wellness-programs",
    category: "Other Benefits",
  },
  "Company / Plan Sponsor": {
    id: "wellness",
    title: "Wellness Programs",
    description:
      "Programs and resources to support your well-being, engagement, and healthy habits.",
    partnerLogo: "/benefits-logo/wellhub.png",
    image: "/benefits-logo/doing-yoga-1536x960.webp",
    buttonText: "WELLNESS BENEFITS>",
    href: "/wellness-programs",
    category: "Company / Plan Sponsor",
  },
  "Recordkeeper / Vendor": {
    id: "recordkeeper",
    title: "Recordkeeper / Vendor",
    description: "Key vendor information and plan resources.",
    partnerLogo: "/benefits-logo/Waypoint-WEB.webp",
    image: "/benefits-logo/Beach-Summer-Couple-on-Island-Vacation-Holiday-1536x960.webp",
    buttonText: "LEARN MORE >",
    href: "/",
    category: "Recordkeeper / Vendor",
  },
};

function nonEmptyString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Return merged hub card defaults for a category. Maps wizard label `Custom` → Other defaults.
 */
export function getHubBenefitDefaultForCategory(
  raw: string | null | undefined,
): HubBenefitDefault {
  const rawStr = (raw || "").trim();
  const customLike =
    rawStr.toLowerCase() === "custom" ||
    rawStr.toLowerCase() === "custom benefit";
  const n = customLike
    ? "Other Benefits"
    : normalizeBenefitsCategoryForCompleteness(rawStr);
  return (
    BASE[n as string] || BASE["Other Benefits"]
  ) as HubBenefitDefault;
}

/**
 * Fill missing card image, copy, and CTA from hub defaults. Sets both `description` and
 * `shortDescription` for APIs that use either.
 *
 * - `saveMode: true` (Create Benefits “complete”): if the user’s body is &lt; 50 chars, store
 *   the hub default description so the portal matches other cards.
 * - `saveMode: false` (portal display): show user text when present (even if short), else default.
 */
export function mergeUserBenefitWithHubDefaults(
  partial: Record<string, unknown> | null | undefined,
  rawCategory: string | null | undefined,
  options?: { saveMode?: boolean },
): Record<string, unknown> {
  const p = partial && typeof partial === "object" ? { ...partial } : {};
  const def = getHubBenefitDefaultForCategory(rawCategory);
  const saveMode = options?.saveMode === true;

  const userTitle = nonEmptyString(p.title ?? p.benefitTitle);
  const userImage = nonEmptyString(p.image);
  const userPartner = nonEmptyString(
    p.partnerLogo ?? p.companyLogo ?? (p as any).companyLogo?.url,
  );
  const userInnerHeaderImage = nonEmptyString(
    (p as any).innerHeaderImage?.url ?? (p as any).innerHeaderImage,
  );
  const userBody = nonEmptyString(
    p.shortDescription ?? p.description,
  );
  const userButton = nonEmptyString(p.buttonText);
  const userHref = nonEmptyString(p.href);

  const title = userTitle || def.title;
  const image = userImage || def.image;
  const partnerLogo = userPartner || def.partnerLogo;
  let text: string;
  if (userBody && userBody.length >= 50) {
    text = userBody;
  } else if (saveMode) {
    text = def.description;
  } else {
    text = userBody || def.description;
  }
  const buttonText = userButton || def.buttonText;
  const href = userHref || def.href;

  return {
    id: p.id && String(p.id).trim() ? p.id : def.id,
    category: p.category && String(p.category).trim() ? p.category : def.category,
    title,
    description: text,
    shortDescription: text,
    image,
    partnerLogo,
    buttonText,
    href,
    isEnabled: p.isEnabled !== false,
    contactId: p.contactId,
    // Preserve wizard step 3 data when present (faqs, supportContacts)
    ...(p.faqs ? { faqs: p.faqs } : {}),
    ...(p.supportContacts ? { supportContacts: p.supportContacts } : {}),
    // Preserve plan video from wizard Step 2 Section 3
    ...(p.planVideo ? { planVideo: p.planVideo } : {}),
    ...(p.planVideoFileName ? { planVideoFileName: p.planVideoFileName } : {}),
    // Preserve inner header image from wizard Step 2 Section 1 Branding
    ...(userInnerHeaderImage ? { innerHeaderImage: userInnerHeaderImage } : {}),
    // Preserve hero overlay settings from wizard Step 2 Section 1 Branding
    ...(p.heroBackgroundOpacity !== undefined ? { heroBackgroundOpacity: p.heroBackgroundOpacity } : {}),
    ...(p.heroContainerBlockOpacity !== undefined ? { heroContainerBlockOpacity: p.heroContainerBlockOpacity } : {}),
    ...(p.heroContainerInverted !== undefined ? { heroContainerInverted: p.heroContainerInverted } : {}),
    ...(p.heroBackgroundInverted !== undefined ? { heroBackgroundInverted: p.heroBackgroundInverted } : {}),
    ...(p.heroUseGradient !== undefined ? { heroUseGradient: p.heroUseGradient } : {}),
    // Preserve journey section text overrides from wizard Step 2 Section 3 Plan Video
    ...(p.journeyHeader ? { journeyHeader: p.journeyHeader } : {}),
    ...(p.journeySubtitle ? { journeySubtitle: p.journeySubtitle } : {}),
    ...(p.journeyBodyText ? { journeyBodyText: p.journeyBodyText } : {}),
  };
}
