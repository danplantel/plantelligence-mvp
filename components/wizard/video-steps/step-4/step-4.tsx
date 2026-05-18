"use client";

import { useState, useEffect } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { VideoStep4a } from "./step-4a";
import { VideoStep4b } from "./step-4b";

interface VideoStep4Props {
  errorFields?: string[];
}

export function VideoStep4({ errorFields = [] }: VideoStep4Props) {
  const { stepData, saveStepDataLocally } = useVideoWizardStore();

  // Sub-step state: 'form' (4a) or 'preview' (4b)
  // Initialize from saved state or default to 'form'
  const savedSubStep =
    (stepData as any).step4SubStep?.step4SubStep ||
    (stepData as any).step4SubStep;
  const [currentSubStep, setCurrentSubStep] = useState<"form" | "preview">(
    savedSubStep || "form",
  );

  // Save sub-step state
  useEffect(() => {
    saveStepDataLocally("step4SubStep", { step4SubStep: currentSubStep });
  }, [currentSubStep, saveStepDataLocally]);

  // Sync currentSubStep with store state
  useEffect(() => {
    const step4SubStep =
      (stepData as any).step4SubStep?.step4SubStep ||
      (stepData as any).step4SubStep;
    if (step4SubStep && step4SubStep !== currentSubStep) {
      setCurrentSubStep(step4SubStep);
    }
  }, [(stepData as any).step4SubStep, currentSubStep]);

  // Show preview step (4b)
  if (currentSubStep === "preview") {
    return <VideoStep4b />;
  }

  // Show form step (4a) - investments form
  return <VideoStep4a errorFields={errorFields} />;
}
