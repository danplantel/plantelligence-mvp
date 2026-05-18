"use client";

import { useState, useEffect } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { VideoStep3a } from "./step-3a";
import { VideoStep3b } from "./step-3b";

interface VideoStep3Props {
  errorFields?: string[];
}

export function VideoStep3({ errorFields = [] }: VideoStep3Props) {
  const { stepData, saveStepDataLocally } = useVideoWizardStore();

  // Sub-step state: 'form' (3a) or 'preview' (3b)
  // Initialize from saved state or default to 'form'
  const savedSubStep =
    (stepData as any).step3SubStep?.step3SubStep ||
    (stepData as any).step3SubStep;
  const [currentSubStep, setCurrentSubStep] = useState<"form" | "preview">(
    savedSubStep || "form",
  );

  // Save sub-step state
  useEffect(() => {
    saveStepDataLocally("step3SubStep", { step3SubStep: currentSubStep });
  }, [currentSubStep, saveStepDataLocally]);

  // Sync currentSubStep with store state
  useEffect(() => {
    const step3SubStep =
      (stepData as any).step3SubStep?.step3SubStep ||
      (stepData as any).step3SubStep;
    if (step3SubStep && step3SubStep !== currentSubStep) {
      setCurrentSubStep(step3SubStep);
    }
  }, [(stepData as any).step3SubStep, currentSubStep]);

  // Show preview step (3b)
  if (currentSubStep === "preview") {
    return <VideoStep3b />;
  }

  // Show form step (3a)
  return <VideoStep3a errorFields={errorFields} />;
}
