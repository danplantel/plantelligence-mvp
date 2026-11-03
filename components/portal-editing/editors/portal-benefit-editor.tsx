"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Loader2 } from "lucide-react";

import { BenefitsEditorPanel } from "@/components/wizard/benefits-steps/benefits-editor-panel";
import { PortalEditorShell } from "@/components/portal-editing/portal-editor-shell";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  useBenefitsWizardStore,
  type BenefitsStep1Data,
  type BenefitsStep3Data,
} from "@/lib/benefits-wizard-store";
import { saveBenefit } from "@/lib/save-benefit";
import { getCategoryPortalVisibility } from "@/lib/portal-category-visibility";
import { normalizeKeyContactCardStyle } from "@/lib/key-contact-card-style";
import {
  normalizeTypographyThemeId,
  type TypographyThemeId,
} from "@/lib/typography-themes";
import type {
  BrandImageData,
  CompanyLogoData,
} from "@/types/new-client-wizard";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

/** The stored API category for a hub route. A custom hub is the Plan Sponsor row. */
export function portalBenefitApiCategory(category: string | null): string {
  return category === "Other" ? "Company / Plan Sponsor" : category || "";
}

function logoDataFromUrl(url: string | null | undefined): CompanyLogoData | null {
  if (!url) return null;
  return {
    url,
    fileName: "image.png",
    fileSize: 0,
    width: 0,
    height: 0,
    hasTransparency: false,
    warnings: [],
  };
}

function brandImageFromUrl(
  url: string | null | undefined,
): BrandImageData | null {
  if (!url) return null;
  return {
    url,
    fileName: "background.png",
    fileSize: 0,
    width: 0,
    height: 0,
    recommendedSize: "1920 px—1080 px",
    status: "ok",
    warnings: [],
  };
}

/**
 * Map a Benefit row + the live plan onto the same Step 1 state Create/Edit
 * Benefits builds, so `BenefitsEditorPanel` renders its exact sections.
 *
 * Mirrors `handleCategoryChange` in `benefits-steps/step-1.tsx` for every field
 * the editor panel reads. `selectedPlan.keyContacts` is deliberately omitted:
 * `saveBenefit()` merges those into the plan's full contact list, and the portal
 * payload only carries the contacts visible to participants.
 */
