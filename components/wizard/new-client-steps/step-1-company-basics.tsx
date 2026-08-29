"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Building2, Globe, Image as ImageIcon, CheckCircle2, AlertCircle, Sparkles, Upload, Plus, X, AlertTriangle, Loader2, XCircle } from "lucide-react";
import { isValidDomain, normalizeCleanDomain } from "@/lib/url-utils";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandImagesSection } from "./sections/brand-images-section";
import { BrandColorsSection } from "./sections/brand-colors-section";
import {
  CompanyBasicsData,
  CompanyLogoData,
  BrandImagesData,
  WelcomeStatementData,
} from "@/types/new-client-wizard";
import { WelcomeMissionSection } from "./sections/welcome-mission-section";
import { MISSION_STATEMENT_PRESETS } from "./constants/welcome-statements";

type CompanyBasicsSubStep = "branding" | "welcomeMission";

const defaultBrandImages: BrandImagesData = {
  header: null,
  thumbnail: null,
  secondaryBanner: null,
  favicon: null,
};
const defaultWelcomeBody = MISSION_STATEMENT_PRESETS[0]?.bodyText || "";

const normalizeCompanyBasicsData = (
  data?: Partial<CompanyBasicsData>,
): CompanyBasicsData => ({
  companyName: data?.companyName || "",
  companyWebsite: data?.companyWebsite || "",
  companyLogo: data?.companyLogo || null,
  primaryColor: data?.primaryColor || "",
  secondaryColor: data?.secondaryColor || "",
  brandImages: {
    header: data?.brandImages?.header || defaultBrandImages.header,
    thumbnail: data?.brandImages?.thumbnail || defaultBrandImages.thumbnail,
    secondaryBanner:
      data?.brandImages?.secondaryBanner || defaultBrandImages.secondaryBanner,
    favicon: data?.brandImages?.favicon || defaultBrandImages.favicon,
  },
  appointmentLink: data?.appointmentLink,
  planType: data?.planType || "",
  portalUrl: data?.portalUrl || "",
  organizationType: data?.organizationType || "Advisor Firm",
  isPrimaryColorPickerOpen: data?.isPrimaryColorPickerOpen ?? false,
  isSecondaryColorPickerOpen: data?.isSecondaryColorPickerOpen ?? false,
  missionHeadline: data?.missionHeadline || "",
  missionBody: data?.missionBody || "",
});

const getComparableCompanyBasics = (data: CompanyBasicsData) => {
  const {
    isPrimaryColorPickerOpen,
    isSecondaryColorPickerOpen,
    ...persistedData
  } = data;
  return persistedData;
};

const areCompanyBasicsEqual = (
  a?: CompanyBasicsData | null,
  b?: CompanyBasicsData | null,
) => {
  if (!a || !b) return false;
  return (
    JSON.stringify(getComparableCompanyBasics(a)) ===
    JSON.stringify(getComparableCompanyBasics(b))
  );
};

interface NewClientStep1Props {
  errorFields?: string[];
}

const normalizeWelcomeStatement = (
  data?: Partial<WelcomeStatementData>,
): WelcomeStatementData => ({
  headline: data?.headline || "",
  bodyText: data?.bodyText || "",
  isAIGenerated: data?.isAIGenerated || false,
  advisorName: data?.advisorName || "",
  advisorAvatar: data?.advisorAvatar || null,
});

