import {
  DEFAULT_DISCLOSURES_TEXT,
  PLATFORM_DISCLOSURE_TEXT,
  DEFAULT_YOUR_DISCLOSURE_TEXT,
  BENEFITS_HUB_YOUR_DISCLOSURE_TEXT,
  FLYER_MARKETING_YOUR_DISCLOSURE_TEXT,
  DISCLOSURE_TEMPLATE_VERSION,
  DISCLOSURE_MERGE_FIELDS,
} from "@/config/onboarding/disclosures";

// The default disclosure copy lives in config so the wording can change without
// touching this module or migrating stored data. Re-exported for existing
// importers (Settings, onboarding wizard).
export {
  DEFAULT_DISCLOSURES_TEXT,
  PLATFORM_DISCLOSURE_TEXT,
  DEFAULT_YOUR_DISCLOSURE_TEXT,
  BENEFITS_HUB_YOUR_DISCLOSURE_TEXT,
  FLYER_MARKETING_YOUR_DISCLOSURE_TEXT,
  DISCLOSURE_TEMPLATE_VERSION,
  DISCLOSURE_MERGE_FIELDS,
};

/**
 * Flyer footer disclaimer text per benefit category, used by the Marketing
 * asset modal and the marketing page's flyer PDF/thumbnail generation.
 */
export const FLYER_CATEGORY_DISCLAIMERS: Record<string, string> = {
  Retirement:
    "For educational and informational purposes only. Not intended as ERISA, tax, legal or investment advice. Investment advice specific to your needs must be obtained separately. Official plan documents govern.",
  "Group Health":
    "For educational and informational purposes only. Not intended as medical, tax, legal or insurance advice. Official plan documents and insurance policies govern.",
  "Group Life":
    "For educational and informational purposes only. Not intended as insurance, tax or legal advice. Official plan documents and insurance policies govern.",
  "Other":
    "For educational and informational purposes only. Not intended as ERISA, tax, legal, investment, insurance or medical advice. Official plan documents and insurance policies govern.",
};

/** Default flyer footer disclaimer for a benefit category, or null if none is mapped. */
export function getFlyerCategoryDisclaimer(category: string): string | null {
  return FLYER_CATEGORY_DISCLAIMERS[category] ?? null;
}

/**
 * Builds the default disclosures text with `[Organization Name]` resolved.
 *
 * `[Organization Name]` is always replaced with `orgName`. `[Company Name]` is only
 * included for the Benefits Hub pages (Retirement, Group Life, Group Health, Other) —
 * pass `includeCompanyName: true` along with a `compName`. For the Landing Page,
 * Settings, and News and Events pages, omit it and the "and [Company Name]" clause
 * is removed entirely (with correct grammar).
 */
export function resolveDefaultDisclosuresText(
  orgName: string,
  compName?: string,
  includeCompanyName = false,
): string {
  const org = (orgName || "").trim() || "[Organization Name]";
  const hasComp = includeCompanyName && !!(compName || "").trim();
  const entitiesLine = hasComp
    ? `PlanTelligence®, ${org}, and ${compName!.trim()} are separate and unaffiliated entities.`
    : `PlanTelligence® and ${org} are separate and unaffiliated entities.`;

  return DEFAULT_DISCLOSURES_TEXT.replace(
    /PlanTelligence®?,\s*\[Organization Name\],\s*and\s*\[Company Name\]\s*are separate and unaffiliated entities\./,
    entitiesLine,
  );
}

/**
 * Resolves `[Organization Name]` in arbitrary disclaimer text and removes any
 * `[Company Name]` mention (with correct grammar). Used for the Landing Page,
 * Settings, and News and Events — pages that only use the organization name.
 */
export function resolveOrgOnlyDisclaimerText(
  text: string,
  orgName: string,
): string {
  const org = (orgName || "").trim() || "[Organization Name]";
  return text
    // Replace the DEFAULT template entities line: "PlanTelligence®, [Organization Name], and [Company Name]"
    .replace(
      /PlanTelligence®?,\s*\[Organization Name\],\s*and\s*\[Company Name\]/g,
      `PlanTelligence® and ${org}`,
    )
    // Replace an already-substituted entities line: "PlanTelligence®, OldOrg, and [Company Name]"
    .replace(
      /PlanTelligence®?,\s*(.+?),\s*and\s*\[Company Name\]/g,
      `PlanTelligence® and ${org}`,
    )
    // Replace an already-normalized org-only entities line: "PlanTelligence® and OldOrg are..."
    .replace(
      /PlanTelligence®?\s+and\s+.+?\s+are\s+separate\s+and\s+unaffiliated\s+entities\./g,
      `PlanTelligence® and ${org} are separate and unaffiliated entities.`,
    )
    .replace(/\[Organization Name\]/g, org)
    .replace(/,\s*and\s*\[Company Name\]/g, "")
    .replace(/\[Company Name\]/g, "");
}

