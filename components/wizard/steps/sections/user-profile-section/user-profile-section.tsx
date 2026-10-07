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
import { normalizeOrganizationType } from "@/config/onboarding/organization-types";

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
    validateFieldOnBlur,
    clearFieldError,
  } = useOnboardingWizardStore();
  const { setValue, watch } = useFormContext();

  // Fold a legacy RIA answer into the merged "Financial Advisor / RIA" option so
  // a previously-saved value still preselects.
  const selectedType = normalizeOrganizationType(watch("organizationType"));
  const customOrganization = watch("customOrganization");

  const onTypeSelect = async (type: OrganizationType) => {
    // Plain set: no shouldTouch, so selecting an option can never surface a
    // validation message. Errors come only from Next or a field blur.
    setValue("organizationType", type);
    if (type !== OrganizationType.OTHER) {
      setValue("customOrganization", "");
    }

    // Choosing a type satisfies the requirement — drop any stale "select an
    // organization type" error. Clear-only, so nothing appears on selection.
    clearFieldError("organizationType");

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
    }
  };

  const onCustomChange = async (value: string) => {
    setValue("customOrganization", value);

    // As soon as the user types, drop the "describe your organization" error;
    // it is re-evaluated on blur / Next.
    clearFieldError("customOrganization");

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
      }
    }
  };

  // Per-field blur validation ("leaves a field"). Never fires on selection, so
  // errors stay hidden until the user clicks Next or leaves the field.
  const validateOnBlur = (field: "organizationType" | "customOrganization") => {
    if (disableAutoSave) return;
    void validateFieldOnBlur(1, field, {
      ...stepData,
      clientProfile: {
        organizationType: watch("organizationType"),
        customOrganization: watch("customOrganization"),
      },
    });
  };

  const content = (
    <>
      {/* Compact 2-column grid so all options are visible without an inner
          scrollbar. */}
      <RadioGroup
        value={selectedType || ""}
        className="grid grid-cols-2 gap-2"
        data-field="organizationType"
        onBlur={(e) => {
          // Ignore focus moving between the radios themselves.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          validateOnBlur("organizationType");
        }}
      >
        {organizationOptions.map((option) => (
          <div
            key={option.value}
            className={`min-w-0 p-2.5 border rounded-lg cursor-pointer transition-colors ${
              selectedType === option.value
                ? `border-primary bg-[#23919C]/10 ${
                    errorFields.includes("organizationType")
                      ? "ring-1 ring-red-500"
                      : ""
                  }`
                : errorFields.includes("organizationType")
                  ? "border-red-500 hover:bg-muted/50"
                  : "hover:bg-muted/50"
            }`}
            onClick={() => onTypeSelect(option.value)}
          >
            <div className="flex items-start space-x-2">
              <RadioGroupItem
                value={option.value}
                id={`org-${option.value}`}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0">
                <Label
                  htmlFor={`org-${option.value}`}
                  className="cursor-pointer font-medium"
                >
                  <p className="text-sm font-medium leading-snug">
                    {option.label}
                  </p>
                </Label>
                <div className="text-xs leading-snug text-muted-foreground">
                  {option.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </RadioGroup>
      {errorFields.includes("organizationType") && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          Please select an organization type
        </p>
      )}

      {selectedType === OrganizationType.OTHER && (
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1">
            Describe Your Organization*
          </label>
          <Textarea
            value={customOrganization}
            onChange={(e) => onCustomChange(e.target.value)}
            onBlur={() => validateOnBlur("customOrganization")}
            placeholder="e.g., benefits marketplace, association, consultancy…"
            className="min-h-20 text-start resize-none focus:ring-none"
            destructive={errorFields.includes("customOrganization")}
            data-field="customOrganization"
          />
          {errorFields.includes("customOrganization") && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">
              Please describe your organization
            </p>
          )}
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
            Your Organizaation
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          What type of organization are you?
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">{content}</CardContent>
    </Card>
  );
}
