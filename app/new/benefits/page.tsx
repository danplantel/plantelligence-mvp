"use client";

import { BenefitsWizard } from "@/components/wizard/benefits-wizard";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { useEffect, useState, Suspense } from "react";
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
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { mergeUserBenefitWithHubDefaults } from "@/lib/hub-benefit-defaults";
import { hasUnsavedBenefitsWork } from "@/lib/benefits-wizard-dirty";
import { useNavigateAwayGuard } from "@/hooks/use-navigate-away-guard";
import { NavigateAwayWarningDialog } from "@/components/ui/navigate-away-warning-dialog";

/** Default benefit entries used when the plan has no benefits list yet (so finish-setup doesn't wipe other categories). */
const DEFAULT_BENEFIT_CATEGORIES: { id: string; title: string; category: BenefitsCategory; href: string; buttonText: string }[] = [
  { id: "retirement", title: "Retirement Plan Benefits", category: "Retirement", href: "/retirement", buttonText: "RETIREMENT BENEFITS>" },
  { id: "health", title: "Health Insurance", category: "Group Health", href: "/health-insurance", buttonText: "HEALTH BENEFITS>" },
  { id: "life", title: "Life Insurance", category: "Group Life", href: "/life-insurance", buttonText: "LIFE INSURANCE BENEFITS>" },
  { id: "wellness", title: "Wellness Programs", category: "Company / Plan Sponsor", href: "/wellness-programs", buttonText: "WELLNESS BENEFITS>" },
];

