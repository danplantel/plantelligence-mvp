"use client";

import { NewClientWizard } from "@/components/wizard/new-client-wizard";
import {
  useNewClientWizardStore,
  newClientWizardSteps,
  getCompanyBasicsSubStep,
} from "@/lib/new-client-wizard-store";
import { useEffect, useState, useCallback, useRef } from "react";
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
import { ResumeOrNewPlanDialog } from "@/components/ui/resume-or-new-plan-dialog";

export default function NewClientPage() {
  const { setTitle } = usePageTitleContext();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showSavingDialog, setShowSavingDialog] = useState(false);
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
// ── Resume-or-new-plan dialog state ───────────────────────────────────
const [showResumeDialog, setShowResumeDialog] = useState(false);
const [resumePlanName, setResumePlanName] = useState("");
const [resumeSavedAt, setResumeSavedAt] = useState("");


  const handleDiscardLeaveCreatePlan = useCallback(async () => {
    const draftClientId = useNewClientWizardStore.getState().draftClientId;

    if (draftClientId) {
      // Always attempt to delete — the previous GET pre-check + status === "draft"
      // gate could skip deletion when autosave races with the discard flow.
      const res = await fetch(`/api/clients/${draftClientId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        console.error("Failed to delete draft client:", data.error || res.statusText);
      } else if (res.ok) {
        toast.success("Draft plan deleted");
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

  // ── Initialization ─────────────────────────────────────────────────────
  // On mount, detect any in-progress draft (server-side via sessionStorage or
  // client-side via Zustand persist rehydration).  If found, load its metadata
  // and show the resume-or-new-plan dialog instead of auto-resuming.
  useEffect(() => {
    let cancelled = false;

    const initializeWizard = async () => {
      setIsInitialLoading(true);
      try {
        const pendingDraftId =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("plantelligence:selectedDraftId")
            : null;

        let hasExistingData = false;
        let planName = "";

        if (pendingDraftId) {
          // Load draft data so the dialog can show the company name.
          await loadDraftById(pendingDraftId);
          if (cancelled) return;

          planName =
            useNewClientWizardStore.getState().stepData.companyBasics
              ?.companyName || "";

          // Try to fetch the server-side saved-at timestamp.
          let savedAt = "";
          try {
            const draftRes = await fetch(`/api/clients/${pendingDraftId}`);
            const draftJson = await draftRes.json();
            const draftClient = draftJson?.data || draftJson;
            const updatedAt: string | undefined = draftClient?.updatedAt;
            if (updatedAt) {
              savedAt = formatSavedAt(updatedAt);
            }
          } catch {
            // Fall through — we'll try localStorage below.
          }

          // If the API call didn't yield a timestamp, try the companion localStorage key
          // written by createSafeStorage.setItem on the previous page load.
          if (!savedAt) {
            savedAt = readLocalStorageSavedAt();
          }

          setResumePlanName(planName);
          setResumeSavedAt(savedAt);
          setShowResumeDialog(true);
          hasExistingData = true;

          // Keep isInitialLoading = true — the dialog callbacks will finalise.
          return;
        }

        // No pending draft — check localStorage via persist rehydration.
        await useNewClientWizardStore.persist.rehydrate();
        if (cancelled) return;

        const sd = useNewClientWizardStore.getState().stepData;
        hasExistingData =
          !!sd.companyBasics?.companyName ||
          !!sd.companyBasics?.planType?.trim() ||
          (!!sd.welcomeStatement?.headline &&
            sd.welcomeStatement.headline !==
              "Welcome to the <Company Name> Benefits Hub!") ||
          !!(sd.keyContacts?.contacts && sd.keyContacts.contacts.length > 0);

        if (hasExistingData) {
          planName = sd.companyBasics?.companyName || "";
          const savedAt = readLocalStorageSavedAt();

          setResumePlanName(planName);
          setResumeSavedAt(savedAt);
          setShowResumeDialog(true);

          // Keep isInitialLoading = true — the dialog callbacks will finalise.
          return;
        }

        // No existing data at all — start a fresh session immediately.
        resetWizard();
        await createNewSession();
        await seedAdvisorDefaultsFromProfile();

        if (cancelled) return;
        setIsInitialLoading(false);
      } catch (error) {
        console.error("Failed to initialize wizard:", error);
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

  // ── Resume-dialog callbacks ────────────────────────────────────────────
  // These are called AFTER the dialog state is set, so the store already has
  // the loaded draft data (for pendingDraftId) or rehydrated localStorage data.

  const handleResumeContinue = useCallback(async () => {
    setShowResumeDialog(false);

    // Consume the pending draft selection so it won't re-fire on next load.
    try {
      const pendingDraftId = sessionStorage.getItem(
        "plantelligence:selectedDraftId",
      );
      if (pendingDraftId) {
        const { consumePendingDraftSelection } = await import(
          "@/lib/draft-utils"
        );
        consumePendingDraftSelection();
      }
    } catch {
      /* ignore */
    }

    // Re-seed advisor defaults for any empty fields (safe — only fills empty).
    await seedAdvisorDefaultsFromProfile();

    // Navigate to the correct step based on URL param or the saved currentStep.
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    const rawStep = params.get("step");
    const parsed = rawStep ? parseInt(rawStep, 10) : NaN;
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 5) {
      goToStep(parsed);
      await updateCurrentStep(parsed);
    } else {
      // Use the step the user was last on (restored by loadDraftById or persist rehydration)
      // instead of recalculating from data completeness, so the user returns to
      // their most recent position in the wizard.
      const savedStep = useNewClientWizardStore.getState().currentStep;
      goToStep(savedStep);
      await updateCurrentStep(savedStep);
    }

    setIsInitialLoading(false);
  }, [seedAdvisorDefaultsFromProfile, goToStep, updateCurrentStep]);

  const handleResumeNewPlan = useCallback(async () => {
    setShowResumeDialog(false);

    // Reset local state and start a fresh session.
    // The existing draft on the server is preserved so it remains visible
    // in View Plans if the user wants to come back to it later.
    resetWizard();
    await createNewSession();
    await seedAdvisorDefaultsFromProfile();

    try {
      sessionStorage.removeItem("plantelligence:selectedDraftId");
    } catch {
      /* ignore */
    }

    setIsInitialLoading(false);
  }, [resetWizard, createNewSession, seedAdvisorDefaultsFromProfile]);

  // ── Stale-draft guard (non-blocking) ────────────────────────────────────
  // After initialization finishes, verify that any draftClientId still
  // references a live server-side draft.  If the draft was deleted from
  // /new/clients (View Plans) while this page was loaded in another tab,
  // or if the persist middleware re-wrote old state before the delete
  // handler's resetWizard() could clear it, force a clean start.
  // This runs OUTSIDE the initialization path so it never blocks
  // isInitialLoading → autosave.
  useEffect(() => {
    if (isInitialLoading) return;

    const state = useNewClientWizardStore.getState();
    const draftId = state.draftClientId;
    if (!draftId) return;

    let cancelled = false;

    (async () => {
      try {
        const checkRes = await fetch(`/api/clients/${draftId}`);
        if (cancelled) return;
        if (!checkRes.ok) {
          // Draft no longer exists — silently reset to a clean session
          const { resetWizard, createNewSession, seedAdvisorDefaultsFromProfile } =
            useNewClientWizardStore.getState();
          resetWizard();
          await createNewSession();
          await seedAdvisorDefaultsFromProfile();
        }
      } catch {
        // Network error — preserve data (don't wipe real work)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isInitialLoading]);

  // ── Debounced server-side autosave ──────────────────────────────────────
  // When the user has entered a company name (the minimum data for a draft),
  // automatically create/update a client record with status "Draft" so it
  // appears in the /new/clients (View Plans) list.  This runs independently
  // of the per-input localStorage autosave in the step components.
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutosavingRef = useRef(false);

  useEffect(() => {
    // Do not autosave while the wizard is still initialising — the store may
    // be in a transient state (resetWizard / createNewSession / seedDefaults).
    if (isInitialLoading) return;

    const companyName = stepData.companyBasics?.companyName?.trim();
    const planType = stepData.companyBasics?.planType?.trim();

    // Skip if no company name or plan type yet (nothing meaningful to save as a draft)
    if (!companyName && !planType) return;

    // Skip if already saving to avoid stacking requests
    if (isAutosavingRef.current) return;

    // Clear any pending autosave timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Debounce 3 seconds after the last data change
    autosaveTimerRef.current = setTimeout(async () => {
      if (isAutosavingRef.current) return;
      isAutosavingRef.current = true;

      try {
        const state = useNewClientWizardStore.getState();

        // Double-check there's still meaningful data (may have been reset during debounce)
        if (
          !state.stepData.companyBasics?.companyName?.trim() &&
          !state.stepData.companyBasics?.planType?.trim()
        ) {
          return;
        }

        const response = await fetch("/api/new-client-wizard/save-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepData: state.stepData,
            currentStep: state.currentStep,
            clientId: state.draftClientId || undefined,
          }),
        });

        const result = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          clientId?: string;
          error?: string;
          code?: string;
        };

        if (result.success && result.clientId) {
          // Store the clientId so subsequent autosaves update the same record
          const currentDraftId = useNewClientWizardStore.getState().draftClientId;
          if (!currentDraftId || currentDraftId !== result.clientId) {
            useNewClientWizardStore.setState({ draftClientId: result.clientId });
          }
        } else if (result.code === "DUPLICATE_PLAN_NAME") {
          // Duplicate name is expected when autosaving — the user will resolve
          // via the explicit "Save as Draft" button dialog. Silently ignore.
        } else if (result.error) {
          console.warn("[Autosave] Failed to save draft:", result.error);
        }
      } catch (error) {
        console.warn("[Autosave] Error saving draft:", error);
      } finally {
        isAutosavingRef.current = false;
      }
    }, 3000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [stepData, isInitialLoading]);

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
    setShowSavingDialog(true);
    try {
      completeStep(currentStep);
      await completeWizard();
      // completeWizard() handles navigation on success via window.location.href.
      // If we reach here, the API returned success:false — the store threw an
      // error which was caught below.
    } catch (error: any) {
      setShowSavingDialog(false);
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
      step5SubStep === "step5d" ||
      step5SubStep === "disclaimers");

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

  return (
    <>
      {/* Always-mounted dialog — renders even over the loading spinner */}
      <ResumeOrNewPlanDialog
        open={showResumeDialog}
        planName={resumePlanName}
        savedAt={resumeSavedAt}
        onContinue={handleResumeContinue}
        onCreateNew={handleResumeNewPlan}
      />

      {isInitialLoading ? (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-accent-blue border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium animate-pulse">
              Loading your plan...
            </p>
          </div>
        </div>
      ) : (
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
            isDiscarding={leaveGuard.isDiscarding}
            onStay={leaveGuard.stayAndKeepEditing}
            onSaveAndExit={leaveGuard.saveAndExit}
            onDiscardWithoutSaving={leaveGuard.discardWithoutSaving}
            onDialogOpenChange={leaveGuard.dialogOnOpenChange}
            onDiscardPointerDownCapture={leaveGuard.suppressStayOnNextClose}
          />

          {/* Saving / Completing Plan Loading Dialog */}
          {showSavingDialog && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-8 flex flex-col items-center space-y-5">
                <div className="w-14 h-14 border-[5px] border-accent-blue border-t-transparent rounded-full animate-spin" />
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Saving Your Plan
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we publish your client portal...
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Parse an ISO timestamp into a human-readable "saved at" string. */
function formatSavedAt(iso: string): string {
  try {
    const savedAt = new Date(iso);
    return savedAt.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Read the companion localStorage timestamp written by createSafeStorage.setItem. */
function readLocalStorageSavedAt(): string {
  try {
    const raw = localStorage.getItem("new-client-wizard-saved-at");
    if (raw) {
      const ts = Number(raw);
      if (!Number.isNaN(ts) && ts > 0) {
        const savedAt = new Date(ts);
        return savedAt.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}
