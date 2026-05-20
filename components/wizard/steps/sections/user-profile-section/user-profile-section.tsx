"use client";

import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { OrganizationType } from "@/types/wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2 } from "lucide-react";
import { organizationOptions } from "./user-profile-section.funcs";

export interface UserProfileSectionProps {
  errorFields?: string[];
  hideCard?: boolean;
  disableAutoSave?: boolean;
}

export function UserProfileSection({
  errorFields = [],
  hideCard = false,
  disableAutoSave = false,
}: UserProfileSectionProps) {
  const {
    saveStepDataLocally,
    saveStepData,
    stepData,
    loadStepData,
    validateCurrentStepFields,
  } = useOnboardingWizardStore();
  const { setValue, watch } = useFormContext();

  const selectedType = watch("organizationType");
  const customOrganization = watch("customOrganization");

  const onTypeSelect = async (type: OrganizationType) => {
    setValue("organizationType", type, {
      shouldDirty: true,
      shouldTouch: true,
    });
    if (type !== OrganizationType.OTHER) {
      setValue("customOrganization", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
    }

    if (!disableAutoSave) {
      // Save data immediately when user interacts
      const data = {
        organizationType: type,
        customOrganization:
          type === OrganizationType.OTHER ? customOrganization : undefined,
      };
      // Save to both local state and server
      try {
        await saveStepData("clientProfile", data, true);
      } catch (error) {
        console.error("Failed to save client profile:", error);
      }
      // Validate fields in real-time
      setTimeout(() => validateCurrentStepFields(), 100);
    }
  };

  const onCustomChange = async (value: string) => {
    setValue("customOrganization", value, {
      shouldDirty: true,
      shouldTouch: true,
    });

    if (!disableAutoSave) {
      // Save data immediately when user interacts
      if (selectedType === OrganizationType.OTHER) {
        const data = {
          organizationType: selectedType,
          customOrganization: value,
        };
        // Save to both local state and server
        try {
          await saveStepData("clientProfile", data, true);
        } catch (error) {
          console.error("Failed to save client profile:", error);
        }
        // Validate fields in real-time
        setTimeout(() => validateCurrentStepFields(), 100);
      }
    }
  };

  const content = (
    <>
      <RadioGroup value={selectedType || ""} className="grid gap-2">
        {organizationOptions.map((option) => (
          <div
            key={option.value}
            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedType === option.value
                ? "border-primary bg-[#23919C]/10"
                : "hover:bg-muted/50"
            }`}
            onClick={() => onTypeSelect(option.value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={`org-${option.value}`} />
              <div>
                <Label
                  htmlFor={`org-${option.value}`}
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

      {selectedType === OrganizationType.OTHER && (
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1">
            Describe Your Organization*
          </label>
          <Textarea
            value={customOrganization}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="Benefits marketplace, PEO, association..."
            className="min-h-20 text-start resize-none focus:ring-none"
            data-field="customOrganization"
          />
        </div>
      )}
    </>
  );

  if (hideCard) {
    return <div className="space-y-3">{content}</div>;
  }

  return (
    <Card className="flex-1 shadow-none dark:bg-gray-800">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent-blue" />
            User Profile
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Select your organization type
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">{content}</CardContent>
    </Card>
  );
}
