"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { ColorPicker } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import {
   Sparkles,
   Building2,
   Globe,
   Link,
   Palette,
   Image as ImageIcon,
 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { deleteFromR2 } from "@/lib/upload-to-r2";

const DEFAULT_WELCOME_STATEMENT = `Welcome to <Organization_Name>!
We consider it a privilege to have been selected by <Client_Name> to represent your 401(k) Savings & Investment Plan. Whether you're just starting your employment journey or are a long-time participant, we share your company's commitment to educating you about the importance of this valuable retirement benefit.
We hope to inspire you to save!`;

// Function to replace placeholders in welcome statement
const replacePlaceholders = (text: string, organizationName: string) => {
   return text
     .replace(/<Organization_Name>/g, organizationName || "Your Organization")
     .replace(/<Client_Name>/g, "Your Client");
 };

// Validate website URL
const isValidWebsite = (url: string): boolean => {
   if (!url) return false;
   
   // Add protocol if missing
   let urlToValidate = url;
   if (!url.startsWith("http://") && !url.startsWith("https://")) {
     urlToValidate = "https://" + url;
   }
   
   try {
     const urlObj = new URL(urlToValidate);
     // Check if it has a valid domain
     return urlObj.hostname.includes(".") && urlObj.hostname.length > 0;
   } catch {
     return false;
   }
 };

interface BrandingData {
     organizationName: string;
     logo: string;
     logoFileName: string;
     website: string;
     missionStatement: string;
     brandColor: string;
     primaryColor?: string;
     secondaryColor?: string;
     isPrimaryColorPickerOpen: boolean;
     isSecondaryColorPickerOpen: boolean;
     isGenerating: boolean;
     backgroundImage?: string;
     backgroundFileName?: string;
     aiAvatar?: string;
     avatarFileName?: string;
     subdomain: string;
     useDefaultWelcomeStatement?: boolean;
     logoPreview?: string;
     backgroundImagePreview?: string;
   }

interface BrandingSetupCardProps {
   data: BrandingData;
   errorFields?: string[];
   onDataChange: (field: keyof BrandingData, value: any) => void;
   onFileUpload: (field: "logo" | "backgroundImage", file: File) => void;
   onFileRemove: (field: "logo" | "backgroundImage") => void;
   onLogoPreview?: (dataUrl: string) => void;
   hideCard?: boolean;
 }

