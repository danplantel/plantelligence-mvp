"use client";

import { useState, useEffect, useRef } from "react";
import { toR2BrandingKey } from "@/lib/branding-image-url";
import type { BrandImagesData } from "@/types/new-client-wizard";

/**
 * Module-level cache for preview DataURLs keyed by R2 object key.
 * Survives React component unmount/remount within the same page load,
 * so navigating away from step 3 and back shows the logo/background
 * preview immediately without waiting for the async R2 proxy fetch.
 *
 * The Zustand store explicitly strips base64 data from persistence
 * (removeBase64Data in onboarding-wizard-store.ts), so we cannot
 * rely on the store for this — module scope is the right level.
 */
const previewDataUrlCache = new Map<string, string>();

function cachePreviewDataUrl(r2Key: string | null | undefined, dataUrl: string): void {
  // Store under the canonical R2 key so lookups via getCachedPreviewDataUrl()
  // (which normalizes with toR2BrandingKey) always hit, regardless of whether the
  // stored value has a leading slash/BOM or is a full URL.
  const canonical = toR2BrandingKey(r2Key);
  if (canonical && dataUrl.startsWith("data:")) {
    previewDataUrlCache.set(canonical, dataUrl);
  }
}

function getCachedPreviewDataUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const r2Key = toR2BrandingKey(value);
  return r2Key ? previewDataUrlCache.get(r2Key) : undefined;
}

// Upload the (cropped) background data URL to R2 and return the storage key —
// mirrors the Settings Branding flow so the onboarding step-3 background uses the
// same high-resolution pipeline (BrandImagesSection / BrandImageUpload) as the
// benefits wizard step-1 and Settings.
async function uploadBackgroundToR2(
  dataUrl: string,
  fileName: string,
): Promise<string | null> {
  try {
    const { uploadFileToR2 } = await import("@/lib/upload-to-r2");
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const mime = dataUrl.startsWith("data:image/png")
      ? "image/png"
      : "image/jpeg";
    const name = fileName || "background.jpg";
    const file = new File([blob], name, { type: mime });
    return await uploadFileToR2({
      file,
      purpose: "upload",
      subPath: "advisor/background",
      fileName: name,
    });
  } catch (error) {
    console.error("Failed to upload background image to R2:", error);
    return null;
  }
}
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { brandingSchema } from "@/lib/wizard-validation";
import { BrandingSetupCard } from "../sections/branding-setup-card/branding-setup-card";
import { AvatarGeneratorCard } from "../sections/avatar-generator-card/avatar-generator-card";
import { BrandColorsSection } from "@/components/wizard/new-client-steps/sections/brand-colors-section";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import {
   createDataSetters,
   createFileHandlers,
   createRemoveHandlers,
 } from "./step-3-branding.funcs";
import { formatUsDate } from "@/lib/date";

const DEFAULT_WELCOME_STATEMENT = `Welcome to <Organization_Name>!
We consider it a privilege to have been selected by <Client_Name> to represent your 401(k) Savings & Investment Plan. Whether you're just starting your employment journey or are a long-time participant, we share your company's commitment to educating you about the importance of this valuable retirement benefit.
We hope to inspire you to save!`;

// Function to replace placeholders in welcome statement
const replacePlaceholders = (text: string, organizationName: string) => {
  return text
    .replace(/<Organization_Name>/g, organizationName || "Your Organization")
    .replace(/<Client_Name>/g, "Your Client");
};

interface Step3BrandingProps {
  errorFields?: string[];
}

