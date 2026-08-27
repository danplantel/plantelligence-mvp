"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "../ui/card";
import type { WizardStep } from "./wizard-stepper";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  useNewClientWizardStore,
  focusFirstInvalidField,
} from "@/lib/new-client-wizard-store";
import { isDuplicatePlanNameError } from "@/lib/duplicate-plan-name-error";
import { DuplicatePlanNameDialog } from "@/components/wizard/duplicate-plan-name-dialog";
import { validateNewClientCurrentStepV2 } from "@/lib/new-client-wizard-validation-v2";
import { toast } from "sonner";

interface NewClientWizardProps {
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

export function NewClientWizard({
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
}: NewClientWizardProps) {
  const [needsScroll, setNeedsScroll] = useState(false);
  const [isPulsating, setIsPulsating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    errorFields,
    nextStep,
    clearErrorFields,
    saveAsDraft,
    saveStepDataToServer,
    stepData,
    selectedCategoryStep3a,
    duplicatePlanNameConflict,
    clearDuplicatePlanNameConflict,
    resolveDuplicatePlanOverwrite,
    resolveDuplicatePlanSaveAsNew,
  } = useNewClientWizardStore();

  // Contacts for Step 3 — gate the Next button until at least one contact exists
  const contactsOnStep3 = stepData.keyContacts?.contacts || [];
  const hasStep3Contact = currentStep === 3 ? contactsOnStep3.length > 0 : true;

  // Step 3 sub-step derived once for use in gating and button logic
  const step3SubStep =
    (stepData as any)?.step3SubStep?.step3SubStep ||
    (stepData as any)?.step3SubStep;

  // Next is enabled for all Step 3 slides — navigation is delegated to the
  // bottom bar (Previous/Next). Each slide's own buttons have been removed.
  const isNextEnabled = currentStep === 3 ? true : hasStep3Contact;

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

  const handlePrevious = async () => {
    if (isProcessing || isLoading) return;

    setIsProcessing(true);
    try {
      if (currentStep === 2) {
        window.dispatchEvent(new CustomEvent("closeStep2Editor"));

        await new Promise((resolve) => setTimeout(resolve, 300));

        onPrevious();
      } else if (currentStep === 5) {
        const step5SubStep =
          (stepData as any)?.employeePortalPreview?.step5SubStep || "disclaimers";

        // Close editor panel first if it's open (for benefits-team/step5d)
        if (step5SubStep === "benefits-team" || step5SubStep === "step5d") {
          window.dispatchEvent(new CustomEvent("closeStep5Editor"));
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        onPrevious();
      } else {
        onPrevious();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNextWithScroll = async () => {
    if (isProcessing || isLoading) {
      return;
    }

    const scrollNeeded = checkIfScrollNeeded();

    if (scrollNeeded) {
      scrollToBottom();
      setNeedsScroll(false);
      setIsPulsating(true);

      setTimeout(() => {
        setIsPulsating(false);
      }, 3000);
      return;
    }

    setIsProcessing(true);
    try {
      // Flush step3b form to store before validation so auto-filled values are recognized (fixes intermittent validation errors)
      const { currentStep: step, stepData: data, step3SlideIndex: slideIdx } =
        useNewClientWizardStore.getState();
      const step3SubStepForFlush =
        (data as any)?.step3SubStep?.step3SubStep ||
        (data as any)?.step3SubStep;
      const isStep3bForm =
        step3SubStepForFlush === "step3b" || slideIdx === 1;
      if (step === 3 && isStep3bForm) {
        await (window as any).__step3bFlushFormToStore?.();
      }
      // Flush step-1 local state to the store before validation (same pattern as
      // step3b) so the wizard validates the current filled fields, not a stale /
      // incomplete snapshot — e.g. after navigating back from a later step.
      if (step === 1) {
        await (window as any).__step1FlushFormToStore?.();
      }
      const { stepData: dataAfterFlush } = useNewClientWizardStore.getState();
      const validationResult = await validateNewClientCurrentStepV2(step, dataAfterFlush);

      if (!validationResult.isValid) {
        if (validationResult.errorFields) {
          useNewClientWizardStore
            .getState()
            .setErrorFields(validationResult.errorFields);
        }

        if (validationResult.errors && validationResult.errors.length > 0) {
          const incompleteCategoriesError = validationResult.errors.find(
            (error: any) => error.field === "incompleteCategories",
          ) as any;

          if (
            incompleteCategoriesError &&
            incompleteCategoriesError.missingCategories
          ) {
            window.dispatchEvent(
              new CustomEvent("showIncompleteCategoriesModal", {
                detail: {
                  missingCategories:
                    incompleteCategoriesError.missingCategories,
                },
              }),
            );
            return;
          }

          const primaryContactError = validationResult.errors.find(
            (error: any) =>
              error.field === "primaryContactRequired" ||
              (typeof error.field === "string" && error.field.startsWith("primaryContact_")),
          ) as any;
          if (primaryContactError?.message) {
            toast.error("Primary contact required", {
              description: primaryContactError.message,
              duration: 6000,
            });
            return;
          }
        }

        setTimeout(() => {
          focusFirstInvalidField(validationResult.errorFields || []);
        }, 100);

        // Only show detailed validation errors on step-3b
        const step3SubStep =
          (data as any)?.step3SubStep?.step3SubStep ||
          (data as any)?.step3SubStep;
        const isStep3b = step === 3 && step3SubStep === "step3b";

        if (isStep3b && validationResult.errors && validationResult.errors.length > 0) {
          const fieldLabels: Record<string, string> = {
            firstName: "First Name",
            lastName: "Last Name",
            title: "Title",
            displayName: "Display Name",
            name: "Name",
            email: "Email",
            phone: "Phone",
            role: "Role",
            benefitsCategories: "Benefits Categories",
            contactActions: "Contact Action",
            primaryContact: "Primary contact required for category",
            hubDocumentsCategory: "Benefits Hub documents",
            schedulingUrl: "Scheduling URL",
            websiteUrl: "Contact Form URL",
          };

          const fieldsByContact = new Map<string, Set<string>>();
          const generalFields = new Set<string>();
          const processedFields = new Set<string>();

          validationResult.errors.forEach((error: any) => {
            const baseField = error.field.replace(/^contact_[^_]+_/, "");

            const uniqueKey = error.contactName
              ? `${error.contactName}_${baseField}`
              : baseField;

            if (processedFields.has(uniqueKey)) {
              return;
            }

            processedFields.add(uniqueKey);

            const fieldLabel =
              baseField.startsWith("primaryContact")
                ? "Primary contact required"
                : (fieldLabels[baseField] || baseField);

            if (error.contactName) {
              if (!fieldsByContact.has(error.contactName)) {
                fieldsByContact.set(error.contactName, new Set());
              }
              fieldsByContact.get(error.contactName)!.add(fieldLabel);
            } else {
              generalFields.add(fieldLabel);
            }
          });

          const errorMessages: string[] = [];

          fieldsByContact.forEach((fields, contactName) => {
            const fieldsList = Array.from(fields).join(", ");
            errorMessages.push(`${contactName}: ${fieldsList}`);
          });

          if (generalFields.size > 0) {
            const fieldsList = Array.from(generalFields).join(", ");
            errorMessages.push(fieldsList);
          }

          if (errorMessages.length === 1) {
            toast.error("Please complete the following fields:", {
              description: errorMessages[0],
              duration: 6000,
            });
          } else if (errorMessages.length > 1) {
            const errorText = errorMessages.join("\n");
            toast.error("Please complete the following fields:", {
              description: errorText,
              duration: 6000,
            });
          } else {
            toast.error("Please complete all required fields");
          }
        } else {
          // For other steps, surface the specific missing fields when they're
          // known so the user (and debugging) can see exactly what failed
          // instead of a generic message.
          const stepFieldLabels: Record<string, string> = {
            companyName: "Company Name",
            companyWebsite: "Company Website",
            planType: "Plan Type",
            portalUrl: "Portal URL",
            primaryColor: "Primary Color",
            secondaryColor: "Secondary Color",
            organizationType: "Organization Type",
            missionHeadline: "Mission Headline",
            missionBody: "Mission Statement",
            heroHeaderUrl: "Background Header Image",
            heroTitle: "Hero Title",
            heroDescription: "Hero Description",
            headline: "Headline",
            bodyText: "Body Text",
            companyBasics: "Company Basics",
          };
          const missingFields = Array.from(
            new Set(
              (validationResult.errorFields || []).map(
                (f: string) => stepFieldLabels[f] || f,
              ),
            ),
          );
          if (missingFields.length > 0) {
            toast.error("Please complete the following fields:", {
              description: missingFields.join(", "),
              duration: 6000,
            });
          } else {
            // For other steps, show generic error message
            toast.error("Please complete all required fields");
          }
        }
        return;
      }

      // If valid, now we can safely close the editor panels before transitioning
      if (currentStep === 2) {
        window.dispatchEvent(new CustomEvent("closeStep2Editor"));
        // Wait 2 seconds for modal to close before proceeding to next step
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else if (currentStep === 5) {
        const step5SubStep =
          (stepData as any)?.employeePortalPreview?.step5SubStep || "disclaimers";
        // Only close editor when on benefits-team/step5d (the editor substep)
        if (step5SubStep === "benefits-team" || step5SubStep === "step5d") {
          window.dispatchEvent(new CustomEvent("closeStep5Editor"));
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Check if we're on step-3b or step-3d
      const step3SubStep =
        (stepData as any)?.step3SubStep?.step3SubStep ||
        (stepData as any)?.step3SubStep;
      const isStep3d = currentStep === 3 && step3SubStep === "step3d";

      // For step-3d, ensure all local changes are saved before calling nextStep
      if (isStep3d) {
        try {
          // Call step-3d's save function to ensure all local state is saved
          const saveStep3dState = (window as any).__step3dSaveCurrentState;
          if (saveStep3dState) {
            await saveStep3dState();
          } else {
            // Fallback: save from store if function not available
            // Give a small delay to ensure any pending state updates are flushed
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Get fresh data from store after delay
            const { stepData: currentStepData } =
              useNewClientWizardStore.getState();
            const keyContactsData = currentStepData.keyContacts || {
              contacts: [],
            };

            if (keyContactsData) {
              // Ensure data is saved locally first
              await useNewClientWizardStore
                .getState()
                .saveStepDataLocally("keyContacts", keyContactsData);

              // Then save to server and draft
              await saveStepDataToServer("keyContacts", keyContactsData);
              await saveAsDraft();
            }
          }

          // Give a small delay to ensure save completes
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          if (isDuplicatePlanNameError(error)) {
            setIsProcessing(false);
            return;
          }
          console.error(
            "Failed to save draft before nextStep for step3d:",
            error,
          );
        }
      }

      let result: { isValid: boolean; errors: any[] };
      try {
        result = await nextStep();
      } catch (error) {
        if (isDuplicatePlanNameError(error)) {
          return;
        }
        throw error;
      }

      clearErrorFields();

      await onNext();
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const checkScroll = () => {
      const needsScrollCheck = checkIfScrollNeeded();
      setNeedsScroll(needsScrollCheck);
      if (needsScrollCheck) {
        setIsPulsating(false);
      }
    };

    checkScroll();

    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener("scroll", checkScroll);
      return () => contentElement.removeEventListener("scroll", checkScroll);
    }
  }, [children, currentStep]);

  // Calculate if we're on Step 3c and have 2+ contacts to change button prioritization
  const isStep3c = currentStep === 3 && step3SubStep === "step3c";
  const contactCount = stepData.keyContacts?.contacts?.length || 0;
  const isStep3cWithMultipleContacts = isStep3c && contactCount >= 2;
  const isStep3a = currentStep === 3 && step3SubStep === "step3a";
  const isStep3aWithMultipleContacts = isStep3a && contactCount >= 2;

  // Get selected category from step3c data (for step3c) or from store (for step3a)
  const selectedCategoryStep3c = (stepData as any)?.step3c?.benefitsCategory || null;
  const currentSelectedCategory = isStep3c ? selectedCategoryStep3c : selectedCategoryStep3a;

  return (
    <>
      <DuplicatePlanNameDialog
        open={duplicatePlanNameConflict != null}
        companyName={duplicatePlanNameConflict?.companyName ?? ""}
        onCancel={clearDuplicatePlanNameConflict}
        onOverwrite={resolveDuplicatePlanOverwrite}
        onSaveAsNew={resolveDuplicatePlanSaveAsNew}
      />
      <div className="mx-10 py-4">
        <div ref={contentRef} className="mb-12">
          {children}
        </div>

        <div
          className="fixed bottom-0 bg-background border-t z-50 dark:border-gray-700"
          style={{
            left: "var(--sidebar-width, 0)",
            width: "calc(100% - var(--sidebar-width, 0))",
            transition: "left 200ms ease-in-out, width 200ms ease-in-out",
          }}
        >
          <div className="mx-10">
            <Card className="shadow-none border-0">
              <CardContent className="flex justify-between items-center p-4 relative">
                <LoadingButton
                  variant="outline"
                  onClick={handlePrevious}
                  isLoading={isProcessing}
                  loadingText="Previous"
                  disabled={isFirstStep || isLoading || isProcessing}
                  size="lg"
                  className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="size-5" />
                  Previous
                </LoadingButton>

                <div className="flex gap-3">
                  {/* Next/Complete button */}
                  {isLastStep ? (
                    <LoadingButton
                      size="lg"
                      onClick={handleComplete}
                      isLoading={isLoading || isProcessing}
                      loadingText="Completing client setup..."
                      className="bg-accent-blue hover:bg-accent-blue/90"
                    >
                      Complete Setup
                      <ChevronRight className="size-5" />
                    </LoadingButton>
                  ) : (
                    <LoadingButton
                      size="lg"
                      onClick={handleNextWithScroll}
                      isLoading={isLoading || isProcessing}
                      loadingText="Saving client data..."
                      variant="default"
                      disabled={!isNextEnabled}
                      className={cn(
                        "bg-accent-blue dark:bg-accent-blue dark:text-white hover:bg-accent-blue/90",
                        !isNextEnabled && "opacity-50 cursor-not-allowed",
                      )}
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
