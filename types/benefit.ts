/**
 * BenefitData — the canonical shape for a single benefit category row.
 * Mirrors the Prisma `Benefit` model (one row per client+category).
 */

export interface HelpCardData {
  id: string;
  title: string;
  introBold?: string;
  paragraphs: string[];
  cta: string;
  href?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  linkLabel?: string;
  linkHref?: string;
  enabled: boolean;
}

/**
 * One contact attached to a benefit category (`Benefit.supportContacts`).
 *
 * The contact *record* lives once on the plan (`Client.keyContacts`); this entry
 * is only the per-category membership + the copy shown on that category's card.
 * Optional fields are additive so existing rows keep working.
 */
export interface SupportContact {
  contactId: string;
  title: string;
  description: string;
  enabled: boolean;
  /** Render order within the category's team (lower first). */
  order?: number;
  /**
   * Marks the category's primary contact. When absent the resolver falls back to
   * the contact's own `isPrimaryByCategory` / `isPrimaryForCategory` flags.
   */
  isPrimary?: boolean;
}

/**
 * Provider / recordkeeper shown beside a category's account-access block.
 * Fields are optional so the editor can save partial edits; render the block
 * only when `companyName` is non-empty.
 */
export interface ProviderContact {
  /** e.g. "Voya", "Empower", "UnitedHealthcare", "MetLife". */
  companyName?: string;
  /** Optional named representative at the provider. */
  contactName?: string;
  title?: string;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  enabled?: boolean;
}

export interface BenefitData {
  id: string;
  clientId: string;
  category: string;

  // Core
  title: string;
  shortDescription?: string | null;

  // Journey Section
  journeyHeader?: string | null;
  journeySubtitle?: string | null;
  journeyBodyText?: string | null;

  // Plan Video (raw R2 key)
  planVideo?: string | null;
  planVideoFileName?: string | null;

  // Branding
  partnerLogo?: string | null;
  backgroundImage?: string | null;
  innerHeaderImage?: string | null;

  // Help Cards
  helpCards?: HelpCardData[] | null;

  // Insurance / Portal Materials
  insurancePlanId?: string | null;
  insuranceLoginUrl?: string | null;
  insuranceBackgroundImage?: string | null;
  insuranceContainerBlockOpacity?: number | null;

  // FAQs & Support Contacts
  faqs?: FAQItem[] | null;
  supportContacts?: SupportContact[] | null;
  /**
   * The provider / recordkeeper that administers this benefit (e.g. Voya,
   * Empower, UnitedHealthcare). Rendered beside the account-access block; the
   * provider's logo is the Benefit's `partnerLogo`.
   */
  providerContact?: ProviderContact | null;

  // Closing & Signature
  signatureMode?: string | null;
  customClosing?: string | null;
  customSignatureName?: string | null;
  customSignatureCompany?: string | null;
  customClosingBold?: boolean | null;
  customClosingItalic?: boolean | null;
  customSignatureNameBold?: boolean | null;
  customSignatureNameItalic?: boolean | null;
  customSignatureCompanyBold?: boolean | null;
  customSignatureCompanyItalic?: boolean | null;

  // Hero Overlay Settings (per-benefit, overrides client-level)
  heroBackgroundOpacity?: number | null;
  heroContainerBlockOpacity?: number | null;
  heroContainerInverted?: boolean | null;
  heroBackgroundInverted?: boolean | null;
  heroUseGradient?: boolean | null;
  desktopHeroBackgroundPosition?: { x: number; y: number } | null;
  mobileHeroBackgroundPosition?: { x: number; y: number } | null;

  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
