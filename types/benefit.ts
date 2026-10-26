/**
 * BenefitData — the canonical shape for a single benefit category row.
 * Mirrors the Prisma `Benefit` model (one row per client+category).
 */

/**
 * The (static) copy for one "How Can We Help You Today?" card.
 *
 * These live in `lib/help-card-defaults.ts`, keyed by `id`. A benefit stores only
 * its `HelpCardLayoutEntry[]` — which cards it shows, in what order, and which
 * one is primary — never the copy itself, so the text cannot drift between
 * benefits or be edited per plan.
 */
export interface HelpCardContent {
  id: string;
  title: string;
  /** Short supporting line drawn on the card itself (the panel reads `paragraphs`). */
  body?: string;
  introBold?: string;
  paragraphs: string[];
  cta: string;
  href?: string;
}

/** @deprecated Prefer `HelpCardContent`; kept for older imports/tests. */
export type HelpCardData = HelpCardContent;

/**
 * One entry in a benefit's persisted card layout.
 *
 * The ARRAY ORDER is the visual order: positions 0–2 make row 1 and 3–6 make
 * row 2. The `primary` card is the single 2-of-4 wide card, and normalization
 * pins it to index 0 (left edge) or index 2 (right edge) of row 1.
 */
export interface HelpCardLayoutEntry {
  id: string;
  /** Exactly one entry may set this (see `lib/help-card-layout.ts`). */
  primary?: boolean;
  /**
   * Whether the card renders on the hub. ABSENT MEANS ENABLED, so a layout saved
   * before this flag existed keeps showing every card.
   *
   * A hidden card keeps its slot in the order: re-enabling it puts it back where
   * it was, and every other card keeps its position around it.
   */
  enabled?: boolean;
}

/** A layout entry with its catalog copy resolved. */
export interface HelpCardResolved extends HelpCardContent {
  primary: boolean;
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

  // Plan Video (raw R2 key or external URL)
  planVideo?: string | null;
  planVideoFileName?: string | null;
  /** "Advisor Intro" | "This benefit" | "Our Services" */
  planVideoLabel?: string | null;
  /** Poster image (R2 key, external URL, or data URL) */
  planVideoThumbnail?: string | null;
  /**
   * Image shown in the journey section when the plan has no video — the editor's
   * "Default Image" upload / gallery pick (R2 key or external URL). Null falls
   * back to the category's stock image.
   */
  planVideoFallbackImage?: string | null;
  /**
   * Editor's "Show on page" toggle. `false` hides the whole video section on the
   * portal; absent/`true` shows it (a row saved before the toggle existed keeps
   * playing its video).
   */
  planVideoVisible?: boolean | null;

  // Branding
  partnerLogo?: string | null;
  backgroundImage?: string | null;

  // Help Cards — layout only (see `HelpCardLayoutEntry`); copy comes from the catalog.
  helpCards?: HelpCardLayoutEntry[] | null;

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
