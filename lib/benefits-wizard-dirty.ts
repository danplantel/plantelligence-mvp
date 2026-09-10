import type { BenefitsWizardState } from "@/lib/benefits-wizard-store";

export type BenefitsDirtySnapshot = Pick<
  BenefitsWizardState,
  "currentStep" | "stepData"
>;

/**
 * Fields that are re-fetched, re-synced, or used purely as tracking state when
 * the wizard rehydrates/resumes. The persist middleware's `partialize` resets the
 * tracking arrays on every save, and Step 1's pre-fill effects re-populate the
 * rest from the API on entry. Excluding them keeps a resumed draft (which the
 * user hasn't touched yet) from immediately reading as "unsaved changes".
 */
const STEP1_TRANSIENT_FIELDS = [
  "selectedPlan",
  "categoryBenefitByApi",
  "benefitFieldsLoadedCategories",
] as const;

const STEP3_TRANSIENT_FIELDS = [
  "supportContactsLoadedCategories",
  "supportContactsPlanId",
  "supportContactsCategory",
] as const;

function stripTransientFields(
  stepData: BenefitsWizardState["stepData"],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stepData ?? {})) {
    if (value == null || typeof value !== "object") {
      out[key] = value;
      continue;
    }

    const cleaned: Record<string, unknown> = {
      ...(value as Record<string, unknown>),
    };
    if (key === "step1") {
      for (const field of STEP1_TRANSIENT_FIELDS) delete cleaned[field];
    } else if (key === "step3") {
      for (const field of STEP3_TRANSIENT_FIELDS) delete cleaned[field];
    }
    out[key] = cleaned;
  }
  return out;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    // Non-serializable transient value (e.g. a live File/Blob). Fall back to a
    // stable marker so a single unserializable write doesn't crash the guard.
    return "__unserializable__";
  }
}

/** Serialize the wizard state, ignoring transient/prefill-only fields, for
 *  stable comparison against the load-time baseline. */
export function serializeBenefitsSnapshot(
  snapshot: BenefitsDirtySnapshot,
): string {
  return safeStringify({
    currentStep: snapshot.currentStep,
    stepData: stripTransientFields(snapshot.stepData),
  });
}

/**
 * True when the live wizard state differs from the baseline captured after the
 * page finished initialising. `baseline === null` means "not initialised yet"
 * and is treated as clean so the leave guard never arms during rehydration.
 */
export function hasUnsavedBenefitsWork(
  snapshot: BenefitsDirtySnapshot,
  baseline: string | null,
): boolean {
  if (baseline === null) return false;
  return serializeBenefitsSnapshot(snapshot) !== baseline;
}
