/**
 * Professional-designation dictionary for onboarding Step 4 (and Settings).
 *
 * Rules this file encodes:
 *  - Stored as the stable `value` id (e.g. "CFP"), never the label — kept
 *    separate from the person's name and never merged into it.
 *  - `label` is the full name (picker match list).
 *  - `acronym` is the short form shown on chips/pills and in outputs, INCLUDING
 *    its mark. Exceptions per spec: CFA and CIPM never take a mark; HRCI
 *    international credentials (aPHRi/PHRi/SPHRi) use ™; GBA, RPA, and the
 *    ASPPA/ARA recordkeeper credentials currently take no symbol.
 *  - Each designation is stored ONCE and tagged with one or more `groups`
 *    (CLU, ChFC, FSCP belong to more than one).
 *  - Typed input that resolves to a dictionary entry is normalized to it
 *    (e.g. "cfp" -> CFP®, "shrm cp" -> SHRM-CP®). Anything that does NOT match
 *    is stored exactly as typed and never gains a mark.
 *
 * ⚠️ Verify every ® / ™ (and the full-name expansions) against each
 * credentialing body's usage guide before shipping.
 */

export type DesignationGroupKey =
  | "retirement_wealth"
  | "hr"
  | "benefits_insurance"
  | "recordkeeper_tpa";

export interface DesignationOption {
  /** Stable id written to the database. */
  value: string;
  /** Full presentation label (match list). */
  label: string;
  /** Short form shown on chips/pills and outputs, WITH its mark. */
  acronym: string;
  /** One or more groups this designation belongs to. */
  groups: DesignationGroupKey[];
}

