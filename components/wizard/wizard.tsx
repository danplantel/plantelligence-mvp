"use client";

import React, { useState, useRef, useEffect } from "react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { Button } from "@/components/ui/button";
import { OnboardingWizardStepper } from "./onboarding-wizard-stepper";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent } from "../ui/card";
import { validateCurrentStep } from "@/lib/wizard-validation";
import { toast } from "sonner";

// Function to focus on first invalid field and scroll to it
const focusFirstInvalidField = (errorFields: string[]) => {
  if (!errorFields || errorFields.length === 0) return;

  const firstErrorField = errorFields[0];

  // Try different selectors for the field
  const selectors = [
    `[data-field="${firstErrorField}"]`,
    `input[name="${firstErrorField}"]`,
    `select[name="${firstErrorField}"]`,
    `textarea[name="${firstErrorField}"]`,
    `#${firstErrorField}`,
    `[id*="${firstErrorField}"]`,
  ];

  let element: HTMLElement | null = null;

  for (const selector of selectors) {
    element = document.querySelector(selector) as HTMLElement;
    if (element) {
      break;
    }
  }

  if (element) {
    // Scroll to element
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    // Focus on element
    setTimeout(() => {
      if (element && typeof element.focus === "function") {
        element.focus();
      } else if (element && element.querySelector) {
        // Try to find focusable element inside
        const focusableElement = element.querySelector(
          "input, select, textarea, button",
        ) as HTMLElement;
        if (focusableElement && typeof focusableElement.focus === "function") {
          focusableElement.focus();
        }
      }
    }, 300);
  } else {
    console.warn("Could not find element for field:", firstErrorField);
  }
};

interface WizardStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

interface OnboardingWizardProps {
  children: React.ReactNode;
  // Optional external props for universal usage
  steps?: WizardStep[];
  currentStep?: number;
  totalSteps?: number;
  onNext?: () => void;
  onPrevious?: () => void;
  onComplete?: () => void;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  isStep5Valid?: boolean;
}

