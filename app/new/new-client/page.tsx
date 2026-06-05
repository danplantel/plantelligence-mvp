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
      // Always attempt to delete — the previous GET pre-check + status === "draft"
      // gate could skip deletion when autosave races with the discard flow.
      const res = await fetch(`/api/clients/${draftClientId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        console.error("Failed to delete draft client:", data.error || res.statusText);
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

  // Guard to ensure the "Resuming" toast appears only once per page load,
  // even if the initialization effect re-fires due to Strict Mode or
  // dependency reference shifts.
  const resumeToastGuardRef = useRef(false);

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
        let hasExistingData = false;

        if (pendingDraftId) {
          await loadDraftById(pendingDraftId);
          const { consumePendingDraftSelection } = await import("@/lib/draft-utils");
          consumePendingDraftSelection();
          resumedFromDraft = true;

          // Show a toast indicating the user is resuming a server-side draft.
          // Prefer the client record's updatedAt from the API; fall back to the
          // companion localStorage timestamp written by createSafeStorage.setItem.
          const planName =
            useNewClientWizardStore.getState().stepData.companyBasics
              ?.companyName || "Plan";
          let toastShown = false;
          try {
            const draftRes = await fetch(`/api/clients/${pendingDraftId}`);
            const draftJson = await draftRes.json();
            const draftClient = draftJson?.data || draftJson;
            const updatedAt: string | undefined = draftClient?.updatedAt;
            if (updatedAt) {
              const savedAt = new Date(updatedAt);
              const formatted = savedAt.toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
              if (!resumeToastGuardRef.current) {
                toast.info(`Resuming "${planName}" draft saved ${formatted}`, {
                  duration: 5000,
                });
                resumeToastGuardRef.current = true;
              }
              toastShown = true;
            }
          } catch {
            // API fetch failed — fall through to localStorage timestamp below
          }

          if (!toastShown) {
            try {
              const raw = localStorage.getItem("new-client-wizard-saved-at");
              if (raw) {
                const ts = Number(raw);
                if (!Number.isNaN(ts) && ts > 0) {
                  const savedAt = new Date(ts);
                  const formatted = savedAt.toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  if (!resumeToastGuardRef.current) {
                    toast.info(`Resuming "${planName}" draft saved ${formatted}`, {
                      duration: 5000,
                    });
                    resumeToastGuardRef.current = true;
                  }
                }
              }
            } catch {
              // Ignore — the toast is non-critical
            }
          }
        } else {
          // Wait for Zustand persist middleware to rehydrate from localStorage
          // before checking for existing data, otherwise stepData is always {}
          // and resetWizard() wipes all previously saved data on page reload.
          await useNewClientWizardStore.persist.rehydrate();

          const sd = useNewClientWizardStore.getState().stepData;
          hasExistingData =
            !!sd.companyBasics?.companyName ||
            !!sd.companyBasics?.planType?.trim() ||
            (!!sd.welcomeStatement?.headline &&
              sd.welcomeStatement.headline !==
                "Welcome to the <Company Name> Benefits Hub!") ||
            !!(sd.keyContacts?.contacts && sd.keyContacts.contacts.length > 0);

          if (!hasExistingData) {
            resetWizard();
            await createNewSession();
            await seedAdvisorDefaultsFromProfile();
          } else {
            // Seed advisor defaults for any empty fields (e.g. companyWebsite,
            // colors, advisor name). This is safe because mergeAdvisorProfileIntoWizardStepData
            // only fills fields that are empty/falsy — it never overwrites user data.
            await seedAdvisorDefaultsFromProfile();

            // Show a toast indicating the user is resuming a draft.
            // Zustand v4 stores { state, version } — there is no _persist.time
            // like v5, so we read the companion timestamp written by
            // createSafeStorage.setItem.
            const planName =
              useNewClientWizardStore.getState().stepData.companyBasics
                ?.companyName || "Plan";
            try {
              const raw = localStorage.getItem("new-client-wizard-saved-at");
              if (raw) {
                const ts = Number(raw);
                if (!Number.isNaN(ts) && ts > 0) {
                  const savedAt = new Date(ts);
                  const formatted = savedAt.toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  if (!resumeToastGuardRef.current) {
                    toast.info(`Resuming "${planName}" draft saved ${formatted}`, {
                      duration: 5000,
                    });
                    resumeToastGuardRef.current = true;
                  }
                }
              }
            } catch {
              // Ignore parse errors — the toast is non-critical
            }
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
        } else if (!resumedFromDraft && !hasExistingData) {
          // Resuming a draft already set currentStep from the client record; do not jump to
          // "first incomplete" or the user loses their last-saved step (e.g. Finish Setup).
          // Also skip when resuming with existing localStorage data — the user's persisted
          // currentStep should be honored. Otherwise seedAdvisorDefaultsFromProfile may have
          // pre-filled fields (e.g. companyWebsite) making the current step appear complete
          // and auto-advancing the user before they've finished.
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
        isDiscarding={leaveGuard.isDiscarding}
        onStay={leaveGuard.stayAndKeepEditing}
        onSaveAndExit={leaveGuard.saveAndExit}
        onDiscardWithoutSaving={leaveGuard.discardWithoutSaving}
        onDialogOpenChange={leaveGuard.dialogOnOpenChange}
        onDiscardPointerDownCapture={leaveGuard.suppressStayOnNextClose}
      />
    </>
  );
}