function normalizeCategory(cat: string | null | undefined): string {
  return (cat || "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** True when the row is stored in R2 (object key or placeholder file). */
function isR2DocumentRow(doc: {
  storageKey?: string;
  file?: string;
  fileUrl?: string;
}): boolean {
  const sk = (doc.storageKey && String(doc.storageKey).trim()) || "";
  if (sk) {
    return sk.startsWith("org/") || (sk.includes("/") && sk.length > 8);
  }
  const f = (doc.file && String(doc.file)) || (doc.fileUrl && String(doc.fileUrl)) || "";
  return f.trim() === "r2:stored";
}

function BenefitsPageInner() {
  const { setTitle } = usePageTitleContext();
  const [isLoading, setIsLoading] = useState(false);
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
  const hasUnsavedChanges = useBenefitsWizardStore((s) =>
    hasUnsavedBenefitsWork({
      currentStep: s.currentStep,
      stepData: s.stepData,
    }),
  );
  const leaveGuard = useNavigateAwayGuard({
    enabled: true,
    hasUnsavedChanges: !isLoading && hasUnsavedChanges,
    onSaveAndExit: async () => {
      // Benefits wizard uses persisted zustand storage as its draft source.
      // Save-and-exit is satisfied once local persisted state is current.
      return;
    },
  });

  useEffect(() => {
    setTitle("Create Benefits");
  }, [setTitle]);

  /**
   * Portal deep link: `/new/benefits?planId=<clientId>&category=<BenefitsCategory>`
   * Do not blanket `resetWizard()` when these exist — it races zustand-persist rehydration and wipes URL init.
   * Re-apply after timeouts so persisted localStorage cannot overwrite deep-linked step1.
   */
  useEffect(() => {
    const hasDeepLink = !!(planIdParam && categoryParam);

    const applyFromUrl = () => {
      if (!planIdParam || !categoryParam) return;
      const step1Data = useBenefitsWizardStore.getState().stepData.step1 || {
        planId: "",
        benefitCategory: "",
        contactId: "",
        benefitTitle: "",
      };
      saveStepData(1, {
        ...step1Data,
        planId: planIdParam,
        benefitCategory: categoryParam as BenefitsCategory,
        benefitTitle: categoryParam === "Custom" ? "" : categoryParam,
      });
    };

    if (hasDeepLink) {
      applyFromUrl();
      const t0 = setTimeout(applyFromUrl, 0);
      const t1 = setTimeout(applyFromUrl, 50);
      const t2 = setTimeout(applyFromUrl, 200);
      return () => {
        clearTimeout(t0);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    resetWizard();
    return undefined;
  }, [planIdParam, categoryParam, saveStepData, resetWizard]);

  const onNext = async () => {
    if (currentStep === 1) {
      const step1Data = useBenefitsWizardStore.getState().stepData.step1;

      // Validate 1a - Selection + Branding
      if (
        !step1Data?.planId ||
        !step1Data?.benefitCategory ||
        !step1Data?.contactId ||
        !step1Data?.companyLogo
      ) {
        toast.error("Please fill in all required fields", {
          description: "Select a plan, category, contact, and upload a logo.",
        });
        return;
      }
      // Validation passed — go directly to Step 2 (Preview & Edit)
      completeStep(currentStep);
      nextStep();
      return;
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

  const onComplete = async () => {
    const store = useBenefitsWizardStore.getState();
    const step1Data = store.stepData.step1;
    const step3Data = store.stepData.step3;
    const step4Data = store.stepData.step4;
    const step5Data = store.stepData.step5;
    const planId = step1Data?.planId;

    // Fallback: read plan video from dedicated per-category localStorage (zustand store may lose it during nav)
    const cat = step1Data?.benefitCategory || "Retirement";
    const lsKey1 = typeof window !== "undefined" ? localStorage.getItem("benefits-plan-video-key-" + cat) : null;
    // Also check old "Custom" key (renamed to "Company / Plan Sponsor")
    const lsKey2 = cat === "Company / Plan Sponsor" && typeof window !== "undefined" ? localStorage.getItem("benefits-plan-video-key-Custom") : null;
    const planVideo = step1Data?.planVideo || lsKey1 || lsKey2 || undefined;
    const lsFn1 = typeof window !== "undefined" ? localStorage.getItem("benefits-plan-video-filename-" + cat) : null;
    const lsFn2 = cat === "Company / Plan Sponsor" && typeof window !== "undefined" ? localStorage.getItem("benefits-plan-video-filename-Custom") : null;
    const planVideoFileName = step1Data?.planVideoFileName || lsFn1 || lsFn2 || undefined;

    if (!planId) {
      toast.error("Plan ID missing. Cannot complete setup.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch current client data to merge
      const response = await fetch(`/api/clients/${planId}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to fetch client data");

      const client = result.data;

      // 2. Edited category row: merge with hub defaults so image / copy / CTA match other cards
      // (saving only partial data was leaving the portal with empty description, image, and button text).
      const newBenefit = mergeUserBenefitWithHubDefaults(
        {
          id: step1Data?.benefitCategory.toLowerCase().replace(/\s+/g, "-"),
          title: step1Data?.benefitTitle,
          shortDescription: step1Data?.shortDescription,
          image: step1Data?.brandImages?.header?.url,
          partnerLogo: step1Data?.companyLogo?.url,
          innerHeaderImage: step1Data?.innerHeaderImage?.url,
          contactId: step1Data?.contactId,
          category: step1Data?.benefitCategory,
          planVideo,
          planVideoFileName,
        },
        step1Data?.benefitCategory,
        { saveMode: true },
      ) as any;
      // Use the benefitVisibility toggle from Step 1 (default true = published)
      newBenefit.isEnabled = (step1Data?.benefitVisibility ?? {})[step1Data?.benefitCategory || ""] ?? true;

      // Include Step 3 FAQs and support contacts for this benefit category
      if (step3Data?.faqs) {
        newBenefit.faqs = step3Data.faqs;
      }
      if (step3Data?.supportContacts) {
        newBenefit.supportContacts = step3Data.supportContacts;
      }

      // Include Plan Video from Step 2 for this benefit category
      if (planVideo) {
        newBenefit.planVideo = planVideo;
        newBenefit.planVideoFileName = step1Data.planVideoFileName;
      }

      // 3. Always preserve all 4 categories: merge existing + default placeholders, then set the one we edited
      const currentBenefits = client.employeePortalPreview?.benefits ?? client.employeePortalPreview?.previewData?.benefits ?? [];
      const editingCategory = (step1Data?.benefitCategory || "").trim();
      const editingNorm = normalizeCategory(editingCategory);

      const updatedBenefits = DEFAULT_BENEFIT_CATEGORIES.map((d) => {
        const norm = normalizeCategory(d.category);
        if (norm === editingNorm) return newBenefit;
        const existing = (currentBenefits as any[]).find(
          (b: any) => normalizeCategory(b.category) === norm,
        );
        if (existing) {
          return mergeUserBenefitWithHubDefaults(
            existing,
            d.category,
            { saveMode: true },
          ) as any;
        }
        return mergeUserBenefitWithHubDefaults(
          {
            id: d.id,
            title: d.title,
            category: d.category,
            href: d.href,
            buttonText: d.buttonText,
            isEnabled: true,
          },
          d.category,
          { saveMode: true },
        ) as any;
      });

      // 4. Update keyContacts if we have new local ones or EDITED existing ones (like headshots)
      const existingContacts = Array.isArray(client.keyContacts) ? client.keyContacts : (client.keyContacts?.contacts || []);
      const wizardPlanContacts = step1Data?.selectedPlan?.keyContacts;
      const localContacts = Array.isArray(wizardPlanContacts) ? wizardPlanContacts : (wizardPlanContacts?.contacts || []);

      // Merge: Prefer local (wizard) data for existing IDs, then add truly new ones
      const updatedContactsList = existingContacts.map((ec: any) => {
        const localUpdate = localContacts.find((lc: any) => lc.id === ec.id || (lc.email === ec.email && ec.email));
        return localUpdate ? { ...ec, ...localUpdate } : ec;
      });

      const newContactsToAdd = localContacts.filter((lc: any) =>
        !existingContacts.some((ec: any) => ec.id === lc.id || (ec.email === lc.email && ec.email))
      );

      const finalContactsList = [...updatedContactsList, ...newContactsToAdd];

      // 5. Update documents for this category
      const currentDocuments = client.documents || [];
      // Other categories: compare hub labels (DB may store "retirement" R2 slug vs "Retirement" in wizard)
      const editingHub = resolvePersistedDocumentCategory(
        "Document",
        step1Data?.benefitCategory,
      );
      const otherCategoryDocuments = currentDocuments.filter((d: any) => {
        const docHub = resolvePersistedDocumentCategory(d.type, d.category);
        return docHub !== editingHub;
      });

      // Current-category documents: wizard Step 4 is the source of truth, BUT if the store rehydrated
      // empty (navigated away, refresh) while the DB still has R2 rows from auto-persist, merge in API
      // rows for this category so we never send an empty list and delete everything.
      //
      // IMPORTANT: step4List may contain documents from ALL categories. Filter to only the current
      // editingHub to avoid duplicating other-category documents when concatenated with
      // retirementPlanDocuments below.
      const step4List = (step4Data?.documents || []) as any[];
      const step4ForCurrentCategory = step4List.filter((d) =>
        resolvePersistedDocumentCategory(
          d.type || "Document",
          d.category,
          d.storageKey,
        ) === editingHub
      );
      const fromApiThisHub = (currentDocuments as any[]).filter(
        (d) =>
          d.type === "Document" &&
          resolvePersistedDocumentCategory(d.type, d.category) === editingHub,
      );
      // Deduplicate by both ID AND storageKey: step4 may have temp-ID docs whose
      // storageKey matches real-ID docs from the API (e.g., auto-persisted R2 uploads).
      // Without storageKey matching, both the temp-ID and real-ID versions would be
      // included, doubling the documents on every completion.
      const step4IdSet = new Set(step4ForCurrentCategory.map((d) => String(d.id ?? "")));
      const step4KeySet = new Set(
        step4ForCurrentCategory
          .map((d) => (d.storageKey ? String(d.storageKey).trim() : ""))
          .filter(Boolean),
      );
      const onlyOnServer = fromApiThisHub.filter(
        (d) => {
          if (step4IdSet.has(String(d.id))) return false;
          const apiKey = (d.storageKey && String(d.storageKey).trim()) || "";
          if (apiKey && step4KeySet.has(apiKey)) return false;
          return true;
        },
      );
      const mergedForCurrentCategory = [...step4ForCurrentCategory, ...onlyOnServer];

      const newDocuments = mergedForCurrentCategory.map((doc: any) => {
        // `GET /api/clients` documents use `title`/`fileUrl`; wizard Step 4 uses `name`/`file`
        const fromClientApi = doc.name == null && doc.title != null;
        if (fromClientApi) {
          const isR2 = isR2DocumentRow(doc);
          const sk = (doc.storageKey && String(doc.storageKey).trim()) || "";
          let fileData: string = (doc.fileUrl as string) || doc.file;
          if (isR2) {
            fileData = "r2:stored";
          } else if (
            fileData &&
            !String(fileData).startsWith("data:") &&
            !String(fileData).startsWith("/api/") &&
            !String(fileData).startsWith("http")
          ) {
            fileData = `data:application/pdf;base64,${fileData}`;
          }
          return {
            id: doc.id,
            name: doc.title,
            fileName: doc.fileName,
            file: fileData,
            ...(isR2 && sk ? { storageKey: sk } : {}),
            type: "Document",
            category: step1Data?.benefitCategory,
            language: doc.language || "EN",
            shortDescription: doc.shortDescription || "",
            expirationDate: doc.expirationDate || undefined,
          };
        }

        const isR2 = isR2DocumentRow(doc);
        let fileData: string | undefined = doc.file;
        if (!isR2 && fileData && !fileData.startsWith("data:") && !fileData.startsWith("/api/")) {
          fileData = `data:application/pdf;base64,${fileData}`;
        }
        if (isR2) {
          fileData = "r2:stored";
        }
        const sk = (doc.storageKey && String(doc.storageKey).trim()) || "";
        return {
          id: doc.id,
          name: doc.name || doc.originalFileName,
          fileName: doc.originalFileName || doc.name,
          file: fileData,
          ...(isR2 && sk ? { storageKey: sk } : {}),
          type: "Document",
          category: step1Data?.benefitCategory,
          language: doc.language || "EN",
          shortDescription: doc.shortDescription || "",
          expirationDate: doc.expirationDate || undefined,
        };
      });

      // 6. Final save
      // Map other categories' `Document` rows. MUST pass storageKey for R2 or PUT will skip r2:stored after delete.
      const retirementPlanDocuments = otherCategoryDocuments
        .filter((d: any) => d.type === "Document")
        .map((d: any) => {
          const isR2 = isR2DocumentRow(d);
          const sk = (d.storageKey && String(d.storageKey).trim()) || "";
          return {
            id: d.id,
            name: d.title,
            fileName: d.fileName,
            file: isR2 ? "r2:stored" : d.fileUrl,
            ...(isR2 && sk ? { storageKey: sk } : {}),
            type: "Document",
            category: d.category,
            language: d.language,
            shortDescription: d.shortDescription,
          };
        });

      // Derive categoryPortalVisibility from benefitVisibility toggles
      const visibilityForComplete = step1Data?.benefitVisibility ?? {};
      const categoryPortalVisibilityForComplete: Record<string, boolean> = {
        Retirement: visibilityForComplete["Retirement"] !== false,
        "Group Health": visibilityForComplete["Group Health"] !== false,
        "Group Life": visibilityForComplete["Group Life"] !== false,
        Other: visibilityForComplete["Custom"] !== false,
      };

      // Include Step 5 disclaimers in the payload
      const step5Disclaimers =
        Array.isArray(step5Data?.disclaimers) && step5Data.disclaimers.length > 0
          ? step5Data.disclaimers
          : undefined;

      const updatePayload = {
        keyContacts: finalContactsList,
        employeePortalPreview: {
          ...client.employeePortalPreview,
          benefits: updatedBenefits,
          // Persist insurance section fields inside employeePortalPreview (JSON field)
          insurancePlanId: step1Data?.insurancePlanId || "",
          insuranceLoginUrl: step1Data?.insuranceLoginUrl || "",
          insuranceBackgroundImage: step1Data?.insuranceBackgroundImage || "",
          insuranceContainerBlockOpacity: step1Data?.insuranceContainerBlockOpacity ?? 0.8,
          // Explicitly persist help cards and hero overlay settings
          helpCards: step1Data?.helpCards,
          heroBackgroundOpacity: step1Data?.heroBackgroundOpacity ?? 1.0,
          heroContainerBlockOpacity: step1Data?.heroContainerBlockOpacity ?? 0.67,
          heroContainerInverted: step1Data?.heroContainerInverted ?? false,
          heroBackgroundInverted: step1Data?.heroBackgroundInverted ?? false,
          heroUseGradient: step1Data?.heroUseGradient ?? false,
        },
        categoryPortalVisibility: categoryPortalVisibilityForComplete,
        ...(step5Disclaimers ? { disclaimers: { disclaimers: step5Disclaimers } } : {}),
      };

      // Only include documentsData if documents actually changed in the wizard.
      // Sending documentsData always triggers a DELETE + RECREATE of all Document-type
      // docs on the server. If the user is just editing a benefit without touching
      // documents, skip documentsData to avoid any risk of duplication.
      const finalRetirementDocs = [...retirementPlanDocuments, ...newDocuments];
      const hasNewOrChangedDocs =
        onlyOnServer.length > 0 ||
        step4ForCurrentCategory.some((d) => {
          // Temp IDs (doc-, temp-, plan-doc-, optional-doc-) indicate wizard-added docs
          const sid = String(d.id ?? "");
          return (
            sid.startsWith("temp-") ||
            sid.startsWith("doc-") ||
            sid.startsWith("plan-doc-") ||
            sid.startsWith("optional-doc-")
          );
        });

      if (hasNewOrChangedDocs) {
        (updatePayload as any).documentsData = {
          retirementPlanDocuments: finalRetirementDocs,
          // Preserve other types
          otherDocuments: currentDocuments.filter((d: any) => d.type !== "Document" && d.type !== "SPD" && d.type !== "SBC"),
          spdFile: currentDocuments.find((d: any) => d.type === "SPD") ? {
            fileName: currentDocuments.find((d: any) => d.type === "SPD")?.fileName,
            file: currentDocuments.find((d: any) => d.type === "SPD")?.fileUrl,
          } : null,
          sbcFile: currentDocuments.find((d: any) => d.type === "SBC") ? {
            fileName: currentDocuments.find((d: any) => d.type === "SBC")?.fileName,
            file: currentDocuments.find((d: any) => d.type === "SBC")?.fileUrl,
          } : null,
        }
      };

      const updateResponse = await fetch(`/api/clients/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      const updateResult = await updateResponse.json();
      if (!updateResult.success) throw new Error(updateResult.error || "Failed to update client");

      // Notify any open portal views that benefits have changed (triggers re-fetch in ClientPortalProvider)
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("benefits-updated", { detail: { clientId: planId } }),
        );
      }

      const categoryName = step1Data?.benefitCategory || "Benefit";
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

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <BenefitsStep1 />;
      case 2:
        return <BenefitsStep2 />;
      case 3:
        return <BenefitsStep3 />;
      case 4:
        return <BenefitsStep4 />;
      case 5:
        return <BenefitsStep5 />;
      default:
        return <BenefitsStep1 />;
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
    </>
  );
}

export default function BenefitsPage() {
  return (
    <Suspense fallback={null}>
      <BenefitsPageInner />
    </Suspense>
  );
}
