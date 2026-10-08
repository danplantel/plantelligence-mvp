"use client";

import { useCallback } from "react";
import { Check } from "lucide-react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { Step5aSummary } from "./step-5a-summary";
import { Step5bDisclosures } from "./step-5b-disclosures";

interface Step5OnboardingProps {
  errorFields?: string[];
  onValidationChange?: (isValid: boolean) => void;
}

/**
 * Step 5 on Onboarding — a self-contained two-node sub-stepper:
 *
 *   5a Summary  ->  Review all captured setup details.
 *   5b Disclosures -> Add compliance language (optional / "Add Later").
 *
 * The active sub-step reuses the wizard store's `showNextSteps` flag, which the
 * global footer already drives: on Step 5 the primary button flips to 5b
 * ("Continue") and then completes ("Go to Dashboard"). `previousStep` flips
 * back to 5a, so no extra navigation state is introduced.
 */
const SUB_STEPS: { key: "summary" | "disclosures"; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "disclosures", label: "Disclosures" },
];

export function Step5Onboarding({
  errorFields = [],
  onValidationChange,
}: Step5OnboardingProps) {
  const showNextSteps = useOnboardingWizardStore((s) => s.showNextSteps);
  const setShowNextSteps = useOnboardingWizardStore((s) => s.setShowNextSteps);
  const organizationName = useOnboardingWizardStore(
    (s) => s.stepData.branding?.organizationName || "",
  );

  const activeIndex = showNextSteps ? 1 : 0;

  const handleDisclosuresValidation = useCallback(
    (isValid: boolean) => {
      onValidationChange?.(isValid);
    },
    [onValidationChange],
  );

  return (
    <div className="space-y-6">
      {/* Step 5 sub-stepper */}
      <div className="flex items-center justify-center">
        {SUB_STEPS.map((sub, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;
          const isClickable = index <= activeIndex;

          return (
            <div key={sub.key} className="flex items-center">
              <button
                type="button"
                onClick={() => isClickable && setShowNextSteps(index === 1)}
                disabled={!isClickable}
                title={sub.label}
                className="flex items-center gap-2 disabled:cursor-not-allowed"
              >
                <span
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${
                    isActive
                      ? "bg-[#2ba8b5] text-white"
                      : isComplete
                        ? "bg-accent-blue text-white"
                        : "bg-[#23919C]/10 text-gray-400"
                  }`}
                >
                  {isComplete ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : (
                    `5${String.fromCharCode(97 + index)}`
                  )}
                </span>
                <span
                  className={`text-sm ${
                    isActive
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {sub.label}
                </span>
              </button>

              {index < SUB_STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-10 mx-3 ${
                    index < activeIndex ? "bg-accent-blue" : "bg-[#23919C]/10"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Active sub-step */}
      {showNextSteps ? (
        <Step5bDisclosures
          errorFields={errorFields}
          onValidationChange={handleDisclosuresValidation}
          organizationName={organizationName}
          forceUniversalScope={true}
        />
      ) : (
        <Step5aSummary />
      )}
    </div>
  );
}
