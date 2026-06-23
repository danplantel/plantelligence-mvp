"use client";

import { BannerPreviewSection } from "../banner-preview-section";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import type {
  BrandImageData,
  CompanyLogoData,
} from "@/types/new-client-wizard";

interface BannerSectionEditorProps {
  onCompanyDataChange: (field: string, value: any) => void;
  onWelcomeDataChange: (
    field: "headline" | "bodyText" | "isAIGenerated",
    value: any,
  ) => void;
  onModalStateChange: (state: {
    isOpen: boolean;
    pendingData: BrandImageData | null;
    onSave: (
      value: string,
      fileName: string,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => void;
    onClose: () => void;
  }) => void;
  onLogoModalStateChange: (state: {
    isOpen: boolean;
    pendingData: CompanyLogoData | null;
    onSave: (
      value: string,
      fileName: string,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => void;
    onClose: () => void;
  }) => void;
  onOpenHeroTextEditor: (field: "title" | "description") => void;
  logoCardRef: React.RefObject<HTMLDivElement>;
  isLogoCardHighlighted: boolean;
  onLogoCardHighlightChange: (highlighted: boolean) => void;
  overlaySettingsCardRef: React.RefObject<HTMLDivElement>;
  isOverlaySettingsHighlighted: boolean;
  onOverlaySettingsHighlightChange: (highlighted: boolean) => void;
  bannerTitleCardRef: React.RefObject<HTMLDivElement>;
  isBannerTitleHighlighted: boolean;
  onBannerTitleHighlightChange: (highlighted: boolean) => void;
  isWelcomeBodyHighlighted?: boolean;
  useDefaultBody: boolean;
  onToggleDefaultBody: (checked: boolean) => void;
  defaultBodyText: string;
  errorFields?: string[];
  /** Self-contained logo editor — same as Step 1's UniversalImageEditorModal */
  isLogoModalOpen?: boolean;
  pendingLogoData?: CompanyLogoData | null;
  onLogoModalChange?: (
    value: string,
    fileName: string,
    headshotData?: any,
  ) => void;
  onLogoModalRemove?: () => void;
  onLogoModalClose?: () => void;
}

export function BannerSectionEditor({
  onCompanyDataChange,
  onWelcomeDataChange,
  onModalStateChange,
  onLogoModalStateChange,
  onOpenHeroTextEditor,
  logoCardRef,
  isLogoCardHighlighted,
  onLogoCardHighlightChange,
  overlaySettingsCardRef,
  isOverlaySettingsHighlighted,
  onOverlaySettingsHighlightChange,
  bannerTitleCardRef,
  isBannerTitleHighlighted,
  onBannerTitleHighlightChange,
  isWelcomeBodyHighlighted,
  useDefaultBody,
  onToggleDefaultBody,
  defaultBodyText,
  errorFields = [],
  isLogoModalOpen,
  pendingLogoData,
  onLogoModalChange,
  onLogoModalRemove,
  onLogoModalClose,
}: BannerSectionEditorProps) {
  return (
    <div data-section-id="banner" className="space-y-4">
      {/* Company Logo Editor at the very top — self-contained
          UniversalImageEditorModal matching Step 1. */}
      <Card className="dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <ImageIcon className="w-5 h-5 text-accent-blue" />
            Company Logo <span className="text-red-500">*</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Upload your company logo. Recommended size: 300×250px.
            Accepted formats: PNG, JPG, WebP, SVG. Max file size: 15 MB.
          </p>
        </CardHeader>
        <CardContent>
          <UniversalImageEditorModal
            type="logo"
            icon={<ImageIcon className="w-4 h-4" />}
            value={
              useNewClientWizardStore.getState().stepData.companyBasics
                ?.companyLogo?.url || ""
            }
            fileName={
              useNewClientWizardStore.getState().stepData.companyBasics
                ?.companyLogo?.fileName || ""
            }
            onChange={async (value, fileName) => {
              const store = useNewClientWizardStore.getState();
              const current = store.stepData.companyBasics;
              if (!current) return;
              store.saveStepDataLocally("companyBasics", {
                ...current,
                companyLogo: {
                  url: value,
                  fileName: fileName,
                  fileSize: 0,
                  width: 0,
                  height: 0,
                  hasTransparency:
                    value.includes("data:image/png") ||
                    value.includes("data:image/svg"),
                  warnings: [],
                } as CompanyLogoData,
              });
            }}
            onRemove={async () => {
              const store = useNewClientWizardStore.getState();
              const currentLogo = store.stepData.companyBasics?.companyLogo;
              if (currentLogo?.url && typeof currentLogo.url === "string" && currentLogo.url.startsWith("org/")) {
                await deleteFromR2(currentLogo.url);
              }
              const current = store.stepData.companyBasics;
              if (!current) return;
              store.saveStepDataLocally("companyBasics", {
                ...current,
                companyLogo: null,
              });
            }}
            placeholder="Upload Logo"
          />
        </CardContent>
      </Card>
    </div>
  );
}