function step1FromBenefit(input: {
  benefit: Record<string, any> | null;
  clientData: Record<string, any> | null;
  planId: string;
  apiCategory: string;
}): BenefitsStep1Data {
  const { benefit, clientData, planId, apiCategory } = input;
  const plan = clientData ?? {};
  const visibility = getCategoryPortalVisibility(plan.categoryPortalVisibility);

  const logoUrl =
    typeof benefit?.partnerLogo === "string" ? benefit.partnerLogo : "";
  const headerUrl =
    benefit?.backgroundImage ||
    benefit?.image ||
    plan.backgroundImg ||
    "";
  const portrait =
    typeof plan.heroPortraitImage === "string"
      ? plan.heroPortraitImage.trim()
      : "";

  return {
    planId,
    benefitCategory: apiCategory,
    typographyTheme: normalizeTypographyThemeId(
      plan.typographyTheme,
    ) as TypographyThemeId,
    contactId: String(benefit?.contactId ?? ""),
    benefitTitle: String(benefit?.title ?? ""),
    shortDescription: String(benefit?.shortDescription ?? ""),
    companyLogo: logoDataFromUrl(logoUrl),
    landingCardImage: logoDataFromUrl(
      typeof benefit?.landingCardImage === "string"
        ? benefit.landingCardImage
        : "",
    ),
    landingCardBody: String(benefit?.landingCardBody ?? ""),
    brandImages: {
      header: brandImageFromUrl(headerUrl),
      thumbnail: null,
      secondaryBanner: null,
      favicon: null,
    },
    selectedPlan: { ...plan, keyContacts: undefined },
    benefitVisibility: {
      Retirement: visibility.Retirement !== false,
      "Group Health": visibility["Group Health"] !== false,
      "Group Life": visibility["Group Life"] !== false,
      Custom: visibility.Other !== false,
    },
    helpCards: benefit?.helpCards || undefined,
    insurancePlanId: String(benefit?.insurancePlanId ?? ""),
    insuranceLoginUrl: String(benefit?.insuranceLoginUrl ?? ""),
    insuranceBackgroundImage: String(benefit?.insuranceBackgroundImage ?? ""),
    insuranceContainerBlockOpacity:
      benefit?.insuranceContainerBlockOpacity ?? 0.8,
    providerContact: benefit?.providerContact ?? null,
    // Only carry the portrait when one exists: `saveBenefit` treats an explicit
    // empty string as "clear the saved portrait".
    ...(portrait ? { heroPortraitImage: portrait } : {}),
    heroBackgroundOpacity:
      benefit?.heroBackgroundOpacity ?? plan.heroBackgroundOpacity,
    heroContainerBlockOpacity:
      benefit?.heroContainerBlockOpacity ?? plan.heroContainerBlockOpacity,
    heroContainerInverted:
      benefit?.heroContainerInverted ?? plan.heroContainerInverted,
    heroBackgroundInverted:
      benefit?.heroBackgroundInverted ?? plan.heroBackgroundInverted,
    heroUseGradient: benefit?.heroUseGradient ?? plan.heroUseGradient,
    planVideo: benefit?.planVideo || undefined,
    planVideoFileName: benefit?.planVideoFileName || undefined,
    planVideoLabel: benefit?.planVideoLabel || undefined,
    planVideoThumbnail: benefit?.planVideoThumbnail || undefined,
    planVideoFallbackImage: benefit?.planVideoFallbackImage || undefined,
    planVideoVisible: benefit?.planVideoVisible,
    keyContactCardStyle: normalizeKeyContactCardStyle(
      benefit?.keyContactCardStyle,
    ),
    journeyHeader: String(benefit?.journeyHeader ?? ""),
    journeySubtitle: String(benefit?.journeySubtitle ?? ""),
    journeyBodyText: String(benefit?.journeyBodyText ?? ""),
    signatureMode: benefit?.signatureMode || "user",
    customClosing: benefit?.customClosing || "",
    customSignatureName: benefit?.customSignatureName || "",
    customSignatureCompany: benefit?.customSignatureCompany || "",
    customClosingBold: benefit?.customClosingBold ?? true,
    customClosingItalic: benefit?.customClosingItalic ?? false,
    customSignatureNameBold: benefit?.customSignatureNameBold ?? false,
    customSignatureNameItalic: benefit?.customSignatureNameItalic ?? false,
    customSignatureCompanyBold: benefit?.customSignatureCompanyBold ?? true,
    customSignatureCompanyItalic:
      benefit?.customSignatureCompanyItalic ?? false,
  };
}

function step3FromBenefit(
  benefit: Record<string, any> | null,
  apiCategory: string,
): BenefitsStep3Data {
  const rawFaqs = benefit?.faqs;
  const rawSupportContacts = benefit?.supportContacts;
  const faqs: BenefitsStep3Data["faqs"] = Array.isArray(rawFaqs)
    ? rawFaqs
    : [];
  const supportContacts: BenefitsStep3Data["supportContacts"] = Array.isArray(
    rawSupportContacts,
  )
    ? rawSupportContacts
    : [];
  return {
    faqs,
    supportContacts,
    faqsByCategory: apiCategory ? { [apiCategory]: faqs } : {},
  };
}

/**
 * Portal benefit hub editor.
 *
 * Hydrates the Create/Edit Benefits wizard store from this hub's live Benefit
 * row and renders the exact same [`BenefitsEditorPanel`](components/wizard/benefits-steps/benefits-editor-panel.tsx)
 * used by Create Benefits Step 2 and Edit Benefit's Preview tab — same sections,
 * same inputs, same behaviour. Every change is autosaved through the shared
 * `saveBenefit()` merge, so the live hub repaints from the same write path the
 * dashboard uses.
 */
