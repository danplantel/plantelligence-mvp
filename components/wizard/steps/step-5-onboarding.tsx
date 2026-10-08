"use client";

import { useCallback } from "react";
import { Check } from "lucide-react";
import {
  useOnboardingWizardStore,
  type Step5SubStep,
} from "@/lib/onboarding-wizard-store";
import { TeamSize } from "@/types/wizard";
import { Step5aSummary } from "./step-5a-summary";
import { Step5bDisclosures } from "./step-5b-disclosures";
import { Step5cTeam } from "./step-5c-team";

interface Step5OnboardingProps {
  errorFields?: string[];
  onValidationChange?: (isValid: boolean) => void;
  /**
   * The wizard's skip action for 5b's "Confirm Disclosures / Skip for Now" button —
   * it owns the attestation and the advance to 5c / the Dashboard.
   */
  onStep5Skip?: () => void;
}

/**
 * Step 5 on Onboarding — a self-contained sub-stepper:
 *
 *   5a Review Your Information   (always)               -> 5b
 *   5b Compliance Disclosures    (always)               -> 5c, or finish if "Just me"
 *   5c Invite Your Team          (team size > Just me)  -> finish
 *
 * The active sub-screen lives in the store (`step5SubStep`). The global footer
 * drives each sub-screen's primary/secondary action and the "Previous" button
 * walks back through the sub-screens. See `wizard.tsx`.
 */
const SUB_STEP_LABELS: Record<Step5SubStep, string> = {
  review: "Review Your Information",
  disclosures: "Compliance Disclosures",
  team: "Invite Your Team",
};

export function Step5Onboarding({
  errorFields = [],
  onValidationChange,
  onStep5Skip,
}: Step5OnboardingProps) {
  const step5SubStep = useOnboardingWizardStore((s) => s.step5SubStep);
  const setStep5SubStep = useOnboardingWizardStore((s) => s.setStep5SubStep);
  const organizationName = useOnboardingWizardStore(
    (s) => s.stepData.branding?.organizationName || "",
  );
  const teamSizeBand = useOnboardingWizardStore(
    (s) => s.stepData.teamSize?.teamSize,
  );

  // 5c ("Invite Your Team") only applies above the "Just me" (solo) band.
  const teamStepApplies = !!teamSizeBand && teamSizeBand !== TeamSize.SOLO;

  // Visible nodes depend on whether the org is larger than a single person.
  const order: Step5SubStep[] = teamStepApplies
    ? ["review", "disclosures", "team"]
    : ["review", "disclosures"];

  // Defensive: never render the team screen when it does not apply.
  const active: Step5SubStep =
    step5SubStep === "team" && !teamStepApplies ? "disclosures" : step5SubStep;
  const activeIndex = Math.max(0, order.indexOf(active));

  // 5b (disclosures) and 5c (team) each report their own validity. Only the
  // active sub-screen is mounted, so this reflects the active sub-step's state.
  const handleSubStepValidation = useCallback(
    (isValid: boolean) => {
      onValidationChange?.(isValid);
    },
    [onValidationChange],
  );

  return (
    <div className="space-y-6">
      {/* Step 5 sub-stepper */}
      <div className="flex flex-wrap items-center justify-center gap-y-2">
        {order.map((sub, index) => {
          const isActive = sub === active;
          const isComplete = index < activeIndex;
          const isClickable = index <= activeIndex;

          return (
            <div key={sub} className="flex items-center">
              <button
                type="button"
                onClick={() => isClickable && setStep5SubStep(sub)}
                disabled={!isClickable}
                title={SUB_STEP_LABELS[sub]}
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
                  {SUB_STEP_LABELS[sub]}
                </span>
              </button>

              {index < order.length - 1 && (
                <div
                  className={`h-0.5 w-8 mx-2 md:w-10 md:mx-3 ${
                    index < activeIndex ? "bg-accent-blue" : "bg-[#23919C]/10"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Active sub-screen */}
      {active === "team" ? (
        <Step5cTeam
          errorFields={errorFields}
          onValidationChange={handleSubStepValidation}
        />
      ) : active === "disclosures" ? (
        <Step5bDisclosures
          errorFields={errorFields}
          onValidationChange={handleSubStepValidation}
          organizationName={organizationName}
          forceUniversalScope={true}
          onSkipForNow={onStep5Skip}
        />
      ) : (
        <Step5aSummary />
      )}
    </div>
  );
}
