"use client";

import { NewClientWizard } from "@/components/wizard/new-client-wizard";
import {
  useNewClientWizardStore,
  newClientWizardSteps,
  getCompanyBasicsSubStep,
  isWizardTransitionActive,
  enqueueDraftSave,
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
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getBenefitsHubOpenPortalUrl } from "@/lib/marketing/hub-url";
import { consumePendingDraftSelection } from "@/lib/draft-utils";
import { isDuplicatePlanNameError } from "@/lib/duplicate-plan-name-error";
import {
  clearWizardBrowserState,
  formatSavedAt,
  hasMeaningfulLocalWork,
  lookupDraft,
  peekPendingDraftId,
  readLocalSavedAt,
  rememberWizardOwner,
  wizardBlobBelongsTo,
} from "@/lib/new-client-wizard-resume";

export default function NewClientPage() {
  const router = useRouter();
  const { setTitle } = usePageTitleContext();
  // The signed-in user, needed to attribute the browser-side wizard snapshot to its owner.
  const { data: session, status: sessionStatus } = useSession();
  const sessionUserId = session?.user?.id ?? null;
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showSavingDialog, setShowSavingDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successPortalUrl, setSuccessPortalUrl] = useState("");
  // The just-created plan/client id, captured when the wizard completes so the
  // success actions (e.g. "Create Benefit") can deep-link even if the store is
  // reset/cleared after completion.
  const [successPlanId, setSuccessPlanId] = useState("");
  // "Save Draft" in the wizard footer (does not advance a step).
  const [isSavingDraft, setIsSavingDraft] = useState(false);
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

  // ── "Save Draft" (wizard footer) ────────────────────────────────────────
  // Persists the current state as a Draft Client row without advancing a step. The
  // page owns the toast and the button's busy state; the store owns the write, the
  // serializer, and the duplicate-name conflict dialog.
  const canSaveDraft = Boolean(
    stepData.companyBasics?.companyName?.trim() ||
      stepData.companyBasics?.planType?.trim(),
  );

  const handleSaveDraft = useCallback(async () => {
    const state = useNewClientWizardStore.getState();
    const companyName = state.stepData.companyBasics?.companyName?.trim();
    const planType = state.stepData.companyBasics?.planType?.trim();
    if (!companyName && !planType) {
      toast.error("Add a company name to save a draft");
      return;
    }

    setIsSavingDraft(true);
    try {
      await saveAsDraft({ showDuplicatePlanDialog: true });
      toast.success("Draft saved", {
        description: "Your draft is listed under All Plans.",
      });
      // Save-and-return: the draft now exists as a Client row, so take the advisor back to
      // the All Plans list (View Plans), where they can resume it or start another plan.
      // The toast is fired first and survives the client-side navigation — sonner's Toaster
      // lives in the root layout, so it is still on screen once /clients renders.
      router.push("/clients");
    } catch (error) {
      // A duplicate name opens the wizard's own DuplicatePlanNameDialog (driven by the
      // store's `duplicatePlanNameConflict`), so it needs no toast of its own.
      if (!isDuplicatePlanNameError(error)) {
        toast.error("Could not save draft", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    } finally {
      setIsSavingDraft(false);
    }
  }, [saveAsDraft]);
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
  // Whether to offer resuming a draft is decided by the SERVER, never by browser storage.
  // See lib/new-client-wizard-resume.ts for the reasoning; the short version is that a draft
  // is a row, and a browser snapshot is only a cache of typing.
  //
  // Two browser-side candidates are considered, and BOTH are verified against
  // `/api/clients/:id` before anything is shown:
  //
  //   1. a hand-off pointer from View Plans (sessionStorage), and
  //   2. the rehydrated snapshot's own `draftClientId`.
  //
  // Consequences worth knowing:
  //   - An empty database can no longer produce a resume prompt: the snapshot may remember a
  //     draft id, but the verification below finds no row and clears it.
  //   - Local typing with no server draft is NOT a plan, so it no longer raises the dialog.
  //   - Local state is discarded only when the server says the draft is gone — never on a
  //     network error, which would throw away real work.
  useEffect(() => {
    // Ownership cannot be judged without a user id, and evaluating the gate with an unknown
    // id would clear every snapshot on every load. Wait for the session to resolve.
    if (sessionStatus === "loading") return;

    let cancelled = false;

    /** Reset local state and open a fresh server session. */
    const startFresh = async (): Promise<void> => {
      resetWizard();
      await createNewSession();
      // Seeding advisor defaults reads the (slow) /api/profile. Don't hold the
      // "Loading Your Plan" spinner for it — render now and let the defaults fill in.
      void seedAdvisorDefaultsFromProfile();
    };

    const initializeWizard = async () => {
      setIsInitialLoading(true);
      try {
        // ── Ownership gate ──
        // The snapshot is keyed by browser, not by user, so establish whose work it is
        // BEFORE rehydrating it. An unattributable or foreign snapshot is discarded rather
        // than adopted — adopting one is how a second advisor on the same machine inherits
        // the first advisor's company name, contacts and images.
        if (!wizardBlobBelongsTo(sessionUserId)) {
          clearWizardBrowserState();
        }
        rememberWizardOwner(sessionUserId);

        // ── 1. Hand-off pointer from View Plans ──
        const pendingDraftId = peekPendingDraftId();
        if (pendingDraftId) {
          const lookup = await lookupDraft(pendingDraftId);
          if (cancelled) return;

          if (lookup === "missing") {
            // The pointer outlived the plan — deleted in View Plans, or this browser was
            // pointed at a fresh database. Drop it instead of offering a phantom resume.
            consumePendingDraftSelection();
            clearWizardBrowserState();
            await startFresh();
            if (cancelled) return;
            setIsInitialLoading(false);
            return;
          }

          if (lookup === "exists") {
            await loadDraftById(pendingDraftId);
            if (cancelled) return;

            const planName =
              useNewClientWizardStore.getState().stepData.companyBasics?.companyName || "";
            setResumePlanName(planName);
            setResumeSavedAt(await fetchDraftSavedAt(pendingDraftId));
            setShowResumeDialog(true);
            // isInitialLoading stays true — a dialog callback finalises.
            return;
          }
          // "unknown" — cannot tell if it exists. Fall through to the snapshot check rather
          // than guessing, and never delete the pointer on an inconclusive answer.
        }

        // ── 2. The rehydrated snapshot ──
        await useNewClientWizardStore.persist.rehydrate();
        if (cancelled) return;

        const state = useNewClientWizardStore.getState();
        const localDraftId = state.draftClientId;

        if (localDraftId) {
          const lookup = await lookupDraft(localDraftId);
          if (cancelled) return;

          if (lookup === "missing") {
            // THE case that produced a resume prompt on a fresh database: the snapshot
            // remembered a draft id, but no such row exists.
            clearWizardBrowserState();
            await startFresh();
            if (cancelled) return;
            setIsInitialLoading(false);
            return;
          }

          if (lookup === "exists") {
            setResumePlanName(state.stepData.companyBasics?.companyName || "");
            setResumeSavedAt(readLocalSavedAt());
            setShowResumeDialog(true);
            return;
          }
          // "unknown" — keep the snapshot and continue without prompting.
        }

        // ── 3. No server draft ──
        // The snapshot may still hold unsaved typing (the user typed a company name but the
        // 3s autosave had not fired). That is not a plan, so no dialog — and it must not be
        // wiped, because the server never saw it. Autosave creates the draft lazily on the
        // next edit, which is exactly what the store's missing-session path already handles.
        if (hasMeaningfulLocalWork(state.stepData)) {
          setIsInitialLoading(false);
          return;
        }

        await startFresh();
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
    sessionStatus,
    sessionUserId,
    createNewSession,
    resetWizard,
    loadDraftById,
    seedAdvisorDefaultsFromProfile,
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
    // Fire-and-forget so it never gates the wizard loading UI on /api/profile.
    void seedAdvisorDefaultsFromProfile();

    // Ensure the store knows which draft Client row it's editing. When resuming
    // via localStorage rehydration the persisted snapshot can lack draftClientId
    // (e.g. the Client row was created by autosave after the last persist), which
    // makes saveAsDraft treat this draft as a brand-new plan and wrongly show the
    // "Plan name already in use" dialog for the user's own draft. Resolve the id
    // from the server by company name when missing.
    const resumeState = useNewClientWizardStore.getState();
    if (!resumeState.draftClientId) {
      const companyName = resumeState.stepData.companyBasics?.companyName?.trim();
      if (companyName) {
        try {
          const clientsRes = await fetch(
            `/api/clients?status=Draft&search=${encodeURIComponent(
              companyName,
            )}&limit=10`,
          );
          if (clientsRes.ok) {
            const clientsJson = await clientsRes.json();
            const clientsList: any[] = clientsJson?.data || [];
            const nameLower = companyName.toLowerCase();
            const match = clientsList.find(
              (c: any) =>
                String(c?.companyName || "").trim().toLowerCase() === nameLower,
            );
            if (match?.id) {
              useNewClientWizardStore.setState({ draftClientId: match.id });
            }
          }
        } catch {
          // Non-blocking — save-draft's same-name draft fallback will still work.
        }
      }
    }

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
    // Non-blocking advisor-default seeding (does not gate the loading UI).
    void seedAdvisorDefaultsFromProfile();

    try {
      sessionStorage.removeItem("plantelligence:selectedDraftId");
    } catch {
      /* ignore */
    }

    setIsInitialLoading(false);
  }, [resetWizard, createNewSession, seedAdvisorDefaultsFromProfile]);

  // ── Stale-draft guard (non-blocking) ────────────────────────────────────
  // Initialization verifies the draft once; this re-checks after it finishes, because the
  // draft can disappear while the page is open — deleted from View Plans in another tab, or
  // cleared by another session. It stays outside the initialization path so it never holds
  // isInitialLoading, and therefore never delays autosave.
  //
  // Only an explicit "the server says it is gone" clears local state. The previous version
  // reset on ANY non-OK response, so a 500 or a 401 threw away the user's work — `lookupDraft`
  // separates "missing" from "could not tell".
  useEffect(() => {
    if (isInitialLoading) return;

    const draftId = useNewClientWizardStore.getState().draftClientId;
    if (!draftId) return;

    let cancelled = false;

    (async () => {
      const lookup = await lookupDraft(draftId);
      if (cancelled || lookup !== "missing") return;

      // The draft is gone: drop local state so the wizard cannot be completed against a row
      // that no longer exists.
      const { resetWizard, createNewSession, seedAdvisorDefaultsFromProfile } =
        useNewClientWizardStore.getState();
      clearWizardBrowserState();
      resetWizard();
      await createNewSession();
      await seedAdvisorDefaultsFromProfile();
    })();

    return () => {
      cancelled = true;
    };
  }, [isInitialLoading]);

  // ── Debounced server-side autosave ──────────────────────────────────────
  // When the user has entered a company name (the minimum data for a draft),
  // automatically create/update a client record with status "Draft" so it
  // appears in the /clients (View Plans) list.  This runs independently
  // of the per-input localStorage autosave in the step components.
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutosavingRef = useRef(false);
  // On a reload/resume the draft is re-hydrated into the store, which flips the
  // autosave effect's deps without any user edit — without a guard that would
  // fire a redundant /save-draft ~3s after loading. Snapshot the loaded state
  // once init finishes and skip autosave until the data actually differs.
  const autosaveBaselineRef = useRef<string | null>(null);
  const autosaveArmedRef = useRef(false);

  // Capture the baseline the moment initialization finishes (before the user can
  // type). Only a resumed draft (already has meaningful data) gets a baseline; a
  // fresh plan is empty here, so autosave keeps its normal behavior and arms on
  // the user's first input.
  useEffect(() => {
    if (isInitialLoading || autosaveBaselineRef.current !== null) return;
    const sd = useNewClientWizardStore.getState().stepData;
    const hasResumedDraft =
      !!sd.companyBasics?.companyName?.trim() ||
      !!sd.companyBasics?.planType?.trim() ||
      !!(sd.keyContacts?.contacts && sd.keyContacts.contacts.length > 0);
    if (hasResumedDraft) {
      autosaveBaselineRef.current = JSON.stringify(sd);
    }
  }, [isInitialLoading]);

  useEffect(() => {
    // Do not autosave while the wizard is still initialising — the store may
    // be in a transient state (resetWizard / createNewSession / seedDefaults) —
    // or while it is processing a Next/Complete transition, which already
    // persists the draft explicitly (an autosave would stack a duplicate,
    // slow save-draft POST on top of the transition save).
    if (isInitialLoading || isWizardTransitionActive()) return;

    const companyName = stepData.companyBasics?.companyName?.trim();
    const planType = stepData.companyBasics?.planType?.trim();

    // Skip if no company name or plan type yet (nothing meaningful to save as a draft)
    if (!companyName && !planType) return;

    // Skip the redundant autosave that would fire right after reloading a draft:
    // hydration re-populated stepData, but nothing has actually changed yet. Once
    // the data differs from the loaded snapshot (a real edit, or a seed that
    // filled empty fields), autosave arms and behaves normally from then on.
    if (autosaveBaselineRef.current !== null && !autosaveArmedRef.current) {
      if (JSON.stringify(stepData) === autosaveBaselineRef.current) {
        return;
      }
      autosaveArmedRef.current = true;
    }

    // Skip if already saving to avoid stacking requests
    if (isAutosavingRef.current) return;

    // Clear any pending autosave timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Debounce 3 seconds after the last data change
    autosaveTimerRef.current = setTimeout(async () => {
      if (isAutosavingRef.current || isWizardTransitionActive()) return;
      isAutosavingRef.current = true;

      try {
        // Enqueue through the shared serializer so the autosave never overlaps an
        // explicit save-draft (Next/Complete) — concurrent writes to the same
        // wizard-session records raise a MongoDB write-conflict 500. Reading the
        // store inside the queue ensures the freshest state is sent.
        await enqueueDraftSave(async () => {
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
            const currentDraftId =
              useNewClientWizardStore.getState().draftClientId;
            if (!currentDraftId || currentDraftId !== result.clientId) {
              useNewClientWizardStore.setState({ draftClientId: result.clientId });
            }
          } else if (result.code === "DUPLICATE_PLAN_NAME") {
            // Duplicate name is expected when autosaving — the user will resolve
            // via the explicit "Save as Draft" button dialog. Silently ignore.
          } else if (result.error) {
            console.warn("[Autosave] Failed to save draft:", result.error);
          }
        });
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

      // Capture the created plan/client id now (before any store reset) so the
      // "Create Benefit" action can deep-link /benefits with the plan selected.
      const createdPlanId = useNewClientWizardStore.getState().draftClientId;
      if (createdPlanId) {
        setSuccessPlanId(createdPlanId);
      }

      // completeWizard() stored the portal URL on the store. Show a dialog
      // so the user can choose to view the portal or go to View Plans.
      setShowSavingDialog(false);
      const portalUrl = useNewClientWizardStore.getState().completedPortalUrl;
      if (portalUrl) {
        setSuccessPortalUrl(portalUrl);
        setShowSuccessDialog(true);
      }
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
        return (
          <NewClientStep1 errorFields={errorFields} />
        );
      case 2:
        return <NewClientStep2 errorFields={errorFields} />;
      case 3:
        return <NewClientStep3 errorFields={errorFields} />;
      case 4:
        return <NewClientStep4 errorFields={errorFields} />;
      case 5:
        return <NewClientStep5 errorFields={errorFields} />;
      default:
        return (
          <NewClientStep1 errorFields={errorFields} />
        );
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
            onSaveDraft={() => void handleSaveDraft()}
            isSavingDraft={isSavingDraft}
            canSaveDraft={canSaveDraft}
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

          {/* Plan Created — Success Dialog */}
          {showSuccessDialog && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-8 flex flex-col items-center space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Plan Created Successfully!
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your client portal is ready. What would you like to do?
                  </p>
                </div>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      const resolvedUrl = successPortalUrl.startsWith("/")
                        ? getBenefitsHubOpenPortalUrl(
                            successPortalUrl.replace(/^\//, ""),
                          )
                        : successPortalUrl;
                      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
                      setShowSuccessDialog(false);
                      // window.location.href = "/clients";
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-accent-blue text-white font-semibold hover:bg-accent-blue/90 transition-colors"
                  >
                    View Portal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Jump straight into the Create Benefit wizard with this
                      // plan already preselected so the advisor can create a
                      // benefit.
                      const planId =
                        successPlanId ||
                        useNewClientWizardStore.getState().draftClientId;
                      setShowSuccessDialog(false);
                      router.push(
                        planId
                          ? `/new-benefits?planId=${encodeURIComponent(planId)}`
                          : "/new-benefits",
                      );
                    }}
                    className="w-full py-3 px-4 rounded-xl border border-accent-blue text-accent-blue font-semibold hover:bg-accent-blue/10 transition-colors"
                  >
                    Create Benefit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuccessDialog(false);
                      router.push("/clients");
                    }}
                    className="w-full py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Go to View Plans
                  </button>
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

/**
 * The server's own "last saved" timestamp for a draft, for the resume dialog.
 *
 * Falls back to the browser's companion timestamp when the request fails, so a dialog already
 * known to be about a real plan still shows something useful rather than nothing.
 */
async function fetchDraftSavedAt(draftId: string): Promise<string> {
  try {
    const response = await fetch(`/api/clients/${encodeURIComponent(draftId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return readLocalSavedAt();
    const json = (await response.json()) as {
      data?: { updatedAt?: string };
      updatedAt?: string;
    };
    const updatedAt = json?.data?.updatedAt ?? json?.updatedAt;
    return updatedAt ? formatSavedAt(updatedAt) : readLocalSavedAt();
  } catch {
    return readLocalSavedAt();
  }
}