export const DESIGNATIONS: DesignationOption[] = [
  // ── Retirement / wealth ────────────────────────────────────────────────────
  { value: "CFP", label: "Certified Financial Planner", acronym: "CFP®", groups: ["retirement_wealth"] },
  { value: "AIF", label: "Accredited Investment Fiduciary", acronym: "AIF®", groups: ["retirement_wealth"] },
  { value: "AIFA", label: "Accredited Investment Fiduciary Analyst", acronym: "AIFA®", groups: ["retirement_wealth"] },
  { value: "PPC", label: "Professional Plan Consultant", acronym: "PPC®", groups: ["retirement_wealth"] },
  { value: "CPFA", label: "Certified Plan Fiduciary Advisor", acronym: "CPFA®", groups: ["retirement_wealth"] },
  { value: "CIMA", label: "Certified Investment Management Analyst", acronym: "CIMA®", groups: ["retirement_wealth"] },
  { value: "CPWA", label: "Certified Private Wealth Advisor", acronym: "CPWA®", groups: ["retirement_wealth"] },
  { value: "RMA", label: "Retirement Management Advisor", acronym: "RMA®", groups: ["retirement_wealth"] },
  { value: "ChFC", label: "Chartered Financial Consultant", acronym: "ChFC®", groups: ["retirement_wealth", "benefits_insurance"] },
  { value: "CLU", label: "Chartered Life Underwriter", acronym: "CLU®", groups: ["retirement_wealth", "benefits_insurance"] },
  { value: "RICP", label: "Retirement Income Certified Professional", acronym: "RICP®", groups: ["retirement_wealth"] },
  { value: "WMCP", label: "Wealth Management Certified Professional", acronym: "WMCP®", groups: ["retirement_wealth"] },
  { value: "FSCP", label: "Financial Services Certified Professional", acronym: "FSCP®", groups: ["retirement_wealth", "benefits_insurance"] },
  { value: "CAP", label: "Chartered Advisor in Philanthropy", acronym: "CAP®", groups: ["retirement_wealth"] },
  { value: "ChSNC", label: "Chartered Special Needs Consultant", acronym: "ChSNC®", groups: ["retirement_wealth"] },
  { value: "AAMS", label: "Accredited Asset Management Specialist", acronym: "AAMS®", groups: ["retirement_wealth"] },
  { value: "CRPC", label: "Chartered Retirement Planning Counselor", acronym: "CRPC®", groups: ["retirement_wealth"] },
  { value: "CRPS", label: "Chartered Retirement Plans Specialist", acronym: "CRPS®", groups: ["retirement_wealth"] },
  { value: "ABFP", label: "Accredited Behavioral Finance Professional", acronym: "ABFP®", groups: ["retirement_wealth"] },
  { value: "APMA", label: "Accredited Portfolio Management Advisor", acronym: "APMA®", groups: ["retirement_wealth"] },
  { value: "AWMA", label: "Accredited Wealth Management Advisor", acronym: "AWMA®", groups: ["retirement_wealth"] },
  { value: "FPQP", label: "Financial Paraplanner Qualified Professional", acronym: "FPQP®", groups: ["retirement_wealth"] },
  { value: "RSSA", label: "Registered Social Security Analyst", acronym: "RSSA®", groups: ["retirement_wealth"] },
  // Never take a mark (display exception).
  { value: "CFA", label: "Chartered Financial Analyst", acronym: "CFA", groups: ["retirement_wealth"] },
  { value: "CIPM", label: "Certificate in Investment Performance Measurement", acronym: "CIPM", groups: ["retirement_wealth"] },

  // ── HR ─────────────────────────────────────────────────────────────────────
  { value: "SHRM_CP", label: "SHRM Certified Professional", acronym: "SHRM-CP®", groups: ["hr"] },
  { value: "SHRM_SCP", label: "SHRM Senior Certified Professional", acronym: "SHRM-SCP®", groups: ["hr"] },
  { value: "APHR", label: "Associate Professional in Human Resources", acronym: "aPHR®", groups: ["hr"] },
  { value: "PHR", label: "Professional in Human Resources", acronym: "PHR®", groups: ["hr"] },
  { value: "PHRCA", label: "Professional in Human Resources – California", acronym: "PHRca®", groups: ["hr"] },
  { value: "SPHR", label: "Senior Professional in Human Resources", acronym: "SPHR®", groups: ["hr"] },
  { value: "GPHR", label: "Global Professional in Human Resources", acronym: "GPHR®", groups: ["hr"] },
  // HRCI international credentials use ™.
  { value: "APHRI", label: "Associate Professional in Human Resources – International", acronym: "aPHRi™", groups: ["hr"] },
  { value: "PHRI", label: "Professional in Human Resources – International", acronym: "PHRi™", groups: ["hr"] },
  { value: "SPHRI", label: "Senior Professional in Human Resources – International", acronym: "SPHRi™", groups: ["hr"] },

  // ── Benefits / insurance (CLU, ChFC, FSCP are shared above) ────────────────
  { value: "CEBS", label: "Certified Employee Benefit Specialist", acronym: "CEBS®", groups: ["benefits_insurance"] },
  { value: "REBC", label: "Registered Employee Benefits Consultant", acronym: "REBC®", groups: ["benefits_insurance"] },
  { value: "CPCU", label: "Chartered Property Casualty Underwriter", acronym: "CPCU®", groups: ["benefits_insurance"] },
  // No symbol.
  { value: "GBA", label: "Group Benefits Associate", acronym: "GBA", groups: ["benefits_insurance"] },
  { value: "RPA", label: "Retirement Plans Associate", acronym: "RPA", groups: ["benefits_insurance"] },

  // ── Recordkeeper / TPA (ASPPA/ARA — symbols to be confirmed) ───────────────
  { value: "QPA", label: "Qualified Pension Administrator", acronym: "QPA", groups: ["recordkeeper_tpa"] },
  { value: "QKA", label: "Qualified 401(k) Administrator", acronym: "QKA", groups: ["recordkeeper_tpa"] },
  { value: "QPFC", label: "Qualified Plan Financial Consultant", acronym: "QPFC", groups: ["recordkeeper_tpa"] },
  { value: "ERPA", label: "Enrolled Retirement Plan Agent", acronym: "ERPA", groups: ["recordkeeper_tpa"] },
  { value: "CPC", label: "Certified Pension Consultant", acronym: "CPC", groups: ["recordkeeper_tpa"] },
];

/** id → label, for display resolution. */
export const DESIGNATION_LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  DESIGNATIONS.map((d) => [d.value, d.label]),
);

/** id → acronym (with mark), for chip + output rendering. */
export const DESIGNATION_ACRONYM_BY_ID: Record<string, string> =
  Object.fromEntries(DESIGNATIONS.map((d) => [d.value, d.acronym]));

/**
 * Lower-cased label/acronym → canonical id, for read-normalization of data
 * captured before the id model (and for typed input).
 */
const LEGACY_LABEL_ALIASES: Record<string, string> = {
  // Retired / reworded labels still resolve.
  "cfa® – chartered financial analyst": "CFA",
  "cipm® – certificate in investment performance measurement": "CIPM",
};

