/**
 * Professional-designation dictionary for onboarding Step 4 (and Settings).
 *
 * Designations are STORED as the stable `value` id (e.g. "CFP"), never the
 * label, so re-wording a label here never requires a data migration.
 *
 * Two compatibility rules make this safe against data captured before the id
 * model existed:
 *  - `designationLabel()` maps a known id to its label and passes anything else
 *    through unchanged (legacy full labels, and genuinely free-text designations
 *    added via the picker's custom input).
 *  - `resolveDesignationId()` maps a legacy label (or an existing id) to the
 *    canonical id; unknown free text passes through unchanged.
 * Together these mean no backfill migration is required.
 */

export type DesignationGroupKey = "financial" | "hr";

export interface DesignationOption {
  /** Stable id written to the database. */
  value: string;
  /** Presentation label — safe to edit. */
  label: string;
  /** Grouping used to suggest relevant designations from a job title. */
  group: DesignationGroupKey;
}

export const DESIGNATIONS: DesignationOption[] = [
  // ── Financial / retirement-plan focused ────────────────────────────────────
  { value: "CFP", label: "CFP® – Certified Financial Planner", group: "financial" },
  {
    value: "AIF",
    label: "AIF® – Accredited Investment Fiduciary",
    group: "financial",
  },
  {
    value: "CPFA",
    label: "CPFA® – Certified Plan Fiduciary Advisor",
    group: "financial",
  },
  {
    value: "CRPS",
    label: "CRPS® – Chartered Retirement Plans Specialist",
    group: "financial",
  },
  {
    value: "CRPC",
    label: "CRPC® – Chartered Retirement Planning Counselor",
    group: "financial",
  },
  {
    value: "CIMA",
    label: "CIMA® – Certified Investment Management Analyst",
    group: "financial",
  },
  { value: "CFA", label: "CFA® – Chartered Financial Analyst", group: "financial" },
  { value: "CLU", label: "CLU® – Chartered Life Underwriter", group: "financial" },
  {
    value: "ChFC",
    label: "ChFC® – Chartered Financial Consultant",
    group: "financial",
  },
  {
    value: "RICP",
    label: "RICP® – Retirement Income Certified Professional",
    group: "financial",
  },
  {
    value: "LUTCF",
    label: "LUTCF® – Life Underwriter Training Council Fellow",
    group: "financial",
  },
  {
    value: "CPA_PFS",
    label: "CPA/PFS – Certified Public Accountant / Personal Financial Specialist",
    group: "financial",
  },

  // ── HR / employer (Plan Sponsor) focused ───────────────────────────────────
  {
    value: "SHRM_CP",
    label: "SHRM-CP – Society for Human Resource Management Certified Professional",
    group: "hr",
  },
  {
    value: "SHRM_SCP",
    label: "SHRM-SCP – Senior Certified Professional",
    group: "hr",
  },
  { value: "PHR", label: "PHR – Professional in Human Resources", group: "hr" },
  {
    value: "SPHR",
    label: "SPHR – Senior Professional in Human Resources",
    group: "hr",
  },
  {
    value: "GPHR",
    label: "GPHR – Global Professional in Human Resources",
    group: "hr",
  },
  {
    value: "CEBS",
    label: "CEBS – Certified Employee Benefit Specialist",
    group: "hr",
  },
  { value: "CBP", label: "CBP – Certified Benefits Professional", group: "hr" },
  { value: "CCP", label: "CCP – Certified Compensation Professional", group: "hr" },
  {
    value: "CHRS",
    label: "CHRS – Certified Health & Retirement Specialist",
    group: "hr",
  },
];

/** id → label, for display resolution. */
export const DESIGNATION_LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  DESIGNATIONS.map((d) => [d.value, d.label]),
);

/** Lower-cased legacy label → canonical id, for read-normalization. */
const LABEL_TO_ID = new Map(
  DESIGNATIONS.map((d) => [d.label.trim().toLowerCase(), d.value]),
);

/**
 * Resolve a stored designation to a display label. Known ids map to their
 * label; legacy full labels and free-text values pass through unchanged.
 */
export function designationLabel(value: string): string {
  if (!value) return "";
  return DESIGNATION_LABEL_BY_ID[value] ?? value;
}

/** Map a list of stored designations to display labels. */
export function designationLabels(values?: string[] | null): string[] {
  return (values ?? []).map(designationLabel).filter(Boolean);
}

/**
 * Map a legacy stored label (or an already-canonical id) to the canonical id.
 * Unknown free text passes through unchanged, so custom designations survive.
 */
export function resolveDesignationId(value: string): string {
  if (!value) return value;
  const trimmed = value.trim();
  if (DESIGNATION_LABEL_BY_ID[trimmed]) return trimmed;
  return LABEL_TO_ID.get(trimmed.toLowerCase()) ?? trimmed;
}

/** Normalize a stored list to canonical ids. */
export function resolveDesignationIds(values?: string[] | null): string[] {
  return (values ?? []).map(resolveDesignationId).filter(Boolean);
}

/** Ids per group, for title-based suggestions. */
export const DESIGNATION_GROUP_IDS: Record<DesignationGroupKey, string[]> = {
  financial: DESIGNATIONS.filter((d) => d.group === "financial").map((d) => d.value),
  hr: DESIGNATIONS.filter((d) => d.group === "hr").map((d) => d.value),
};

/** Full option list, optionally restricted to a group. */
export function getDesignationOptions(
  group?: DesignationGroupKey,
): DesignationOption[] {
  return group ? DESIGNATIONS.filter((d) => d.group === group) : [...DESIGNATIONS];
}

/**
 * Suggest designations from a job title (returns option objects so callers can
 * render labels while storing ids). Mirrors the previous keyword routing:
 * relationship / success / plan / compliance roles get no suggestions.
 */
export function getRelevantDesignations(title: string): DesignationOption[] {
  if (!title) return [];

  const t = title.toLowerCase();

  if (
    t.includes("advisor") ||
    t.includes("planner") ||
    t.includes("manager") ||
    t.includes("consultant")
  ) {
    return getDesignationOptions("financial");
  }
  if (t.includes("hr") || t.includes("benefits") || t.includes("chro")) {
    return getDesignationOptions("hr");
  }
  if (
    t.includes("relationship") ||
    t.includes("success") ||
    t.includes("plan") ||
    t.includes("compliance")
  ) {
    return [];
  }
  return getDesignationOptions();
}
