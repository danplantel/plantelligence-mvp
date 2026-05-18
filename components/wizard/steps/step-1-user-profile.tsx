"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProfileSection } from "./sections/user-profile-section/user-profile-section";
import { TeamSizeSection } from "./sections/team-size-section/team-size-section";
import { clientProfileSchema, teamSizeSchema } from "@/lib/wizard-validation";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { useEffect, useState } from "react";

interface Step1UserProfileProps {
  errorFields?: string[];
}

export function Step1UserProfile({ errorFields = [] }: Step1UserProfileProps) {
  const { stepData, saveStepDataLocally } = useOnboardingWizardStore();

  // State for Progressive Disclosure
  const [showTeamSize, setShowTeamSize] = useState(false);

  // Initialize form with validation
  const methods = useForm({
    resolver: zodResolver(clientProfileSchema.and(teamSizeSchema)),
    defaultValues: {
      organizationType: stepData.clientProfile?.organizationType || undefined,
      customOrganization: stepData.clientProfile?.customOrganization ?? "",
      teamSize: stepData.teamSize?.teamSize || undefined,
    },
    mode: "onSubmit",
  });

  const {
    setValue,
    watch,
    handleSubmit,
    formState: { errors },
  } = methods;
  const watchedData = watch();

  // No default value - let user choose first

  // Show team size section when organization type is selected
  useEffect(() => {
    const organizationType = watchedData.organizationType;
    if (organizationType) {
      setShowTeamSize(true);
    } else {
      setShowTeamSize(false);
    }
  }, [watchedData.organizationType]);

  // Update form when stepData changes
  useEffect(() => {
    if (stepData.clientProfile) {
      setValue("organizationType", stepData.clientProfile.organizationType);
      setValue(
        "customOrganization",
        stepData.clientProfile.customOrganization ?? "",
      );
    }
    if (stepData.teamSize) {
      setValue("teamSize", stepData.teamSize.teamSize);
    }
  }, [stepData, setValue]);

  return (
    <TooltipProvider>
      <FormProvider {...methods}>
        <div
          className={`grid gap-6 w-full transition-all duration-300 ${
            showTeamSize ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {/* User Profile Section */}
          <div>
            <UserProfileSection errorFields={errorFields} />
            {errors.organizationType && (
              <div className="mt-2 text-sm text-red-600">
                {errors.organizationType.message}
              </div>
            )}
            {errors.customOrganization && (
              <div className="mt-2 text-sm text-red-600">
                {errors.customOrganization.message}
              </div>
            )}
          </div>

          {/* Team Size Section - Progressive Disclosure */}
          {showTeamSize && (
            <div className="animate-in slide-in-from-right-5 duration-300">
              <TeamSizeSection errorFields={errorFields} />
              {errors.teamSize && (
                <div className="mt-2 text-sm text-red-600">
                  {errors.teamSize.message}
                </div>
              )}
            </div>
          )}
        </div>
      </FormProvider>
    </TooltipProvider>
  );
}
