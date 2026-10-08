"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  useOnboardingWizardStore,
  type Step5SubStep,
} from "@/lib/onboarding-wizard-store";
import { getSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { OnboardingWizardStepper } from "./onboarding-wizard-stepper";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent } from "../ui/card";
import { validateCurrentStep } from "@/lib/wizard-validation";
import { toast } from "sonner";
import { TeamSize } from "@/types/wizard";

// Function to focus on the top-most invalid field and scroll to it.
// Chooses the FIRST errored field in DOCUMENT ORDER (not validation order) so
// the user always lands on the highest visible error — mirroring the
// new-client wizard's step-1 behavior. Every required onboarding control
// carries a `data-field` attribute for this lookup.
const focusFirstInvalidField = (errorFields: string[]) => {
  if (!errorFields || errorFields.length === 0) return;

  const errorSet = new Set(errorFields);

  // 1) Preferred: top-most errored element that exposes a `data-field`.
  let element: HTMLElement | null = null;
  const candidates = document.querySelectorAll<HTMLElement>("[data-field]");
  for (const candidate of Array.from(candidates)) {
    const field = candidate.getAttribute("data-field");
    if (field && errorSet.has(field)) {
      element = candidate;
      break;
    }
  }

  // 2) Legacy fallback for error keys without a `data-field` element.
  if (!element) {
    const firstErrorField = errorFields[0];
    const selectors = [
      `input[name="${firstErrorField}"]`,
      `select[name="${firstErrorField}"]`,
      `textarea[name="${firstErrorField}"]`,
      `#${firstErrorField}`,
      `[id*="${firstErrorField}"]`,
    ];

    for (const selector of selectors) {
      element = document.querySelector(selector) as HTMLElement | null;
      if (element) {
        break;
      }
    }
  }

  if (!element) {
    console.warn("Could not find element for field:", errorFields[0]);
    return;
  }

  const target = element;

  // Scroll to element
  target.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });

  // Focus on element
  setTimeout(() => {
    if (typeof target.focus === "function" && target.matches("input, select, textarea, button")) {
      target.focus({ preventScroll: true });
    } else if (target.querySelector) {
      // Try to find focusable element inside
      const focusableElement = target.querySelector(
        "input, select, textarea, button",
      ) as HTMLElement | null;
      if (focusableElement && typeof focusableElement.focus === "function") {
        focusableElement.focus({ preventScroll: true });
      }
    }
  }, 300);
};

/** Human labels for validation error fields, so the toast can name them. */
const FIELD_LABELS: Record<string, string> = {
  organizationType: "Organization type",
  teamSize: "Team size",
  customOrganization: "Organization description",
  services: "Services",
  customService: "Custom benefits",
  logo: "Logo",
  organizationName: "Organization name",
  website: "Website",
  primaryColor: "Primary color",
  secondaryColor: "Secondary color",
  name: "Name",
  email: "Email",
  organizationEmail: "Organization Email",
  phone: "Phone",
  title: "Title",
};

