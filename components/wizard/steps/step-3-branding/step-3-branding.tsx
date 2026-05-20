"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { brandingSchema } from "@/lib/wizard-validation";
import { BrandingSetupCard } from "../sections/branding-setup-card/branding-setup-card";
import { AvatarGeneratorCard } from "../sections/avatar-generator-card/avatar-generator-card";
import {
   createDataSetters,
   createFileHandlers,
   createRemoveHandlers,
   BrandingState,
 } from "./step-3-branding.funcs";
import { formatUsDate } from "@/lib/date";
import { extractColorsFromImage } from "@/lib/extract-colors-from-image";

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
       subdomain: stepData.branding?.subdomain || "benefits.acme.com",
     },
     mode: "onSubmit",
   });

   const { setValue, watch } = methods;
   const watchedData = watch();
   const [logo, setLogo] = useState(stepData.branding?.logo || "");
   const [logoPreview, setLogoPreview] = useState(stepData.branding?.logo || "");
   const [logoFileName, setLogoFileName] = useState(
     stepData.branding?.logoFileName || "",
   );
   const [backgroundImage, setBackgroundImage] = useState(
     stepData.branding?.backgroundImage || "",
   );
   const [backgroundImagePreview, setBackgroundImagePreview] = useState(
     stepData.branding?.backgroundImage || "",
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
  const [primaryColor, setPrimaryColor] = useState(
    stepData.branding?.primaryColor || "#1F3A60",
  );
  const [secondaryColor, setSecondaryColor] = useState(
    stepData.branding?.secondaryColor || "#4A90E2",
  );
  const [subdomain, setSubdomain] = useState(
    stepData.branding?.subdomain || "benefits.acme.com",
  );

  // Ref to store the latest logo value
  const latestLogoRef = useRef<string>("");

  const [isPrimaryColorPickerOpen, setIsPrimaryColorPickerOpen] = useState(false);
  const [isSecondaryColorPickerOpen, setIsSecondaryColorPickerOpen] = useState(false);
  const [isAvatarGeneratorOpen, setIsAvatarGeneratorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useDefaultWelcomeStatement, setUseDefaultWelcomeStatement] =
    useState(true);

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
       primaryColor,
       secondaryColor,
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
      setValue("subdomain", stepData.branding.subdomain || "benefits.acme.com");
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
              logoPreview,
              backgroundImagePreview,
            }}
            errorFields={errorFields}
            onLogoPreview={async (dataUrl) => {
              setLogoPreview(dataUrl);
              try {
                const colors = await extractColorsFromImage(dataUrl);
                setPrimaryColor(colors.primary);
                setSecondaryColor(colors.secondary);
              } catch (error) {
                console.error("Failed to extract colors from logo preview:", error);
                setPrimaryColor("#1F3A60");
                setSecondaryColor("#4A90E2");
              }
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

              if (field !== "logoPreview" && field !== "backgroundImagePreview") {
                 const setter = setters[field as keyof typeof setters];
                 setter?.(value);
               }

               if (field === "logo") {
                 latestLogoRef.current = value;
                 setLogoPreview(value);
               }

               if (field === "backgroundImagePreview") {
                 setBackgroundImagePreview(value);
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
                primaryColor: latestBranding.primaryColor ?? primaryColor,
                secondaryColor: latestBranding.secondaryColor ?? secondaryColor,
                aiAvatar: latestBranding.aiAvatar ?? aiAvatar,
                avatarFileName: latestBranding.avatarFileName ?? avatarFileName,
                subdomain: latestBranding.subdomain ?? subdomain,
              };

              // Only override non-preview fields
              if (field !== "backgroundImagePreview" && field !== "logoPreview") {
                brandingData[field] = value;
              }

               if (field === "logoFileName" && brandingData.logo === "") {
                 if (latestLogoRef.current) {
                   brandingData.logo = latestLogoRef.current;
                 }
               }
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

              setTimeout(() => validateCurrentStepFields(), 100);
            }}
            onFileUpload={async (
              field: "logo" | "backgroundImage",
              file: File,
            ) => {
              const reader = new FileReader();
              reader.onload = async (e) => {
                const result = e.target?.result as string;

                if (field === "logo") {
                  setLogoPreview(result);
                } else if (field === "backgroundImage") {
                  setBackgroundImagePreview(result);
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
                       primaryColor,
                       secondaryColor,
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
              } else if (field === "backgroundImage") {
                removeHandlers.background?.();
                setBackgroundImagePreview("");
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
                aiAvatar,
                avatarFileName,
                subdomain,
              };

              await saveStepDataLocally("branding", brandingData);
            }}
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
