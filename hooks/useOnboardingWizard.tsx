"use client";

import { useEffect, useState } from "react";
import {
  useOnboardingWizardStore,
  WizardStep,
} from "@/lib/onboarding-wizard-store";

interface UseOnboardingWizardProps {
  wizardType: "onboarding" | "new-client";
  steps: WizardStep[];
}

export function useOnboardingWizard({
  wizardType,
  steps,
}: UseOnboardingWizardProps) {
  const {
    currentStep,
    totalSteps,
    isCompleted,
    stepData,
    nextStep,
    previousStep,
    completeStep,
    completeWizard,
    saveStepData,
    saveStepDataToServer,
    loadAllWizardData,
    resetWizard,
  } = useOnboardingWizardStore();

  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize wizard
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Load existing data on mount (only once when initialized)
  useEffect(() => {
    if (isInitialized) {
      loadAllWizardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]); // Only load once when initialized

  const handleNext = async () => {
    completeStep(currentStep);
    nextStep();
  };

  const handlePrevious = () => {
    previousStep();
  };

  const handleComplete = async () => {
    completeStep(currentStep);
    completeWizard();

    // Save final data to server
    try {
      const response = await fetch(
        `/api/onboarding-wizard/${wizardType}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ finalData: stepData }),
        },
      );

      if (!response.ok) {
        console.error("Failed to complete wizard");
      }
    } catch (error) {
      console.error("Error completing wizard:", error);
    }
  };

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return {
    currentStep,
    totalSteps,
    steps,
    isCompleted,
    stepData,
    isInitialized,
    isFirstStep,
    isLastStep,
    nextStep: handleNext,
    previousStep: handlePrevious,
    completeWizard: handleComplete,
    saveStepData,
    saveStepDataToServer,
    resetWizard,
  };
}
