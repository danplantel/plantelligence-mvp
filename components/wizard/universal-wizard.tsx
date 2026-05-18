"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { WizardStep, WizardStepper } from "./wizard-stepper";

export interface WizardProps {
  steps: WizardStep[];
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onComplete: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  children: React.ReactNode;
  className?: string;
  showStepper?: boolean;
  nextButtonText?: string;
  previousButtonText?: string;
  completeButtonText?: string;
}

export function Wizard({
  steps,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onComplete,
  isFirstStep,
  isLastStep,
  children,
  className = "mx-10 py-6 min-h-screen",
  showStepper = true,
  nextButtonText = "Next",
  previousButtonText = "Previous",
  completeButtonText = "Complete",
}: WizardProps) {
  const currentStepData = steps.find((step) => step.id === currentStep);
  const currentStepTitle = currentStepData?.title || "";

  return (
    <div className={className}>
      {showStepper && (
        <WizardStepper
          steps={steps}
          currentStep={currentStep}
          totalSteps={totalSteps}
          currentStepTitle={currentStepTitle}
        />
      )}

      <div className="my-6">{children}</div>

      <Card className="shadow-none">
        <CardContent className="flex justify-between p-6">
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={isFirstStep}
            className="flex items-center space-x-2 text-lg px-4 py-6 border-accent-blue text-accent-blue"
          >
            <ChevronLeft className="size-6" />
            <span>{previousButtonText}</span>
          </Button>

          <Button
            onClick={isLastStep ? onComplete : onNext}
            className="flex items-center space-x-2 bg-accent-blue text-white text-lg px-4 py-6"
          >
            <span>{isLastStep ? completeButtonText : nextButtonText}</span>
            <ChevronRight className="size-6" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
