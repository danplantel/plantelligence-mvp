"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Loader2 } from "lucide-react";

import { BenefitsEditorPanel } from "@/components/wizard/benefits-steps/benefits-editor-panel";
import { PortalEditorActionBar } from "@/components/portal-editing/portal-editor-action-bar";
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
 * The Benefit-row fields a Step 1/3 draft changes, in the shape the hub reads.
 *
 * The live hub renders from the Benefit API object SWR has cached, so a draft
 * only becomes visible beside the panel if it is written into that cache entry.
 * Every field this maps is one the panel owns; anything else on the row is left
 * untouched. The real write still happens in `saveBenefit()` on Save.
 */
function benefitPatchFromStepData(
  step1: BenefitsStep1Data,
  step3: BenefitsStep3Data,
): Record<string, any> {
  return {
    title: step1.benefitTitle,
    shortDescription: step1.shortDescription,
    partnerLogo: step1.companyLogo?.url ?? "",
    landingCardImage: step1.landingCardImage?.url ?? "",
    landingCardBody: step1.landingCardBody,
    backgroundImage: step1.brandImages?.header?.url ?? "",
    contactId: step1.contactId,
    insurancePlanId: step1.insurancePlanId,
    insuranceLoginUrl: step1.insuranceLoginUrl,
    insuranceBackgroundImage: step1.insuranceBackgroundImage,
    insuranceContainerBlockOpacity: step1.insuranceContainerBlockOpacity,
    providerContact: step1.providerContact,
    helpCards: step1.helpCards,
    heroBackgroundOpacity: step1.heroBackgroundOpacity,
    heroContainerBlockOpacity: step1.heroContainerBlockOpacity,
    heroContainerInverted: step1.heroContainerInverted,
    heroBackgroundInverted: step1.heroBackgroundInverted,
    heroUseGradient: step1.heroUseGradient,
    planVideo: step1.planVideo ?? "",
    planVideoFileName: step1.planVideoFileName ?? "",
    planVideoLabel: step1.planVideoLabel ?? "",
    planVideoThumbnail: step1.planVideoThumbnail ?? "",
    planVideoFallbackImage: step1.planVideoFallbackImage ?? "",
    planVideoVisible: step1.planVideoVisible,
    keyContactCardStyle: step1.keyContactCardStyle,
    journeyHeader: step1.journeyHeader,
    journeySubtitle: step1.journeySubtitle,
    journeyBodyText: step1.journeyBodyText,
    signatureMode: step1.signatureMode,
    customClosing: step1.customClosing,
    customSignatureName: step1.customSignatureName,
    customSignatureCompany: step1.customSignatureCompany,
    customClosingBold: step1.customClosingBold,
    customClosingItalic: step1.customClosingItalic,
    customSignatureNameBold: step1.customSignatureNameBold,
    customSignatureNameItalic: step1.customSignatureNameItalic,
    customSignatureCompanyBold: step1.customSignatureCompanyBold,
    customSignatureCompanyItalic: step1.customSignatureCompanyItalic,
    faqs: step3.faqs,
    supportContacts: step3.supportContacts,
  };
}

