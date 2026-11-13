/**
 * Shared configuration for the portal legal documents.
 *
 * The policy copy itself lives in `lib/legal/content/*`, generated from the
 * root-level Markdown sources. This module holds the values that are either
 * environment-specific (the viewer's organization) or product-wide (the
 * operator identity and contact channels), so the same documents can be
 * rendered for every Benefits Hub without duplicating the policy text.
 */

export type PortalLegalDoc = "privacy" | "terms";

/** The public, plan-scoped routes for the two legal documents. */
export const PORTAL_LEGAL_PATHS: Record<PortalLegalDoc, string> = {
  privacy: "privacy",
  terms: "terms",
};

/**
 * Build a legal-document link for a portal slug.
 *
 * Returns `undefined` when there is no slug (for example inside a wizard
 * preview), so callers can keep the footer's previous inert placeholder rather
 * than emit `//privacy`.
 */
export function portalLegalHref(
  clientId: string | null | undefined,
  doc: PortalLegalDoc,
): string | undefined {
  const slug = (clientId ?? "").trim();
  return slug ? `/${slug}/${PORTAL_LEGAL_PATHS[doc]}` : undefined;
}

/** The platform operator named in both documents. */
export const PLATFORM_LEGAL_ENTITY = "PlanTelligence";

/** The support/privacy contact published in both documents. */
export const PLATFORM_SUPPORT_EMAIL = "support@plantelligence.ai";

/**
 * Policy dates. Kept in one place so the footer, the pages and any future
 * dashboard legal pages agree on the same version.
 */
export const LEGAL_EFFECTIVE_DATE = "November 13, 2026";
export const LEGAL_LAST_UPDATED = "November 13, 2026";

/** Values substituted into the `[PLACEHOLDER]` fields of the policy text. */
export interface LegalPlaceholderContext {
  /** The Publishing Organization / advisor name shown to the participant. */
  organizationName?: string;
  /** How the participant reaches that organization (email, phone, etc.). */
  organizationContact?: string;
  effectiveDate?: string;
  lastUpdated?: string;
}
