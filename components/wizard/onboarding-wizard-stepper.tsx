"use client";

import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Check, Edit3, X, Moon, Sun } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useState, useEffect } from "react";

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

interface OnboardingWizardStepperProps {
  currentStepTitle?: string;
  steps?: WizardStep[];
  currentStep?: number;
  totalSteps?: number;
  showEditorButton?: boolean;
}

export function OnboardingWizardStepper({
  currentStepTitle,
  steps: externalSteps,
  currentStep: externalCurrentStep,
  totalSteps: externalTotalSteps,
  showEditorButton,
}: OnboardingWizardStepperProps) {
  const store = useOnboardingWizardStore();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Initialize dark mode from localStorage and document
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setIsDarkMode(isDark);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    setThemeMode(savedTheme || "system");
  }, []);

  // Use external props if provided, otherwise fall back to store
  const steps = externalSteps || store.steps;
  const currentStep = externalCurrentStep || store.currentStep;
  const totalSteps = externalTotalSteps || store.totalSteps;

  // Determine if editor button should be shown
  const shouldShowEditorButton =
    showEditorButton !== undefined ? showEditorButton : false;

  // Handle editor toggle
  const handleToggleEditor = () => {
    setIsEditorOpen(!isEditorOpen);
  };

  // Handle theme toggle
  const handleToggleTheme = () => {
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.remove("dark");
      setIsDarkMode(false);
      setThemeMode("light");
      localStorage.setItem("theme", "light");
    } else {
      html.classList.add("dark");
      setIsDarkMode(true);
      setThemeMode("dark");
      localStorage.setItem("theme", "dark");
    }
  };

  // Cancel the signup — permanently deletes the account and all data in the DB.
  const handleCancelSignup = async () => {
    try {
      setIsCancelling(true);
      const response = await fetch("/api/profile/delete", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      const result = await response.json();
      if (result.success) {
        // Clear the client-side onboarding store + persisted localStorage.
        useOnboardingWizardStore.getState().resetWizard();
        try {
          localStorage.removeItem("onboarding-wizard-store");
        } catch {
          // Ignore storage errors — session cleanup below still applies.
        }
        setCancelDialogOpen(false);
        toast.success("Account deleted successfully");
        await signOut({ callbackUrl: "/signin" });
      } else {
        throw new Error(result.error || "Failed to delete account");
      }
    } catch (err) {
      console.error("Error canceling signup:", err);
      toast.error("Failed to cancel signup. Please try again.");
      setCancelDialogOpen(false);
    } finally {
      setIsCancelling(false);
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

  // Handle step click - navigate to completed steps
  const handleStepClick = (stepId: number) => {
    // Only allow navigation to current step or previously completed steps
    if (stepId < currentStep || stepId === currentStep) {
      store.goToStep(stepId);
    }
  };

  return (
    <>
      <Card className="w-full shadow-none mt-2 rounded-none border-none">
      <div className="flex items-center justify-between mb-4">
         
         {/* Logo and Step Title */}
         <div className="flex items-center gap-4 flex-shrink-0">
           <img
             src={
               themeMode === "dark" || themeMode === "system"
                 ? "/pt_icon_dark.png"
                 : "/pt_icon_light.png"
             }
             className="w-[20px]"
             alt="PlanTelligence"
           />
           {/* Fixed width title so the stepper doesn't shift between steps.
               Longest title is "Organization Branding Setup". */}
           <CardTitle className="text-md whitespace-nowrap w-[280px] truncate">
             {currentStepTitle}
           </CardTitle>
         </div>

         {/* Step Indicators */}
         <div className="relative right-16 flex items-center justify-center w-1/2 mt-2">
        {visibleSteps.map((step, index) => {
          const isLastVisible = index === visibleSteps.length - 1;
          const isCurrent = step.id === currentStep;
          const isPast = step.id < currentStep;
          const isClickable = isPast || isCurrent;

          return (
            <div
              key={step.id}
              className="relative flex items-center"
            >
              <button
                onClick={() => handleStepClick(step.id)}
                disabled={!isClickable}
                className={`size-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                  isCurrent
                    ? "bg-[#2ba8b5] text-white transition-none"
                    : isPast
                      ? "bg-accent-blue text-white cursor-pointer hover:bg-accent-blue/90 hover:shadow-md hover:scale-105 transition-all duration-200"
                      : "bg-[#23919C]/10 text-gray-400 cursor-not-allowed transition-all duration-200"
                }`}
                style={isCurrent ? {
                  animationName: isDarkMode ? "wizard-pulse-glow-dark" : "wizard-pulse-glow-light",
                  animationDuration: "5s",
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: "infinite",
                } as React.CSSProperties : !isCurrent && !isPast && isDarkMode ? {
                  backgroundColor: "#4B5563",
                  color: "#E5E7EB"
                } : undefined}
                title={
                  isClickable
                    ? `Go to ${step.title}`
                    : `Complete previous steps to unlock ${step.title}`
                }
              >
                {isPast ? (
                  <Check className="w-2 h-2" />
                ) : (
                  <p
                    className="text-xs"
                    style={isCurrent ? {
                      animationName: "wizard-text-pulse",
                      animationDuration: "5s",
                      animationTimingFunction: "ease-in-out",
                      animationIterationCount: "infinite",
                    } as React.CSSProperties : undefined}
                  >
                    {step.id}
                  </p>
                )}
              </button>

              {!isLastVisible && (
                <div
                  className={`h-0.5 w-10 mx-1 transition-all duration-200 ${
                    step.id < currentStep
                      ? "bg-accent-blue"
                      : isDarkMode ? "" : "bg-[#23919C]/10"
                  }`}
                  style={step.id >= currentStep && isDarkMode ? {
                    backgroundColor: "#4B5563"
                  } : undefined}
                />
              )}
            </div>
          );
        })}
        </div>

        {/* Theme Toggle + Cancel */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleTheme}
            className="p-2 h-9 w-9"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>

          {/* Cancel Signup */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCancelDialogOpen(true)}
            disabled={isCancelling}
            className="h-9 px-3 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            title="Cancel signup and delete all data"
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>

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
      </div>
      </Card>

      {/* Cancel Signup Confirmation */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleCancelSignup}
        title="Cancel Signup?"
        description="Are you sure you want to cancel your signup? This will permanently delete your account and all associated data from the database. This action cannot be undone."
        confirmText="Delete Account"
        cancelText="Keep Editing"
        variant="destructive"
        isLoading={isCancelling}
      />
    </>
  );
}
