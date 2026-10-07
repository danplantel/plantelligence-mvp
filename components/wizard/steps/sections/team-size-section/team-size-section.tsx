"use client";

import { useFormContext } from "react-hook-form";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { TeamSize } from "@/types/wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";
import { allTeamSizeOptions } from "./team-size-section.funcs";

export interface TeamSizeSectionProps {
  errorFields?: string[];
  hideCard?: boolean;
  disableAutoSave?: boolean;
}

export function TeamSizeSection({
  errorFields = [],
  hideCard = false,
  disableAutoSave = false,
}: TeamSizeSectionProps) {
  const { saveStepData, stepData, validateFieldOnBlur } =
    useOnboardingWizardStore();
  const { setValue, watch } = useFormContext();

  const selectedSize = watch("teamSize");

  const onSizeSelect = async (size: TeamSize) => {
    setValue("teamSize", size, { shouldDirty: true, shouldTouch: true });

    if (!disableAutoSave) {
      // Save data immediately when user interacts
      const data = { teamSize: size };
      // Save to both local state and server
      try {
        await saveStepData("teamSize", data, true);
      } catch (error) {
        console.error("Failed to save team size:", error);
      }
    }
  };

  // Per-field blur validation ("leaves a field"). Never fires on selection.
  const validateSizeOnBlur = () => {
    if (disableAutoSave) return;
    void validateFieldOnBlur(1, "teamSize", {
      ...stepData,
      teamSize: { teamSize: watch("teamSize") },
    });
  };

  const content = (
    <>
      <RadioGroup
        value={selectedSize || ""}
        className="grid gap-2"
        data-field="teamSize"
        onBlur={(e) => {
          // Ignore focus moving between the radios themselves.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          validateSizeOnBlur();
        }}
      >
        {allTeamSizeOptions.map((option) => (
          <div
            key={option.value}
            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedSize === option.value
                ? `border-primary bg-[#23919C]/10 ${
                    errorFields.includes("teamSize")
                      ? "ring-1 ring-red-500"
                      : ""
                  }`
                : errorFields.includes("teamSize")
                  ? "border-red-500 hover:bg-muted/50"
                  : "hover:bg-muted/50"
            }`}
            onClick={() => onSizeSelect(option.value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={`team-${option.value}`} />
              <div>
                <Label
                  htmlFor={`team-${option.value}`}
                  className="cursor-pointer font-medium"
                >
                  <p className="text-sm font-medium">{option.label}</p>
                </Label>
                <div className="text-xs text-muted-foreground">
                  {option.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </RadioGroup>
      {errorFields.includes("teamSize") && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          Please select a team size
        </p>
      )}
      <p className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground dark:bg-muted/20">
        Count Team Members within your organization only. External
        collaborators, like plan sponsors or partner advisors, can be added
        later when setting up plans. You can change this anytime
      </p>
    </>
  );

  if (hideCard) {
    return <div className="space-y-2">{content}</div>;
  }

  return (
    <Card className="flex-1 shadow-none dark:bg-gray-800">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-blue" />
            Team Size
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          How many people in your organization will need access to PlanTelligence?
        </p>
      </CardHeader>
      <CardContent className="pt-0">{content}</CardContent>
    </Card>
  );
}
