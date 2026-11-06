"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModalGallery } from "@/components/ui/modalGallery";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { KeyContactImageCard } from "@/components/wizard/shared/key-contact-image-card";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { MissionStatementFields } from "@/components/wizard/new-client-steps/sections/mission-statement-fields";
import { TypographySection } from "@/components/wizard/new-client-steps/sections/typography-section";
import { useHeroOverlaySettings } from "@/components/wizard/new-client-steps/sections/hooks/use-hero-overlay-settings";
import { HERO_RECOMMENDED_SIZE_LABEL } from "@/components/wizard/new-client-steps/sections/utils/hero-utils";
import {
  exportFullResolutionImage,
  resolveBrandImageUrl,
} from "@/components/wizard/new-client-steps/sections/utils/image-utils";
import { CompanyLogoCard } from "@/components/wizard/new-client-steps/sections/components/company-logo-card";
import { BannerOverlaySettingsCard } from "@/components/wizard/new-client-steps/sections/components/banner-overlay-settings-card";
import {
  HeroBackgroundCard,
  type HeroSegmentMode,
} from "@/components/wizard/new-client-steps/sections/components/hero-background-card";
import { WelcomeStatementCard } from "@/components/wizard/new-client-steps/sections/components/welcome-statement-card";
import type { EditorSection } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { portalEditAnchor } from "@/lib/portal-editor-sections";
import type {
  BrandImageData,
  BrandImagesData,
  CompanyBasicsData,
  CompanyLogoData,
  WelcomeStatementData,
} from "@/types/new-client-wizard";
import type { TypographyThemeId } from "@/lib/typography-themes";

export interface PlanPreviewEditorSectionsProps {
  companyData: CompanyBasicsData;
  onCompanyDataChange: (field: any, value: any) => void;
  onLogoChange: (logoData: CompanyLogoData | null) => void;
  defaultWelcomeMessage: string;
  useDefaultWelcomeMessage: boolean;
  setUseDefaultWelcomeMessage: (checked: boolean) => void;
  clientId?: string;
  /** The plan's key contact headshot — drawn while the advisor has not chosen their own. */
  keyContactHeadshot?: string;
  /**
   * Show the "Key Contact Image" override card. Step 2 and Edit Client's Preview
   * show it; the portal's Landing page panel does not.
   */
  showKeyContactImage?: boolean;
  // Mission statement
  missionHeadline: string;
  missionBody: string;
  defaultBodyText: string;
  useDefaultBody: boolean;
  headlineRef: React.RefObject<HTMLInputElement | null>;
  bodyTextRef: React.RefObject<HTMLTextAreaElement | null>;
  handleHeadlineChange: (value: string) => void;
  handleBodyChange: (value: string) => void;
  handleUseDefaultBody: (checked: boolean) => void;
  handleGenerateMissionHeadline: () => void;
  handleGenerateMissionBody: () => void;
  headlineCharCount: number;
  bodyCharCount: number;
  isHeadlineValid: boolean;
  isBodyValid: boolean;
  errorFields: string[];
  /** Persists a Featured Image change; falls back to `brandImages` on `companyData`. */
  onBrandImagesChange?: (brandImages: BrandImagesData) => void | Promise<void>;
  /** Scrolls the live preview to the field being edited, when one is available. */
  onFieldFocus?: (field: string) => void;
  /** Lets the host sync its own desktop/mobile preview to the Hero card's tab. */
  onHeroSegmentModeChange?: (mode: HeroSegmentMode) => void;
  /**
   * Read the hero overlay settings straight from `companyData` instead of the
   * persisted Create Plan draft. The portal sets this so an old wizard draft in
   * localStorage can never mask the plan's saved values.
   */
  preferCompanyDataForOverlay?: boolean;
}

/**
 * The exact Editing Panel sections used by Create Plan Step 2 and Edit Client's
 * Preview tab: Typography, Images, Hero Content, Mission Statement.
 *
 * Shared so the portal's inline editor renders the same inputs and structure.
 * Returns the section list (for `EditorPanelWrapper`) plus the overlay modals
 * that the host must render as siblings of the panel.
 */