export function Step3Branding({ errorFields = [] }: Step3BrandingProps) {
   const {
     saveStepDataLocally,
     saveStepData,
     saveStepDataToServer,
     stepData,
     validateCurrentStepFields,
     clearErrorFields,
   } = useOnboardingWizardStore();

   // Initialize form with validation
   const methods = useForm({
     resolver: zodResolver(brandingSchema),
     defaultValues: {
       logo: stepData.branding?.logo || "",
       organizationName: stepData.branding?.organizationName || "",
       website: stepData.branding?.website || "",
       missionStatement: stepData.branding?.missionStatement || "",
       brandColor: stepData.branding?.brandColor || "#1F3A60",
       subdomain: stepData.branding?.subdomain || "",
     },
     mode: "onSubmit",
   });

   const { setValue, watch } = methods;
   const watchedData = watch();
   const [logo, setLogo] = useState(stepData.branding?.logo || "");
   // Preview DataURLs – seeded from the module-level cache on mount so that
   // navigating back to step 3 within the same page load shows the logo and
   // background image immediately, without waiting for the async R2 proxy fetch.
   const [logoPreviewDataUrl, setLogoPreviewDataUrl] = useState(
     getCachedPreviewDataUrl(stepData.branding?.logo) ?? "",
   );
   const [logoFileName, setLogoFileName] = useState(
     stepData.branding?.logoFileName || "",
   );
   const [backgroundImage, setBackgroundImage] = useState(
     stepData.branding?.backgroundImage || "",
   );
   const [backgroundPreviewDataUrl, setBackgroundPreviewDataUrl] = useState(
     getCachedPreviewDataUrl(stepData.branding?.backgroundImage) ?? "",
   );
   const [backgroundFileName, setBackgroundFileName] = useState(
     stepData.branding?.backgroundFileName || "",
   );
  const [aiAvatar, setAiAvatar] = useState(stepData.branding?.aiAvatar || "");
  const [avatarFileName, setAvatarFileName] = useState(
    stepData.branding?.avatarFileName || "",
  );

  const [organizationName, setOrganizationName] = useState(
    stepData.branding?.organizationName || "",
  );
  const [website, setWebsite] = useState(stepData.branding?.website || "");
  const [missionStatement, setMissionStatement] = useState(
    stepData.branding?.missionStatement || "",
  );
  const [brandColor, setBrandColor] = useState(
    stepData.branding?.brandColor || "#1F3A60",
  );
  // Brand colors start blank. They are populated only when the user clicks
  // "Extract Colors" in BrandColorsSection (or restores previously saved
  // values from the store when returning to Step 3).
  const [primaryColor, setPrimaryColor] = useState(
    stepData.branding?.primaryColor || "",
  );
  const [secondaryColor, setSecondaryColor] = useState(
    stepData.branding?.secondaryColor || "",
  );
  const [subdomain, setSubdomain] = useState(
    stepData.branding?.subdomain || "",
  );

  // Refs to store the latest color values to avoid stale closures in saveData
  const primaryColorRef = useRef<string>(primaryColor);
  const secondaryColorRef = useRef<string>(secondaryColor);

  // Ref to store the latest logo value
  const latestLogoRef = useRef<string>("");

  // Refs to track preview DataURLs so the caching logic in onDataChange can
  // always read the latest value (React state may be stale due to batching).
  const logoPreviewDataUrlRef = useRef("");
  const backgroundPreviewDataUrlRef = useRef("");

  const [isPrimaryColorPickerOpen, setIsPrimaryColorPickerOpen] = useState(false);
  const [isSecondaryColorPickerOpen, setIsSecondaryColorPickerOpen] = useState(false);
  const [isAvatarGeneratorOpen, setIsAvatarGeneratorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useDefaultWelcomeStatement, setUseDefaultWelcomeStatement] =
    useState(true);

  // Keep refs in sync with local state to avoid stale closures
  useEffect(() => {
    primaryColorRef.current = primaryColor;
  }, [primaryColor]);
  useEffect(() => {
    secondaryColorRef.current = secondaryColor;
  }, [secondaryColor]);

  // Clear any stale errorFields on mount so the required branding fields start in
  // their normal (non-error) state. errorFields is global store state that can
  // survive navigation (e.g. from a delayed validation of a prior step or a
  // previous failed submit), and those errors must not paint red borders on
  // untouched fields the user hasn't entered anything into yet.
  useEffect(() => {
    clearErrorFields();
  }, [clearErrorFields]);

  // Set default welcome statement when useDefaultWelcomeStatement is true
  useEffect(() => {
    if (useDefaultWelcomeStatement) {
      const updatedStatement = replacePlaceholders(
        DEFAULT_WELCOME_STATEMENT,
        organizationName,
      );
      setMissionStatement(updatedStatement);
    }
  }, [useDefaultWelcomeStatement, organizationName]);

  // NOTE: Color extraction from logo is handled in the onLogoPreview callback below,
  // which receives a DataURL. We do NOT extract from `logo` state because after R2
  // upload `logo` holds an R2 key (not a URL), which causes 404 errors.

  // Update mission statement when organization name changes and using default
  useEffect(() => {
    if (useDefaultWelcomeStatement && organizationName) {
      const updatedStatement = replacePlaceholders(
        DEFAULT_WELCOME_STATEMENT,
        organizationName,
      );
      if (updatedStatement !== missionStatement) {
        setMissionStatement(updatedStatement);
      }
    }
  }, [organizationName, useDefaultWelcomeStatement, missionStatement]);

  const saveData = async () => {
     // Get current form values to ensure consistency
     const currentFormData = watch();

     const brandingData = {
       logo: logo, // Use local state for logo as it's updated by file upload
       logoFileName,
       backgroundImage,
       backgroundFileName,
       organizationName: currentFormData.organizationName || organizationName,
       website: currentFormData.website || website,
       missionStatement: currentFormData.missionStatement || missionStatement,
       brandColor: currentFormData.brandColor || brandColor,
       primaryColor: primaryColorRef.current,
       secondaryColor: secondaryColorRef.current,
       aiAvatar,
       avatarFileName,
       subdomain: currentFormData.subdomain || subdomain,
     };

    // Basic validation
    if (!brandingData.brandColor || brandingData.brandColor.trim() === "") {
      console.error("Brand color is required");
      return;
    }

    if (!brandingData.subdomain || brandingData.subdomain.trim() === "") {
      console.error("Subdomain is required");
      return;
    }

    try {
      await saveStepDataLocally("branding", brandingData);
      // Also save to server to prevent data loss
      await saveStepData("branding", brandingData, true);

      // Also save organizationName and website to clientProfile for persistence
      const clientProfileData = {
        organizationType: stepData.clientProfile?.organizationType,
        customOrganization: stepData.clientProfile?.customOrganization,
        organizationName: brandingData.organizationName,
        website: brandingData.website,
      };

      await saveStepDataLocally("clientProfile", clientProfileData);
      await saveStepData("clientProfile", clientProfileData, true);
    } catch (error) {
      console.error("Failed to save branding data:", error);
      // Don't update local state if server validation failed
    }
  };

  const onAvatarGenerate = async (avatarData: any) => {
    if (avatarData.imageUrl) {
      setAiAvatar(avatarData.imageUrl);
      setAvatarFileName(
        `AI Generated Avatar - ${formatUsDate(new Date())}`,
      );
    } else {
      setAiAvatar("generated-avatar-url");
      setAvatarFileName("AI Generated Avatar");
    }

    await saveData();

    // Force save to store after avatar generation
    const brandingData = {
      logo,
      logoFileName,
      backgroundImage,
      backgroundFileName,
      organizationName,
      website,
      missionStatement,
      brandColor,
      primaryColor: primaryColorRef.current,
      secondaryColor: secondaryColorRef.current,
      aiAvatar: avatarData.imageUrl || "generated-avatar-url",
      avatarFileName: avatarData.imageUrl
        ? `AI Generated Avatar - ${formatUsDate(new Date())}`
        : "AI Generated Avatar",
      subdomain,
    };

    await saveStepDataLocally("branding", brandingData);
    // Also save to server to prevent data loss
    try {
      await saveStepData("branding", brandingData, true);
    } catch (error) {
      console.error("Failed to save branding to server:", error);
    }
  };

  // Update form when stepData changes
  useEffect(() => {
    if (stepData.branding) {
      setValue("logo", stepData.branding.logo || "");
      setValue("missionStatement", stepData.branding.missionStatement || "");
      setValue("brandColor", stepData.branding.brandColor || "#1F3A60");
      setValue("subdomain", stepData.branding.subdomain || "");

      // Keep the website state in sync with the store so the Brand Colors
      // extraction always receives the current Organization Website value,
      // even when returning to Step 3 after the data was persisted.
      setWebsite(stepData.branding.website || "");

      // Restore local state for primaryColor and secondaryColor from store
      // so color pickers show correct values when navigating back to Step 3
      if (stepData.branding.primaryColor) {
        setPrimaryColor(stepData.branding.primaryColor);
      }
      if (stepData.branding.secondaryColor) {
        setSecondaryColor(stepData.branding.secondaryColor);
      }
    }

    // Load organizationName and website from clientProfile (for persistence)
    if (stepData.clientProfile) {
      setValue(
        "organizationName",
        stepData.clientProfile.organizationType ||
          stepData.branding?.organizationName ||
          "",
      );
    }
  }, [stepData.branding, stepData.clientProfile, setValue]);

  // Sync logo state with form when logo changes
  useEffect(() => {
    setValue("logo", logo);
  }, [logo, setValue]);

  // Wire the shared BrandColorsSection (same UI/functionality as the new-client
  // wizard's Brand Colors section) to the onboarding step-3 state so that color
  // changes are persisted exactly like the inline onDataChange handler does.
  const persistBrandColorChange = (
    field: "primaryColor" | "secondaryColor",
    value: string,
  ) => {
    if (field === "primaryColor") {
      setPrimaryColor(value);
      primaryColorRef.current = value;
    } else {
      setSecondaryColor(value);
      secondaryColorRef.current = value;
    }

    const latestBranding = (useOnboardingWizardStore.getState().stepData
      .branding || {}) as any;
    const brandingData: any = {
      logo: latestBranding.logo ?? logo,
      logoFileName: latestBranding.logoFileName ?? logoFileName,
      backgroundImage: latestBranding.backgroundImage ?? backgroundImage,
      backgroundFileName:
        latestBranding.backgroundFileName ?? backgroundFileName,
      organizationName: latestBranding.organizationName ?? organizationName,
      website: latestBranding.website ?? website,
      missionStatement: latestBranding.missionStatement ?? missionStatement,
      brandColor: latestBranding.brandColor ?? brandColor,
      primaryColor:
        field === "primaryColor"
          ? value
          : latestBranding.primaryColor ?? primaryColorRef.current,
      secondaryColor:
        field === "secondaryColor"
          ? value
          : latestBranding.secondaryColor ?? secondaryColorRef.current,
      aiAvatar: latestBranding.aiAvatar ?? aiAvatar,
      avatarFileName: latestBranding.avatarFileName ?? avatarFileName,
      subdomain: latestBranding.subdomain ?? subdomain,
    };
    saveStepDataLocally("branding", brandingData);
  };

  // Background image persistence — mirrors the inline onDataChange handling for
  // backgroundImage/backgroundFileName (saves locally + to server and caches the
  // preview DataURL against the R2 key so the preview survives page navigation).
  const handleBackgroundFieldChange = async (
    nextImage: string,
    nextFileName: string,
    nextPreview: string,
  ) => {
    setBackgroundImage(nextImage);
    setBackgroundFileName(nextFileName);
    setBackgroundPreviewDataUrl(nextPreview);
    backgroundPreviewDataUrlRef.current = nextPreview;

    if (nextPreview) {
      cachePreviewDataUrl(nextImage, nextPreview);
    }

    const latestBranding = (useOnboardingWizardStore.getState().stepData
      .branding || {}) as any;
    const brandingData: any = {
      logo: latestBranding.logo ?? logo,
      logoFileName: latestBranding.logoFileName ?? logoFileName,
      backgroundImage: nextImage,
      backgroundFileName: nextFileName,
      organizationName: latestBranding.organizationName ?? organizationName,
      website: latestBranding.website ?? website,
      missionStatement: latestBranding.missionStatement ?? missionStatement,
      brandColor: latestBranding.brandColor ?? brandColor,
      primaryColor: latestBranding.primaryColor ?? primaryColorRef.current,
      secondaryColor:
        latestBranding.secondaryColor ?? secondaryColorRef.current,
      aiAvatar: latestBranding.aiAvatar ?? aiAvatar,
      avatarFileName: latestBranding.avatarFileName ?? avatarFileName,
      subdomain: latestBranding.subdomain ?? subdomain,
    };
    await saveStepDataLocally("branding", brandingData);
    await saveStepDataToServer("branding", brandingData);
  };

  // Background upload via the shared BrandImagesSection — the exact same
  // high-resolution pipeline used by Settings Branding and benefits step-1
  // (BrandImageUpload + SimpleImageEditorModal with exportScale). Uploads the
  // cropped data URL to R2, then persists the R2 key.
  const handleBrandImagesChange = async (brandImages: BrandImagesData) => {
    const header = brandImages.header;
    if (!header) {
      // Removed — clear the background and drop the R2 object.
      if (backgroundImage) {
        await deleteFromR2(backgroundImage).catch(() => {});
      }
      await handleBackgroundFieldChange("", "", "");
      return;
    }

    let storedUrl = header.url;
    if (header.url.startsWith("data:")) {
      const r2Key = await uploadBackgroundToR2(header.url, header.fileName);
      if (r2Key) storedUrl = r2Key;
    }

    // Use the modal's data-URL preview for immediate display + caching.
    const previewSrc =
      header.previewUrl ||
      (header.url.startsWith("data:") ? header.url : backgroundPreviewDataUrl);
    await handleBackgroundFieldChange(storedUrl, header.fileName, previewSrc);
  };

  return (
    <FormProvider {...methods}>
      <div className="space-y-4">
        <div className="w-full">
          <BrandingSetupCard
            data={{
              organizationName,
              logo,
              logoFileName,
              website,
              backgroundImage,
              backgroundFileName,
              missionStatement,
              brandColor,
              primaryColor,
              secondaryColor,
              subdomain,
              aiAvatar,
              avatarFileName,
              isPrimaryColorPickerOpen,
              isSecondaryColorPickerOpen,
              isGenerating,
              useDefaultWelcomeStatement,
              logoPreviewDataUrl,
              backgroundPreviewDataUrl,
            }}
            hideColors
            hideBackgroundImage
            disableAutoColorExtraction
            errorFields={errorFields}
            onLogoPreview={async (dataUrl) => {
              // Only record the preview DataURL here. Brand color extraction is
              // now handled exclusively by the "Extract Colors" button in
              // BrandColorsSection (matching the new-client wizard) — colors are
              // NOT auto-populated from the logo on upload.
              setLogoPreviewDataUrl(dataUrl);
              logoPreviewDataUrlRef.current = dataUrl;
            }}
            onDataChange={async (field: any, value: any) => {
              const setters = createDataSetters({
                setOrganizationName,
                setLogo,
                setLogoFileName,
                setWebsite,
                setBackgroundImage,
                setBackgroundFileName,
                setMissionStatement,
                setBrandColor,
                setPrimaryColor,
                setSecondaryColor,
                setSubdomain,
                setAiAvatar,
                setAvatarFileName,
                setIsPrimaryColorPickerOpen,
                setIsSecondaryColorPickerOpen,
                setIsAvatarGeneratorOpen,
                setIsGenerating,
                setUseDefaultWelcomeStatement,
              });

              if (field !== "logoPreviewDataUrl" && field !== "backgroundPreviewDataUrl") {
                 const setter = setters[field as keyof typeof setters];
                 setter?.(value);
               }

               if (field === "logo") {
                 latestLogoRef.current = value;
                 // Cache the preview data URL against the new R2 key so that
                 // navigating away and back within the same page load shows
                 // the preview immediately.  Uses the ref because React state
                 // (logoPreviewDataUrl) may still be stale due to batching.
                 if (logoPreviewDataUrlRef.current) {
                   cachePreviewDataUrl(value, logoPreviewDataUrlRef.current);
                 }
                 // Do NOT overwrite logoPreview here — onLogoPreview already
                 // set it to the data URL. The R2 key is not a valid image src.
               }

               if (field === "logoPreviewDataUrl") {
                 setLogoPreviewDataUrl(value);
                 logoPreviewDataUrlRef.current = value;
               }

               if (field === "backgroundPreviewDataUrl") {
                 setBackgroundPreviewDataUrl(value);
                 backgroundPreviewDataUrlRef.current = value;
               }

               if (field === "backgroundImage") {
                 if (backgroundPreviewDataUrlRef.current) {
                   cachePreviewDataUrl(value, backgroundPreviewDataUrlRef.current);
                 }
               }

              // Read latest branding data from store to avoid stale React state
              const latestBranding = (useOnboardingWizardStore.getState().stepData.branding || {}) as any;

             // Don't include preview fields in the data saved to store/server
             const brandingData: any = {
               logo: latestBranding.logo ?? logo,
               logoFileName: latestBranding.logoFileName ?? logoFileName,
               backgroundImage: latestBranding.backgroundImage ?? backgroundImage,
               backgroundFileName: latestBranding.backgroundFileName ?? backgroundFileName,
               organizationName: latestBranding.organizationName ?? organizationName,
               website: latestBranding.website ?? website,
               missionStatement: latestBranding.missionStatement ?? missionStatement,
               brandColor: latestBranding.brandColor ?? brandColor,
               primaryColor: latestBranding.primaryColor ?? primaryColorRef.current,
               secondaryColor: latestBranding.secondaryColor ?? secondaryColorRef.current,
               aiAvatar: latestBranding.aiAvatar ?? aiAvatar,
               avatarFileName: latestBranding.avatarFileName ?? avatarFileName,
               subdomain: latestBranding.subdomain ?? subdomain,
             };

              // Only override non-preview fields
              if (field !== "backgroundPreviewDataUrl" && field !== "logoPreviewDataUrl") {
                brandingData[field] = value;
              }

                if (field === "logoFileName" && brandingData.logo === "") {
                  if (latestLogoRef.current) {
                    brandingData.logo = latestLogoRef.current;
                  }
                }

                // Debug: log what's being saved to the store
                console.log(`[Step3] Saving brandingData to store:`, {
                  field,
                  value,
                  primaryColor: brandingData.primaryColor,
                  secondaryColor: brandingData.secondaryColor,
                  latestBrandingPrimary: latestBranding.primaryColor,
                  refPrimary: primaryColorRef.current,
                });

                await saveStepDataLocally("branding", brandingData);

               // Save to server immediately for backgroundImage changes
               if (field === "backgroundImage" || field === "backgroundFileName") {
                 await saveStepDataToServer("branding", brandingData);
               }

              if (field === "organizationName" || field === "website") {
                const clientProfileData = {
                  organizationType: stepData.clientProfile?.organizationType,
                  customOrganization:
                    stepData.clientProfile?.customOrganization,
                  organizationName:
                    field === "organizationName" ? value : organizationName,
                  website: field === "website" ? value : website,
                };

                await saveStepDataLocally("clientProfile", clientProfileData);
              }

            }}
            onFileUpload={async (
              field: "logo" | "backgroundImage",
              file: File,
            ) => {
              const reader = new FileReader();
              reader.onload = async (e) => {
                const result = e.target?.result as string;

                if (field === "logo") {
                  setLogoPreviewDataUrl(result);
                  logoPreviewDataUrlRef.current = result;
                } else if (field === "backgroundImage") {
                  setBackgroundPreviewDataUrl(result);
                  backgroundPreviewDataUrlRef.current = result;
                }

                const fileHandlers = createFileHandlers(
                  {
                    setLogo,
                    setLogoFileName,
                    setBackgroundImage,
                    setBackgroundFileName,
                  },
                  result,
                  file,
                );

                if (field === "logo") {
                  fileHandlers.logo?.();
                } else if (field === "backgroundImage") {
                  fileHandlers.backgroundImage?.();
                }

                try {
                    const currentFormData = watch();
                    const brandingData = {
                       logo: field === "logo" ? result : logo,
                       logoFileName: field === "logo" ? file.name : logoFileName,
                       backgroundImage: field === "backgroundImage" ? result : backgroundImage,
                       backgroundFileName: field === "backgroundImage" ? file.name : backgroundFileName,
                       organizationName: currentFormData.organizationName || organizationName,
                       website: currentFormData.website || website,
                       missionStatement: currentFormData.missionStatement || missionStatement,
                       brandColor: currentFormData.brandColor || brandColor,
                       primaryColor: primaryColorRef.current,
                       secondaryColor: secondaryColorRef.current,
                       aiAvatar,
                       avatarFileName,
                       subdomain: currentFormData.subdomain || subdomain,
                     };

                   await saveStepDataLocally("branding", brandingData);
                   // Save directly to server bypassing autosaveToServer flag
                   await saveStepDataToServer("branding", brandingData);
                 } catch (error) {
                   console.error(
                     "Step 3 - Error saving data after file upload:",
                     error,
                   );
                 }
              };
              reader.readAsDataURL(file);
            }}
            onFileRemove={async (field: "logo" | "backgroundImage") => {
              const removeHandlers = createRemoveHandlers({
                setLogo,
                setLogoFileName,
                setBackgroundImage,
                setBackgroundFileName,
              });

              if (field === "logo") {
                removeHandlers.logo?.();
                setLogoPreviewDataUrl("");
                logoPreviewDataUrlRef.current = "";
              } else if (field === "backgroundImage") {
                removeHandlers.background?.();
                setBackgroundPreviewDataUrl("");
                backgroundPreviewDataUrlRef.current = "";
              }
              
              await saveData();

              const brandingData = {
                logo: field === "logo" ? "" : logo,
                logoFileName: field === "logo" ? "" : logoFileName,
                backgroundImage:
                  field === "backgroundImage" ? "" : backgroundImage,
                backgroundFileName:
                  field === "backgroundImage" ? "" : backgroundFileName,
                organizationName,
                website,
                missionStatement,
                brandColor,
                primaryColor: primaryColorRef.current,
                secondaryColor: secondaryColorRef.current,
                aiAvatar,
                avatarFileName,
                subdomain,
              };

              await saveStepDataLocally("branding", brandingData);
            }}
          />
        </div>

        <div className="w-full">
          <BrandColorsSection
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            onPrimaryChange={(color) =>
              persistBrandColorChange("primaryColor", color)
            }
            onSecondaryChange={(color) =>
              persistBrandColorChange("secondaryColor", color)
            }
            isPrimaryPickerOpen={isPrimaryColorPickerOpen}
            isSecondaryPickerOpen={isSecondaryColorPickerOpen}
            onPrimaryPickerOpenChange={setIsPrimaryColorPickerOpen}
            onSecondaryPickerOpenChange={setIsSecondaryColorPickerOpen}
            logoDataUrl={logoPreviewDataUrl || undefined}
            websiteUrl={website || stepData.branding?.website || ""}
            organizationName={organizationName}
            errorFields={errorFields}
          />
        </div>

        <div className="w-full">
          {/* Shared BrandImagesSection — the exact same Background Image upload
              used by Settings Branding and the benefits wizard step-1 (high-res
              export via SimpleImageEditorModal + BrandImageUpload compression). */}
          <BrandImagesSection
            brandImages={{
              header: backgroundImage
                ? {
                    url: backgroundImage,
                    fileName: backgroundFileName,
                    fileSize: 0,
                    width: 0,
                    height: 0,
                    recommendedSize: "1920×1080 px",
                    status: "ok",
                    warnings: [],
                  }
                : null,
              thumbnail: null,
              secondaryBanner: null,
              favicon: null,
            }}
            onBrandImagesChange={handleBrandImagesChange}
            visibleSlots={["header"]}
            errorFields={errorFields}
          />
        </div>

        {isAvatarGeneratorOpen && (
          <div className="flex-1">
            <AvatarGeneratorCard
              onGenerate={onAvatarGenerate}
              onCancel={() => setIsAvatarGeneratorOpen(false)}
            />
          </div>
        )}
      </div>
    </FormProvider>
  );
}
