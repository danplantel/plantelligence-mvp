"use client";

import { BenefitsWizard } from "@/components/wizard/benefits-wizard";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { persistPlanSelection } from "@/lib/plan-selector-storage";
import { fetchProfileOnce } from "@/lib/fetch-profile";
import { useEffect, useRef, useState, Suspense } from "react";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import {
  BenefitsStep1,
  BenefitsStep2,
  BenefitsStep3,
  BenefitsStep4,
  BenefitsStep5,
} from "@/components/wizard/benefits-steps";
import { BenefitsCategory } from "@/types/new-client-wizard";
import { saveBenefit, normalizeCategory } from "@/lib/save-benefit";
import {
  hasUnsavedBenefitsWork,
  serializeBenefitsSnapshot,
} from "@/lib/benefits-wizard-dirty";
import { useNavigateAwayGuard } from "@/hooks/use-navigate-away-guard";
import { NavigateAwayWarningDialog } from "@/components/ui/navigate-away-warning-dialog";
import { PublishingAttestationDialog } from "@/components/wizard/benefits-steps/publishing-attestation-dialog";

/** Serialize the wizard's current state for comparison against the dirty baseline. */
function snapshotBenefitsStore(): string {
  const state = useBenefitsWizardStore.getState();
  return serializeBenefitsSnapshot({
    currentStep: state.currentStep,
    stepData: state.stepData,
  });
}