export function usePlanPreviewEditorSections({
  companyData,
  onCompanyDataChange,
  onLogoChange,
  defaultWelcomeMessage,
  useDefaultWelcomeMessage,
  setUseDefaultWelcomeMessage,
  clientId,
  keyContactHeadshot,
  showKeyContactImage = true,
  missionHeadline,
  missionBody,
  defaultBodyText,
  useDefaultBody,
  headlineRef,
  bodyTextRef,
  handleHeadlineChange,
  handleBodyChange,
  handleUseDefaultBody,
  handleGenerateMissionHeadline,
  handleGenerateMissionBody,
  headlineCharCount,
  bodyCharCount,
  isHeadlineValid,
  isBodyValid,
  errorFields,
  onBrandImagesChange,
  onFieldFocus,
  onHeroSegmentModeChange,
  preferCompanyDataForOverlay = false,
}: PlanPreviewEditorSectionsProps): {
  sections: EditorSection[];
  modals: React.ReactNode;
} {
  // ── Hero segment mode (Desktop / Mobile tabs inside the Hero Banner Image card) ──
  const [heroSegmentMode, setHeroSegmentMode] =
    useState<HeroSegmentMode>("desktop");

  const handleHeroSegmentModeChange = useCallback(
    (mode: HeroSegmentMode) => {
      setHeroSegmentMode(mode);
      onHeroSegmentModeChange?.(mode);
    },
    [onHeroSegmentModeChange],
  );

  // ── Hero background positions — derived directly from companyData ──
  const desktopHeroPosition =
    (companyData as any)?.desktopHeroBackgroundPosition ?? { x: 50, y: 50 };
  const mobileHeroPosition =
    (companyData as any)?.mobileHeroBackgroundPosition ?? { x: 50, y: 50 };

  const handleDesktopHeroPositionChange = useCallback(
    (position: { x: number; y: number }) => {
      onCompanyDataChange("desktopHeroBackgroundPosition", position);
    },
    [onCompanyDataChange],
  );

  const handleMobileHeroPositionChange = useCallback(
    (position: { x: number; y: number }) => {
      onCompanyDataChange("mobileHeroBackgroundPosition", position);
    },
    [onCompanyDataChange],
  );

  // ── Overlay settings ──
  const {
    heroOverlayOpacity,
    heroBackgroundOpacity,
    heroContainerBackgroundOpacity,
    heroContainerBlockOpacity,
    heroContainerInverted,
    heroBackgroundInverted,
    heroUseGradient,
    handleSettingsChange,
  } = useHeroOverlaySettings(
    companyData,
    onCompanyDataChange,
    undefined,
    undefined,
    { preferCompanyData: preferCompanyDataForOverlay },
  );

  // ── Hero background: default-photo gallery + crop editor ──
  const [heroGalleryOpen, setHeroGalleryOpen] = useState(false);
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  const [pendingHeroImageData, setPendingHeroImageData] =
    useState<BrandImageData | null>(null);

  // ── Image change handlers for editor cards ──
  const handleHeroImageChange = useCallback(
    (imageData: BrandImageData) => {
      const currentBrandImages = companyData.brandImages || ({} as BrandImagesData);
      onCompanyDataChange("brandImages", {
        ...currentBrandImages,
        header: imageData,
      });
    },
    [companyData.brandImages, onCompanyDataChange],
  );

  const handleHeroImageRemove = useCallback(() => {
    const currentBrandImages = companyData.brandImages || ({} as BrandImagesData);
    onCompanyDataChange("brandImages", {
      ...currentBrandImages,
      header: null,
    });
  }, [companyData.brandImages, onCompanyDataChange]);

  const handleLogoImageChange = useCallback(
    (imageData: BrandImageData) => {
      const logoData: CompanyLogoData = {
        url: imageData.url,
        fileName: imageData.fileName || "",
        fileSize: imageData.fileSize || 0,
        width: imageData.width || 0,
        height: imageData.height || 0,
        hasTransparency:
          imageData.url.includes("data:image/png") ||
          imageData.url.includes("data:image/svg"),
        warnings: imageData.warnings || [],
        cropData: imageData.cropData as any,
      };
      onLogoChange(logoData);
    },
    [onLogoChange],
  );

  const handleLogoImageRemove = useCallback(() => {
    onLogoChange(null);
  }, [onLogoChange]);

  const handleWelcomeHeadlineChange = useCallback(
    (value: string) => {
      onCompanyDataChange("heroTitle", value);
    },
    [onCompanyDataChange],
  );

  const handleWelcomeBodyChange = useCallback(
    (value: string) => {
      onCompanyDataChange("heroDescription", value);
    },
    [onCompanyDataChange],
  );

  const handleToggleDefaultBody = useCallback(
    (checked: boolean) => {
      setUseDefaultWelcomeMessage(checked);
      if (checked) {
        onCompanyDataChange("heroDescription", defaultWelcomeMessage);
      }
    },
    [setUseDefaultWelcomeMessage, onCompanyDataChange, defaultWelcomeMessage],
  );

  const heroImageData = companyData?.brandImages?.header || null;

  const welcomeCardData: WelcomeStatementData = {
    headline:
      (companyData as any)?.heroTitle ||
      `Welcome to the ${companyData?.companyName || "Company Name"} Benefits Hub!`,
    bodyText: (companyData as any)?.heroDescription || "",
    isAIGenerated: false,
  };

  /**
   * Persist a Featured Image change. The host passes its R2-aware handler where
   * it has one; otherwise the plain `brandImages` field is updated.
   */
  const handleBrandImagesChange =
    onBrandImagesChange ??
    ((next: BrandImagesData) => onCompanyDataChange("brandImages", next));

  /**
   * Open the crop editor on the ALREADY-saved hero image. The stored value is an
   * R2 key, which neither `<img>` nor Fabric can load, so resolve it first.
   */
  const handleHeroEditClick = useCallback(() => {
    if (!heroImageData) return;
    setPendingHeroImageData({
      ...heroImageData,
      url: resolveBrandImageUrl(heroImageData.url),
      originalUrl: resolveBrandImageUrl(heroImageData.originalUrl) || undefined,
      previewUrl: resolveBrandImageUrl(heroImageData.previewUrl) || undefined,
    });
    setIsHeroModalOpen(true);
  }, [heroImageData]);

  const handleHeroModalClose = useCallback(() => {
    setIsHeroModalOpen(false);
    setPendingHeroImageData(null);
  }, []);

  /** Persist a finished hero crop through the host's brand-images handler. */
  const handleHeroModalSave = useCallback(
    (
      value: string,
      fileName: string,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => {
      const current = pendingHeroImageData;
      const next: BrandImageData = {
        url: value,
        previewUrl: value,
        originalUrl: cropData?.originalImage || current?.originalUrl || value,
        fileName,
        fileSize: current?.fileSize ?? 0,
        width: current?.width ?? 0,
        height: current?.height ?? 0,
        recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
        status: "ok",
        warnings: [],
        cropData,
      };
      const nextBrandImages = {
        ...(companyData.brandImages || {}),
        header: next,
      } as BrandImagesData;
      void handleBrandImagesChange(nextBrandImages);
    },
    [pendingHeroImageData, handleBrandImagesChange, companyData.brandImages],
  );

  /** Gallery selection is handed to the crop editor before anything is saved. */
  const handleHeroGallerySelect = useCallback(async (url: string) => {
    let fileName = "default-image.png";
    let fileExtension = "png";
    if (url.startsWith("data:image/")) {
      const match = url.match(/data:image\/(\w+);/);
      if (match && match[1]) {
        fileExtension = match[1];
        fileName = `default-image.${fileExtension}`;
      }
    } else {
      const urlMatch = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i);
      if (urlMatch && urlMatch[1]) {
        fileExtension = urlMatch[1].toLowerCase();
        fileName = `default-image.${fileExtension}`;
      }
    }

    // Hand the ORIGINAL, full-resolution photo to the crop editor so the hero is
    // framed to its own guidelines and nothing is applied until the user saves.
    let dataUrl = url;
    let width = 0;
    let height = 0;
    try {
      const exported = await exportFullResolutionImage(url);
      dataUrl = exported.dataUrl;
      width = exported.width;
      height = exported.height;
    } catch (error) {
      console.error("Failed to load default photo for editing:", error);
    }

    setPendingHeroImageData({
      url: dataUrl,
      originalUrl: url,
      fileName,
      fileSize: 0,
      width,
      height,
      recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
      status: "ok",
      warnings: [],
    });
    setHeroGalleryOpen(false);
    setIsHeroModalOpen(true);
  }, []);

  // ── Editor panel sections ──
  const sections: EditorSection[] = [
    {
      title: "Typography",
      content: (
        <TypographySection
          title="Typography Theme"
          value={companyData?.typographyTheme}
          onChange={(id: TypographyThemeId) =>
            onCompanyDataChange("typographyTheme", id)
          }
          compact
          // Same AI suggestion as Create Plan, using this plan's saved website.
          enableAiSuggestion
          websiteUrl={companyData?.companyWebsite}
          companyName={companyData?.companyName}
        />
      ),
    },
    {
      title: "Images",
      content: (
        <div className="space-y-4">
          <Card className="dark:bg-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm dark:text-gray-100">
                Company Logo <span className="text-red-500">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyLogoCard
                companyLogo={companyData?.companyLogo}
                onLogoImageChange={handleLogoImageChange}
                onLogoImageRemove={handleLogoImageRemove}
                isHighlighted={false}
                onFieldFocus={() => onFieldFocus?.("banner")}
                // The Card above already says "Company Logo *", so the card's own
                // heading would be the second one on screen.
                showTitle={false}
              />
            </CardContent>
          </Card>

          {/* Addressed by the Landing Page's hero photograph — the "Edit hero
              background" affordance scrolls here. An anchor, not a section: the
              "Images" section also holds the Company Logo card above. */}
          <div data-edit-anchor={portalEditAnchor.heroBackground}>
            <Card className="dark:bg-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm dark:text-gray-100">
                  Hero Banner Image <span className="text-red-500">*</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HeroBackgroundCard
                  heroImageData={heroImageData}
                  onImageChange={handleHeroImageChange}
                  onImageRemove={handleHeroImageRemove}
                  onEditClick={handleHeroEditClick}
                  onFileSelect={(data) => handleHeroImageChange(data)}
                  onDefaultPhotoClick={() => setHeroGalleryOpen(true)}
                  segmentMode={heroSegmentMode}
                  onSegmentModeChange={handleHeroSegmentModeChange}
                  desktopPosition={desktopHeroPosition}
                  onDesktopPositionChange={handleDesktopHeroPositionChange}
                  mobilePosition={mobileHeroPosition}
                  onMobilePositionChange={handleMobileHeroPositionChange}
                  onFieldFocus={() => onFieldFocus?.("banner")}
                />
              </CardContent>
            </Card>
          </div>

          {/* The welcome banner's circular portrait. Left empty it shows the
              category's key contact headshot, so this is purely an override.
              Step 2 / Edit Client show it; the portal Landing panel does not. */}
          {showKeyContactImage && (
            <Card className="dark:bg-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm dark:text-gray-100">
                  Key Contact Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                <KeyContactImageCard
                  value={(companyData as any)?.heroPortraitImage || ""}
                  defaultImage={keyContactHeadshot}
                  onChange={(url) =>
                    onCompanyDataChange("heroPortraitImage", url)
                  }
                  clientId={clientId}
                  // The Card above already says "Key Contact Image".
                  showTitle={false}
                />
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      title: "Hero Content",
      content: (
        <div className="space-y-4">
          <Card className="dark:bg-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm dark:text-gray-100">
                Welcome Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WelcomeStatementCard
                welcomeData={welcomeCardData}
                companyName={companyData?.companyName || "Company Name"}
                errorFields={errorFields}
                useDefaultBody={useDefaultWelcomeMessage}
                onToggleDefaultBody={handleToggleDefaultBody}
                defaultBodyText={defaultWelcomeMessage}
                onHeadlineChange={handleWelcomeHeadlineChange}
                onBodyChange={handleWelcomeBodyChange}
                onFieldFocus={() => onFieldFocus?.("banner")}
              />
            </CardContent>
          </Card>

          <Card
            className="dark:bg-gray-800"
            onMouseDown={() => onFieldFocus?.("banner")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm dark:text-gray-100">
                Overlay Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BannerOverlaySettingsCard
                backgroundOpacity={heroBackgroundOpacity}
                containerBlockOpacity={heroContainerBlockOpacity}
                containerInverted={heroContainerInverted}
                backgroundInverted={heroBackgroundInverted}
                useGradient={heroUseGradient}
                onSettingsChange={handleSettingsChange}
                isHighlighted={false}
              />
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      title: "Mission Statement",
      content: (
        <div className="space-y-4">
          {/* Featured Image — the section's first item, mirroring Create Plan's
              Section 4. It is a brand image, so it reuses the very same uploader
              and cropper the Company tab's Brand Images area uses. */}
          <div data-edit-anchor={portalEditAnchor.featuredImage}>
            <BrandImagesSection
              brandImages={companyData.brandImages}
              visibleSlots={["thumbnail"]}
              onBrandImagesChange={handleBrandImagesChange}
            />
          </div>
          <Card className="dark:bg-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm dark:text-gray-100">
                Mission Statement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MissionStatementFields
                missionHeadline={missionHeadline}
                missionBody={missionBody}
                defaultBodyText={defaultBodyText}
                useDefaultBody={useDefaultBody}
                headlineCharCount={headlineCharCount}
                bodyCharCount={bodyCharCount}
                isHeadlineValid={isHeadlineValid}
                isBodyValid={isBodyValid}
                errorFields={errorFields}
                headlineRef={headlineRef as any}
                bodyTextRef={bodyTextRef as any}
                onHeadlineChange={handleHeadlineChange}
                onBodyChange={handleBodyChange}
                onUseDefaultBodyChange={handleUseDefaultBody}
                onGenerateMissionHeadline={handleGenerateMissionHeadline}
                onGenerateMissionBody={handleGenerateMissionBody}
                showUseDefault={false}
                onFieldFocus={() => onFieldFocus?.("mission")}
              />
            </CardContent>
          </Card>
        </div>
      ),
    },
  ];

  const modals = (
    <>
      {/* Default-photo picker and crop editor. Create Plan raises both from
          `BannerSectionEditor`; the preview/portal panels raise them here. */}
      <ModalGallery
        open={heroGalleryOpen}
        onOpenChange={setHeroGalleryOpen}
        onSelect={handleHeroGallerySelect}
      />

      {pendingHeroImageData && (
        <SimpleImageEditorModal
          modalTitle="Hero Banner Image"
          modalDescription="Upload and edit your image."
          value={pendingHeroImageData.url || ""}
          originalValue={pendingHeroImageData.originalUrl}
          fileName={pendingHeroImageData.fileName || ""}
          existingCropData={pendingHeroImageData.cropData}
          onChange={handleHeroModalSave}
          onRemove={handleHeroModalClose}
          isOpen={isHeroModalOpen}
          onClose={handleHeroModalClose}
          saveButtonText="Save Hero Banner Image"
          // The canvas, guide and export values the wizard's own hero editor uses,
          // so a crop made here and one made in Create Plan are the same crop.
          canvasWidth={640}
          canvasHeight={600}
          guidelineWidth={580}
          guidelineHeight={240}
          guidelinePadding={20}
          exportScale={3}
        />
      )}
    </>
  );

  return { sections, modals };
}
