"use client";

import { NewClientWizard } from "@/components/wizard/new-client-wizard";
import {
  useNewClientWizardStore,
  newClientWizardSteps,
  getCompanyBasicsSubStep,
} from "@/lib/new-client-wizard-store";
import { useEffect, useState, useCallback } from "react";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { toast } from "sonner";
import {
  NewClientStep1,
  NewClientStep2,
  NewClientStep3,
  NewClientStep4,
  NewClientStep5,
} from "@/components/wizard/new-client-steps";
import { hasUnsavedWizardWork } from "@/lib/new-client-wizard-dirty";
import { useNavigateAwayGuard } from "@/hooks/use-navigate-away-guard";
import { NavigateAwayWarningDialog } from "@/components/ui/navigate-away-warning-dialog";

export default function NewClientPage() {
  const { setTitle } = usePageTitleContext();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const {
    currentStep,
    totalSteps,
    steps,
    stepData,
    nextStep,
    previousStep,
    completeStep,
    completeWizard,
    loadAllWizardData,
    loadDraftById,
    createNewSession,
    seedAdvisorDefaultsFromProfile,
    syncCurrentStepToFirstIncomplete,
    resetWizard,
    saveAsDraft,
    goToStep,
    updateCurrentStep,
    errorFields,
  } = useNewClientWizardStore();

  const handleDiscardLeaveCreatePlan = useCallback(async () => {
    const draftClientId = useNewClientWizardStore.getState().draftClientId;
    if (draftClientId) {
      const getRes = await fetch(`/api/clients/${draftClientId}`);
      const getJson = (await getRes.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { status?: string };
      };
      const clientData = getJson?.data;
      const status = (clientData?.status ?? "").toString().toLowerCase();
      if (status === "draft") {
        const res = await fetch(`/api/clients/${draftClientId}`, {
          method: "DELETE",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok && res.status !== 404) {
          throw new Error(data.error || "Failed to delete the draft plan");
        }
      }
    }
    resetWizard();
    await createNewSession();
    await seedAdvisorDefaultsFromProfile();
    try {
      sessionStorage.removeItem("plantelligence:selectedDraftId");
    } catch {
      /* ignore */
    }
  }, [resetWizard, createNewSession, seedAdvisorDefaultsFromProfile]);

  useEffect(() => {
    setTitle("Create Plan");
  }, [setTitle]);

  useEffect(() => {
    let cancelled = false;

    const initializeWizard = async () => {
      setIsInitialLoading(true);
      try {
        const pendingDraftId =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("plantelligence:selectedDraftId")
            : null;

        let resumedFromDraft = false;

        if (pendingDraftId) {
          await loadDraftById(pendingDraftId);
          const { consumePendingDraftSelection } = await import("@/lib/draft-utils");
          consumePendingDraftSelection();
          resumedFromDraft = true;
        } else {
          const sd = useNewClientWizardStore.getState().stepData;
          const hasExistingData =
            !!sd.companyBasics?.companyName ||
            !!sd.welcomeStatement?.headline ||
            !!(sd.keyContacts?.contacts && sd.keyContacts.contacts.length > 0);

          if (!hasExistingData) {
            resetWizard();
            await createNewSession();
            await seedAdvisorDefaultsFromProfile();
          }
        }

        if (cancelled) return;

        const params = new URLSearchParams(
          typeof window !== "undefined" ? window.location.search : "",
        );
        const rawStep = params.get("step");
        const parsed = rawStep ? parseInt(rawStep, 10) : NaN;
        if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 5) {
          goToStep(parsed);
          await updateCurrentStep(parsed);
        } else if (!resumedFromDraft) {
          // Resuming a draft already set currentStep from the client record; do not jump to
          // "first incomplete" or the user loses their last-saved step (e.g. Finish Setup).
          await syncCurrentStepToFirstIncomplete();
        }
      } catch (error) {
        console.error("Failed to initialize wizard:", error);
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }
    };

    initializeWizard();
    return () => {
      cancelled = true;
    };
  }, [
    createNewSession,
    resetWizard,
    loadDraftById,
    seedAdvisorDefaultsFromProfile,
    syncCurrentStepToFirstIncomplete,
    goToStep,
    updateCurrentStep,
  ]);

  const onNext = async () => {
    // Complete the current step - validation is handled in new-client-wizard.tsx
    completeStep(currentStep);

    // Ensure current step data is saved to server before moving forward
    // This is already handled in nextStep() within new-client-wizard-store.ts
  };

  const onPrevious = () => {
    previousStep();
  };

  const onComplete = async () => {
    setIsLoading(true);
    try {
      completeStep(currentStep);
      await completeWizard();

      const { sessionId } = useNewClientWizardStore.getState();
      window.sessionStorage.setItem("previousPage", window.location.pathname);

      if (sessionId) {
        window.location.href = `/new/view/${sessionId}`;
      } else {
        toast.error("Session ID missing after completion.");
      }
    } catch (error: any) {
      toast.error("Cannot complete wizard:", {
        description: error.message,
        duration: 5000,
        dismissible: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const companyBasicsSubStep = getCompanyBasicsSubStep(stepData);
  const isFirstStep = currentStep === 1 && companyBasicsSubStep === "branding";

  const hasUnsavedChanges = useNewClientWizardStore((s) =>
    hasUnsavedWizardWork({
      isCompleted: s.isCompleted,
      stepData: s.stepData,
      currentStep: s.currentStep,
      draftClientId: s.draftClientId,
    }),
  );
  const leaveGuard = useNavigateAwayGuard({
    enabled: !isInitialLoading && !isLoading,
    hasUnsavedChanges,
    onSaveAndExit: async () => {
      await saveAsDraft({ showDuplicatePlanDialog: false });
    },
    onDiscard: handleDiscardLeaveCreatePlan,
  });

  const step5SubStep = stepData.employeePortalPreview?.step5SubStep || "disclaimers";
  const isLastStep =
    currentStep === totalSteps &&
    (step5SubStep === "benefits-team" ||
      step5SubStep === "step5d");

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <NewClientStep1 errorFields={errorFields} />;
      case 2:
        return <NewClientStep2 errorFields={errorFields} />;
      case 3:
        return <NewClientStep3 errorFields={errorFields} />;
      case 4:
        return <NewClientStep4 errorFields={errorFields} />;
      case 5:
        return <NewClientStep5 errorFields={errorFields} />;
      default:
        return <NewClientStep1 errorFields={errorFields} />;
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-accent-blue border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium animate-pulse">
            Loading your plan...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <NewClientWizard
        steps={newClientWizardSteps}
        currentStep={currentStep}
        totalSteps={totalSteps}
        onNext={onNext}
        onPrevious={onPrevious}
        onComplete={onComplete}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        isLoading={isLoading}
      >
        {renderStep()}
      </NewClientWizard>

      <NavigateAwayWarningDialog
        open={leaveGuard.dialogOpen}
        isSaving={leaveGuard.isSaving}
        onStay={leaveGuard.stayAndKeepEditing}
        onSaveAndExit={leaveGuard.saveAndExit}
        onDiscardWithoutSaving={leaveGuard.discardWithoutSaving}
        onDialogOpenChange={leaveGuard.dialogOnOpenChange}
        onDiscardPointerDownCapture={leaveGuard.suppressStayOnNextClose}
      />
    </>
  );
}