/**
 * Portal benefit hub editor.
 *
 * Hydrates the Create/Edit Benefits wizard store from this hub's live Benefit
 * row and renders the exact same [`BenefitsEditorPanel`](components/wizard/benefits-steps/benefits-editor-panel.tsx)
 * used by Create Benefits Step 2 and Edit Benefit's Preview tab — same sections,
 * same inputs, same behaviour.
 *
 * The store is a DRAFT: each change is mapped onto the cached Benefit object (and
 * the plan-level slices the hub reads) so the page beside the panel repaints at
 * once, but nothing is written until Save. Cancel refetches the saved row and
 * re-seeds the panel from it.
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
    resetSave,
    patchClientData,
    refetchPortal,
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
  const [isDirty, setIsDirty] = useState(false);
  const hydratedKeyRef = useRef<string | null>(null);
  const skipFirstChangeRef = useRef(true);
  const savingRef = useRef(false);
  // The draft effect needs the newest plan without re-subscribing on every patch.
  const clientDataRef = useRef(clientData);
  clientDataRef.current = clientData;

  /** Re-seed both steps from a Benefit row + plan, without marking a draft. */
  const hydrateFrom = useCallback(
    (
      benefit: Record<string, any> | null,
      plan: Record<string, any> | null,
    ) => {
      setHydrated(false);
      const store = useBenefitsWizardStore.getState();
      store.saveStepData(
        1,
        step1FromBenefit({ benefit, clientData: plan, planId, apiCategory }),
      );
      store.saveStepData(3, step3FromBenefit(benefit, apiCategory));
      skipFirstChangeRef.current = true;
      setHydrated(true);
    },
    [planId, apiCategory],
  );

  // The editor panel reads the wizard store directly, so hydration is what makes
  // its sections show this hub's saved values.
  useEffect(() => {
    if (!benefitKey || !clientData) return;
    if (data === undefined && !error) return;
    if (hydratedKeyRef.current === benefitKey) return;

    hydratedKeyRef.current = benefitKey;
    hydrateFrom(
      (data?.benefit ?? null) as Record<string, any> | null,
      clientData as Record<string, any>,
    );
  }, [benefitKey, clientData, data, error, hydrateFrom]);

  const stepData = useBenefitsWizardStore((state) => state.stepData);

  /**
   * Any store change after hydration is a user edit. Repaint the hub from the
   * draft (SWR cache + the plan-level slices the page reads) and light up the
   * action bar; nothing is written until Save.
   */
  useEffect(() => {
    if (!hydrated) return;
    if (skipFirstChangeRef.current) {
      skipFirstChangeRef.current = false;
      return;
    }

    setIsDirty(true);

    const step1 = stepData.step1 as BenefitsStep1Data | undefined;
    if (!benefitKey || !step1) return;

    const patch = benefitPatchFromStepData(
      step1,
      (stepData.step3 ?? {}) as BenefitsStep3Data,
    );
    void mutate(
      benefitKey,
      (current: any) =>
        current?.benefit
          ? { ...current, benefit: { ...current.benefit, ...patch } }
          : current,
      { revalidate: false },
    );

    // Some of this panel edits the PLAN, not the Benefit row: the typography
    // theme, the key-contact portrait and Section 1's header button. The hub
    // chrome reads all three straight off `clientData`, so they are patched
    // there as well — otherwise those sections would only change on reload.
    const planPatch: Record<string, unknown> = {};
    if (step1.typographyTheme !== undefined) {
      planPatch.typographyTheme = step1.typographyTheme;
    }
    // `""` is meaningful here — `saveBenefit` treats it as "clear the saved
    // portrait" — so patch whenever the key exists, not only when it is truthy.
    if (typeof step1.heroPortraitImage === "string") {
      planPatch.heroPortraitImage = step1.heroPortraitImage;
    }
    const headerCta = (step1 as any).headerCta;
    if (headerCta !== undefined) {
      const currentPlan = (clientDataRef.current ?? {}) as Record<string, any>;
      // `patchClientData` merges at the top level, so the blob is merged here to
      // keep the rest of `employeePortalPreview` intact.
      planPatch.employeePortalPreview = {
        ...((currentPlan.employeePortalPreview as Record<string, unknown>) ??
          {}),
        headerCta,
      };
    }
    if (Object.keys(planPatch).length) patchClientData(planPatch);
  }, [stepData, hydrated, benefitKey, mutate, patchClientData]);

  /** Write the drafted Steps 1/3 through the shared benefit save path. */
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

    savingRef.current = true;
    beginSave();
    try {
      const result = await saveBenefit(portalStepData);
      if (!result.success) {
        throw new Error(result.error || "Could not save this benefit.");
      }
      setIsDirty(false);
      finishSave();
      // The saved row is the source of truth now — drop the optimistic cache.
      if (benefitKey) await mutate(benefitKey);
    } catch (saveFailure) {
      // Keep the draft and its live preview so the advisor can retry.
      failSave(
        saveFailure instanceof Error
          ? saveFailure.message
          : "Could not save this benefit.",
      );
    } finally {
      savingRef.current = false;
    }
  }, [planId, benefitKey, mutate, beginSave, finishSave, failSave]);

  /**
   * Throw the draft away: refetch the saved Benefit row and the plan, then
   * re-seed both wizard steps. The hub repaints from the refetched sources.
   */
  const cancel = useCallback(async () => {
    if (savingRef.current) return;
    setIsDirty(false);
    resetSave();

    const fresh = await refetchPortal();
    const refreshed = benefitKey ? await mutate(benefitKey) : undefined;
    const benefit = ((refreshed as any)?.benefit ??
      data?.benefit ??
      null) as Record<string, any> | null;
    const plan = (fresh ?? clientDataRef.current ?? null) as Record<
      string,
      any
    > | null;
    hydrateFrom(benefit, plan);
  }, [benefitKey, mutate, refetchPortal, resetSave, data, hydrateFrom]);

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
      // The Save/Cancel row docks to the panel's own footer, not the portal.
      footer={
        <PortalEditorActionBar
          isDirty={isDirty}
          onSave={() => void save()}
          onCancel={() => void cancel()}
        />
      }
      // Quick Answers writes placements through its own endpoint, so a
      // revalidation is what brings them into the live hub.
      onTopicsSaved={() => {
        if (benefitKey) void mutate(benefitKey);
      }}
    />
  );
}
