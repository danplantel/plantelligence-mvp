"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { ColorPicker } from "@/components/ui/color-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Building2,
  Globe,
  Link,
  Palette,
  Image as ImageIcon,
} from "lucide-react";
import { useEffect } from "react";
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

interface BrandingData {
  organizationName: string;
  logo: string;
  logoFileName: string;
  website: string;
  missionStatement: string;
  brandColor: string;
  isColorPickerOpen: boolean;
  isGenerating: boolean;
  backgroundImage?: string;
  backgroundFileName?: string;
  aiAvatar?: string;
  avatarFileName?: string;
  subdomain: string;
  useDefaultWelcomeStatement?: boolean;
}

interface BrandingSetupCardProps {
  data: BrandingData;
  errorFields?: string[];
  onDataChange: (field: keyof BrandingData, value: any) => void;
  onFileUpload: (field: "logo", file: File) => void;
  onFileRemove: (field: "logo") => void;
  hideCard?: boolean;
}

export function BrandingSetupCard({
  data,
  errorFields = [],
  onDataChange,
  onFileUpload,
  onFileRemove,
  hideCard = false,
}: BrandingSetupCardProps) {
  const { validateCurrentStepFields } = useOnboardingWizardStore();

  const {
    organizationName,
    logo,
    logoFileName,
    website,
    missionStatement,
    brandColor,
    isColorPickerOpen,
    isGenerating,
    useDefaultWelcomeStatement = true,
  } = data;

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
      {/* Required Fields - Two Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-3">
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
              onChange={async (e) => {
                onDataChange("website", e.target.value);
                // Validate fields in real-time
                setTimeout(() => validateCurrentStepFields(), 100);
              }}
              placeholder="Enter organization website"
              type="text"
              required
              destructive={errorFields.includes("website")}
              data-field="website"
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-3">
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
              onChange={(value, fileName) => {
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

          {/* Brand Color */}
          <div className="relative">
            <label className="block text-sm font-medium mb-1">
              Organization Brand Color
            </label>
            <div className="flex items-center space-x-3">
              <button
                onClick={() =>
                  onDataChange("isColorPickerOpen", !isColorPickerOpen)
                }
                className="w-9 h-9 border rounded cursor-pointer flex items-center justify-center"
                style={{ background: brandColor }}
              >
                <div className="w-4 h-4 rounded border border-white/20" />
              </button>
              <Input
                icon={<Palette className="h-4 w-4" />}
                type="text"
                value={brandColor}
                onChange={(e) => onDataChange("brandColor", e.target.value)}
                placeholder="#1F3A60"
                className="flex-1"
                data-field="brandColor"
              />
            </div>

            <ColorPicker
              value={brandColor}
              onChange={(value) => onDataChange("brandColor", value)}
              isOpen={isColorPickerOpen}
              onOpenChange={(open) => onDataChange("isColorPickerOpen", open)}
            />
          </div>
        </div>
      </div>

      {/* Generate with AI Button - Active when website exists but no action */}
      <div className="space-y-2">
        <Button
          onClick={() => {}}
          disabled={!website}
          className="w-auto px-3 py-2"
        >
          <Sparkles className="mr-2 w-4 h-4" />
          AI Assistant
        </Button>
        {!website && (
          <p className="text-sm text-muted-foreground">
            Please enter your website URL to enable AI generation
          </p>
        )}
        {website && (
          <p className="text-sm text-muted-foreground">
            AI generation feature coming soon
          </p>
        )}
      </div>

      {/* AI Generated Content */}
      <div className="space-y-3">{/* Welcome Statement */}</div>
    </div>
  );

  if (hideCard) {
    return content;
  }

  return (
    <Card className="shadow-none h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Palette className="w-5 h-5 text-accent-blue" />
          Branding Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">{content}</CardContent>
    </Card>
  );
}
