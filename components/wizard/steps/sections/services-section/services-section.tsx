"use client";

import { ServiceType } from "@/types/wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Briefcase } from "lucide-react";
import {
  categoriesToStep2Services,
  step2ServicesToCategories,
} from "./services-section.funcs";
import { PrimaryServiceCategoriesSelect } from "@/components/ui/primary-service-categories-select";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";

interface ServicesSectionProps {
  selectedServices: ServiceType[];
  /** Legacy: toggle single service. Prefer onServicesChange for the shared category component. */
  onServiceToggle?: (service: ServiceType) => void;
  /** Called when category selection changes (same data as Settings primary categories) */
  onServicesChange?: (services: ServiceType[]) => void;
  customService: string;
  onCustomServiceChange: (value: string) => void;
  errorFields?: string[];
  hideCard?: boolean;
}

export function ServicesSection({
  selectedServices,
  onServiceToggle,
  onServicesChange,
  customService,
  onCustomServiceChange,
  errorFields = [],
  hideCard = false,
}: ServicesSectionProps) {
  const { validateCurrentStepFields } = useOnboardingWizardStore();
  const isOtherSelected = selectedServices.includes(ServiceType.OTHER);
  const selectedCategories = step2ServicesToCategories(selectedServices);

  const handleCategoriesChange = (categories: string[]) => {
    const newServices = categoriesToStep2Services(categories);
    if (onServicesChange) {
      onServicesChange(newServices as ServiceType[]);
    } else if (onServiceToggle) {
      newServices.forEach((s) => {
        if (!selectedServices.includes(s as ServiceType)) onServiceToggle(s as ServiceType);
      });
      selectedServices.forEach((s) => {
        if (!newServices.includes(s)) onServiceToggle(s);
      });
    }
  };

  const content = (
    <div className="space-y-4">
      <PrimaryServiceCategoriesSelect
        selectedValues={selectedCategories}
        onSelectionChange={handleCategoriesChange}
        placeholder="Select service categories..."
        helperText="Select 1–4 categories. Same categories as in Settings."
        maxSelections={4}
      />

      {/* Custom input when "Other" is selected */}
      {isOtherSelected && (
        <div className="space-y-2">
          <Label htmlFor="custom-service" className="text-sm font-medium">
            Please specify other benefits (max 50 characters)
          </Label>
          <Input
            id="custom-service"
            value={customService}
            onChange={async (e) => {
              onCustomServiceChange(e.target.value);
              setTimeout(() => validateCurrentStepFields(), 100);
            }}
            placeholder="Enter custom benefits..."
            maxLength={50}
            destructive={errorFields.includes("services")}
            className="w-full"
            data-field="customService"
          />
          <div className="text-xs text-muted-foreground text-right">
            {customService.length}/50 characters
          </div>
        </div>
      )}
    </div>
  );

  if (hideCard) {
    return content;
  }

  return (
    <Card className="flex flex-col shadow-none h-full dark:bg-gray-800">
      <CardHeader className="space-y-4">
        <p className="font-light text-muted-foreground">
          Which service categories do you offer? (Select all that apply)
        </p>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 mb-5">{content}</CardContent>
    </Card>
  );
}
