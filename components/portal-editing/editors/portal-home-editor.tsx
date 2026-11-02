"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { usePlanPreviewEditorSections } from "@/components/wizard/new-client-steps/sections/components/plan-preview-editor-sections";
import { PortalEditorShell } from "@/components/portal-editing/portal-editor-shell";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { MISSION_STATEMENT_PRESETS } from "@/components/wizard/new-client-steps/constants/welcome-statements";
import { HERO_RECOMMENDED_SIZE_LABEL } from "@/components/wizard/new-client-steps/sections/utils/hero-utils";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  normalizeTypographyThemeId,
  type TypographyThemeId,
} from "@/lib/typography-themes";
import { readPortalContacts, resolvePortalPrimaryContact } from "@/lib/portal-primary-contact";
import type {
  BrandImageData,
  BrandImagesData,
  CompanyBasicsData,
  CompanyLogoData,
} from "@/types/new-client-wizard";

const DEFAULT_WELCOME_MESSAGE =
  MISSION_STATEMENT_PRESETS[0]?.bodyText ||
  "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";

const DEFAULT_MISSION_BODY =
  MISSION_STATEMENT_PRESETS[0]?.bodyText ||
  "When people are supported, great things happen. This hub was created to help you understand and take advantage of the opportunities available to you as a team member. From everyday resources to long-term planning tools, everything you need is right here.";

/** Turn a legacy URL/name pair into the BrandImageData shape the cards read. */
function brandImageFromLegacy(
  url?: string | null,
  fileName?: string | null,
  recommendedSize = "",
): BrandImageData | null {
  if (!url) return null;
  return {
    url,
    fileName: fileName ?? "",
    fileSize: 0,
    width: 0,
    height: 0,
    recommendedSize,
    status: "ok",
    warnings: [],
  };
}

/** Map the portal payload onto the same `CompanyBasicsData` the Step 2 panel uses. */
function companyFromClient(
  clientData: Record<string, any> | null,
): CompanyBasicsData {
  const rawBrandImages = (clientData?.brandImages ?? {}) as Record<string, any>;
  const logoUrl =
    typeof clientData?.companyLogo === "string" ? clientData.companyLogo : "";

  const brandImages: BrandImagesData = {
    header:
      rawBrandImages.header ??
      brandImageFromLegacy(
        clientData?.backgroundImg,
        clientData?.backgroundImgName,
        HERO_RECOMMENDED_SIZE_LABEL,
      ),
    thumbnail:
      rawBrandImages.thumbnail ??
      brandImageFromLegacy(
        clientData?.thumbnailImg,
        clientData?.thumbnailImgName,
      ),
    secondaryBanner:
      rawBrandImages.secondaryBanner ??
      brandImageFromLegacy(
        clientData?.secondaryBannerImg,
        clientData?.secondaryBannerImgName,
      ),
    favicon: rawBrandImages.favicon ?? null,
    employeeResourcesHero: rawBrandImages.employeeResourcesHero ?? null,
  };

  return {
    companyName: String(clientData?.companyName ?? ""),
    companyWebsite: String(clientData?.companyWebsite ?? ""),
    companyLogo: logoUrl
      ? {
          url: logoUrl,
          fileName: String(clientData?.logoFileName ?? ""),
          fileSize: 0,
          width: 0,
          height: 0,
          hasTransparency:
            logoUrl.includes("data:image/png") ||
            logoUrl.includes("data:image/svg"),
          warnings: [],
        }
      : null,
    primaryColor: String(clientData?.brandColor ?? "#1F3A60"),
    secondaryColor: String(clientData?.secondaryColor ?? "#6B7280"),
    typographyTheme: normalizeTypographyThemeId(
      clientData?.typographyTheme,
    ) as TypographyThemeId,
    brandImages,
    appointmentLink: String(clientData?.appointmentLink ?? ""),
    heroTitle: String(clientData?.heroTitle ?? ""),
    heroDescription: String(clientData?.heroDescription ?? ""),
    missionHeadline: String(clientData?.missionHeadline ?? ""),
    missionBody: String(clientData?.missionBody ?? ""),
    heroOverlayOpacity: clientData?.heroOverlayOpacity,
    heroBackgroundOpacity: clientData?.heroBackgroundOpacity,
    heroContainerOpacity: clientData?.heroContainerOpacity,
    heroContainerBackgroundOpacity:
      clientData?.heroContainerBackgroundOpacity,
    heroContainerBlockOpacity: clientData?.heroContainerBlockOpacity,
    heroCompanyNameColor: clientData?.heroCompanyNameColor,
    heroContainerInverted: clientData?.heroContainerInverted ?? false,
    heroBackgroundInverted: clientData?.heroBackgroundInverted ?? false,
    heroUseGradient: clientData?.heroUseGradient ?? false,
    desktopHeroBackgroundPosition:
      clientData?.desktopHeroBackgroundPosition,
    mobileHeroBackgroundPosition:
      clientData?.mobileHeroBackgroundPosition,
    heroPortraitImage: String(clientData?.heroPortraitImage ?? ""),
  };
}