export function NewClientStep1({ errorFields = [] }: NewClientStep1Props) {
  const { stepData, saveStepDataLocally, loadDraftById, currentStep, draftClientId, saveAsDraft } =
    useNewClientWizardStore();
  const normalizedInitialCompanyData = normalizeCompanyBasicsData(
    stepData.companyBasics,
  );
  const [companyData, setCompanyData] = useState<CompanyBasicsData>(
    normalizedInitialCompanyData,
  );
  const lastPersistedCompanyData = useRef<CompanyBasicsData>(
    normalizedInitialCompanyData,
  );
  const normalizedInitialWelcomeData = normalizeWelcomeStatement(
    stepData.welcomeStatement,
  );
  const [welcomeData, setWelcomeData] = useState<WelcomeStatementData>(
    normalizedInitialWelcomeData,
  );
  const [useDefaultBody, setUseDefaultBody] = useState(false);
  const [isGeneratingWelcome, setIsGeneratingWelcome] = useState(false);
  const generationOrderRef = useRef<number[]>([]);
  const remainingStatementIndexesRef = useRef<number[]>([]);
  const cyclePositionRef = useRef(0);
  const trackerInitializedRef = useRef(false);
  const missionGenerationOrderRef = useRef<number[]>([]);
  const missionRemainingIndexesRef = useRef<number[]>([]);
  const missionCyclePositionRef = useRef(0);
  const missionTrackerInitializedRef = useRef(false);
  const [missionLimitReached, setMissionLimitReached] = useState(false);
  const lastPersistedWelcomeData = useRef<WelcomeStatementData>(
    normalizedInitialWelcomeData,
  );

  // Always hold the latest local companyData so the wizard's Next handler can
  // flush it to the store right before validation.
  const companyDataRef = useRef(companyData);
  companyDataRef.current = companyData;

  // Expose a flush callback so handleNextWithScroll can persist step-1's local
  // state into the store BEFORE validating. Without this, after navigating back
  // from a later step the wizard validates a stale/incomplete store snapshot and
  // wrongly reports missing required fields. Mirrors the step-3b flush pattern.
  useEffect(() => {
    (window as any).__step1FlushFormToStore = async () => {
      let data = companyDataRef.current;
      // Fallback: if the Portal URL is empty but a company name exists, derive
      // the slug exactly like the UI's placeholder/preview do. This guarantees
      // step-1 validation never fails on a field that visually appears filled
      // (the preview shows a derived slug even when the stored value is empty).
      if (!(data.portalUrl || "").trim() && (data.companyName || "").trim()) {
        const slug = (data.companyName as string)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 30);
        if (slug) {
          data = { ...data, portalUrl: slug };
        }
      }
      const {
        isPrimaryColorPickerOpen,
        isSecondaryColorPickerOpen,
        ...dataToSave
      } = data;
      // Merge over the current store value so step-2-owned fields (heroTitle,
      // heroDescription, overlay settings, etc.) are preserved.
      const currentStore =
        useNewClientWizardStore.getState().stepData.companyBasics || {};
      await saveStepDataLocally("companyBasics", {
        ...currentStore,
        ...dataToSave,
      });
    };
    return () => {
      delete (window as any).__step1FlushFormToStore;
    };
  }, [saveStepDataLocally]);

  const companyNameRef = useRef<HTMLInputElement>(null);
  const companyWebsiteRef = useRef<HTMLInputElement>(null);
  const [logoPreviewDataUrl, setLogoPreviewDataUrl] = useState<string | undefined>(undefined);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);

  // Advisor's portal subdomain (User.subdomain) — used in the Portal URL preview
  const [userSubdomain, setUserSubdomain] = useState<string>("");

  // Loading state — keep showing the skeleton until the subdomain (and other
  // profile-derived data) has been fetched.
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Track whether the user has manually edited the Portal URL, so we stop
  // auto-populating it from the company name once they take control.
  const portalUrlManuallyEditedRef = useRef(false);

  // Portal URL availability check
  type PortalUrlAvailability = "idle" | "checking" | "available" | "taken";
  const [portalUrlAvailability, setPortalUrlAvailability] =
    useState<PortalUrlAvailability>("idle");
  const [checkedPortalUrl, setCheckedPortalUrl] = useState<string>("");
  const portalUrlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPortalUrlCheckedRef = useRef<string>("");

  useEffect(() => {
    const slug = (companyData.portalUrl || "").trim();

    if (portalUrlTimerRef.current) {
      clearTimeout(portalUrlTimerRef.current);
    }

    if (!slug || slug.length < 2) {
      setPortalUrlAvailability("idle");
      setCheckedPortalUrl("");
      lastPortalUrlCheckedRef.current = "";
      return;
    }

    if (slug === lastPortalUrlCheckedRef.current) {
      return;
    }

    portalUrlTimerRef.current = setTimeout(async () => {
      lastPortalUrlCheckedRef.current = slug;
      setPortalUrlAvailability("checking");
      setCheckedPortalUrl(slug);
      try {
        const params = new URLSearchParams({ slug });
        if (draftClientId) {
          params.set("clientId", draftClientId);
        }
        const res = await fetch(`/api/check-portal-url?${params.toString()}`);
        if (!res.ok) {
          setPortalUrlAvailability("available");
          return;
        }
        const data = await res.json();
        setPortalUrlAvailability(data.available ? "available" : "taken");
      } catch {
        setPortalUrlAvailability("available");
      }
    }, 600);

    return () => {
      if (portalUrlTimerRef.current) {
        clearTimeout(portalUrlTimerRef.current);
      }
    };
  }, [companyData.portalUrl, draftClientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const profile = await res.json();
          if (!cancelled && profile?.subdomain) {
            setUserSubdomain(profile.subdomain);
          }
        }
      } catch {
        // Non-critical — the subdomain is just for the preview
      } finally {
        // Always flip off the skeleton once the fetch resolves, so the form
        // renders even if the subdomain is missing (e.g. localhost dev).
        if (!cancelled) {
          setIsDataLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-populate the Portal URL from the company name whenever the company
  // name is present but the Portal URL is empty. The onChange handler covers
  // the case where the user types the company name; this effect covers values
  // loaded from the store / draft (e.g. after navigating back to step 1 or
  // resuming), where the field could otherwise LOOK filled (placeholder /
  // preview show a derived slug) while the underlying value is empty — which
  // made step-1 validation wrongly fail on a "filled out" form.
  useEffect(() => {
    if (portalUrlManuallyEditedRef.current) return;
    const companyName = (companyData.companyName || "").trim();
    const currentPortalUrl = (companyData.portalUrl || "").trim();
    if (!companyName || currentPortalUrl) return;
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    if (slug) {
      updateField("portalUrl", slug);
    }
  }, [companyData.companyName, companyData.portalUrl]);

  // Field-level validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const setFieldError = (field: string, error: string | null) => {
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  };

  const markTouched = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const isFieldInvalid = (field: string): boolean => {
    return errorFields.includes(field) || (touchedFields[field] && !!fieldErrors[field]);
  };

  // Validation helpers
  const validateCompanyName = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "Company name is required";
    if (trimmed.length < 2) return "Company name must be at least 2 characters";
    return null;
  };

  const validateWebsite = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null; // optional
    if (!isValidDomain(trimmed)) return "Please enter a valid domain (e.g., example.com)";
    return null;
  };

  const validatePortalUrl = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "Portal URL is required";
    if (trimmed.length < 2) return "Portal URL must be at least 2 characters";
    return null;
  };

  const validateColorRequired = (value: string, label: string): string | null => {
    if (!value || value.trim() === "") return `${label} is required`;
    return null;
  };

  // Only the branding sub-step is shown (welcomeMission moved to Step 2)
  const currentSubStep: CompanyBasicsSubStep = "branding";
  // No auto-initialization to default to avoid user frustration

  // Sync bodyText with defaultWelcomeBody when useDefaultBody is true
  useEffect(() => {
    if (
      useDefaultBody &&
      defaultWelcomeBody &&
      welcomeData.bodyText !== defaultWelcomeBody
    ) {
      updateWelcomeField("bodyText", defaultWelcomeBody);
    }
  }, [useDefaultBody, defaultWelcomeBody]);

  // Sync welcome statement with store updates
  useEffect(() => {
    const normalizedWelcomeData = normalizeWelcomeStatement(
      stepData.welcomeStatement,
    );
    lastPersistedWelcomeData.current = normalizedWelcomeData;
    setWelcomeData((prev) =>
      JSON.stringify(prev) === JSON.stringify(normalizedWelcomeData)
        ? prev
        : normalizedWelcomeData,
    );
  }, [stepData.welcomeStatement]);

  // Sync component state with store when stepData changes (e.g., after loading draft)
  useEffect(() => {
    const normalizedCompanyBasics = normalizeCompanyBasicsData(
      stepData.companyBasics,
    );
    lastPersistedCompanyData.current = normalizedCompanyBasics;
    setCompanyData((prev) => {
      if (!prev) return normalizedCompanyBasics;
      if (areCompanyBasicsEqual(prev, normalizedCompanyBasics)) {
        return prev;
      }
      return {
        ...normalizedCompanyBasics,
        isPrimaryColorPickerOpen: prev.isPrimaryColorPickerOpen,
        isSecondaryColorPickerOpen: prev.isSecondaryColorPickerOpen,
      };
    });
  }, [stepData.companyBasics]);

  useEffect(() => {
    if (trackerInitializedRef.current) return;
    const allIndexes = MISSION_STATEMENT_PRESETS.map((_, index) => index);
    const initialMatchIndex = MISSION_STATEMENT_PRESETS.findIndex(
      (statement) => statement.bodyText === (welcomeData.bodyText || ""),
    );

    if (initialMatchIndex >= 0) {
      generationOrderRef.current = [initialMatchIndex];
      remainingStatementIndexesRef.current = allIndexes.filter(
        (idx) => idx !== initialMatchIndex,
      );
    } else {
      generationOrderRef.current = [];
      remainingStatementIndexesRef.current = allIndexes;
    }
    trackerInitializedRef.current = true;
  }, [welcomeData.bodyText]);

  useEffect(() => {
    if (missionTrackerInitializedRef.current) return;
    const allIndexes = MISSION_STATEMENT_PRESETS.map((_, index) => index);
    const initialMatchIndex = MISSION_STATEMENT_PRESETS.findIndex(
      (statement) =>
        statement.bodyText === (companyData.missionBody || "") &&
        statement.headline === (companyData.missionHeadline || ""),
    );

    if (initialMatchIndex >= 0) {
      missionGenerationOrderRef.current = [initialMatchIndex];
      missionRemainingIndexesRef.current = allIndexes.filter(
        (idx) => idx !== initialMatchIndex,
      );
    } else {
      missionGenerationOrderRef.current = [];
      missionRemainingIndexesRef.current = allIndexes;
    }
    missionTrackerInitializedRef.current = true;
  }, [companyData.missionBody, companyData.missionHeadline]);

  // Save data when it changes (ignoring UI-only state)
  useEffect(() => {
    if (areCompanyBasicsEqual(lastPersistedCompanyData.current, companyData)) {
      return;
    }

    lastPersistedCompanyData.current = companyData;

    const {
      isPrimaryColorPickerOpen,
      isSecondaryColorPickerOpen,
      ...dataToSave
    } = companyData;

    saveStepDataLocally("companyBasics", dataToSave);
  }, [companyData, saveStepDataLocally]);

  // Save welcome statement locally when it changes
  useEffect(() => {
    if (
      JSON.stringify(lastPersistedWelcomeData.current) ===
      JSON.stringify(welcomeData)
    ) {
      return;
    }

    // Do not persist the auto-generated placeholder headline when the user
    // has not entered a company name — it would make hasExistingData truthy
    // on the next visit and trigger a misleading "Resuming" toast.
    if (
      !companyData.companyName.trim() &&
      welcomeData.headline === "Welcome to the <Company Name> Benefits Hub!"
    ) {
      lastPersistedWelcomeData.current = welcomeData;
      return;
    }

    lastPersistedWelcomeData.current = welcomeData;
    saveStepDataLocally("welcomeStatement", welcomeData);
  }, [welcomeData, saveStepDataLocally, companyData.companyName]);

  const getAutoWelcomeHeadline = () => {
    if (companyData.companyName.trim().length > 0) {
      return `Welcome to the ${companyData.companyName} Benefits Hub!`;
    }
    return "Welcome to the <Company Name> Benefits Hub!";
  };
  const headlineCharCount = welcomeData.headline?.length || 0;
  const bodyCharCount = welcomeData.bodyText?.length || 0;
  const isHeadlineValid = headlineCharCount <= 500;
  const isBodyValid = bodyCharCount >= 250 && bodyCharCount <= 2000;

  const updateWelcomeField = (
    field: keyof WelcomeStatementData,
    value: any,
  ) => {
    setWelcomeData((prev) => ({ ...prev, [field]: value }));
  };

  const applyPredefinedStatement = (index: number) => {
    const statement = MISSION_STATEMENT_PRESETS[index];
    if (!statement) return;
    updateWelcomeField("bodyText", statement.bodyText);
    updateWelcomeField("isAIGenerated", true);
    setUseDefaultBody(false);
  };

  const handleUseDefaultBody = (checked: boolean) => {
    setUseDefaultBody(checked);
    if (checked) {
      updateWelcomeField("bodyText", defaultWelcomeBody);
      updateWelcomeField("isAIGenerated", false);
    }
  };

  const applyMissionPreset = (index: number) => {
    const preset = MISSION_STATEMENT_PRESETS[index];
    if (!preset) return;
    handleMissionFieldChange("missionHeadline", preset.headline);
    handleMissionFieldChange("missionBody", preset.bodyText);
  };

  const handleGenerateMissionStatement = () => {
    const remaining = missionRemainingIndexesRef.current;

    if (remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      const presetIndex = remaining.splice(randomIndex, 1)[0];
      missionGenerationOrderRef.current.push(presetIndex);
      applyMissionPreset(presetIndex);

      if (missionRemainingIndexesRef.current.length === 0) {
        setMissionLimitReached(true);
      }
      return;
    }

    if (missionGenerationOrderRef.current.length === 0) {
      return;
    }

    const presetIndex =
      missionGenerationOrderRef.current[missionCyclePositionRef.current];
    missionCyclePositionRef.current =
      (missionCyclePositionRef.current + 1) %
      missionGenerationOrderRef.current.length;
    applyMissionPreset(presetIndex);
    setMissionLimitReached(true);
  };

  const handleGenerateMissionHeadline = () => {
    const remaining = missionRemainingIndexesRef.current;

    if (remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      const presetIndex = remaining[randomIndex];
      const preset = MISSION_STATEMENT_PRESETS[presetIndex];
      if (preset) {
        handleMissionFieldChange("missionHeadline", preset.headline);
      }
      return;
    }

    if (missionGenerationOrderRef.current.length > 0) {
      const presetIndex =
        missionGenerationOrderRef.current[missionCyclePositionRef.current];
      const preset = MISSION_STATEMENT_PRESETS[presetIndex];
      if (preset) {
        handleMissionFieldChange("missionHeadline", preset.headline);
      }
      missionCyclePositionRef.current =
        (missionCyclePositionRef.current + 1) %
        missionGenerationOrderRef.current.length;
    }
  };

  const handleGenerateMissionBody = () => {
    const remaining = missionRemainingIndexesRef.current;

    if (remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      const presetIndex = remaining[randomIndex];
      const preset = MISSION_STATEMENT_PRESETS[presetIndex];
      if (preset) {
        handleMissionFieldChange("missionBody", preset.bodyText);
      }
      return;
    }

    if (missionGenerationOrderRef.current.length > 0) {
      const presetIndex =
        missionGenerationOrderRef.current[missionCyclePositionRef.current];
      const preset = MISSION_STATEMENT_PRESETS[presetIndex];
      if (preset) {
        handleMissionFieldChange("missionBody", preset.bodyText);
      }
      missionCyclePositionRef.current =
        (missionCyclePositionRef.current + 1) %
        missionGenerationOrderRef.current.length;
    }
  };

  // Keep welcome title in sync with company name (non-editable)
  useEffect(() => {
    const autoHeadline = getAutoWelcomeHeadline();
    setWelcomeData((prev) =>
      prev.headline === autoHeadline
        ? prev
        : { ...prev, headline: autoHeadline },
    );
  }, [companyData.companyName]);

  const updateField = (field: keyof CompanyBasicsData, value: any) => {
    setCompanyData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (logoData: CompanyLogoData | null) => {
    // Just save the logo data directly, no second modal needed
    updateField("companyLogo", logoData);
  };

  const handleBrandImagesChange = async (brandImages: BrandImagesData) => {
    if (!draftClientId) {
      updateField("brandImages", brandImages);
      return;
    }
    const slots: { key: keyof BrandImagesData; r2Slot: "background" | "thumbnail" | "secondaryBanner" | "favicon" }[] = [
      { key: "header", r2Slot: "background" },
      { key: "thumbnail", r2Slot: "thumbnail" },
      { key: "secondaryBanner", r2Slot: "secondaryBanner" },
      { key: "favicon", r2Slot: "favicon" },
    ];
    let updated = { ...brandImages };
    for (const { key, r2Slot } of slots) {
      const img = updated[key];
      if (img?.url?.startsWith("data:")) {
        try {
          const { uploadBrandingToR2 } = await import("@/lib/branding-r2");
          const r2Key = await uploadBrandingToR2({
            dataUrlOrFile: img.url,
            fileName: img.fileName || `${r2Slot}.png`,
            clientId: draftClientId,
            slot: r2Slot,
          });
          if (r2Key) {
            updated = { ...updated, [key]: { ...img, url: r2Key } };
          }
        } catch (_) {
          // keep original
        }
      }
    }
    updateField("brandImages", updated);
  };

  const handleMissionFieldChange = (
    field: "missionHeadline" | "missionBody",
    value: string,
  ) => {
    updateField(field, value);
  };

  const handleWelcomeDescriptionChange = (value: string) => {
    if (useDefaultBody) {
      setUseDefaultBody(false);
    }
    updateWelcomeField("bodyText", value);
  };

  if (isDataLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Plan Type Skeleton */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>

        {/* Company Information Skeleton */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <Skeleton className="h-5 w-44" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Portal URL Skeleton */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        {/* Logo Skeleton */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>

        {/* Brand Colors Skeleton */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {currentSubStep === "branding" && (
        <>
          {/* Plan Type Selection */}
          <Card className="dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                <Building2 className="w-5 h-5 text-accent-blue" />
                Plan Type <span className="text-red-500">*</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Select the type of plan you&apos;re creating
              </p>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={companyData.planType || ""}
                onValueChange={(value) => updateField("planType", value)}
                className="grid gap-3"
              >
                <div
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${companyData.planType === "client"
                    ? "border-primary bg-[#23919C]/10 dark:bg-[#23919C]/20"
                    : "hover:bg-muted/50 dark:hover:bg-gray-700 dark:border-gray-600"
                    }`}
                  onClick={() => updateField("planType", "client")}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="client" id="plan-client" />
                    <div>
                      <Label
                        htmlFor="plan-client"
                        className="cursor-pointer font-medium dark:text-gray-300"
                      >
                        <p className="text-sm font-medium">Client</p>
                      </Label>
                      <div className="text-xs text-muted-foreground dark:text-gray-400">
                        Create a live Benefits Hub for an existing client
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${companyData.planType === "prospect"
                    ? "border-primary bg-[#23919C]/10 dark:bg-[#23919C]/20"
                    : "hover:bg-muted/50 dark:hover:bg-gray-700 dark:border-gray-600"
                    }`}
                  onClick={() => updateField("planType", "prospect")}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="prospect" id="plan-prospect" />
                    <div>
                      <Label
                        htmlFor="plan-prospect"
                        className="cursor-pointer font-medium dark:text-gray-300"
                      >
                        <p className="text-sm font-medium">Prospect</p>
                      </Label>
                      <div className="text-xs text-muted-foreground dark:text-gray-400">
                        Create a demo Benefits Hub for a prospective client
                      </div>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card className="dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                <Building2 className="w-5 h-5 text-accent-blue" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="dark:text-gray-300">
                    Company Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      icon={<Building2 className="h-4 w-4" />}
                      ref={companyNameRef}
                      id="companyName"
                      name="companyName"
                      data-field="companyName"
                      value={companyData.companyName}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, 65);
                        if (touchedFields["companyName"]) {
                          setFieldError("companyName", validateCompanyName(value));
                        }
                        updateField("companyName", value);
                        // Auto-populate Portal URL from company name until the user manually edits it
                        if (!portalUrlManuallyEditedRef.current) {
                          const slug = value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "-")
                            .replace(/-+/g, "-")
                            .replace(/^-+|-+$/g, "")
                            .slice(0, 30);
                          if (slug) {
                            updateField("portalUrl", slug);
                          }
                        }
                      }}
                      onBlur={() => {
                        markTouched("companyName");
                        setFieldError("companyName", validateCompanyName(companyData.companyName));
                      }}
                      placeholder="Enter company name"
                      maxLength={65}
                      required
                      destructive={isFieldInvalid("companyName")}
                    />
                    {touchedFields["companyName"] && companyData.companyName.trim() && !fieldErrors["companyName"] && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 dark:text-green-400 pointer-events-none" />
                    )}
                    <div
                      className={`absolute -top-8 right-0 flex items-center gap-2 transition-all duration-500 ease-out ${companyData.companyName.length >= 45
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-2 pointer-events-none"
                        }`}
                    >
                      <span
                        className={`text-xs transition-colors duration-300 ${companyData.companyName.length >= 65
                          ? "text-red-500 dark:text-red-400"
                          : "text-muted-foreground dark:text-gray-400"
                          }`}
                      >
                        {companyData.companyName.length}/65 characters
                      </span>
                      {companyData.companyName.length >= 65 && (
                        <Badge
                          variant="destructive"
                          className="text-xs animate-in fade-in slide-in-from-right-2 duration-500"
                        >
                          Limit reached
                        </Badge>
                      )}
                    </div>
                  </div>
                  {touchedFields["companyName"] && fieldErrors["companyName"] && (
                    <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors["companyName"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyWebsite" className="dark:text-gray-300">
                    Company Website
                    <span className="text-xs text-muted-foreground dark:text-gray-400 ml-1">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      icon={<Globe className="h-4 w-4" />}
                      ref={companyWebsiteRef}
                      id="companyWebsite"
                      name="companyWebsite"
                      data-field="companyWebsite"
                      value={companyData.companyWebsite}
                      onChange={(e) => {
                        if (touchedFields["companyWebsite"]) {
                          setFieldError("companyWebsite", validateWebsite(e.target.value));
                        }
                        updateField("companyWebsite", e.target.value);
                      }}
                      onBlur={() => {
                        markTouched("companyWebsite");
                        const value = companyData.companyWebsite?.trim() || "";
                        if (value) {
                          // Normalize: strip protocol and www.
                          const clean = normalizeCleanDomain(value);
                          if (clean !== value) {
                            updateField("companyWebsite", clean);
                          }
                        }
                        setFieldError("companyWebsite", validateWebsite(value));
                      }}
                      placeholder="example.com"
                      type="text"
                      destructive={isFieldInvalid("companyWebsite")}
                    />
                    {touchedFields["companyWebsite"] && companyData.companyWebsite?.trim() && !fieldErrors["companyWebsite"] && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 dark:text-green-400 pointer-events-none" />
                    )}
                  </div>
                  {touchedFields["companyWebsite"] && fieldErrors["companyWebsite"] && (
                    <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors["companyWebsite"]}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Portal URL */}
          <Card className="dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                <Globe className="w-5 h-5 text-accent-blue" />
                Portal URL <span className="text-red-500">*</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Customize the URL where employees will access your benefits portal.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400 bg-muted/50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
                <span className="shrink-0">https://</span>
                <span className="font-medium text-foreground dark:text-gray-200">
                  {userSubdomain || "your-org"}
                </span>
                <span className="shrink-0">.plantel.pro/new/view/</span>
                <span className="font-medium text-foreground dark:text-gray-200">
                  {companyData.portalUrl ||
                    companyData.companyName
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-")
                      .replace(/^-+|-+$/g, "") ||
                    "your-plan"}
                </span>
              </div>
              <div className="relative">
                <Input
                  id="portalUrl"
                  name="portalUrl"
                  data-field="portalUrl"
                  value={companyData.portalUrl || ""}
                  onChange={(e) => {
                    // Once the user types here, stop auto-populating from company name
                    portalUrlManuallyEditedRef.current = true;
                    const value = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-")
                      .slice(0, 30);
                    updateField("portalUrl", value);
                    if (touchedFields["portalUrl"]) {
                      setFieldError("portalUrl", validatePortalUrl(value));
                    }
                  }}
                  onBlur={() => {
                    markTouched("portalUrl");
                    setFieldError(
                      "portalUrl",
                      validatePortalUrl(companyData.portalUrl || ""),
                    );
                  }}
                  placeholder={companyData.companyName
                    ? companyData.companyName
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-")
                        .replace(/-+/g, "-")
                        .replace(/^-+|-+$/g, "")
                        .slice(0, 30)
                    : "your-plan"}
                  maxLength={30}
                  required
                  destructive={isFieldInvalid("portalUrl")}
                />
                {touchedFields["portalUrl"] &&
                  companyData.portalUrl?.trim() &&
                  !fieldErrors["portalUrl"] && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 dark:text-green-400 pointer-events-none" />
                  )}
                <div
                  className={`absolute -top-8 right-0 flex items-center gap-2 transition-all duration-500 ease-out ${(companyData.portalUrl || "").length >= 15
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-2 pointer-events-none"
                    }`}
                >
                  <span
                    className={`text-xs transition-colors duration-300 ${(companyData.portalUrl || "").length >= 30
                      ? "text-red-500 dark:text-red-400"
                      : "text-muted-foreground dark:text-gray-400"
                      }`}
                  >
                    {(companyData.portalUrl || "").length}/30 characters
                  </span>
                  {(companyData.portalUrl || "").length >= 30 && (
                    <Badge
                      variant="destructive"
                      className="text-xs animate-in fade-in slide-in-from-right-2 duration-500"
                    >
                      Limit reached
                    </Badge>
                  )}
                </div>
              </div>
              {touchedFields["portalUrl"] && fieldErrors["portalUrl"] && (
                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors["portalUrl"]}
                </p>
              )}
              {/* Portal URL availability indicator */}
              {portalUrlAvailability !== "idle" &&
                (companyData.portalUrl || "").trim().length >= 2 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {portalUrlAvailability === "checking" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Checking availability...
                        </span>
                      </>
                    ) : portalUrlAvailability === "available" ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-xs text-green-600 dark:text-green-400">
                          &ldquo;{checkedPortalUrl}&rdquo; is available
                        </span>
                      </>
                    ) : portalUrlAvailability === "taken" ? (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-xs text-red-600 dark:text-red-400">
                          &ldquo;{checkedPortalUrl}&rdquo; is already taken
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                Only lowercase letters, numbers, and hyphens allowed. Max 30 characters.
              </p>
            </CardContent>
          </Card>

          {/* Company Logo */}
          <Card className="dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                <ImageIcon className="w-5 h-5 text-accent-blue" />
                Company Logo <span className="text-red-500">*</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Upload your company logo. Recommended size: 300×250px. Accepted formats: PNG, JPG, WebP, SVG. Max file size: 15 MB.
              </p>
            </CardHeader>
            <CardContent>

              {/* UniversalImageEditorModal (controlled via isOpen/onClose) */}
              <UniversalImageEditorModal
                type="logo"
                icon={<ImageIcon className="w-4 h-4" />}
                value={companyData.companyLogo?.url || ""}
                fileName={companyData.companyLogo?.fileName || ""}
                isOpen={isLogoModalOpen}
                onClose={() => setIsLogoModalOpen(false)}
                onChange={async (value, fileName, headshotData) => {
                  const previewDataUrl: string | undefined =
                    (headshotData as any)?.previewDataUrl;
                  const previewSrc = previewDataUrl || (value?.startsWith("data:") ? value : undefined);

                  // Store the preview data URL for display
                  if (previewDataUrl) {
                    setLogoPreviewDataUrl(previewDataUrl);
                  }

                  // Note: Brand color extraction is triggered manually by the
                  // user via the "Extract Colors" button in BrandColorsSection,
                  // which uses both the logo and the company website.

                  // Save the logo data
                  const logoData: CompanyLogoData = {
                    url: value,
                    fileName: fileName,
                    fileSize: 0,
                    width: 0,
                    height: 0,
                    hasTransparency: value.includes("data:image/png") || value.includes("data:image/svg"),
                    warnings: [],
                  };
                  handleLogoChange(logoData);

                  // Close the modal after saving
                  setIsLogoModalOpen(false);
                }}
                onRemove={async () => {
                  const currentLogoUrl = companyData.companyLogo?.url;
                  if (typeof currentLogoUrl === "string" && currentLogoUrl.startsWith("org/")) {
                    await deleteFromR2(currentLogoUrl);
                  }
                  setLogoPreviewDataUrl(undefined);
                  handleLogoChange(null);
                  if (draftClientId) {
                    try {
                      await saveAsDraft({ showDuplicatePlanDialog: false });
                    } catch {
                      /* non-blocking */
                    }
                  }
                  setIsLogoModalOpen(false);
                }}
                placeholder="Upload Logo"
                destructive={errorFields.includes("companyLogo")}
              />
            </CardContent>
          </Card>

          {/* Brand Colors */}
          <BrandColorsSection
            primaryColor={companyData.primaryColor}
            secondaryColor={companyData.secondaryColor}
            onPrimaryChange={(color) => {
              updateField("primaryColor", color);
              markTouched("primaryColor");
              setFieldError("primaryColor", validateColorRequired(color, "Primary color"));
            }}
            onSecondaryChange={(color) => {
              updateField("secondaryColor", color);
              markTouched("secondaryColor");
              setFieldError("secondaryColor", validateColorRequired(color, "Secondary color"));
            }}
            isPrimaryPickerOpen={companyData.isPrimaryColorPickerOpen || false}
            isSecondaryPickerOpen={companyData.isSecondaryColorPickerOpen || false}
            onPrimaryPickerOpenChange={(open) =>
              updateField("isPrimaryColorPickerOpen", open || false)
            }
            onSecondaryPickerOpenChange={(open) =>
              updateField("isSecondaryColorPickerOpen", open || false)
            }
            logoDataUrl={
              logoPreviewDataUrl ||
              (companyData.companyLogo?.url?.startsWith("data:")
                ? companyData.companyLogo.url
                : undefined)
            }
            websiteUrl={companyData.companyWebsite}
            organizationName={companyData.companyName}
            errorFields={errorFields}
            touchedFields={touchedFields}
            fieldErrors={fieldErrors}
          />

          {/* Brand Images */}
          <BrandImagesSection
            brandImages={companyData.brandImages}
            onBrandImagesChange={handleBrandImagesChange}
            errorFields={errorFields}
            logoUrl={companyData.companyLogo?.url}
            companyName={companyData.companyName}
          />
        </>
      )}
    </div>
  );
}