export function PortalBenefitEditor() {
  const {
    target,
    planId,
    canEditFunction,
    isOpen,
    closePanel,
    beginSave,
    finishSave,
    failSave,
    saveState,
    saveError,
  } = usePortalEditing();
  const { clientData } = useClientPortal();
  const { mutate } = useSWRConfig();

  const canEditBenefit = canEditFunction("create_benefits");
  const category = target?.category ?? null;
  const apiCategory = portalBenefitApiCategory(category);
  const benefitKey =
    planId && apiCategory
      ? `/api/clients/${planId}/benefits/${encodeURIComponent(apiCategory)}?forPortal=1&withTopics=1`
      : null;

  const { data, error } = useSWR(benefitKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const [hydrated, setHydrated] = useState(false);
  const hydratedKeyRef = useRef<string | null>(null);
  const skipFirstChangeRef = useRef(true);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const versionRef = useRef(0);
  const [saveTick, setSaveTick] = useState(0);

  // The editor panel reads the wizard store directly, so hydration is what makes
  // its sections show this hub's saved values.
  useEffect(() => {
    if (!benefitKey || !clientData) return;
    if (data === undefined && !error) return;
    if (hydratedKeyRef.current === benefitKey) return;

    hydratedKeyRef.current = benefitKey;
    setHydrated(false);

    const benefit = (data?.benefit ?? null) as Record<string, any> | null;
    const store = useBenefitsWizardStore.getState();
    store.saveStepData(
      1,
      step1FromBenefit({
        benefit,
        clientData: clientData as Record<string, any>,
        planId,
        apiCategory,
      }),
    );
    store.saveStepData(3, step3FromBenefit(benefit, apiCategory));

    skipFirstChangeRef.current = true;
    setHydrated(true);
  }, [benefitKey, clientData, data, error, planId, apiCategory]);

  const stepData = useBenefitsWizardStore((state) => state.stepData);

  // Any store change after hydration is a user edit — queue the autosave.
  useEffect(() => {
    if (!hydrated) return;
    if (skipFirstChangeRef.current) {
      skipFirstChangeRef.current = false;
      return;
    }
    dirtyRef.current = true;
    versionRef.current += 1;
    setSaveTick((tick) => tick + 1);
  }, [stepData, hydrated]);

  const save = useCallback(async () => {
    if (!planId || savingRef.current) return;
    const snapshot = useBenefitsWizardStore.getState().stepData;
    if (!snapshot.step1?.planId) return;

    // The portal only owns Steps 1 and 3. Drop any Steps 4/5 left by an
    // unrelated dashboard draft so this save can never rewrite another
    // benefit's documents or disclaimers.
    const portalStepData = {
      ...snapshot,
      step4: undefined,
      step5: undefined,
    };

    const version = versionRef.current;
    savingRef.current = true;
    beginSave();
    try {
      const result = await saveBenefit(portalStepData);
      if (!result.success) {
        throw new Error(result.error || "Could not save this benefit.");
      }
      finishSave();
      if (benefitKey) await mutate(benefitKey);
    } catch (saveFailure) {
      failSave(
        saveFailure instanceof Error
          ? saveFailure.message
          : "Could not save this benefit.",
      );
      if (benefitKey) await mutate(benefitKey);
    } finally {
      savingRef.current = false;
      // Edits made while the save was in flight need another pass.
      if (versionRef.current !== version) {
        dirtyRef.current = true;
        setSaveTick((tick) => tick + 1);
      }
    }
  }, [planId, benefitKey, mutate, beginSave, finishSave, failSave]);

  useEffect(() => {
    if (!hydrated || !dirtyRef.current) return;
    const timer = setTimeout(() => {
      dirtyRef.current = false;
      void save();
    }, 1200);
    return () => clearTimeout(timer);
  }, [saveTick, hydrated, save]);

  const footer =
    saveState === "saving" ? (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    ) : saveState === "error" ? (
      <span className="text-xs text-red-500">
        {saveError || "Could not save this benefit."}
      </span>
    ) : undefined;

  if (!canEditBenefit) {
    return (
      <PortalEditorShell eyebrow="Benefit Editor" title="Editing Panel">
        <p className="p-6 text-sm text-muted-foreground">
          You don&rsquo;t have permission to edit this benefit&rsquo;s page
          details.
        </p>
      </PortalEditorShell>
    );
  }

  if (!hydrated) {
    return (
      <PortalEditorShell eyebrow="Benefit Editor" title="Editing Panel">
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading benefit…
        </div>
      </PortalEditorShell>
    );
  }

  return (
    <BenefitsEditorPanel
      isOpen={isOpen}
      isAnimating={isOpen}
      onClose={closePanel}
      planCompanyName={String(clientData?.companyName || "")}
      companyWebsite={clientData?.companyWebsite || ""}
      // A light grey tool surface, matching the portal's other editor panels.
      surfaceClassName="bg-gray-100 dark:bg-gray-900"
      footer={footer}
    />
  );
}
