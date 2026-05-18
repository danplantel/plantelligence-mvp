"use client";

import { useState, useEffect } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { VideoStep5a } from "./step-5a";
import { VideoStep5b } from "./step-5b";
import { VideoStep5c } from "./step-5c";

interface VideoStep5Props {
  errorFields?: string[];
}

export function VideoStep5({ errorFields = [] }: VideoStep5Props) {
  const { stepData, saveStepDataLocally } = useVideoWizardStore();

  // Sub-step state: 'form' (5a) or 'preview' (5b)
  // Initialize from saved state or default to 'form'
  const savedSubStep =
    (stepData as any).step5SubStep?.step5SubStep ||
    (stepData as any).step5SubStep;
  const [currentSubStep, setCurrentSubStep] = useState<
    "form" | "preview" | "disclaimer"
  >(savedSubStep || "form");

  // Initialize step5SubStep in store if not set
  useEffect(() => {
    if (!savedSubStep) {
      saveStepDataLocally("step5SubStep", { step5SubStep: "form" });
    }
  }, [savedSubStep, saveStepDataLocally]);

  // Save sub-step state
  useEffect(() => {
    saveStepDataLocally("step5SubStep", { step5SubStep: currentSubStep });
  }, [currentSubStep, saveStepDataLocally]);

  // Sync currentSubStep with store state
  useEffect(() => {
    const step5SubStep =
      (stepData as any).step5SubStep?.step5SubStep ||
      (stepData as any).step5SubStep;
    if (step5SubStep && step5SubStep !== currentSubStep) {
      setCurrentSubStep(step5SubStep);
    }
  }, [(stepData as any).step5SubStep, currentSubStep]);

  // Show disclaimer step (5c)
  if (currentSubStep === "disclaimer") {
    return <VideoStep5c />;
  }

  // Show preview step (5b)
  if (currentSubStep === "preview") {
    return <VideoStep5b />;
  }

  // Show form step (5a) - resources form
  return <VideoStep5a errorFields={errorFields} />;
}