const TEXT_TO_ID = new Map<string, string>();
for (const d of DESIGNATIONS) {
  TEXT_TO_ID.set(d.label.trim().toLowerCase(), d.value);
  TEXT_TO_ID.set(d.acronym.trim().toLowerCase(), d.value);
  // Also match the acronym without its mark (e.g. "cfp" for "CFP®").
  TEXT_TO_ID.set(d.acronym.replace(/[®™]/g, "").trim().toLowerCase(), d.value);
}
for (const [alias, id] of Object.entries(LEGACY_LABEL_ALIASES)) {
  TEXT_TO_ID.set(alias, id);
}

/**
 * Resolve a stored designation to a full display label. Known ids map to their
 * label; legacy labels and free-text values pass through unchanged.
 */
export function designationLabel(value: string): string {
  if (!value) return "";
  return DESIGNATION_LABEL_BY_ID[value] ?? value;
}

/** Map a list of stored designations to full labels. */
export function designationLabels(values?: string[] | null): string[] {
  return (values ?? []).map(designationLabel).filter(Boolean);
}

/**
 * Resolve a stored designation to the short form shown on chips/pills and in
 * outputs. Known ids map to their acronym (with mark); free text passes through
 * unchanged — never gaining a mark.
 */
export function designationAcronym(value: string): string {
  if (!value) return "";
  const id = resolveDesignationId(value);
  return DESIGNATION_ACRONYM_BY_ID[id] ?? value;
}

/** Map a list of stored designations to acronyms. */
export function designationAcronyms(values?: string[] | null): string[] {
  return (values ?? []).map(designationAcronym).filter(Boolean);
}

/**
 * Map a legacy stored label (or an already-canonical id) to the canonical id.
 * Unknown free text passes through unchanged, so custom designations survive.
 */
export function resolveDesignationId(value: string): string {
  if (!value) return value;
  const trimmed = value.trim();
  if (DESIGNATION_LABEL_BY_ID[trimmed]) return trimmed;
  return TEXT_TO_ID.get(trimmed.toLowerCase()) ?? trimmed;
}

/** Normalize a stored list to canonical ids. */
export function resolveDesignationIds(values?: string[] | null): string[] {
  return (values ?? []).map(resolveDesignationId).filter(Boolean);
}

/** Ids per group (a shared designation appears in each of its groups). */
export const DESIGNATION_GROUP_IDS: Record<DesignationGroupKey, string[]> = {
  retirement_wealth: DESIGNATIONS.filter((d) =>
    d.groups.includes("retirement_wealth"),
  ).map((d) => d.value),
  hr: DESIGNATIONS.filter((d) => d.groups.includes("hr")).map((d) => d.value),
  benefits_insurance: DESIGNATIONS.filter((d) =>
    d.groups.includes("benefits_insurance"),
  ).map((d) => d.value),
  recordkeeper_tpa: DESIGNATIONS.filter((d) =>
    d.groups.includes("recordkeeper_tpa"),
  ).map((d) => d.value),
};

/** Full option list, optionally restricted to a group. */
export function getDesignationOptions(
  group?: DesignationGroupKey,
): DesignationOption[] {
  return group
    ? DESIGNATIONS.filter((d) => d.groups.includes(group))
    : [...DESIGNATIONS];
}

/**
 * Heuristic title → group routing for suggestions. Returns the designations to
 * offer for a given job title (an empty list means "no suggestions": a
 * relationship / client-success role carries none by design).
 */
export function getRelevantDesignations(title: string): DesignationOption[] {
  if (!title) return [];

  const t = title.toLowerCase();

  if (t.includes("relationship") || t.includes("success")) {
    return [];
  }
  if (
    t.includes("recordkeeper") ||
    t.includes("tpa") ||
    t.includes("plan administrator") ||
    t.includes("compliance") ||
    t.includes("operations")
  ) {
    return getDesignationOptions("recordkeeper_tpa");
  }
  if (t.includes("hr") || t.includes("chro") || t.includes("people")) {
    return getDesignationOptions("hr");
  }
  if (t.includes("benefits")) {
    return getDesignationOptions("benefits_insurance");
  }
  if (
    t.includes("advisor") ||
    t.includes("planner") ||
    t.includes("wealth") ||
    t.includes("consultant") ||
    t.includes("manager")
  ) {
    return getDesignationOptions("retirement_wealth");
  }
  return getDesignationOptions();
}
