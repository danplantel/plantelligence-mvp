"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ColorPicker } from "@/components/ui/color-picker";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Building2, Palette, Globe, Image as ImageIcon, CheckCircle2, AlertCircle, Sparkles, Upload, Plus, X, AlertTriangle } from "lucide-react";
import { isValidDomain, normalizeCleanDomain } from "@/lib/url-utils";
import { extractColorsFromImage } from "@/lib/extract-colors-from-image";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import { BrandImagesSection } from "./sections/brand-images-section";
import {
  CompanyBasicsData,
  CompanyLogoData,
  BrandImagesData,
  WelcomeStatementData,
} from "@/types/new-client-wizard";
import { WelcomeMissionSection } from "./sections/welcome-mission-section";
import {
  WELCOME_BODY_PRESETS,
  MISSION_STATEMENT_PRESETS,
} from "./constants/welcome-statements";

type CompanyBasicsSubStep = "branding" | "welcomeMission";

const defaultBrandImages: BrandImagesData = {
  header: null,
  thumbnail: null,
  secondaryBanner: null,
  favicon: null,
};
const defaultWelcomeBody = WELCOME_BODY_PRESETS[0]?.bodyText || "";

const normalizeCompanyBasicsData = (
  data?: Partial<CompanyBasicsData>,
): CompanyBasicsData => ({
  companyName: data?.companyName || "",
  companyWebsite: data?.companyWebsite || "",
  companyLogo: data?.companyLogo || null,
  primaryColor: data?.primaryColor || "#1F3A60",
  secondaryColor: data?.secondaryColor || "#6B7280",
  brandImages: {
    header: data?.brandImages?.header || defaultBrandImages.header,
    thumbnail: data?.brandImages?.thumbnail || defaultBrandImages.thumbnail,
    secondaryBanner:
      data?.brandImages?.secondaryBanner || defaultBrandImages.secondaryBanner,
    favicon: data?.brandImages?.favicon || defaultBrandImages.favicon,
  },
  appointmentLink: data?.appointmentLink,
  planType: data?.planType || "client",
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

  const companyNameRef = useRef<HTMLInputElement>(null);
  const companyWebsiteRef = useRef<HTMLInputElement>(null);
  const [logoPreviewDataUrl, setLogoPreviewDataUrl] = useState<string | undefined>(undefined);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);

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

  const validateHexColor = (value: string, label: string): string | null => {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!value || !hexColorRegex.test(value)) return `${label} must be a valid hex color (e.g., #1F3A60)`;
    return null;
  };

  const validateLogo = (logo: CompanyLogoData | null): string | null => {
    if (!logo || !logo.url) return null; // optional in v2
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
    const allIndexes = WELCOME_BODY_PRESETS.map((_, index) => index);
    const initialMatchIndex = WELCOME_BODY_PRESETS.findIndex(
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

    lastPersistedWelcomeData.current = welcomeData;
    saveStepDataLocally("welcomeStatement", welcomeData);
  }, [welcomeData, saveStepDataLocally]);

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
    const statement = WELCOME_BODY_PRESETS[index];
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {currentSubStep === "branding" && (
        <>
          {/* Plan Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent-blue" />
                Plan Type
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Select the type of plan you&apos;re creating
              </p>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={companyData.planType || "client"}
                onValueChange={(value) => updateField("planType", value)}
                className="grid gap-3"
              >
                <div
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${companyData.planType === "client" || !companyData.planType
                    ? "border-primary bg-[#23919C]/10"
                    : "hover:bg-muted/50"
                    }`}
                  onClick={() => updateField("planType", "client")}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="client" id="plan-client" />
                    <div>
                      <Label
                        htmlFor="plan-client"
                        className="cursor-pointer font-medium"
                      >
                        <p className="text-sm font-medium">Client</p>
                      </Label>
                      <div className="text-xs text-muted-foreground">
                        Active plan for real clients
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${companyData.planType === "prospect"
                    ? "border-primary bg-[#23919C]/10"
                    : "hover:bg-muted/50"
                    }`}
                  onClick={() => updateField("planType", "prospect")}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="prospect" id="plan-prospect" />
                    <div>
                      <Label
                        htmlFor="plan-prospect"
                        className="cursor-pointer font-medium"
                      >
                        <p className="text-sm font-medium">Prospect</p>
                      </Label>
                      <div className="text-xs text-muted-foreground">
                        Draft plan for demos & presentations
                      </div>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent-blue" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">
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
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none" />
                    )}
                    <div
                      className={`absolute -top-8 right-0 flex items-center gap-2 transition-all duration-500 ease-out ${companyData.companyName.length >= 45
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-2 pointer-events-none"
                        }`}
                    >
                      <span
                        className={`text-xs transition-colors duration-300 ${companyData.companyName.length >= 65
                          ? "text-red-500"
                          : "text-muted-foreground"
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
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors["companyName"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyWebsite">
                    Company Website
                    <span className="text-xs text-muted-foreground ml-1">(optional)</span>
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
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none" />
                    )}
                  </div>
                  {touchedFields["companyWebsite"] && fieldErrors["companyWebsite"] && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors["companyWebsite"]}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-accent-blue" />
                Company Logo
              </CardTitle>
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

                  // Extract colors from the logo preview
                  if (previewSrc) {
                    try {
                      const colors = await extractColorsFromImage(previewSrc);
                      updateField("primaryColor", colors.primary);
                      updateField("secondaryColor", colors.secondary);
                    } catch (_) {
                      // Fallback to defaults if extraction fails
                    }
                  }

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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-accent-blue" />
                Brand Colors
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose your primary and secondary brand colors for the employee
                portal. Colors can be auto-extracted from your uploaded logo.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Color */}
                <div className="space-y-3 relative">
                  <Label>Primary Color <span className="text-red-500">*</span></Label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        updateField(
                          "isPrimaryColorPickerOpen",
                          !companyData.isPrimaryColorPickerOpen,
                        );
                        if (!companyData.isPrimaryColorPickerOpen && companyData.isSecondaryColorPickerOpen) {
                          updateField("isSecondaryColorPickerOpen", false);
                        }
                      }}
                      className={`w-9 h-9 border rounded cursor-pointer flex items-center justify-center ${isFieldInvalid("primaryColor") ? "border-red-500" : "border-gray-300"}`}
                      style={{ background: companyData.primaryColor }}
                    >
                      <div className="w-4 h-4 rounded border border-white/20" />
                    </button>
                    <Input
                      icon={<Palette className="h-4 w-4" />}
                      type="text"
                      value={companyData.primaryColor}
                      onChange={(e) => {
                        updateField("primaryColor", e.target.value);
                        if (touchedFields["primaryColor"]) {
                          setFieldError("primaryColor", validateHexColor(e.target.value, "Primary color"));
                        }
                      }}
                      onBlur={() => {
                        markTouched("primaryColor");
                        setFieldError("primaryColor", validateHexColor(companyData.primaryColor, "Primary color"));
                      }}
                      placeholder="#1F3A60"
                      className="flex-1"
                      destructive={isFieldInvalid("primaryColor")}
                    />
                    {touchedFields["primaryColor"] && !fieldErrors["primaryColor"] && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    )}
                  </div>
                  <ColorPicker
                    value={companyData.primaryColor}
                    onChange={(color) => {
                      updateField("primaryColor", color);
                      if (touchedFields["primaryColor"]) {
                        setFieldError("primaryColor", validateHexColor(color, "Primary color"));
                      }
                    }}
                    isOpen={companyData.isPrimaryColorPickerOpen || false}
                    onOpenChange={(open) => {
                      if (!open && touchedFields["primaryColor"]) {
                        setFieldError("primaryColor", validateHexColor(companyData.primaryColor, "Primary color"));
                      }
                      updateField("isPrimaryColorPickerOpen", open || false);
                    }}
                    title="Primary Color"
                  />
                  {touchedFields["primaryColor"] && fieldErrors["primaryColor"] && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors["primaryColor"]}
                    </p>
                  )}
                </div>

                {/* Secondary Color */}
                <div className="space-y-3 relative">
                  <Label>Secondary Color <span className="text-red-500">*</span></Label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        updateField(
                          "isSecondaryColorPickerOpen",
                          !companyData.isSecondaryColorPickerOpen,
                        );
                        if (!companyData.isSecondaryColorPickerOpen && companyData.isPrimaryColorPickerOpen) {
                          updateField("isPrimaryColorPickerOpen", false);
                        }
                      }}
                      className={`w-9 h-9 border rounded cursor-pointer flex items-center justify-center ${isFieldInvalid("secondaryColor") ? "border-red-500" : "border-gray-300"}`}
                      style={{ background: companyData.secondaryColor }}
                    >
                      <div className="w-4 h-4 rounded border border-white/20" />
                    </button>
                    <Input
                      icon={<Palette className="h-4 w-4" />}
                      type="text"
                      value={companyData.secondaryColor}
                      onChange={(e) => {
                        updateField("secondaryColor", e.target.value);
                        if (touchedFields["secondaryColor"]) {
                          setFieldError("secondaryColor", validateHexColor(e.target.value, "Secondary color"));
                        }
                      }}
                      onBlur={() => {
                        markTouched("secondaryColor");
                        setFieldError("secondaryColor", validateHexColor(companyData.secondaryColor, "Secondary color"));
                      }}
                      placeholder="#4A90E2"
                      className="flex-1"
                      destructive={isFieldInvalid("secondaryColor")}
                    />
                    {touchedFields["secondaryColor"] && !fieldErrors["secondaryColor"] && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    )}
                  </div>
                  <ColorPicker
                    value={companyData.secondaryColor}
                    onChange={(color) => {
                      updateField("secondaryColor", color);
                      if (touchedFields["secondaryColor"]) {
                        setFieldError("secondaryColor", validateHexColor(color, "Secondary color"));
                      }
                    }}
                    isOpen={companyData.isSecondaryColorPickerOpen || false}
                    onOpenChange={(open) => {
                      if (!open && touchedFields["secondaryColor"]) {
                        setFieldError("secondaryColor", validateHexColor(companyData.secondaryColor, "Secondary color"));
                      }
                      updateField("isSecondaryColorPickerOpen", open || false);
                    }}
                    title="Secondary Color"
                  />
                  {touchedFields["secondaryColor"] && fieldErrors["secondaryColor"] && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors["secondaryColor"]}
                    </p>
                  )}
                </div>
              </div>

              {/* Color Preview */}
              <div className="mt-4 p-4 border rounded-lg">
                <h4 className="text-sm font-medium mb-2">Color Preview</h4>
                <div className="flex gap-2">
                  <div
                    className="w-8 h-8 rounded border"
                    style={{ background: companyData.primaryColor }}
                    title="Primary Color"
                  />
                  <div
                    className="w-8 h-8 rounded border"
                    style={{ background: companyData.secondaryColor }}
                    title="Secondary Color"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Brand Images */}
          <BrandImagesSection
            brandImages={companyData.brandImages}
            onBrandImagesChange={handleBrandImagesChange}
            errorFields={errorFields}
          />
        </>
      )}
    </div>
  );
}
