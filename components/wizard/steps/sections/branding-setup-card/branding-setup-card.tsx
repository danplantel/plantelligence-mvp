"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { BackgroundImageField } from "@/components/wizard/steps/sections/background-image-field/background-image-field";
import { ColorPicker } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { InfoDialog } from "@/components/ui/info-dialog";
import {
   Building2,
   Globe,
   Palette,
   Image as ImageIcon,
   Info,
 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { deleteFromR2 } from "@/lib/upload-to-r2";
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
     useDefaultWelcomeStatement?: boolean;
     logoPreviewDataUrl?: string;
     backgroundPreviewDataUrl?: string;
   }

interface BrandingSetupCardProps {
   data: BrandingData;
   errorFields?: string[];
   onDataChange: (field: keyof BrandingData, value: any) => void;
   onFileUpload: (field: "logo" | "backgroundImage", file: File) => void;
   onFileRemove: (field: "logo" | "backgroundImage") => void;
   onLogoPreview?: (dataUrl: string) => Promise<void>;
   hideCard?: boolean;
   hideColors?: boolean;
   hideBackgroundImage?: boolean;
   /**
    * When true, uploading a logo does NOT auto-populate the primary/secondary
    * brand colors. Color extraction is then left to the dedicated
    * "Extract Colors" button in BrandColorsSection (matching the new-client
    * wizard behavior).
    */
   disableAutoColorExtraction?: boolean;
 }

export function BrandingSetupCard({
  data,
  errorFields = [],
  onDataChange,
  onFileUpload,
  onFileRemove,
  onLogoPreview,
  hideCard = false,
  hideColors = false,
  hideBackgroundImage = false,
  disableAutoColorExtraction = false,
}: BrandingSetupCardProps) {
  const [websiteError, setWebsiteError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [infoDialogConfig, setInfoDialogConfig] = useState({ title: "", description: "" });

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

  // Validate website on change
   const handleWebsiteChange = (value: string) => {
     onDataChange("website", value);
     
     if (value && !isValidWebsite(value)) {
       setWebsiteError("Please enter a valid website URL (e.g., example.com or https://example.com)");
     } else {
       setWebsiteError("");
     }
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
          maxLength={100}
          onChange={async (e) => {
            onDataChange("organizationName", e.target.value);
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
      <div data-field="logo">
        <label className="block text-sm font-medium mb-1 flex items-center gap-1">
          Organization Logo <span className="text-red-500">*</span>
          <button
            type="button"
            onClick={() => {
              setInfoDialogConfig({ title: "Organization Logo", description: "Upload your organization's logo for branding purposes." });
              setInfoDialogOpen(true);
            }}
            className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </label>
        <UniversalImageEditorModal
          type="logo"
          icon={<ImageIcon className="w-4 h-4" />}
          value={logo}
          fileName={logoFileName}
          previewDataUrl={data.logoPreviewDataUrl}
          onChange={async (value, fileName, headshotData) => {
            const previewDataUrl: string | undefined =
              (headshotData as any)?.previewDataUrl;
            const previewSrc = previewDataUrl || (value?.startsWith("data:") ? value : undefined);

            // SET the preview data URL IMMEDIATELY (synchronously, before any
            // await) so that when the modal closes ~500ms later the trigger-area
            // preview renders from the data URL instead of falling back to the
            // slow async R2 proxy fetch.  The color-extraction and onLogoPreview
            // callbacks are async and can take 5+ seconds each; we cannot wait
            // for them before making the preview URL available.
            if (previewSrc) {
              onDataChange("logoPreviewDataUrl", previewSrc);
            }

            // Save the logo value (and cache its preview DataURL against the R2
            // key) IMMEDIATELY, BEFORE the slow color-extraction/onLogoPreview
            // awaits below.  Otherwise, if the user navigates away from Step 3
            // during those ~10s of async work, the preview cache isn't populated
            // yet and the logo appears broken when they navigate back.
            onDataChange("logo", value);
            onDataChange("logoFileName", fileName);

            if (previewSrc) {
              // By default, extract colors directly from the logo data URL so the
              // swatches are populated on upload. When disableAutoColorExtraction
              // is set (e.g. the onboarding wizard, which uses the dedicated
              // "Extract Colors" button in BrandColorsSection), skip this so the
              // Primary/Secondary colors only populate when the user triggers
              // extraction.
              if (!disableAutoColorExtraction) {
                try {
                  const colors = await extractColorsFromImage(previewSrc);
                  onDataChange("primaryColor", colors.primary);
                  onDataChange("secondaryColor", colors.secondary);
                } catch {
                  // Non-critical – the user can pick colours manually
                }
              }
              if (onLogoPreview) {
                await onLogoPreview(previewSrc);
              }
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
      </div>

      {!hideColors && (
        <>
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
      </>)}

      {!hideBackgroundImage && (
        <BackgroundImageField
          value={data.backgroundImage || ""}
          fileName={data.backgroundFileName || ""}
          previewDataUrl={data.backgroundPreviewDataUrl}
          onChange={(value, fileName, previewSrc) => {
            // Dispatch the preview BEFORE backgroundImage so the module-level
            // previewDataUrlCache (keyed by R2 key) gets populated — mirroring the
            // logo path. If backgroundImage were dispatched first, the preview ref
            // would still be stale when the cache-write runs, so the background
            // preview would not survive navigating away from Step 3 and back.
            if (previewSrc) {
              onDataChange("backgroundPreviewDataUrl", previewSrc);
            }
            onDataChange("backgroundImage", value);
            onDataChange("backgroundFileName", fileName);
          }}
          onRemove={async () => {
            if (data.backgroundImage) {
              await deleteFromR2(data.backgroundImage);
            }
            onDataChange("backgroundImage", "");
            onDataChange("backgroundFileName", "");
            onFileRemove("backgroundImage");
          }}
          destructive={errorFields.includes("backgroundImage")}
        />
      )}

    </div>
  );

  if (hideCard) {
    return (
      <>
        {content}
        <InfoDialog
          open={infoDialogOpen}
          onOpenChange={setInfoDialogOpen}
          title={infoDialogConfig.title}
          description={infoDialogConfig.description}
        />
      </>
    );
  }

  return (
    <Card className="shadow-none h-full flex flex-col dark:bg-gray-800">
      <CardHeader className="pb-3">
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {content}
        <InfoDialog
          open={infoDialogOpen}
          onOpenChange={setInfoDialogOpen}
          title={infoDialogConfig.title}
          description={infoDialogConfig.description}
        />
      </CardContent>
    </Card>
  );
}