/** Fields the live portal reads directly — patched optimistically while typing. */
function clientPatchForField(
  field: string,
  value: any,
): Record<string, unknown> {
  if (field === "primaryColor") return { brandColor: value };

  if (field === "brandImages") {
    const images = (value ?? {}) as BrandImagesData;
    return {
      brandImages: images,
      backgroundImg: images.header?.url ?? "",
      backgroundImgName: images.header?.fileName ?? "",
      thumbnailImg: images.thumbnail?.url ?? "",
      thumbnailImgName: images.thumbnail?.fileName ?? "",
      secondaryBannerImg: images.secondaryBanner?.url ?? "",
      secondaryBannerImgName: images.secondaryBanner?.fileName ?? "",
    };
  }

  return { [field]: value };
}

/** The PUT payload for a single field. The route merges narrow payloads. */
function payloadForField(
  field: string,
  value: any,
): Record<string, unknown> {
  if (field === "primaryColor") return { brandColor: value };
  return { [field]: value };
}

/**
 * Portal Home editor.
 *
 * Renders the exact same Editing Panel sections as Create Plan Step 2 and Edit
 * Client's Preview tab (`usePlanPreviewEditorSections`) against the plan's live
 * portal data. Every change patches the portal context immediately, so the page
 * beside the panel repaints at once; the PUT is debounced and the saved row
 * remains the source of truth.
 */
