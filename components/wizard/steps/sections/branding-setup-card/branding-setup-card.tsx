"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { ColorPicker } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { InfoDialog } from "@/components/ui/info-dialog";
import {
   Sparkles,
   Building2,
   Globe,
   Link,
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
     subdomain: string;
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
   const [websiteError, setWebsiteError] = useState<string>("");
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [infoDialogOpen, setInfoDialogOpen] = useState(false);
   const [infoDialogConfig, setInfoDialogConfig] = useState({ title: "", description: "" });

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
     subdomain,
   } = data;

  // Generate a URL-safe subdomain slug from a string (e.g., organization name)
  const generateSubdomainSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20);
  };

  // Sanitize subdomain input — only lowercase, numbers, hyphens
  const handleSubdomainChange = (value: string) => {
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 20);
    onDataChange("subdomain", sanitized);
  };

  // Compute the preview subdomain slug: use the entered value, auto-generate from org name, or fallback
  const previewSubdomainSlug =
    subdomain ||
    generateSubdomainSlug(organizationName || "") ||
    "your-organization";

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
          onChange={async (e) => {
            onDataChange("organizationName", e.target.value);
          }}
          placeholder="Enter organization name"
          required
          destructive={errorFields.includes("organizationName")}
          data-field="organizationName"
        />
      </div>

      {/* Portal Subdomain */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Portal Subdomain <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-muted-foreground dark:text-gray-400 mb-3">
          Customize the subdomain where employees will access your benefits portal.
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400 bg-muted/50 dark:bg-gray-900/50 rounded-lg px-3 py-2 mb-3">
          <span className="font-medium text-foreground dark:text-gray-200">
            {previewSubdomainSlug}
          </span>
          <span className="shrink-0">.plantel.pro</span>
        </div>
        <div className="relative">
          <Input
            icon={<Link className="h-4 w-4" />}
            value={subdomain}
            onChange={(e) => handleSubdomainChange(e.target.value)}
            placeholder={generateSubdomainSlug(organizationName || "") || "your-organization"}
            required
            destructive={errorFields.includes("subdomain")}
            data-field="subdomain"
            maxLength={20}
          />
          <div
            className={`absolute -top-8 right-0 flex items-center gap-2 transition-all duration-500 ease-out ${subdomain.length >= 15
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 pointer-events-none"
              }`}
          >
            <span
              className={`text-xs transition-colors duration-300 ${subdomain.length >= 20
                ? "text-red-500 dark:text-red-400"
                : "text-muted-foreground dark:text-gray-400"
                }`}
            >
              {subdomain.length}/20 characters
            </span>
            {subdomain.length >= 20 && (
              <Badge
                variant="destructive"
                className="text-xs animate-in fade-in slide-in-from-right-2 duration-500"
              >
                Limit reached
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground dark:text-gray-400 mt-2">
          Only lowercase letters, numbers, and hyphens allowed. Max 20 characters.
        </p>
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

            if (previewSrc) {
              // Extract colors directly from the logo data URL.  This runs
              // after we've already queued logoPreviewDataUrl, so the trigger
              // preview updates without waiting for colour extraction.
              try {
                const colors = await extractColorsFromImage(previewSrc);
                onDataChange("primaryColor", colors.primary);
                onDataChange("secondaryColor", colors.secondary);
              } catch {
                // Non-critical – the user can pick colours manually
              }
              if (onLogoPreview) {
                await onLogoPreview(previewSrc);
              }
            }
            // Now save the logo/data – the extracted colors are already in the store
            onDataChange("logo", value);
            onDataChange("logoFileName", fileName);
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
        <label className="block text-sm font-medium mb-1 flex items-center gap-1">
          Background Image (Optional)
          <button
            type="button"
            onClick={() => {
              setInfoDialogConfig({ title: "Background Image", description: "Upload a background image that will appear behind your content." });
              setInfoDialogOpen(true);
            }}
            className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </label>
        <UniversalImageEditorModal
          type="custom"
          icon={<ImageIcon className="w-4 h-4" />}
          value={data.backgroundImage || ""}
          fileName={data.backgroundFileName || ""}
          previewDataUrl={data.backgroundPreviewDataUrl}
          onChange={(value, fileName, headshotData) => {
            onDataChange("backgroundImage", value);
            onDataChange("backgroundFileName", fileName);
            // Use the DataURL preview passed back from the modal so preview works with R2 key
            const previewDataUrl: string | undefined =
              (headshotData as any)?.previewDataUrl;
            const previewSrc = previewDataUrl || (value?.startsWith("data:") ? value : undefined);
            if (previewSrc) {
              onDataChange("backgroundPreviewDataUrl", previewSrc);
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
      </div>

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
