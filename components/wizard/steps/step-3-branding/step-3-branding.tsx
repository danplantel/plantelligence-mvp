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
  const [logoFileName, setLogoFileName] = useState(
    stepData.branding?.logoFileName || "",
  );
  const [backgroundImage, setBackgroundImage] = useState(
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
  const [subdomain, setSubdomain] = useState(
    stepData.branding?.subdomain || "benefits.acme.com",
  );

  // Ref to store the latest logo value
  const latestLogoRef = useRef<string>("");

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
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
        <div
          className={
            isAvatarGeneratorOpen ? "flex flex-row gap-4" : "space-y-4"
          }
        >
          <div className={isAvatarGeneratorOpen ? "flex-1" : ""}>
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
                subdomain,
                aiAvatar,
                avatarFileName,
                isColorPickerOpen,
                isGenerating,
                useDefaultWelcomeStatement,
              }}
              errorFields={errorFields}
              onDataChange={async (field: keyof BrandingState, value: any) => {
                const setters = createDataSetters({
                  setOrganizationName,
                  setLogo,
                  setLogoFileName,
                  setWebsite,
                  setBackgroundImage,
                  setBackgroundFileName,
                  setMissionStatement,
                  setBrandColor,
                  setSubdomain,
                  setAiAvatar,
                  setAvatarFileName,
                  setIsColorPickerOpen,
                  setIsAvatarGeneratorOpen,
                  setIsGenerating,
                  setUseDefaultWelcomeStatement,
                });

                setters[field]?.(value);

                // Store logo value in ref when updating logo
                if (field === "logo") {
                  latestLogoRef.current = value;
                }

                // Create updated branding data with the new value
                // Use current state values and update the specific field
                const currentState = {
                  logo,
                  logoFileName,
                  backgroundImage,
                  backgroundFileName,
                  organizationName,
                  website,
                  missionStatement,
                  brandColor,
                  aiAvatar,
                  avatarFileName,
                  subdomain,
                };

                const brandingData = {
                  ...currentState,
                  [field]: value,
                };

                // Special handling for logoFileName - preserve logo from previous update
                if (field === "logoFileName" && brandingData.logo === "") {
                  // If logo is empty but we're updating fileName, keep the previous logo value
                  if (latestLogoRef.current) {
                    brandingData.logo = latestLogoRef.current;
                  }
                }
                // Save locally immediately and debounce server save
                await saveStepDataLocally("branding", brandingData);

                // Also save organizationName and website to clientProfile for persistence
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

                // Validate fields in real-time
                setTimeout(() => validateCurrentStepFields(), 100);
              }}
              onFileUpload={async (
                field: "logo" | "backgroundImage" | "avatar",
                file: File,
              ) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                  const result = e.target?.result as string;

                  const fileHandlers = createFileHandlers(
                    {
                      setLogo,
                      setLogoFileName,
                      setBackgroundImage,
                      setBackgroundFileName,
                      setAiAvatar,
                      setAvatarFileName,
                    },
                    result,
                    file,
                  );

                  fileHandlers[field]?.();

                  try {
                    await saveData();

                    // Force save to store immediately after file upload
                    const brandingData = {
                      logo: result,
                      logoFileName: file.name,
                      backgroundImage,
                      backgroundFileName,
                      organizationName,
                      website,
                      missionStatement,
                      brandColor,
                      aiAvatar,
                      avatarFileName,
                      subdomain,
                    };

                    await saveStepDataLocally("branding", brandingData);
                  } catch (error) {
                    console.error(
                      "Step 3 - Error saving data after file upload:",
                      error,
                    );
                  }
                };
                reader.readAsDataURL(file);
              }}
              onFileRemove={async (field: "logo" | "background" | "avatar") => {
                const removeHandlers = createRemoveHandlers({
                  setLogo,
                  setLogoFileName,
                  setBackgroundImage,
                  setBackgroundFileName,
                  setAiAvatar,
                  setAvatarFileName,
                });

                removeHandlers[field]?.();
                await saveData();

                // Force save to store after file removal
                const brandingData = {
                  logo: field === "logo" ? "" : logo,
                  logoFileName: field === "logo" ? "" : logoFileName,
                  backgroundImage:
                    field === "background" ? "" : backgroundImage,
                  backgroundFileName:
                    field === "background" ? "" : backgroundFileName,
                  organizationName,
                  website,
                  missionStatement,
                  brandColor,
                  aiAvatar: field === "avatar" ? "" : aiAvatar,
                  avatarFileName: field === "avatar" ? "" : avatarFileName,
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
      </div>
    </FormProvider>
  );
}
