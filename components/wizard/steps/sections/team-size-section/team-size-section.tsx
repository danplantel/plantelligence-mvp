"use client";

import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { TeamSize, OrganizationType } from "@/types/wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";
import { getTeamSizeOptions } from "./team-size-section.funcs";

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
  const {
    saveStepDataLocally,
    saveStepData,
    stepData,
    loadStepData,
    validateCurrentStepFields,
  } = useOnboardingWizardStore();
  const { setValue, watch } = useFormContext();

  const selectedSize = watch("teamSize");
  const organizationType = watch("organizationType");

  const teamSizeOptions = getTeamSizeOptions(organizationType);

  useEffect(() => {
    if (!organizationType) return;

    const availableSizes = getTeamSizeOptions(organizationType);
    const firstOption = availableSizes[0];
    const isSizeAvailable = selectedSize
      ? availableSizes.some((option) => option.value === selectedSize)
      : false;

    if (!isSizeAvailable) {
      const nextValue = firstOption ? firstOption.value : undefined;
      setValue("teamSize", nextValue as any, {
        shouldDirty: true,
        shouldTouch: true,
      });
      if (!disableAutoSave) {
        saveStepDataLocally("teamSize", { teamSize: nextValue });
      }
    }
  }, [
    organizationType,
    selectedSize,
    setValue,
    saveStepDataLocally,
    disableAutoSave,
  ]);

  const onSizeSelect = async (size: TeamSize) => {
    setValue("teamSize", size, { shouldDirty: true, shouldTouch: true });

    if (!disableAutoSave) {
      // Save data immediately when user interacts
      const data = { teamSize: size };
      await saveStepDataLocally("teamSize", data);
      // Also save to server to prevent data loss
      try {
        await saveStepData("teamSize", data, true);
      } catch (error) {
        console.error("Failed to save team size to server:", error);
      }
      // Validate fields in real-time
      setTimeout(() => validateCurrentStepFields(), 100);
    }
  };

  if (!organizationType) {
    const emptyContent = (
      <p className="text-sm text-muted-foreground">
        Please select an organization type first
      </p>
    );

    if (hideCard) {
      return <div>{emptyContent}</div>;
    }

    return (
      <Card className="flex-1 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-blue" />
            Team Size / Role Scope
          </CardTitle>
          {emptyContent}
        </CardHeader>
      </Card>
    );
  }

  const content = (
    <RadioGroup
      value={selectedSize || ""}
      className="grid gap-2"
      data-field="teamSize"
    >
      {teamSizeOptions.map((option) => (
        <div
          key={option.value}
          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
            selectedSize === option.value
              ? "border-primary bg-[#23919C]/10"
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
  );

  if (hideCard) {
    return <div className="space-y-2">{content}</div>;
  }

  return (
    <Card className="flex-1 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-blue" />
            Team Size / Role Scope
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          How many users need access?
        </p>
      </CardHeader>
      <CardContent className="pt-0">{content}</CardContent>
    </Card>
  );
}
