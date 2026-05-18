"use client";

import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Check, Edit3, X } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

interface WizardStepperProps {
  currentStepTitle?: string;
  steps?: WizardStep[];
  currentStep?: number;
  totalSteps?: number;
  showEditorButton?: boolean;
}

export function WizardStepper({
  currentStepTitle,
  steps: externalSteps,
  currentStep: externalCurrentStep,
  totalSteps: externalTotalSteps,
  showEditorButton,
}: WizardStepperProps) {
  const store = useNewClientWizardStore();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Use external props if provided, otherwise fall back to store
  const steps = externalSteps || store.steps;
  const currentStep = externalCurrentStep || store.currentStep;
  const totalSteps = externalTotalSteps || store.totalSteps;

  // Determine if editor button should be shown
  // For Step 3, only show on step3d sub-step
  const step3SubStep = (store.stepData as any)?.step3SubStep?.step3SubStep || (store.stepData as any)?.step3SubStep;
  const isStep3d = currentStep === 3 && step3SubStep === "step3d";

  const shouldShowEditorButton =
    showEditorButton !== undefined
      ? showEditorButton
      : currentStep === 1 || currentStep === 2 || isStep3d || currentStep === 5;

  // Listen for editor state changes from step 1, step 2 and step 5
  useEffect(() => {
    const handleEditorStateChange1 = (event: CustomEvent) => {
      if (currentStep === 1) {
        setIsEditorOpen(event.detail.isOpen);
      }
    };

    const handleEditorStateChange2 = (event: CustomEvent) => {
      if (currentStep === 2) {
        setIsEditorOpen(event.detail.isOpen);
      }
    };

    const handleEditorStateChange3 = (event: CustomEvent) => {
      if (currentStep === 3) {
        setIsEditorOpen(event.detail.isOpen);
      }
    };

    const handleEditorStateChange5 = (event: CustomEvent) => {
      if (currentStep === 5) {
        setIsEditorOpen(event.detail.isOpen);
      }
    };

    const handleEditorOpen1 = () => {
      if (currentStep === 1) setIsEditorOpen(true);
    };
    const handleEditorClose1 = () => {
      if (currentStep === 1) setIsEditorOpen(false);
    };

    const handleEditorOpen2 = () => {
      if (currentStep === 2) setIsEditorOpen(true);
    };
    const handleEditorClose2 = () => {
      if (currentStep === 2) setIsEditorOpen(false);
    };

    const handleEditorOpen3 = () => {
      if (currentStep === 3) setIsEditorOpen(true);
    };
    const handleEditorClose3 = () => {
      if (currentStep === 3) setIsEditorOpen(false);
    };

    const handleEditorOpen5 = () => {
      if (currentStep === 5) setIsEditorOpen(true);
    };
    const handleEditorClose5 = () => {
      if (currentStep === 5) setIsEditorOpen(false);
    };

    window.addEventListener(
      "step1EditorStateChange" as any,
      handleEditorStateChange1,
    );
    window.addEventListener(
      "step2EditorStateChange" as any,
      handleEditorStateChange2,
    );
    window.addEventListener(
      "step3EditorStateChange" as any,
      handleEditorStateChange3,
    );
    window.addEventListener(
      "step5EditorStateChange" as any,
      handleEditorStateChange5,
    );
    window.addEventListener("step1EditorOpen" as any, handleEditorOpen1);
    window.addEventListener("step1EditorClose" as any, handleEditorClose1);
    window.addEventListener("step2EditorOpen" as any, handleEditorOpen2);
    window.addEventListener("step2EditorClose" as any, handleEditorClose2);
    window.addEventListener("step3EditorOpen" as any, handleEditorOpen3);
    window.addEventListener("step3EditorClose" as any, handleEditorClose3);
    window.addEventListener("step5EditorOpen" as any, handleEditorOpen5);
    window.addEventListener("step5EditorClose" as any, handleEditorClose5);

    return () => {
      window.removeEventListener(
        "step1EditorStateChange" as any,
        handleEditorStateChange1,
      );
      window.removeEventListener(
        "step2EditorStateChange" as any,
        handleEditorStateChange2,
      );
      window.removeEventListener(
        "step3EditorStateChange" as any,
        handleEditorStateChange3,
      );
      window.removeEventListener(
        "step5EditorStateChange" as any,
        handleEditorStateChange5,
      );
      window.removeEventListener("step1EditorOpen" as any, handleEditorOpen1);
      window.removeEventListener("step1EditorClose" as any, handleEditorClose1);
      window.removeEventListener("step2EditorOpen" as any, handleEditorOpen2);
      window.removeEventListener("step2EditorClose" as any, handleEditorClose2);
      window.removeEventListener("step3EditorOpen" as any, handleEditorOpen3);
      window.removeEventListener("step3EditorClose" as any, handleEditorClose3);
      window.removeEventListener("step5EditorOpen" as any, handleEditorOpen5);
      window.removeEventListener("step5EditorClose" as any, handleEditorClose5);
    };
  }, [currentStep]);

  // Handle editor toggle
  const handleToggleEditor = () => {
    if (currentStep === 1) {
      if (isEditorOpen) {
        window.dispatchEvent(new CustomEvent("closeStep1Editor"));
      } else {
        window.dispatchEvent(new CustomEvent("openStep1Editor"));
      }
    } else if (currentStep === 2) {
      if (isEditorOpen) {
        window.dispatchEvent(new CustomEvent("closeStep2Editor"));
      } else {
        window.dispatchEvent(new CustomEvent("openStep2Editor"));
      }
    } else if (currentStep === 3) {
      if (isEditorOpen) {
        window.dispatchEvent(new CustomEvent("closeStep3Editor"));
      } else {
        window.dispatchEvent(new CustomEvent("openStep3Editor"));
      }
    } else if (currentStep === 5) {
      if (isEditorOpen) {
        window.dispatchEvent(new CustomEvent("closeStep5Editor"));
      } else {
        window.dispatchEvent(new CustomEvent("openStep5Editor"));
      }
    }
  };

  // Calculate which steps to show (max 5 visible)
  const getVisibleSteps = () => {
    const maxVisible = 5;
    let startIndex = 0;
    let endIndex = Math.min(maxVisible, totalSteps);

    // When we reach step 3, start showing the next steps
    if (currentStep >= 4) {
      startIndex = Math.max(0, currentStep - 3);
      endIndex = Math.min(startIndex + maxVisible, totalSteps);
    }

    // When we're near the end, show the last 5 steps
    if (currentStep > totalSteps - 3) {
      startIndex = Math.max(0, totalSteps - maxVisible);
      endIndex = totalSteps;
    }

    return steps.slice(startIndex, endIndex);
  };

  const visibleSteps = getVisibleSteps();

  return (
    <Card className="w-full p-5 shadow-none mt-2">
      <div className="flex items-center justify-between mb-4">
        <CardTitle className="text-xl">{currentStepTitle}</CardTitle>
        {shouldShowEditorButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleEditor}
            className="bg-accent-blue text-white hover:bg-[#3f797f]"
          >
            {isEditorOpen ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Close Editor
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 mr-2" />
                Open Editor
              </>
            )}
          </Button>
        )}
      </div>
      <div className="relative flex items-center w-full mt-2">
        {visibleSteps.map((step, index) => {
          const isLastVisible = index === visibleSteps.length - 1;
          const isCurrent = step.id === currentStep;
          const isPast = step.id < currentStep;

          return (
            <div
              key={step.id}
              className="relative flex items-center"
              style={{ flex: isLastVisible ? 0 : 1 }}
            >
              <div
                className={`size-12 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 flex-shrink-0 ${isCurrent
                  ? "bg-accent-blue text-white"
                  : isPast
                    ? "bg-accent-blue text-white"
                    : "bg-[#23919C]/10 text-gray-400"
                  }`}
              >
                <p className="text-sm">{step.id}</p>
              </div>

              {!isLastVisible && (
                <div
                  className={`h-1.5 flex-1 transition-all duration-200 ${step.id < currentStep ? "bg-accent-blue" : "bg-[#23919C]/10"
                    }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