export function OnboardingWizard({
  children,
  steps: externalSteps,
  currentStep: externalCurrentStep,
  totalSteps: externalTotalSteps,
  onNext: externalOnNext,
  onPrevious: externalOnPrevious,
  onComplete: externalOnComplete,
  isFirstStep: externalIsFirstStep,
  isLastStep: externalIsLastStep,
  isStep5Valid = true,
}: OnboardingWizardProps) {
  const store = useOnboardingWizardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [needsScroll, setNeedsScroll] = useState(false);
  const [isPulsating, setIsPulsating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Use external props if provided, otherwise fall back to store
  const steps = externalSteps || store.steps;
  const currentStep = externalCurrentStep || store.currentStep;
  const totalSteps = externalTotalSteps || store.totalSteps;
  const showNextSteps = store.showNextSteps;

  const {
    nextStep,
    previousStep,
    completeStep,
    completeWizard,
    stepData,
    saveStepData,
    saveStepDataToServer,
    errorFields,
    setErrorFields,
    clearErrorFields,
  } = store;

  const handleNext = async () => {
    setIsLoading(true);

    try {
      // Get fresh data from the current step component before validation
      let freshStepData = { ...stepData };

      // For step 4, wait a bit for store to update and get fresh data
      if (currentStep === 4) {
        // Wait longer for the store to update with the latest data
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Get fresh data from store after waiting
        const currentStore = useOnboardingWizardStore.getState();
        freshStepData = { ...currentStore.stepData };

        // Always try to get fresh data from form inputs to ensure we have the latest values
        // This is especially important for headshot which might be uploaded but not yet saved to store
        const phoneInput = document.querySelector(
          'input[name="phone"]',
        ) as HTMLInputElement;
        const titleInput = document.querySelector(
          'input[name="title"]',
        ) as HTMLInputElement;
        const headshotField = document.querySelector(
          '[data-field="headshot"]',
        ) as HTMLElement;

        // Get headshot value - try multiple sources
        let headshotValue = freshStepData.userSetup?.headshot || "";

        // Try to get headshot from the image preview if available
        if (headshotField) {
          const headshotImg = headshotField.querySelector(
            'img[alt="Current headshot"]',
          ) as HTMLImageElement;
          if (
            headshotImg &&
            headshotImg.src &&
            !headshotImg.src.includes("data:image/svg")
          ) {
            // Only use if it's a real image, not a placeholder
            headshotValue = headshotImg.src;
          }
        }

        // Update freshStepData with form values - always update to ensure we have latest
        freshStepData.userSetup = {
          ...freshStepData.userSetup,
          phone: phoneInput?.value || freshStepData.userSetup?.phone || "",
          title: titleInput?.value || freshStepData.userSetup?.title || "",
          name: freshStepData.userSetup?.name || "",
          email: freshStepData.userSetup?.email || "",
          designations: freshStepData.userSetup?.designations || [],
          headshot: headshotValue || freshStepData.userSetup?.headshot || "",
          headshotFileName: freshStepData.userSetup?.headshotFileName || "",
          backgroundImage: freshStepData.userSetup?.backgroundImage || "",
          backgroundFileName: freshStepData.userSetup?.backgroundFileName || "",
        };
      }

      // Validate current step before proceeding
      const validationResult = await validateCurrentStep(
        currentStep,
        freshStepData,
      );

      if (!validationResult.isValid) {
        console.error("Validation failed:", validationResult.errors);
        // Set error fields for destructive styling
        if (validationResult.errorFields) {
          setErrorFields(validationResult.errorFields);

          // Focus on first invalid field and scroll to it
          setTimeout(() => {
            focusFirstInvalidField(validationResult.errorFields);
          }, 100);
        }
        toast.error("Please complete all required fields before proceeding");
        return;
      }

      // Clear error fields on successful validation
      clearErrorFields();

      // Enable autosave for this transition only (so child components using saveStepData with saveToServer=true will POST)
      useOnboardingWizardStore.getState().setAutosaveToServer?.(true);

      const stepTypeMap: { [key: number]: string } = {
        1: "clientProfile", // User Profile (includes teamSize)
        2: "services", // Services (includes insuranceLicensing)
        3: "branding", // Branding
        4: "userSetup", // User Setup (profile details)
        5: "summary", // Summary (no data to save)
      };

      // Special handling for step 1 - save both clientProfile and teamSize
      // IMPORTANT: These must be SEQUENTIAL, not parallel, to avoid a race condition
      // where both API routes find no existing session and each creates their own.
      // The first save creates the session, the second reuses it.
      if (currentStep === 1) {
        // Save clientProfile first to ensure session is created
        if (stepData.clientProfile) {
          const clientProfileResult = await saveStepDataToServer(
            "clientProfile",
            stepData.clientProfile,
          );
          if (!clientProfileResult) {
            console.error(
              `Failed to save clientProfile for step ${currentStep}`,
            );
            return;
          }
        }

        // Save teamSize second (reuses the session created above)
        if (stepData.teamSize) {
          const teamSizeResult = await saveStepDataToServer(
            "teamSize",
            stepData.teamSize,
          );
          if (!teamSizeResult) {
            console.error(
              `Failed to save teamSize for step ${currentStep}`,
            );
            return;
          }
        }
      } else if (currentStep === 2) {
        // Special handling for step 2 - save services and insuranceLicensing
        const promises = [];

        if (stepData.services) {
          promises.push(saveStepDataToServer("services", stepData.services));
        }

        if (stepData.insuranceLicensing) {
          promises.push(
            saveStepDataToServer(
              "insuranceLicensing",
              stepData.insuranceLicensing,
            ),
          );
        }

        if (promises.length > 0) {
          const results = await Promise.all(promises);
          const allSuccess = results.every((result) => result === true);

          if (!allSuccess) {
            console.error(`Failed to save step ${currentStep} data to server`);
            return;
          }
        }
      } else {
        // Regular handling for other steps
        const currentStepType = stepTypeMap[currentStep];

        // Read the latest store data directly to avoid stale render-cycle stepData.
        // The render-cycle stepData may lag behind the zustand store when onDataChange
        // in child components (e.g., Step 3 Branding) calls saveStepDataLocally, because
        // React re-renders are asynchronous. Using getState() guarantees we get the
        // most up-to-date values (e.g., primaryColor, secondaryColor).
        const latestStore = useOnboardingWizardStore.getState();
        const latestStepData = latestStore.stepData;

        // Debug: log what's being sent to the server for Step 3 branding
        if (currentStep === 3) {
          console.log("[handleNext] Step 3 - render-cycle stepData.branding:", {
            primaryColor: stepData.branding?.primaryColor,
            secondaryColor: stepData.branding?.secondaryColor,
          });
          console.log("[handleNext] Step 3 - latestStore stepData.branding:", {
            primaryColor: latestStepData.branding?.primaryColor,
            secondaryColor: latestStepData.branding?.secondaryColor,
          });
        }

        // Step 4: handleNext builds freshStepData (DOM headshot + delayed store read) for
        // validation — must POST that same payload. stepData from render can lag behind
        // the headshot batch debounce and would save without the new headshot.
        const payloadForServer =
          currentStep === 4 && freshStepData.userSetup
            ? freshStepData.userSetup
            : currentStepType
              ? latestStepData[currentStepType as keyof typeof latestStepData]
              : undefined;

        if (currentStepType && payloadForServer) {
          const success = await saveStepDataToServer(
            currentStepType,
            payloadForServer,
          );
          if (!success) {
            console.error(`Failed to save step ${currentStep} data to server`);
            return;
          }
          if (currentStep === 4 && freshStepData.userSetup) {
            await saveStepData("userSetup", freshStepData.userSetup, false);
          }
        }
      }

      completeStep(currentStep);
      nextStep();
    } finally {
      // Disable autosave after moving to next step
      useOnboardingWizardStore.getState().setAutosaveToServer?.(false);
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    previousStep();
  };

  const handleComplete = async () => {
    // Check validation for step 5 (disclaimers)
    if (currentStep === 5 && !isStep5Valid) {
      toast.error(
        "Please complete the required fields before proceeding to the dashboard.",
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const stepTypeMap: { [key: number]: string } = {
        1: "clientProfile", // User Profile (includes teamSize)
        2: "services", // Services (includes insuranceLicensing)
        3: "branding", // Branding
        4: "userSetup", // User Setup (profile details)
        5: "summary", // Summary (no data to save)
      };

      // Special handling for step 1 - save both clientProfile and teamSize
      if (currentStep === 1) {
        const promises = [];

        if (stepData.clientProfile) {
          promises.push(
            saveStepDataToServer("clientProfile", stepData.clientProfile),
          );
        }

        if (stepData.teamSize) {
          promises.push(saveStepDataToServer("teamSize", stepData.teamSize));
        }

        if (promises.length > 0) {
          const results = await Promise.all(promises);
          const allSuccess = results.every((result) => result === true);

          if (!allSuccess) {
            console.error(
              `Failed to save final step ${currentStep} data to server`,
            );
            toast.error("Failed to save data. Please try again.");
            return;
          }
        }
      } else if (currentStep === 2) {
        // Special handling for step 2 - save services and insuranceLicensing
        const promises = [];

        if (stepData.services) {
          promises.push(saveStepDataToServer("services", stepData.services));
        }

        if (stepData.insuranceLicensing) {
          promises.push(
            saveStepDataToServer(
              "insuranceLicensing",
              stepData.insuranceLicensing,
            ),
          );
        }

        if (promises.length > 0) {
          const results = await Promise.all(promises);
          const allSuccess = results.every((result) => result === true);

          if (!allSuccess) {
            console.error(
              `Failed to save final step ${currentStep} data to server`,
            );
            toast.error("Failed to save data. Please try again.");
            return;
          }
        }
      } else {
        // Regular handling for other steps
        const currentStepType = stepTypeMap[currentStep];
        if (
          currentStepType &&
          stepData[currentStepType as keyof typeof stepData]
        ) {
          const success = await saveStepDataToServer(
            currentStepType,
            stepData[currentStepType as keyof typeof stepData],
          );
          if (!success) {
            console.error(
              `Failed to save final step ${currentStep} data to server`,
            );
            toast.error("Failed to save data. Please try again.");
            return;
          }
        }
      }

      const response = await fetch("/api/onboarding-wizard/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ finalData: stepData }),
      });

      if (response.ok) {
        completeStep(currentStep);
        // Update store state locally without making a second API call
        // (completeWizard() would trigger a redundant POST to the complete endpoint)
        useOnboardingWizardStore.setState({
          isCompleted: true,
          currentStep: 5,
        });
        window.location.href = "/new/dashboard";
      } else {
        const errorData = await response.json();
        console.error("Failed to complete wizard:", errorData);
        toast.error(`Failed to complete onboarding: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error completing wizard:", error);
      toast.error(`Error completing onboarding: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Use external handlers if provided, otherwise use internal logic
  const handleNextClick = externalOnNext || handleNext;
  const handlePreviousClick = externalOnPrevious || handlePrevious;
  const handleCompleteClick = externalOnComplete || handleComplete;

  const isFirstStep =
    externalIsFirstStep !== undefined ? externalIsFirstStep : currentStep === 1;
  const isLastStep =
    externalIsLastStep !== undefined
      ? externalIsLastStep
      : currentStep === totalSteps;

  const currentStepData = steps.find((step) => step.id === currentStep);
  const currentStepTitle = currentStepData?.title;

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

  // Handle Next button click with scroll logic
  const handleNextWithScroll = async () => {
    if (needsScroll) {
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

    // If already scrolled or no scroll needed, proceed normally
    await handleNextClick();
  };

  // Primary button click routing for Step 5 behavior
  const handlePrimaryClick = async () => {
    // On the last step (5), if we haven't shown Next Steps yet, toggle to it instead of advancing
    if (isLastStep && !showNextSteps) {
      store.setShowNextSteps(true);
      return;
    }

    // If last step and already in Next Steps, complete
    if (isLastStep && showNextSteps) {
      await handleCompleteClick();
      return;
    }

    // Otherwise, regular next with scroll behavior
    await handleNextWithScroll();
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
      {/* Fixed header with stepper */}
      <div className="fixed top-0 left-0 right-0 bg-background border-b shadow-md z-40">
        <div className="flex justify-center">
          <div className="w-full max-w-6xl">
            <OnboardingWizardStepper
              currentStepTitle={currentStepTitle}
              steps={steps}
              currentStep={currentStep}
              totalSteps={totalSteps}
              showEditorButton={false}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center min-h-screen pt-20 pb-4">
        {/* Content area with top padding to account for fixed header */}
        <div ref={contentRef} className="mb-20 w-full max-w-4xl px-10">
          {React.cloneElement(children as React.ReactElement, {
            errorFields: errorFields,
          })}
        </div>

        {/* Footer with navigation - sticky to bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
          <div className="flex justify-center">
            <Card className="shadow-none border-0 w-full max-w-4xl">
              <CardContent className="flex justify-between p-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handlePreviousClick}
                  disabled={isFirstStep}
                  className="flex items-center space-x-2 border-accent-blue text-accent-blue dark:text-gray-300 dark:border-gray-600 transition-colors duration-300 hover:bg-accent-blue hover:text-white dark:hover:bg-gray-600 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="size-5" />
                  <span>Previous</span>
                </Button>

                <LoadingButton
                  size="lg"
                  onClick={handlePrimaryClick}
                  isLoading={isLoading}
                  loadingText={
                    isLastStep && showNextSteps
                      ? "Completing setup..."
                      : "Saving data..."
                  }
                  className={`flex items-center space-x-2 text-white bg-accent-blue dark:bg-accent-blue-dark transition-all duration-300 ${
                    isPulsating
                      ? "animate-pulse ring-2 ring-accent-blue ring-opacity-50"
                      : ""
                  }`}
                >
                  <span>
                    {isLastStep && showNextSteps
                      ? "Go to Dashboard"
                      : currentStep === 5
                      ? "Continue"
                      : needsScroll
                      ? "Scroll to Continue"
                      : "Next"}
                  </span>
                  <ChevronRight className="size-5" />
                </LoadingButton>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