export function PortalHomeEditor() {
  const { clientData } = useClientPortal();
  const {
    planId,
    beginSave,
    finishSave,
    failSave,
    saveState,
    saveError,
    patchClientData,
    refetchPortal,
  } = usePortalEditing();

  const [companyData, setCompanyData] = useState<CompanyBasicsData>(() =>
    companyFromClient(clientData as Record<string, any> | null),
  );
  const [useDefaultWelcomeMessage, setUseDefaultWelcomeMessage] =
    useState(false);
  const [useDefaultBody, setUseDefaultBody] = useState(false);
  const [revision, setRevision] = useState(0);

  const headlineRef = useRef<HTMLInputElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);

  // Pending save state. `pendingRef` merges every field touched since the last
  // successful PUT; `versionRef` prevents an in-flight save from clearing edits
  // made while it was running.
  const pendingRef = useRef<Record<string, any>>({});
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const [saveTick, setSaveTick] = useState(0);

  // Re-seed the local editor from the saved plan on first mount (and after a
  // failed save refetch). Optimistic patches this editor made keep the same
  // hydration key, so typing is never reset.
  const hydrationKey = `${clientData?.id ?? ""}:${revision}`;
  const hydratedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!clientData) return;
    if (hydratedKeyRef.current === hydrationKey) return;
    hydratedKeyRef.current = hydrationKey;
    setCompanyData(companyFromClient(clientData as Record<string, any>));
    setUseDefaultWelcomeMessage(
      !clientData.heroDescription ||
        clientData.heroDescription === DEFAULT_WELCOME_MESSAGE,
    );
    setUseDefaultBody(
      !clientData.missionBody ||
        clientData.missionBody === DEFAULT_MISSION_BODY,
    );
  }, [clientData, hydrationKey]);

  const enqueueSave = useCallback((fields: Record<string, any>) => {
    pendingRef.current = { ...pendingRef.current, ...fields };
    versionRef.current += 1;
    dirtyRef.current = true;
    setSaveTick((tick) => tick + 1);
  }, []);

  const updateField = useCallback(
    (field: string, value: any) => {
      setCompanyData(
        (previous) => ({ ...previous, [field]: value }) as CompanyBasicsData,
      );
      patchClientData(clientPatchForField(field, value));
      enqueueSave(payloadForField(field, value));
    },
    [patchClientData, enqueueSave],
  );

  const handleLogoChange = useCallback(
    (logoData: CompanyLogoData | null) => {
      setCompanyData((previous) => ({ ...previous, companyLogo: logoData }));
      patchClientData({
        companyLogo: logoData?.url ?? "",
        logoFileName: logoData?.fileName ?? "",
      });
      enqueueSave({ companyLogo: logoData });
    },
    [patchClientData, enqueueSave],
  );

  const handleBrandImagesChange = useCallback(
    (next: BrandImagesData) => {
      updateField("brandImages", next);
    },
    [updateField],
  );

  const savingRef = useRef(false);
  const save = useCallback(async () => {
    if (!planId || savingRef.current) return;
    const payload = pendingRef.current;
    const version = versionRef.current;
    if (!Object.keys(payload).length) return;

    savingRef.current = true;
    beginSave();
    try {
      const response = await fetch(`/api/clients/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Could not save this page.");
      }
      // Only clear what this request actually sent. Edits made while it was in
      // flight stay queued for the next save.
      if (versionRef.current === version) {
        pendingRef.current = {};
      }
      finishSave();
    } catch (error) {
      pendingRef.current = {};
      failSave(
        error instanceof Error ? error.message : "Could not save this page.",
      );
      // The server is the source of truth — pull the rejected values back and
      // re-seed the panel from them.
      await refetchPortal();
      setRevision((value) => value + 1);
    } finally {
      savingRef.current = false;
      // A debounce that fired mid-save returned early; flush what is still queued.
      if (Object.keys(pendingRef.current).length > 0) {
        dirtyRef.current = true;
        setSaveTick((tick) => tick + 1);
      }
    }
  }, [planId, beginSave, finishSave, failSave, refetchPortal]);

  // Debounced autosave. The first render is not dirty, so opening the panel never
  // writes a no-op update.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      dirtyRef.current = false;
      void save();
    }, 700);
    return () => clearTimeout(timer);
  }, [saveTick, save]);

  const missionHeadline = companyData.missionHeadline ?? "";
  const missionBody = companyData.missionBody ?? "";
  const headlineCharCount = missionHeadline.length;
  const bodyCharCount = missionBody.length;

  const handleGenerateMissionHeadline = useCallback(() => {
    const preset =
      MISSION_STATEMENT_PRESETS[
        Math.floor(Math.random() * MISSION_STATEMENT_PRESETS.length)
      ];
    if (preset) updateField("missionHeadline", preset.headline);
  }, [updateField]);

  const handleGenerateMissionBody = useCallback(() => {
    const preset =
      MISSION_STATEMENT_PRESETS[
        Math.floor(Math.random() * MISSION_STATEMENT_PRESETS.length)
      ];
    if (preset) {
      updateField("missionBody", preset.bodyText);
      setUseDefaultBody(false);
    }
  }, [updateField]);

  const handleUseDefaultBody = useCallback(
    (checked: boolean) => {
      setUseDefaultBody(checked);
      if (checked) updateField("missionBody", DEFAULT_MISSION_BODY);
    },
    [updateField],
  );

  const keyContacts = readPortalContacts(clientData?.keyContacts);
  const keyContactHeadshot = String(
    resolvePortalPrimaryContact(keyContacts)?.headshot || "",
  );

  const { sections, modals } = usePlanPreviewEditorSections({
    companyData,
    onCompanyDataChange: updateField,
    onLogoChange: handleLogoChange,
    defaultWelcomeMessage: DEFAULT_WELCOME_MESSAGE,
    useDefaultWelcomeMessage,
    setUseDefaultWelcomeMessage,
    clientId: clientData?.id,
    keyContactHeadshot,
    // The Landing page has no Key Contact Image override card.
    showKeyContactImage: false,
    missionHeadline,
    missionBody,
    defaultBodyText: DEFAULT_MISSION_BODY,
    useDefaultBody,
    headlineRef,
    bodyTextRef,
    handleHeadlineChange: (value) => updateField("missionHeadline", value),
    handleBodyChange: (value) => updateField("missionBody", value),
    handleUseDefaultBody,
    handleGenerateMissionHeadline,
    handleGenerateMissionBody,
    headlineCharCount,
    bodyCharCount,
    isHeadlineValid: headlineCharCount <= 60,
    isBodyValid: bodyCharCount >= 250 && bodyCharCount <= 2000,
    errorFields: [],
    onBrandImagesChange: handleBrandImagesChange,
    preferCompanyDataForOverlay: true,
  });

  const footer =
    saveState === "saving" ? (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    ) : saveState === "error" ? (
      <span className="text-xs text-red-500">
        {saveError || "Could not save this page."}
      </span>
    ) : undefined;

  return (
    <>
      <PortalEditorShell
        sections={sections}
        footer={footer}
        eyebrow="Plan Branding & Messaging"
        title="Editing Panel"
        headerBadge={
          companyData.companyName.trim() ? (
            <span className="inline-flex items-center rounded-md bg-accent-blue/10 px-2 py-0.5 text-xs font-semibold text-accent-blue">
              {companyData.companyName}
            </span>
          ) : undefined
        }
      />
      {modals}
    </>
  );
}
