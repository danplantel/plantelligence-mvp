"use client";

import { BannerPreviewSection } from "../banner-preview-section";
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
}: BannerSectionEditorProps) {
  return (
    <div data-section-id="banner">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Section 1
        </h3>
        <div className="h-px w-12 bg-border mt-2" />
      </div>
      <BannerPreviewSection
        onCompanyDataChange={onCompanyDataChange}
        onWelcomeDataChange={onWelcomeDataChange}
        hidePreviewCard
        isPreviewSticky={false}
        renderModalOutside={true}
        onModalStateChange={onModalStateChange}
        onLogoModalStateChange={onLogoModalStateChange}
        onOpenHeroTextEditor={onOpenHeroTextEditor}
        logoCardRef={logoCardRef}
        isLogoCardHighlighted={isLogoCardHighlighted}
        onLogoCardHighlightChange={onLogoCardHighlightChange}
        overlaySettingsCardRef={overlaySettingsCardRef}
        isOverlaySettingsHighlighted={isOverlaySettingsHighlighted}
        onOverlaySettingsHighlightChange={onOverlaySettingsHighlightChange}
        bannerTitleCardRef={bannerTitleCardRef}
        isBannerTitleHighlighted={isBannerTitleHighlighted}
        onBannerTitleHighlightChange={onBannerTitleHighlightChange}
        isWelcomeBodyHighlighted={isWelcomeBodyHighlighted}
        useDefaultBody={useDefaultBody}
        onToggleDefaultBody={onToggleDefaultBody}
        defaultBodyText={defaultBodyText}
        errorFields={errorFields}
      />
    </div>
  );
}