/** Step 5 shows its active sub-screen in the header instead of the generic "Summary". */
const STEP5_SUB_TITLES: Record<Step5SubStep, string> = {
  review: "Review Your Information",
  disclosures: "Review & Finish",
  team: "Invite Your Team",
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
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Use external props if provided, otherwise fall back to store
  const steps = externalSteps || store.steps;
  const currentStep = externalCurrentStep || store.currentStep;
  const totalSteps = externalTotalSteps || store.totalSteps;
  const step5SubStep = store.step5SubStep;
  const setStep5SubStep = store.setStep5SubStep;
  const editFromReview = store.editFromReview;
  const returnToReview = store.returnToReview;

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

  // Step 5c ("Invite Your Team") only applies when the org is bigger than one
  // person — i.e. team size is anything other than "Just me" (solo).
  const teamSizeBand = stepData.teamSize?.teamSize;
  const teamStepApplies = !!teamSizeBand && teamSizeBand !== TeamSize.SOLO;

  const handleNext = async () => {
    setIsLoading(true);

    try {
      // Get fresh data from the current step component before validation
      let freshStepData = { ...stepData };

      // For step 3 and 4, wait a bit for the store to update (e.g. after a logo
      // or headshot upload) so validation always uses the freshest store data —
      // the render-cycle stepData can lag behind an async upload save.
      if (currentStep === 3 || currentStep === 4) {
        // Wait for the store to update with the latest data
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Get fresh data from store after waiting
        const currentStore = useOnboardingWizardStore.getState();
        freshStepData = { ...currentStore.stepData };

        // Step 4 only: also read the latest form/DOM values (headshot, phone,
        // title) since those may not be flushed to the store yet.
        if (currentStep === 4) {
          // Always try to get fresh data from form inputs to ensure we have the latest values
          // This is especially important for headshot which might be uploaded but not yet saved to store
          const phoneInput = document.querySelector(
            'input[name="phone"]',
          ) as HTMLInputElement;
          const titleInput = document.querySelector(
            'input[name="title"]',
          ) as HTMLInputElement;
          const nameInput = document.querySelector(
            'input[name="name"]',
          ) as HTMLInputElement;
          const orgEmailInput = document.querySelector(
            'input[name="organizationEmail"]',
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

          // Validate what is ON SCREEN, not just the store. A resumed draft can
          // leave the store lagging (or missing the never-rendered login email),
          // which previously blocked Next with "complete all required fields"
          // even though the form was filled.
          let emailValue = freshStepData.userSetup?.email || "";
          if (!emailValue) {
            try {
              const currentSession = await getSession();
              emailValue = currentSession?.user?.email || "";
            } catch {
              // Best-effort; validation will still report Email if it stays blank.
            }
          }

          freshStepData.userSetup = {
            ...freshStepData.userSetup,
            name: nameInput?.value || freshStepData.userSetup?.name || "",
            email: emailValue,
            organizationEmail:
              orgEmailInput?.value ||
              freshStepData.userSetup?.organizationEmail ||
              "",
            phone: phoneInput?.value || freshStepData.userSetup?.phone || "",
            title: titleInput?.value || freshStepData.userSetup?.title || "",
            designations: freshStepData.userSetup?.designations || [],
            headshot: headshotValue || freshStepData.userSetup?.headshot || "",
            headshotFileName: freshStepData.userSetup?.headshotFileName || "",
            backgroundImage: freshStepData.userSetup?.backgroundImage || "",
            backgroundFileName: freshStepData.userSetup?.backgroundFileName || "",
          };
        }
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
          // Tag as "next" so the step's scroll hook re-anchors the viewport
          // (blur-sourced errors intentionally do not).
          setErrorFields(validationResult.errorFields, "next");

          // Focus on first invalid field and scroll to it
          setTimeout(() => {
            focusFirstInvalidField(validationResult.errorFields);
          }, 100);
        }
        // Name the missing field(s) rather than a bare generic message.
        const missing = (validationResult.errorFields || []).map(
          (field) => FIELD_LABELS[field] ?? field,
        );
        toast.error(
          missing.length > 0
            ? `Please complete: ${missing.join(", ")}`
            : "Please complete all required fields before proceeding",
        );
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

      // Editing a step from Review (5a): save, then return straight to Review
      // instead of advancing through the in-between steps.
      if (editFromReview) {
        returnToReview();
      } else {
        nextStep();
      }
    } finally {
      // Disable autosave after moving to next step
      useOnboardingWizardStore.getState().setAutosaveToServer?.(false);
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    // In edit-from-review mode, Previous abandons the edit and returns to
    // Review without saving (it never walks back through the in-between steps).
    if (editFromReview) {
      returnToReview();
      return;
    }
    previousStep();
  };

  const handleComplete = async () => {
    // Step 5 validation is enforced on its own sub-screens (e.g. "Confirm
    // Disclosures" on 5b) or bypassed by an explicit skip, so completion itself
    // is not gated here.
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

        // Refresh the NextAuth JWT so the middleware onboarding gate sees
        // onboardingComplete=true before the redirect to /dashboard
        // (otherwise the user would be bounced straight back to onboarding).
        try {
          await getSession();
        } catch {
          // Best-effort; the jwt callback re-checks on the next session fetch.
        }

        // Show success overlay with green checkmark for 3 seconds, then navigate
        setShowSuccessOverlay(true);
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 3000);
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
  // Step 5 is a sub-stepper — its header title reflects the active sub-screen
  // (5a Review Your Information / 5b Compliance Disclosures / 5c Invite Your
  // Team) rather than the generic "Summary" step name.
  const currentStepTitle =
    currentStep === 5 ? STEP5_SUB_TITLES[step5SubStep] : currentStepData?.title;

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

  // Primary button click routing for Step 5's sub-screens.
  const handlePrimaryClick = async () => {
    if (isLastStep) {
      // 5a Review -> 5b Disclosures
      if (step5SubStep === "review") {
        setStep5SubStep("disclosures");
        return;
      }

      // 5b Disclosures -> "Confirm Disclosures"
      if (step5SubStep === "disclosures") {
        // Requires a disclosure or an explicit "Add Later".
        if (!isStep5Valid) {
          // Surface the choice's validation UI on the radio group (the same
          // errorFields mechanism the other steps use) and explain via toast.
          setErrorFields(["disclosures"], "next");
          toast.error(
            "Please confirm your compliance disclosures, or choose Skip for Now.",
          );
          return;
        }
        clearErrorFields();
        // -> 5c when the team step applies, otherwise finish.
        if (teamStepApplies) {
          setStep5SubStep("team");
          return;
        }
        await handleCompleteClick();
        return;
      }

      // 5c Team -> "Send Invites & Finish"
      await handleCompleteClick();
      return;
    }

    // Steps 1-4: regular next with scroll behavior.
    await handleNextWithScroll();
  };

  // Secondary (skip/later) action for Step 5's sub-screens.
  const handleStep5SecondaryClick = async () => {
    if (!isLastStep) return;

    // 5b Disclosures -> "Skip for Now"
    if (step5SubStep === "disclosures") {
      if (teamStepApplies) {
        setStep5SubStep("team");
      } else {
        await handleCompleteClick();
      }
      return;
    }

    // 5c Team -> "Invite Later"
    if (step5SubStep === "team") {
      await handleCompleteClick();
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

  // Step 5 sub-screen labels. Each sub-screen owns its primary action; 5b and 5c
  // also expose a skip/later secondary action.
  const willCompleteOnPrimary =
    !editFromReview &&
    isLastStep &&
    (step5SubStep === "team" ||
      (step5SubStep === "disclosures" && !teamStepApplies));

  const primaryLabel = editFromReview
    ? "Save & Return to Review"
    : isLastStep
      ? step5SubStep === "review"
        ? "Looks Good, Continue"
        : step5SubStep === "disclosures"
          ? "Confirm Disclosures"
          : "Send Invites & Finish"
      : needsScroll
        ? "Scroll to Continue"
        : "Next";

  const step5SecondaryLabel = isLastStep
    ? step5SubStep === "disclosures"
      ? "Skip for Now"
      : step5SubStep === "team"
        ? "Invite Later"
        : null
    : null;

  return (
    <>
      {showSuccessOverlay ? (
        /* Success overlay — hides all toolbars, shows green checkmark for 3s */
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-gray-900">
          <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
            <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-6">
              <CheckCircle className="size-20 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              Setup Complete!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      ) : (
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
                      disabled={isFirstStep && !editFromReview}
                      className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <ChevronLeft className="size-5" />
                      <span>Previous</span>
                    </Button>

                    <div className="flex items-center gap-2">
                      {step5SecondaryLabel && (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handleStep5SecondaryClick}
                          disabled={isLoading}
                          className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          {step5SecondaryLabel}
                        </Button>
                      )}

                      <LoadingButton
                        size="lg"
                        onClick={handlePrimaryClick}
                        isLoading={isLoading}
                        loadingText={
                          willCompleteOnPrimary
                            ? "Completing setup..."
                            : "Saving data..."
                        }
                        className={`flex items-center space-x-2 text-white bg-accent-blue dark:bg-accent-blue-dark transition-all duration-300 ${
                          isPulsating
                            ? "animate-pulse ring-2 ring-accent-blue ring-opacity-50"
                            : ""
                        }`}
                      >
                        <span>{primaryLabel}</span>
                        <ChevronRight className="size-5" />
                      </LoadingButton>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
