"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProfileSection } from "./sections/user-profile-section/user-profile-section";
import { TeamSizeSection } from "./sections/team-size-section/team-size-section";
import { clientProfileSchema, teamSizeSchema } from "@/lib/wizard-validation";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { useScrollToErrorField } from "@/hooks/use-scroll-to-error-field";
import { normalizeOrganizationType } from "@/config/onboarding/organization-types";
import { normalizeTeamSize } from "@/config/onboarding/team-sizes";
import { useEffect, useState } from "react";

interface Step1UserProfileProps {
  errorFields?: string[];
}

export function Step1UserProfile({ errorFields = [] }: Step1UserProfileProps) {
  const { stepData, saveStepDataLocally } = useOnboardingWizardStore();

  // Scroll to the top-most errored required field (document order) whenever
  // validation errors appear — mirrors new-client step 1.
  useScrollToErrorField(errorFields, [
    "organizationType",
    "teamSize",
    "customOrganization",
  ]);

  // State for Progressive Disclosure
  const [showTeamSize, setShowTeamSize] = useState(false);

  // Initialize form with validation
  const methods = useForm({
    resolver: zodResolver(clientProfileSchema.and(teamSizeSchema)),
    defaultValues: {
      organizationType: normalizeOrganizationType(
        stepData.clientProfile?.organizationType,
      ),
      customOrganization: stepData.clientProfile?.customOrganization ?? "",
      teamSize: normalizeTeamSize(stepData.teamSize?.teamSize),
    },
    mode: "onSubmit",
  });

  const { setValue, watch } = methods;
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
      setValue(
        "organizationType",
        normalizeOrganizationType(stepData.clientProfile.organizationType),
      );
      setValue(
        "customOrganization",
        stepData.clientProfile.customOrganization ?? "",
      );
    }
    if (stepData.teamSize) {
      setValue("teamSize", normalizeTeamSize(stepData.teamSize.teamSize));
    }
  }, [stepData, setValue]);

  return (
    <TooltipProvider>
      <FormProvider {...methods}>
        {/* 5-column grid: the profile takes 3 columns, team size takes 2. Until an
            organization type is chosen the profile is the only child and spans all
            five. */}
        {/* `items-stretch` (not items-start) so the Team Size card matches the
            taller User Profile card's height; each column is a flex column and
            the section Cards use `flex-1` to fill it. */}
        <div className="grid grid-cols-5 items-stretch gap-6 transition-all duration-300">
          {/* User Profile Section — deliberately NO inner scroll box: the step
              grows with its content and the wizard's own scroll region handles
              overflow, so every organization option stays visible instead of
              being clipped mid-list. */}
          <div
            className={`flex flex-col ${
              showTeamSize ? "col-span-3" : "col-span-5"
            }`}
          >
            <UserProfileSection errorFields={errorFields} />
          </div>

          {/* Team Size Section - Progressive Disclosure (2 of the 5 columns) */}
          {showTeamSize && (
            <div className="col-span-2 flex flex-col animate-in slide-in-from-right-5 duration-300">
              <TeamSizeSection errorFields={errorFields} />
            </div>
          )}
        </div>
      </FormProvider>
    </TooltipProvider>
  );
}
