"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { WizardStep, WizardStepper } from "./wizard-stepper";
import { LoadingButton } from "@/components/ui/loading-button";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { toast } from "sonner";

interface VideoWizardProps {
  steps: WizardStep[];
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onComplete: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  children: React.ReactNode;
  isLoading?: boolean;
}

export function VideoWizard({
  steps,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onComplete,
  isFirstStep,
  isLastStep,
  children,
  isLoading = false,
}: VideoWizardProps) {
  const currentStepData = steps.find((step) => step.id === currentStep);
  const currentStepTitle = currentStepData?.title || "";

  const [needsScroll, setNeedsScroll] = useState(false);
  const [isPulsating, setIsPulsating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const { errorFields, nextStep, clearErrorFields } = useVideoWizardStore();

  // Check if user needs to scroll to see all content
  const checkIfScrollNeeded = () => {
    if (!contentRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
    return !isAtBottom;
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({
        top: contentRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Handle Complete button click
  const handleComplete = async () => {
    // Prevent multiple clicks while processing
    if (isProcessing || isLoading) {
      return;
    }

    setIsProcessing(true);
    try {
      await onComplete();
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Next button click with scroll logic
  const handleNextWithScroll = async () => {
    // Prevent multiple clicks while processing
    if (isProcessing || isLoading) {
      return;
    }

    // Check if scroll is needed NOW (not using cached state)
    const scrollNeeded = checkIfScrollNeeded();

    if (scrollNeeded) {
      // If we need to scroll, scroll first
      scrollToBottom();
      setNeedsScroll(false);
      setIsPulsating(true);

      // Stop pulsating after 3 seconds
      setTimeout(() => {
        setIsPulsating(false);
      }, 3000);
      return;
    }

    // If already scrolled or no scroll needed, proceed with validation
    setIsProcessing(true);
    try {
      const result = await nextStep();

      if (!result.isValid) {
        // Show error messages
        if (result.errors && result.errors.length > 0) {
          if (result.errors.length === 1) {
            toast.error(result.errors[0].message);
          } else if (result.errors.length <= 3) {
            const errorMessages = result.errors
              .map((error: any) => error.message)
              .join(", ");
            toast.error("Please fix the following errors:", {
              description: errorMessages,
              duration: 5000,
            });
          } else {
            toast.error(
              "Please complete all required fields before proceeding",
            );
          }
        } else {
          toast.error("Please complete all required fields before proceeding");
        }
        return;
      }

      // Clear error fields on successful validation
      clearErrorFields();

      // Call the original onNext if validation passed
      await onNext();
    } finally {
      setIsProcessing(false);
    }
  };

  // Check scroll status when content changes
  useEffect(() => {
    const checkScroll = () => {
      const needsScrollCheck = checkIfScrollNeeded();
      setNeedsScroll(needsScrollCheck);
      if (needsScrollCheck) {
        setIsPulsating(false);
      }
    };

    // Check immediately
    checkScroll();

    // Check on scroll
    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener("scroll", checkScroll);
      return () => contentElement.removeEventListener("scroll", checkScroll);
    }
  }, [children, currentStep]);

  return (
    <>
      <div className="mx-10 py-4 min-h-screen">
        {/* Header with stepper */}
        <div className="mb-4">
          <WizardStepper
            steps={steps}
            currentStep={currentStep}
            totalSteps={totalSteps}
            currentStepTitle={currentStepTitle}
          />
        </div>

        {/* Content area */}
        <div ref={contentRef} className="mb-20">
          {children}
        </div>

        {/* Footer with navigation - sticky to bottom */}
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t z-50"
          style={{
            left: "var(--sidebar-width, 0)",
          }}
        >
          <div className="mx-10">
            <Card className="shadow-none border-0">
              <CardContent className="flex justify-between p-4">
                <Button
                  variant="outline"
                  onClick={onPrevious}
                  disabled={isFirstStep || isLoading || isProcessing}
                  size="lg"
                >
                  <ChevronLeft className="size-5" />
                  Previous
                </Button>

                <div className="flex gap-3">
                  {/* Next/Complete button */}
                  {isLastStep ? (
                    <LoadingButton
                      size="lg"
                      onClick={handleComplete}
                      isLoading={isLoading || isProcessing}
                      loadingText="Completing..."
                    >
                      Complete
                      <ChevronRight className="size-5" />
                    </LoadingButton>
                  ) : (
                    <LoadingButton
                      size="lg"
                      onClick={handleNextWithScroll}
                      isLoading={isLoading || isProcessing}
                      loadingText="Saving..."
                    >
                      {needsScroll ? "Scroll to Continue" : "Next"}
                      <ChevronRight className="size-5" />
                    </LoadingButton>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
