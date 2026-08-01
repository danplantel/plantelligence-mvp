export const DEFAULT_DISCLOSURES_TEXT = `The information and resources provided on this website are for educational and informational purposes only and are not intended as ERISA, tax, legal, investment, insurance, medical, or other professional advice. Each plan, employer, and participant situation is unique. Plan sponsors, employers, and participants should consult their qualified legal, tax, investment, insurance, medical, or other licensed professionals regarding their specific circumstances.

Nothing on this website should be construed as a solicitation, recommendation, or endorsement to buy, sell, or maintain any security, insurance product, or investment strategy. PlanTelligence does not provide investment advice, does not act as an ERISA fiduciary, and does not determine plan design, benefit eligibility, or coverage.

PlanTelligence is an independent technology platform and is not affiliated with any broker-dealer, registered investment advisor, insurance carrier, recordkeeper, or third-party administrator.

Links to external websites are provided for informational purposes only and do not constitute an endorsement or approval by PlanTelligence or any associated firms.

PlanTelligence, [Organization Name], and [Company Name] are separate and unaffiliated entities.

© 2026 PlanTelligence. All rights reserved.`;

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
    ? `PlanTelligence, ${org}, and ${compName!.trim()} are separate and unaffiliated entities.`
    : `PlanTelligence and ${org} are separate and unaffiliated entities.`;

  return DEFAULT_DISCLOSURES_TEXT.replace(
    /PlanTelligence,\s*\[Organization Name\],\s*and\s*\[Company Name\]\s*are separate and unaffiliated entities\./,
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
    // Replace the DEFAULT template entities line: "PlanTelligence, [Organization Name], and [Company Name]"
    .replace(
      /PlanTelligence,\s*\[Organization Name\],\s*and\s*\[Company Name\]/g,
      `PlanTelligence and ${org}`,
    )
    // Replace an already-substituted entities line: "PlanTelligence, OldOrg, and [Company Name]"
    .replace(
      /PlanTelligence,\s*(.+?),\s*and\s*\[Company Name\]/g,
      `PlanTelligence and ${org}`,
    )
    // Replace an already-normalized org-only entities line: "PlanTelligence and OldOrg are..."
    .replace(
      /PlanTelligence\s+and\s+.+?\s+are\s+separate\s+and\s+unaffiliated\s+entities\./g,
      `PlanTelligence and ${org} are separate and unaffiliated entities.`,
    )
    .replace(/\[Organization Name\]/g, org)
    .replace(/,\s*and\s*\[Company Name\]/g, "")
    .replace(/\[Company Name\]/g, "");
}