/**
 * Appends the Registered Trademark symbol (®) to every occurrence of the
 * "PlanTelligence" word mark in disclaimer text, so user-entered disclaimers
 * (which may omit the mark) display consistently as "PlanTelligence®".
 * Occurrences that already carry the symbol ("PlanTelligence®" or
 * "PlanTelligence ®") are left untouched.
 */
export function ensurePlanTelligenceTrademark(text: string): string {
  return (text || "").replace(/PlanTelligence(?!\s*®)/g, "PlanTelligence®");
}

/**
 * The trademark line every disclaimer ends with in the OUTPUT (the rendered
 * portal footer).
 *
 * It is deliberately NOT part of the editable/stored disclaimer text: every
 * editor strips it on load (`stripDisclaimerCopyright`) so it never appears in a
 * textarea, and the renderers append it (`appendDisclaimerCopyright`) so the
 * published disclaimer always carries it — exactly once.
 */
export const DISCLAIMER_COPYRIGHT =
  "© 2026 PlanTelligence®. All rights reserved.";

/** Matches the copyright line in its canonical form. */
const DISCLAIMER_COPYRIGHT_PATTERN =
  /©\s*2026\s*PlanTelligence®?\.\s*All rights reserved\./i;

/**
 * Appends `DISCLAIMER_COPYRIGHT` for OUTPUT, unless it is already present (so a
 * legacy text that still carries it is not doubled). Blank text is untouched.
 */
export function appendDisclaimerCopyright(
  text: string | null | undefined,
): string {
  const body = (text || "").trimEnd();
  if (!body) return body;
  if (DISCLAIMER_COPYRIGHT_PATTERN.test(body)) return body;
  return `${body}\n\n${DISCLAIMER_COPYRIGHT}`;
}

/**
 * Removes `DISCLAIMER_COPYRIGHT` so the editable value — and therefore every
 * textarea — never shows it. Applied when loading stored text into an editor;
 * the renderers add it back on output.
 */
export function stripDisclaimerCopyright(
  text: string | null | undefined,
): string {
  return (text || "")
    .replace(
      /\n*\s*©\s*2026\s*PlanTelligence®?\.\s*All rights reserved\.\s*/i,
      "",
    )
    .trimEnd();
}

/**
 * Combine the LOCKED platform disclosure with the editable "Your Disclosure"
 * into the single string stored on `Disclaimer.text` — so every existing
 * renderer/output is unchanged. The platform block always comes first.
 */
export function combineDisclosureText(
  yourDisclosure: string,
  platformText: string = PLATFORM_DISCLOSURE_TEXT,
): string {
  const your = (yourDisclosure || "").trim();
  return your ? `${platformText}\n\n${your}` : platformText;
}

/**
 * Split a stored disclosure into the locked platform block and the editable
 * "Your Disclosure". Handles the canonical order (platform first) and the
 * legacy order (the editable paragraph first); any other custom text is shown
 * in full as "Your Disclosure".
 */
export function splitDisclosureText(
  text: string,
  platformText: string = PLATFORM_DISCLOSURE_TEXT,
): {
  platform: string;
  your: string;
} {
  const platform = platformText.trim();
  const body = (text || "").trim();
  if (!body) return { platform, your: "" };
  if (body.startsWith(platform)) {
    return { platform, your: body.slice(platform.length).trim() };
  }
  if (body.endsWith(platform)) {
    return { platform, your: body.slice(0, body.length - platform.length).trim() };
  }
  return { platform, your: body };
}

/**
 * Resolve the organization-name merge field. Accepts both the legacy bracket
 * form `[Organization Name]` and the brace form `{Organization Name}`.
 */
export function resolveOrganizationNameToken(
  text: string,
  orgName: string,
): string {
  const org = (orgName || "").trim() || "[Organization Name]";
  return (text || "")
    .replace(/\[Organization Name\]/g, org)
    .replace(/\{Organization Name\}/g, org);
}

/**
 * Resolve the flyer's `{Benefits Hub QR / link}` token: "the Benefits Hub" when
 * the flyer carries a Benefits Hub QR code, otherwise the Benefits Hub URL.
 */
export function resolveFlyerBenefitsHubToken(
  text: string,
  opts: { hasQrCode: boolean; benefitsHubUrl: string },
): string {
  const replacement = opts.hasQrCode
    ? "the Benefits Hub"
    : opts.benefitsHubUrl;
  return (text || "").replace(/\{Benefits Hub QR \/ link\}/g, replacement);
}
