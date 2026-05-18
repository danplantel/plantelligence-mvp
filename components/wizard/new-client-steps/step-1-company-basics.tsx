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
import { Building2, Palette, Globe, Image as ImageIcon } from "lucide-react";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import { BrandImagesSection } from "./sections/brand-images-section";
import {
  CompanyBasicsData,
  CompanyLogoData,
  BrandImagesData,
  BrandImageData,
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

  // Convert BrandImageData to CompanyLogoData
  const convertBrandImageToLogo = (
    brandImage: BrandImageData | null,
  ): CompanyLogoData | null => {
    if (!brandImage) return null;
    return {
      url: brandImage.url, // Cropped image for UI
      originalUrl: brandImage.originalUrl || brandImage.cropData?.originalImage,
      fileName: brandImage.fileName,
      fileSize: brandImage.fileSize,
      width: brandImage.width,
      height: brandImage.height,
      hasTransparency:
        brandImage.url.includes("data:image/png") ||
        brandImage.url.includes("data:image/svg"),
      warnings: brandImage.warnings || [],
      cropData: brandImage.cropData, // Preserve cropData with originalImage
    };
  };

  // Convert CompanyLogoData to BrandImageData
  const convertLogoToBrandImage = (
    logoData: CompanyLogoData | null,
  ): BrandImageData | undefined => {
    if (!logoData) return undefined;

    const brandImage: BrandImageData = {
      url: logoData.url, // Cropped image for UI
      originalUrl: logoData.originalUrl || logoData.cropData?.originalImage, // Original image for reset
      fileName: logoData.fileName,
      fileSize: logoData.fileSize,
      width: logoData.width,
      height: logoData.height,
      recommendedSize: "900×900 px",
      status:
        logoData.warnings && logoData.warnings.length > 0 ? "warning" : "ok",
      warnings: logoData.warnings || [],
      cropData: logoData.cropData, // Preserve cropData with originalImage
    };

    return brandImage;
  };

  const handleLogoChange = (logoData: CompanyLogoData | null) => {
    // Just save the logo data directly, no second modal needed
    updateField("companyLogo", logoData);
  };

  const handleLogoImageChange = async (imageData: BrandImageData) => {
    const logoData = convertBrandImageToLogo(imageData);
    const isDataUrl = imageData.url?.startsWith("data:");
    let clientId = draftClientId;
    if (!clientId && isDataUrl && saveAsDraft) {
      try {
        // Do not open duplicate-name dialog here — user resolves name on Next → step 2.
        await saveAsDraft({ showDuplicatePlanDialog: false });
        clientId = useNewClientWizardStore.getState().draftClientId ?? undefined;
      } catch (_) {
        // continue without R2
      }
    }
    if (clientId && isDataUrl) {
      try {
        const { uploadBrandingToR2 } = await import("@/lib/branding-r2");
        const key = await uploadBrandingToR2({
          dataUrlOrFile: imageData.url,
          fileName: imageData.fileName || "logo.png",
          clientId,
          slot: "logo",
        });
        if (key && logoData) {
          handleLogoChange({
            ...logoData,
            url: key,
            fileName: logoData.fileName ?? imageData.fileName ?? "logo.png",
          } as CompanyLogoData);
          return;
        }
      } catch (_) {
        // fallback to base64
      }
    }
    handleLogoChange(logoData);
  };

  const handleLogoImageRemove = async () => {
    const currentLogoUrl = companyData.companyLogo?.url;
    if (typeof currentLogoUrl === "string" && currentLogoUrl.startsWith("org/")) {
      const { deleteFromR2 } = await import("@/lib/upload-to-r2");
      await deleteFromR2(currentLogoUrl);
    }
    handleLogoChange(null);
    // Only sync to server when this wizard is tied to a draft Client row. Without
    // draftClientId, save-draft treats the name like a new plan and can report duplicate name if it
    // matches an Active plan — avoid that noise on Remove (Next/save will persist).
    if (draftClientId) {
      try {
        await saveAsDraft({ showDuplicatePlanDialog: false });
      } catch {
        /* non-blocking */
      }
    }
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
    <div className="space-y-6">
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
                        updateField("companyName", value);
                      }}
                      onBlur={() => { }}
                      placeholder="Enter company name"
                      maxLength={65}
                      required
                      destructive={errorFields.includes("companyName")}
                    />
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyWebsite">Company Website</Label>
                  <Input
                    icon={<Globe className="h-4 w-4" />}
                    ref={companyWebsiteRef}
                    id="companyWebsite"
                    name="companyWebsite"
                    data-field="companyWebsite"
                    value={companyData.companyWebsite}
                    onChange={(e) => {
                      updateField("companyWebsite", e.target.value);
                    }}
                    onBlur={() => { }}
                    placeholder="example.com"
                    type="url"
                    destructive={errorFields.includes("companyWebsite")}
                  />
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
              <BrandImageUpload
                slotKey="companyLogo"
                slot={{
                  title: "Company Logo",
                  description: "",
                  recommendedSize: "900×900 px",
                  accept: ".svg,.png,.jpg,.jpeg",
                  required: true,
                  previewAspectRatio: 1,
                  previewLabel: "Logo preview",
                  defaultPhoteButton: false,
                }}
                currentImage={convertLogoToBrandImage(companyData.companyLogo)}
                onImageChange={handleLogoImageChange}
                onImageRemove={handleLogoImageRemove}
                hideButtons={true}
                useUniversalModal={true}
                universalModalType="normalizer"
                maxFileSize={100}
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
                portal.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Color */}
                <div className="space-y-3 relative">
                  <Label>Primary Color</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateField(
                            "isPrimaryColorPickerOpen",
                            !companyData.isPrimaryColorPickerOpen,
                          )
                        }
                        className="h-10 px-3"
                      >
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ background: companyData.primaryColor }}
                        />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {companyData.primaryColor}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {[
                        { name: "Navy", value: "#1F3A60" },
                        { name: "Dark Gray", value: "#374151" },
                        { name: "Black", value: "#000000" },
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          className={`w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm transition-transform hover:scale-110 ${companyData.primaryColor === preset.value
                              ? "ring-2 ring-accent-blue ring-offset-1"
                              : ""
                            }`}
                          style={{ backgroundColor: preset.value }}
                          title={preset.name}
                          onClick={() => updateField("primaryColor", preset.value)}
                        />
                      ))}
                    </div>
                  </div>
                  <ColorPicker
                    value={companyData.primaryColor}
                    onChange={(color) => updateField("primaryColor", color)}
                    isOpen={companyData.isPrimaryColorPickerOpen || false}
                    onOpenChange={(open) =>
                      updateField("isPrimaryColorPickerOpen", open || false)
                    }
                  />
                </div>

                {/* Secondary Color */}
                <div className="space-y-3 relative">
                  <Label>Secondary Color</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateField(
                            "isSecondaryColorPickerOpen",
                            !companyData.isSecondaryColorPickerOpen,
                          )
                        }
                        className="h-10 px-3"
                      >
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ background: companyData.secondaryColor }}
                        />
                      </Button>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{companyData.secondaryColor}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {[
                        { name: "Navy", value: "#1F3A60" },
                        { name: "Dark Gray", value: "#374151" },
                        { name: "Black", value: "#000000" },
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          className={`w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm transition-transform hover:scale-110 ${companyData.secondaryColor === preset.value
                              ? "ring-2 ring-accent-blue ring-offset-1"
                              : ""
                            }`}
                          style={{ backgroundColor: preset.value }}
                          title={preset.name}
                          onClick={() => updateField("secondaryColor", preset.value)}
                        />
                      ))}
                    </div>
                  </div>
                  <ColorPicker
                    value={companyData.secondaryColor}
                    onChange={(color) => updateField("secondaryColor", color)}
                    isOpen={companyData.isSecondaryColorPickerOpen || false}
                    onOpenChange={(open) =>
                      updateField("isSecondaryColorPickerOpen", open || false)
                    }
                  />
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
