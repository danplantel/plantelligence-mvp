import type { BenefitsWizardState } from "@/lib/benefits-wizard-store";

type BenefitsDirtySnapshot = Pick<BenefitsWizardState, "currentStep" | "stepData">;

function hasAnyContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some((item) => hasAnyContent(item));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      hasAnyContent(item),
    );
  }
  return false;
}

export function hasUnsavedBenefitsWork(snapshot: BenefitsDirtySnapshot): boolean {
  if (snapshot.currentStep > 1) return true;
  return hasAnyContent(snapshot.stepData);
}
