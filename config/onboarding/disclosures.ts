/**
 * Default compliance disclosure text used across onboarding and Settings.
 *
 * Lives in config so the wording (and the `[Organization Name]` /
 * `[Company Name]` placeholders) can be edited without a data migration.
 * `lib/disclaimer-constants.ts` re-exports this and owns the resolution helpers.
 */
export const DEFAULT_DISCLOSURES_TEXT = `The information and resources provided on this website are for educational and informational purposes only and are not intended as ERISA, tax, legal, investment, insurance, medical, or other professional advice. Each plan, employer, and participant situation is unique. Plan sponsors, employers, and participants should consult their qualified legal, tax, investment, insurance, medical, or other licensed professionals regarding their specific circumstances.

Nothing on this website should be construed as a solicitation, recommendation, or endorsement to buy, sell, or maintain any security, insurance product, or investment strategy. PlanTelligence® does not provide investment advice, does not act as an ERISA fiduciary, and does not determine plan design, benefit eligibility, or coverage.

PlanTelligence® is an independent technology platform and is not associated wiht an insurance carrier, recordkeeper, or third-party administrator.

Links to external websites are provided for informational purposes only and do not constitute an endorsement or approval by PlanTelligence® or any associated firms.

PlanTelligence®, [Organization Name], and [Company Name] are separate and unaffiliated entities.`;

/**
 * The locked "Platform Disclosure" for the Benefits Hub (the platform block
 * used for that surface).
 *
 * Rendered READ-ONLY everywhere (onboarding, summaries, Settings): an advisor
 * can neither edit nor remove it. Only "Your Disclosure" is editable.
 */
export const PLATFORM_DISCLOSURE_TEXT = `PlanTelligence® is a technology platform and does not provide investment, legal, tax, insurance, or medical advice, determine benefit eligibility or coverage, or serve as an ERISA plan fiduciary solely by providing the PlanTelligence technology platform. \n\nInformation presented through this Benefits Hub does not replace or modify applicable plan, policy, certificate, or other governing documents. In the event of a conflict, the applicable governing documents control.

Third-party websites and resources may be provided for convenience or informational purposes. PlanTelligence® does not control the content of third-party websites. \n\nAdditional disclosures applicable to the organization, financial professional, insurance professional, plan, or benefits presented through this Benefits Hub may appear below or elsewhere within the applicable content.`;

/**
 * The default "Your Disclosure" — the editable, firm-owned introductory
 * paragraph (paragraph 1 of `DEFAULT_DISCLOSURES_TEXT`). Advisors may rewrite
 * this; the `PLATFORM_DISCLOSURE_TEXT` block above stays fixed.
 */
export const DEFAULT_YOUR_DISCLOSURE_TEXT = `The information and resources provided on this website are for educational and informational purposes only and are not intended as ERISA, tax, legal, investment, insurance, medical, or other professional advice. Each plan, employer, and participant situation is unique. Plan sponsors, employers, and participants should consult their qualified legal, tax, investment, insurance, medical, or other licensed professionals regarding their specific circumstances.`;

/**
 * Recommended "Your Disclosure" for the Benefits Hub footer — shown when the
 * advisor chooses "Use Recommended".
 */
export const BENEFITS_HUB_YOUR_DISCLOSURE_TEXT = `The information and resources provided through this Benefits Hub are for educational and informational purposes only and are not intended as ERISA, tax, legal, investment, insurance, medical, or other professional advice. Individual circumstances and plan provisions may vary. Consult the appropriate qualified or licensed professional regarding your specific circumstances. \n\nUnless otherwise specifically stated, educational information presented through this Benefits Hub should not be construed as a recommendation or solicitation to buy, sell, hold, or obtain any security, insurance product, or investment strategy.`;

/**
 * Recommended "Your Disclosure" for the Flyer & Marketing surface — shown when
 * the advisor chooses "Use Recommended".
 */
export const FLYER_MARKETING_YOUR_DISCLOSURE_TEXT = `For educational and informational purposes only. Not legal, tax, investment, insurance, or medical advice. Official plan and policy documents govern. See {Benefits Hub QR / link} for important disclosures.`;

/**
 * Version of the default disclosure templates in this file. BUMP WHENEVER the
 * default copy changes, so downstream surfaces can detect stale stored text.
 * All default/versioned disclosure text lives here — it is never hard-coded
 * into templates.
 */
export const DISCLOSURE_TEMPLATE_VERSION = 1;

/**
 * Merge fields supported in "Your Disclosure" text. The tokens are stored
 * verbatim in the disclaimer and resolved when it is rendered.
 */
export const DISCLOSURE_MERGE_FIELDS = [
  {
    token: "{Organization Name}",
    note: "Fills from your organization name (Step 3).",
  },
  {
    token: "{Plan Sponsor Name}",
    note: "Filled in automatically for each plan.",
  },
  {
    token: "{Benefits Hub QR / link}",
    note: "Shows the Benefits Hub link, or “the Benefits Hub” when a QR code is present.",
  },
] as const;