export function BrandingSetupCard({
   data,
   errorFields = [],
   onDataChange,
   onFileUpload,
   onFileRemove,
   onLogoPreview,
   hideCard = false,
 }: BrandingSetupCardProps) {
   const { validateCurrentStepFields } = useOnboardingWizardStore();
   const [websiteError, setWebsiteError] = useState<string>("");
   const fileInputRef = useRef<HTMLInputElement>(null);

   // Handle file input change to capture preview immediately
   const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file && onLogoPreview) {
       const reader = new FileReader();
       reader.onload = (event) => {
         const dataUrl = event.target?.result as string;
         onLogoPreview(dataUrl);
       };
       reader.readAsDataURL(file);
     }
   };

   const {
     organizationName,
     logo,
     logoFileName,
     website,
     missionStatement,
     brandColor,
     isPrimaryColorPickerOpen,
     isSecondaryColorPickerOpen,
     isGenerating,
     useDefaultWelcomeStatement = true,
   } = data;

   // Validate website on change
   const handleWebsiteChange = (value: string) => {
     onDataChange("website", value);
     
     if (value && !isValidWebsite(value)) {
       setWebsiteError("Please enter a valid website URL (e.g., example.com or https://example.com)");
     } else {
       setWebsiteError("");
     }
     
     // Validate fields in real-time
     setTimeout(() => validateCurrentStepFields(), 100);
   };

  // Update mission statement when organization name changes and using default
  useEffect(() => {
    if (useDefaultWelcomeStatement && organizationName) {
      const updatedStatement = replacePlaceholders(
        DEFAULT_WELCOME_STATEMENT,
        organizationName,
      );
      if (updatedStatement !== missionStatement) {
        onDataChange("missionStatement", updatedStatement);
      }
    }
  }, [
    organizationName,
    useDefaultWelcomeStatement,
    missionStatement,
    onDataChange,
  ]);

  const content = (
    <div className="space-y-4">
      {/* Organization Name */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Organization Name <span className="text-red-500">*</span>
        </label>
        <Input
          icon={<Building2 className="h-4 w-4" />}
          value={organizationName}
          onChange={async (e) => {
            onDataChange("organizationName", e.target.value);
            // Validate fields in real-time
            setTimeout(() => validateCurrentStepFields(), 100);
          }}
          placeholder="Enter organization name"
          required
          destructive={errorFields.includes("organizationName")}
          data-field="organizationName"
        />
      </div>

      {/* Organization Website */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Organization Website <span className="text-red-500">*</span>
        </label>
        <Input
          icon={<Globe className="h-4 w-4" />}
          value={website}
          onChange={(e) => handleWebsiteChange(e.target.value)}
          placeholder="Enter organization website (e.g., example.com)"
          type="text"
          required
          destructive={errorFields.includes("website") || (website !== "" && !isValidWebsite(website))}
          data-field="website"
        />
        {websiteError && (
          <p className="text-xs text-red-500 mt-1">{websiteError}</p>
        )}
      </div>

      {/* Organization Logo */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Organization Logo <span className="text-red-500">*</span>
        </label>
        <UniversalImageEditorModal
          type="logo"
          icon={<ImageIcon className="w-4 h-4" />}
          value={logo}
          fileName={logoFileName}
          onChange={(value, fileName, headshotData) => {
            onDataChange("logo", value);
            onDataChange("logoFileName", fileName);
            // Use the DataURL preview passed back from the modal (headshotData.previewDataUrl)
            // so the preview and color extraction work even when value is an R2 key
            const previewDataUrl: string | undefined =
              (headshotData as any)?.previewDataUrl;
            const previewSrc = previewDataUrl || (value?.startsWith("data:") ? value : undefined);
            if (onLogoPreview && previewSrc) {
              onLogoPreview(previewSrc);
            }
          }}
          onRemove={async () => {
            await deleteFromR2(logo);
            onDataChange("logo", "");
            onDataChange("logoFileName", "");
            onFileRemove("logo");
          }}
          placeholder="Upload Logo"
          destructive={errorFields.includes("logo")}
        />
        {data.logoPreview && (
          <div className="mt-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg p-4 flex flex-col items-center justify-center">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
              Logo Preview
            </p>
            <div className="flex items-center justify-center w-full">
              <img
                src={data.logoPreview}
                alt="Organization Logo"
                className="max-w-full max-h-40 object-contain"
                onError={(e) => {
                  console.error("Failed to load logo image:", e);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Primary Color */}
      <div className="relative">
        <label className="block text-sm font-medium mb-1">
          Primary Brand Color
        </label>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              onDataChange("isPrimaryColorPickerOpen", !isPrimaryColorPickerOpen);
              if (!isPrimaryColorPickerOpen && isSecondaryColorPickerOpen) {
                onDataChange("isSecondaryColorPickerOpen", false);
              }
            }}
            className="w-9 h-9 border rounded cursor-pointer flex items-center justify-center"
            style={{ background: data.primaryColor || "#1F3A60" }}
          >
            <div className="w-4 h-4 rounded border border-white/20" />
          </button>
          <Input
            icon={<Palette className="h-4 w-4" />}
            type="text"
            value={data.primaryColor || ""}
            onChange={(e) => onDataChange("primaryColor", e.target.value)}
            placeholder="#1F3A60"
            className="flex-1"
            data-field="primaryColor"
          />
        </div>

        <ColorPicker
          value={data.primaryColor || "#1F3A60"}
          onChange={(value) => onDataChange("primaryColor", value)}
          isOpen={isPrimaryColorPickerOpen}
          onOpenChange={(open) => onDataChange("isPrimaryColorPickerOpen", open)}
          title="Primary Color"
        />
      </div>

      {/* Secondary Color */}
      <div className="relative">
        <label className="block text-sm font-medium mb-1">
          Secondary Brand Color
        </label>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              onDataChange("isSecondaryColorPickerOpen", !isSecondaryColorPickerOpen);
              if (!isSecondaryColorPickerOpen && isPrimaryColorPickerOpen) {
                onDataChange("isPrimaryColorPickerOpen", false);
              }
            }}
            className="w-9 h-9 border rounded cursor-pointer flex items-center justify-center"
            style={{ background: data.secondaryColor || "#4A90E2" }}
          >
            <div className="w-4 h-4 rounded border border-white/20" />
          </button>
          <Input
            icon={<Palette className="h-4 w-4" />}
            type="text"
            value={data.secondaryColor || ""}
            onChange={(e) => onDataChange("secondaryColor", e.target.value)}
            placeholder="#4A90E2"
            className="flex-1"
            data-field="secondaryColor"
          />
        </div>

        <ColorPicker
          value={data.secondaryColor || "#4A90E2"}
          onChange={(value) => onDataChange("secondaryColor", value)}
          isOpen={isSecondaryColorPickerOpen}
          onOpenChange={(open) => onDataChange("isSecondaryColorPickerOpen", open)}
          title="Secondary Color"
        />
      </div>

      {/* Background Image */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Background Image (Optional)
        </label>
        <UniversalImageEditorModal
          type="logo"
          icon={<ImageIcon className="w-4 h-4" />}
          value={data.backgroundImage || ""}
          fileName={data.backgroundFileName || ""}
          onChange={(value, fileName, headshotData) => {
            onDataChange("backgroundImage", value);
            onDataChange("backgroundFileName", fileName);
            // Use the DataURL preview passed back from the modal so preview works with R2 key
            const previewDataUrl: string | undefined =
              (headshotData as any)?.previewDataUrl;
            const previewSrc = previewDataUrl || (value?.startsWith("data:") ? value : undefined);
            if (previewSrc) {
              onDataChange("backgroundImagePreview", previewSrc);
            }
          }}
          onRemove={async () => {
            if (data.backgroundImage) {
              await deleteFromR2(data.backgroundImage);
            }
            onDataChange("backgroundImage", "");
            onDataChange("backgroundFileName", "");
            onFileRemove("backgroundImage");
          }}
          placeholder="Upload Background Image"
          modalTitle="Background Image"
          modalDescription="Upload a background image. Adjust and fit it into the preview dimensions for best results."
          saveButtonText="Save Background Image"
          autoSizeOnOpen={true}
        />
        {data.backgroundImagePreview && (
          <div className="mt-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg p-4 flex flex-col items-center justify-center min-h-80">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
              Background Image Preview
            </p>
            <div className="flex items-center justify-center w-full flex-1">
              <img
                src={data.backgroundImagePreview}
                alt="Background Image"
                className="max-w-full max-h-72 object-cover rounded"
                onError={(e) => {
                  console.error("Failed to load background image:", e);
                }}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );

  if (hideCard) {
    return content;
  }

  return (
    <Card className="shadow-none h-full flex flex-col dark:bg-gray-800">
      <CardHeader className="pb-3">
      </CardHeader>
      <CardContent className="flex-1 pt-0">{content}</CardContent>
    </Card>
  );
}