function NewBenefitsPageInner() {
  const { setTitle, setSubtitle } = usePageTitleContext();
  const [isLoading, setIsLoading] = useState(false);
  // True until the persisted store is rehydrated (or the deep-link state is
  // applied) and a clean baseline has been captured. The leave guard stays
  // disabled during this window so a resume never flashes the warning dialog.
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const benefitsBaselineRef = useRef<string | null>(null);
  // True once the user has interacted with the page. Until then every store write is
  // treated as the app's own pre-fill rather than user work — see the subscription below.
  const userInteractedRef = useRef(false);
  const [, bumpBaselineVersion] = useState(0);
  const [isAttestationOpen, setIsAttestationOpen] = useState(false);
  const searchParams = useSearchParams();
  const planIdParam = searchParams.get("planId");
  const categoryRaw = searchParams.get("category");
  /** Decode + normalize (encodeURIComponent uses %20; + may appear in legacy URLs). */
  const categoryParam = categoryRaw
    ? decodeURIComponent(categoryRaw.replace(/\+/g, " "))
    : null;

  const {
    currentStep,
    totalSteps,
    steps,
    nextStep,
    previousStep,
    completeStep,
    resetWizard,
    saveStepData,
    stepData,
  } = useBenefitsWizardStore();
  // Selected plan's company name (set by Step 1 when a plan is chosen), shown
  // in the page header next to the "Create Benefits" title.
  const selectedPlanName = useBenefitsWizardStore(
    (s) =>
      (s.stepData.step1?.selectedPlan as { companyName?: string } | null)
        ?.companyName ?? "",
  );
  // Benefit category for the selected plan (e.g. "Retirement"), appended to the
  // company name in the header subtitle ("Acme Corp - Retirement").
  const benefitCategoryName = useBenefitsWizardStore(
    (s) => s.stepData.step1?.benefitCategory ?? "",
  );
  const hasUnsavedChanges = useBenefitsWizardStore((s) =>
    hasUnsavedBenefitsWork(
      {
        currentStep: s.currentStep,
        stepData: s.stepData,
      },
      benefitsBaselineRef.current,
    ),
  );
  const leaveGuard = useNavigateAwayGuard({
    enabled: !isInitialLoading && !isLoading,
    hasUnsavedChanges,
    onSaveAndExit: async () => {
      // Benefits wizard uses persisted zustand storage as its draft source.
      // Save-and-exit is satisfied once local persisted state is current.
      return;
    },
  });

  /**
   * Keep the dirty baseline in step with the app's own writes.
   *
   * On entry the wizard fills itself in programmatically: Step 1's pre-fill rebuilds the
   * benefit fields from the API, and the org-logo sync further down writes `companyLogo`
   * and `orgLogoSnapshot`. Both land *after* the initial baseline is captured, so before
   * the user had touched anything the page already compared as dirty and navigating away
   * raised "Leave this setup?".
   *
   * The baseline therefore follows every store update until the user interacts with the
   * page, and freezes on the first pointer or key event. Programmatic pre-fill is
   * absorbed, while anything the user does afterwards still counts as unsaved work.
   */
  useEffect(() => {
    const freezeBaseline = () => {
      userInteractedRef.current = true;
    };
    window.addEventListener("pointerdown", freezeBaseline, true);
    window.addEventListener("keydown", freezeBaseline, true);

    const unsubscribe = useBenefitsWizardStore.subscribe(() => {
      if (userInteractedRef.current) return;
      benefitsBaselineRef.current = snapshotBenefitsStore();
      // `hasUnsavedChanges` reads the baseline through a ref, which is not a reactive
      // dependency, so nudge a re-render to re-evaluate it against the new baseline.
      bumpBaselineVersion((version) => version + 1);
    });

    return () => {
      unsubscribe();
      window.removeEventListener("pointerdown", freezeBaseline, true);
      window.removeEventListener("keydown", freezeBaseline, true);
    };
  }, []);

  useEffect(() => {
    setTitle("Create Benefits");
  }, [setTitle]);

  // Show the selected plan's company name + benefit category in the page header
  // (next to the "Create Benefits" title) instead of inside the plan selection
  // card, e.g. "Loading Company - Retirement".
  useEffect(() => {
    const category =
      benefitCategoryName === "Custom"
        ? "Company / Plan Sponsor"
        : benefitCategoryName.trim();
    setSubtitle(
      selectedPlanName
        ? category
          ? `${selectedPlanName} - ${category}`
          : selectedPlanName
        : "",
    );
  }, [selectedPlanName, benefitCategoryName, setSubtitle]);

  // Scroll to the top whenever the user navigates between steps so each step
  // starts at its beginning (e.g. going back from Step 5 to Step 1).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  /**
   * Portal deep link: `/new-benefits?planId=<clientId>&category=<BenefitsCategory>`
   *
   * A `planId` alone (e.g. the "Create Benefit" action after a plan is created)
   * preselects the plan and leaves the benefit category blank so the advisor
   * picks which benefit to create. When `category` is also present it is
   * preselected too (per-category create links).
   *
   * When deep-link params exist they take priority over any persisted state —
   * re-apply after timeouts so persisted localStorage rehydration cannot
   * overwrite the URL-driven step1 values.
   *
   * When there is NO deep link, rehydrate the persisted store.  Only reset the
   * wizard when the store is truly empty after rehydration (fresh entry from
   * the dashboard), so that Brand Logo / Benefit Description and other fields
   * survive a page refresh.
   */
  useEffect(() => {
    const hasPlanParam = !!planIdParam;

    const applyFromUrl = () => {
      if (!planIdParam) return;
      const step1Data = useBenefitsWizardStore.getState().stepData.step1 || {
        planId: "",
        benefitCategory: "",
        contactId: "",
        benefitTitle: "",
      };
      const next: Record<string, any> = {
        ...step1Data,
        planId: planIdParam,
      };
      if (categoryParam) {
        next.benefitCategory = categoryParam as BenefitsCategory;
        next.benefitTitle = categoryParam === "Custom" ? "" : categoryParam;
      } else {
        // Plan-only deep link: preselect the plan, clear any category so the
        // wizard starts at "pick a benefit category" for this plan.
        next.benefitCategory = "";
        next.benefitTitle = "";
        next.contactId = "";
        next.companyLogo = null;
      }
      saveStepData(1, next);
      // Keep the plan picker in sync so this plan shows as the most recent.
      persistPlanSelection("benefits", planIdParam);
    };

    // Snapshot the store after the initial state is settled (URL-driven or
    // rehydrated). Anything that changes after this point is real user work.
    const captureBaseline = () => {
      benefitsBaselineRef.current = snapshotBenefitsStore();
    };

    if (hasPlanParam) {
      applyFromUrl();
      captureBaseline();
      setIsInitialLoading(false);
      const t0 = setTimeout(applyFromUrl, 0);
      const t1 = setTimeout(applyFromUrl, 50);
      const t2 = setTimeout(applyFromUrl, 200);
      return () => {
        clearTimeout(t0);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    // No deep link — rehydrate persisted state and only reset if truly empty
    let cancelled = false;
    const init = async () => {
      await useBenefitsWizardStore.persist.rehydrate();
      if (cancelled) return;
      const sd = useBenefitsWizardStore.getState().stepData;
      if (!sd.step1?.planId && !sd.step1?.benefitCategory) {
        resetWizard();
      }
      captureBaseline();
      setIsInitialLoading(false);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [planIdParam, categoryParam, saveStepData, resetWizard]);

  /**
   * ── Propagate a changed Organization Logo into this benefit ──
   *
   * Settings → Branding changes `User.advisorLogoUrl`, but the Benefit Logo (Step 1)
   * and Provider Logo (Step 2) both read `step1.companyLogo` from a draft hydrated out
   * of localStorage — and the pre-fill prefers the Benefit row's `partnerLogo`, which
   * normally holds the PREVIOUS org logo because this page's auto-save writes it back.
   * Without this the new org logo only appeared after re-saving the benefit by hand.
   *
   * Deliberately page-level rather than only in Step 1's pre-fill: the wizard resumes on
   * whatever step was persisted, so landing directly on Step 2 would otherwise never run
   * the Step 1 effect. `orgLogoSnapshot` makes this fire only on an actual change, so a
   * deliberately chosen provider logo is left alone.
   */
  useEffect(() => {
    if (isInitialLoading) return;

    let cancelled = false;
    (async () => {
      const profile: any = await fetchProfileOnce().catch(() => null);
      if (cancelled || !profile) return;

      const orgLogo: string | null =
        profile.advisorLogoUrl ||
        profile.advisorLogo ||
        profile.wizardSessions?.[0]?.branding?.logo ||
        null;
      if (!orgLogo || !String(orgLogo).trim()) return;

      const latest = useBenefitsWizardStore.getState().stepData.step1;
      if (!latest?.planId || !latest.benefitCategory) return;

      // The org logo is only the default logo for the advisor's PRIMARY categories —
      // mirrors the Step 1 pre-fill so both agree.
      const primaryCats: string[] = Array.isArray(profile.primaryServiceCategories)
        ? profile.primaryServiceCategories
        : [];
      const apiCat =
        latest.benefitCategory === "Custom"
          ? "Company / Plan Sponsor"
          : latest.benefitCategory;
      const isPrimary = primaryCats.some(
        (pc) =>
          normalizeCategory(String(pc)) === normalizeCategory(apiCat) ||
          (normalizeCategory(String(pc)) === "other" &&
            normalizeCategory(apiCat) === "company / plan sponsor"),
      );
      if (!isPrimary) return;

      const snapshot = String(latest.orgLogoSnapshot ?? "").trim();
      if (String(orgLogo).trim() === snapshot) return;

      // Mirror the new logo into the read-once Benefit snapshot too, so
      // `handleCategoryChange` and the Step 1 pre-fill (both of which rebuild the logo
      // from it) can't re-read the previous image.
      const rowKey = normalizeCategory(apiCat);
      const existingRow = latest.categoryBenefitByApi?.[rowKey];
      const categoryBenefitByApi =
        existingRow && latest.categoryBenefitByApi
          ? {
              ...latest.categoryBenefitByApi,
              [rowKey]: { ...existingRow, partnerLogo: orgLogo },
            }
          : latest.categoryBenefitByApi;

      useBenefitsWizardStore.getState().saveStepData(1, {
        ...latest,
        companyLogo: {
          url: orgLogo,
          fileName: latest.companyLogo?.fileName || "logo.png",
          fileSize: 0,
          width: 0,
          height: 0,
          hasTransparency: false,
          warnings: [],
        },
        orgLogoSnapshot: orgLogo,
        categoryBenefitByApi,
      });

      // This write is the app's, not the user's, and it resolves asynchronously — so it
      // can land after the subscription above has already been frozen by a click. Keep
      // it out of the comparison unless the user has genuinely started editing.
      if (!userInteractedRef.current) {
        benefitsBaselineRef.current = snapshotBenefitsStore();
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialLoading]);

  const onNext = async () => {
    if (currentStep === 1) {
      const step1Data = useBenefitsWizardStore.getState().stepData.step1;

      // Validate 1a - Selection, Branding & Messaging. Collect the specific
      // missing required fields so Step 1 can open the owning accordion and
      // scroll straight to the offending control.
      const missingFields: string[] = [];
      if (!step1Data?.planId) missingFields.push("planId");
      if (!step1Data?.benefitCategory) missingFields.push("benefitCategory");
      if (!step1Data?.companyLogo) missingFields.push("companyLogo");
      if (!step1Data?.benefitTitle?.trim()) missingFields.push("benefitTitle");
      if (!step1Data?.shortDescription?.trim())
        missingFields.push("shortDescription");
      if (!step1Data?.contactId) missingFields.push("contactId");

      if (missingFields.length > 0) {
        // Prefer the direct handler registered by Step 1 (guaranteed to exist
        // once the step is mounted); fall back to the event for decoupling.
        const scrollToFields = (window as any).__benefitsStep1ScrollToFields;
        if (typeof scrollToFields === "function") {
          scrollToFields(missingFields);
        } else {
          window.dispatchEvent(
            new CustomEvent("benefitsStep1ValidationError", {
              detail: { fields: missingFields },
            }),
          );
        }
        toast.error("Please fill in all required fields", {
          description:
            "Select a plan, category, contact, upload a logo, and complete the Intro Headline & Message.",
        });
        return;
      }
      // Validation passed — go directly to Step 2 (Preview & Edit)
      completeStep(currentStep);
      nextStep();
      return;
    }

    if (currentStep === 2) {
      const step1Data = useBenefitsWizardStore.getState().stepData.step1;

      // Validate Insurance fields: only the Login URL is required. The Plan /
      // Group ID is optional — the editor panel shows it without a required
      // marker, so it must not block moving to the next step.
      // Flag any missing required Step 2 fields (in document order) so the
      // editor paints them red and scrolls to the first one. Prefer the direct
      // handler registered by Step 2; fall back to the editor event.
      const missingFields: string[] = [];
      if (!step1Data?.companyLogo?.url?.trim()) missingFields.push("companyLogo");
      if (!step1Data?.brandImages?.header?.url?.trim())
        missingFields.push("brandImages.header");
      if (!step1Data?.benefitTitle?.trim()) missingFields.push("benefitTitle");
      if (!step1Data?.shortDescription?.trim())
        missingFields.push("shortDescription");
      if (!step1Data?.insuranceLoginUrl?.trim())
        missingFields.push("insuranceLoginUrl");

      if (missingFields.length > 0) {
        const scrollToFields = (window as any).__benefitsStep2ScrollToFields;
        if (typeof scrollToFields === "function") {
          scrollToFields(missingFields);
        } else {
          window.dispatchEvent(
            new CustomEvent("openBenefitsEditor", {
              detail: { sectionId: "insurance", fieldId: "insuranceLoginUrl" },
            }),
          );
        }
        toast.error("Please complete the required fields", {
          description:
            "Add a Provider Logo, Header Background, Intro Headline, Intro Message, and the Register/Login Button URL.",
        });
        return;
      }
    }

    if (currentStep === 3) {
      const step3Data = useBenefitsWizardStore.getState().stepData.step3;

      // Validation: At least one contact
      const enabledContacts =
        step3Data?.supportContacts?.filter((sc) => sc.enabled) || [];
      if (enabledContacts.length === 0) {
        toast.error("Please select at least one support contact", {
          description: "Employees need someone to reach out to for questions.",
        });
        return;
      }
      // Proceed to next step
      completeStep(currentStep);
      nextStep();
      return;
    }

    completeStep(currentStep);
    nextStep();
  };

  const onPrevious = () => {
    previousStep();
  };

  /**
   * Persist the benefit using the shared `saveBenefit()` helper (the same merge
   * logic the Edit Benefit page uses). UI concerns — loading state, toasts,
   * step navigation — stay here.
   */
  const submitBenefits = async () => {
    const store = useBenefitsWizardStore.getState();
    const stepData = store.stepData;
    const planId = stepData.step1?.planId;

    if (!planId) {
      toast.error("Plan ID missing. Cannot complete setup.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await saveBenefit(stepData);
      if (!result.success) throw new Error(result.error || "Failed to save benefit");

      const categoryName = stepData.step1?.benefitCategory || "Benefit";
      completeStep(currentStep);
      toast.success(`${categoryName} benefits created successfully!`);

      // Small delay for the toast to be seen, then navigate back to Step 1
      setTimeout(() => {
        useBenefitsWizardStore.getState().goToStep(1);
      }, 1500);
    } catch (error: any) {
      console.error("Completion error:", error);
      toast.error("Cannot complete benefits creation:", {
        description: error.message,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Intercept the submit attempt on Step 5 (the wizard's "Complete" button is
   * only shown on the last step). Instead of publishing immediately, show the
   * Publishing Attestation dialog so the user must confirm both attestations
   * before the Benefit is submitted.
   */
  const onComplete = () => {
    setIsAttestationOpen(true);
  };

  const handleConfirmPublish = async () => {
    setIsAttestationOpen(false);
    await submitBenefits();
  };

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        // The category is pinned by the deep link when the Browse Benefits page's
        // per-row "+ Add" opens this wizard (`?planId&category`), so Step 1 hides
        // its redundant "Benefit Category" picker. Plan-only entry points (sidebar
        // "Create Benefit", right after a plan is created, dashboard tasks) keep it.
        return <BenefitsStep1 hideCategoryPicker={!!categoryParam} />;
      case 2:
        return <BenefitsStep2 />;
      case 3:
        return <BenefitsStep3 />;
      case 4:
        return <BenefitsStep4 />;
      case 5:
        return <BenefitsStep5 />;
      default:
        return <BenefitsStep1 hideCategoryPicker={!!categoryParam} />;
    }
  };

  return (
    <>
      <BenefitsWizard
        steps={steps}
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
      </BenefitsWizard>
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
      <PublishingAttestationDialog
        open={isAttestationOpen}
        onOpenChange={setIsAttestationOpen}
        onConfirm={handleConfirmPublish}
        submitting={isLoading}
      />
    </>
  );
}

export default function NewBenefitsPage() {
  return (
    <Suspense fallback={null}>
      <NewBenefitsPageInner />
    </Suspense>
  );
}
