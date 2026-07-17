"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BannerPreviewSection } from "../banner-preview-section";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageIcon, Settings, Image as ImageIcon2 } from "lucide-react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import { BannerOverlaySettingsCard } from "./banner-overlay-settings-card";
import { HeroBackgroundCard } from "./hero-background-card";
import { ModalGallery } from "@/components/ui/modalGallery";
import { useHeroOverlaySettings } from "../hooks/use-hero-overlay-settings";
import {
  HERO_RECOMMENDED_SIZE_LABEL,
  HERO_RECOMMENDED_WIDTH,
  HERO_RECOMMENDED_HEIGHT,
  autoCropHeroBackgroundImage,
} from "../utils/hero-utils";
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
  // Overlay settings hook for Hero section
  const storeCompanyBasics = useNewClientWizardStore((state) => state.stepData.companyBasics);
  const saveStepDataLocally = useNewClientWizardStore((state) => state.saveStepDataLocally);
  
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
    undefined,
    onCompanyDataChange,
    saveStepDataLocally,
    storeCompanyBasics,
  );

  // Hero background image state
  const [heroGalleryOpen, setHeroGalleryOpen] = useState(false);
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  const [pendingHeroImageData, setPendingHeroImageData] = useState<BrandImageData | null>(null);
  const lastHeroModalStateRef = useRef<{ isOpen: boolean; pendingData: BrandImageData | null } | null>(null);

  // Derive hero image data from store
  const heroImageData = storeCompanyBasics?.brandImages?.header ?? null;

  // Hero background handlers
  const handleHeroBackgroundImageChange = (imageData: BrandImageData) => {
    const store = useNewClientWizardStore.getState();
    const current = store.stepData.companyBasics;
    if (!current) return;

    const updatedBrandImages = {
      ...(current.brandImages || {}),
      header: imageData,
    };

    store.saveStepDataLocally("companyBasics", {
      ...current,
      brandImages: updatedBrandImages,
    });
  };

  const handleHeroBackgroundImageRemove = () => {
    const store = useNewClientWizardStore.getState();
    const current = store.stepData.companyBasics;
    if (!current) return;

    const updatedBrandImages = {
      ...(current.brandImages || {}),
      header: null,
    };

    store.saveStepDataLocally("companyBasics", {
      ...current,
      brandImages: updatedBrandImages,
    });
  };

  const handleHeroBackgroundEditClick = () => {
    if (heroImageData) {
      setPendingHeroImageData(heroImageData);
      setIsHeroModalOpen(true);
    }
  };

  const handleHeroBackgroundFileSelect = (imageData: BrandImageData) => {
    setPendingHeroImageData(imageData);
    setIsHeroModalOpen(true);
  };

  const handleHeroModalSave = useCallback(
    (
      value: string,
      fileName: string,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => {
      if (pendingHeroImageData) {
        const img = new Image();
        img.onload = () => {
          const warnings: string[] = [];
          if (
            img.width < HERO_RECOMMENDED_WIDTH ||
            img.height < HERO_RECOMMENDED_HEIGHT
          ) {
            warnings.push(
              `Below recommended size (${HERO_RECOMMENDED_SIZE_LABEL}). May appear blurry.`,
            );
          }

          const updatedImageData: BrandImageData = {
            ...pendingHeroImageData,
            url: value,
            originalUrl:
              cropData?.originalImage ||
              pendingHeroImageData.originalUrl ||
              value,
            fileName,
            width: img.width,
            height: img.height,
            status: (warnings.length > 0 ? "warning" : "ok") as
              | "ok"
              | "warning"
              | "error",
            warnings,
            cropData: cropData,
          };

          handleHeroBackgroundImageChange(updatedImageData);
        };
        img.onerror = () => {
          handleHeroBackgroundImageChange({
            ...pendingHeroImageData,
            url: value,
            fileName,
          });
        };
        img.src = value;
      }
      setIsHeroModalOpen(false);
      setPendingHeroImageData(null);
    },
    [pendingHeroImageData],
  );

  const handleHeroModalClose = useCallback(() => {
    setIsHeroModalOpen(false);
    setPendingHeroImageData(null);
  }, []);

  // Notify parent about hero modal state changes
  useEffect(() => {
    if (onModalStateChange) {
      const currentState = {
        isOpen: isHeroModalOpen,
        pendingData: pendingHeroImageData,
      };

      const lastState = lastHeroModalStateRef.current;
      if (
        !lastState ||
        lastState.isOpen !== currentState.isOpen ||
        lastState.pendingData !== currentState.pendingData
      ) {
        lastHeroModalStateRef.current = currentState;
        onModalStateChange({
          ...currentState,
          onSave: handleHeroModalSave,
          onClose: handleHeroModalClose,
        });
      }
    }
  }, [
    isHeroModalOpen,
    pendingHeroImageData,
    onModalStateChange,
    handleHeroModalSave,
    handleHeroModalClose,
  ]);

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

      {/* Hero Background Image */}
      <Card className="dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <ImageIcon2 className="w-5 h-5 text-accent-blue" />
            Background Header Image (Hero)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HeroBackgroundCard
            heroImageData={heroImageData}
            onImageChange={handleHeroBackgroundImageChange}
            onImageRemove={handleHeroBackgroundImageRemove}
            onEditClick={handleHeroBackgroundEditClick}
            onFileSelect={handleHeroBackgroundFileSelect}
            onDefaultPhotoClick={() => setHeroGalleryOpen(true)}
            segmentMode="desktop"
            onSegmentModeChange={() => {}}
            mobilePosition={{ x: 50, y: 50 }}
            onMobilePositionChange={() => {}}
          />
        </CardContent>
      </Card>

      {/* Hero Overlay Settings */}
      <Card className="dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Settings className="w-5 h-5 text-accent-blue" />
            Hero Overlay Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BannerOverlaySettingsCard
            ref={overlaySettingsCardRef}
            backgroundOpacity={heroBackgroundOpacity}
            containerBlockOpacity={heroContainerBlockOpacity}
            containerInverted={heroContainerInverted}
            backgroundInverted={heroBackgroundInverted}
            useGradient={heroUseGradient}
            onSettingsChange={handleSettingsChange}
            isHighlighted={isOverlaySettingsHighlighted}
          />
        </CardContent>
      </Card>

      {/* Default Photo Gallery for Hero Background */}
      <ModalGallery
        open={heroGalleryOpen}
        onOpenChange={setHeroGalleryOpen}
        onSelect={async (url) => {
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

          try {
            const { croppedUrl, width, height } =
              await autoCropHeroBackgroundImage(url);

            const warnings: string[] = [];
            if (
              width < HERO_RECOMMENDED_WIDTH ||
              height < HERO_RECOMMENDED_HEIGHT
            ) {
              warnings.push(
                `Below recommended size (${HERO_RECOMMENDED_SIZE_LABEL}). May appear blurry.`,
              );
            }

            const brandImageData: BrandImageData = {
              url: croppedUrl,
              fileName,
              fileSize: 0,
              width,
              height,
              recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
              status: (warnings.length > 0 ? "warning" : "ok") as
                | "ok"
                | "warning"
                | "error",
              warnings,
            };

            handleHeroBackgroundImageChange(brandImageData);
            setHeroGalleryOpen(false);
          } catch (error) {
            console.error("Failed to auto-crop image:", error);
            const img = new Image();
            img.onload = () => {
              const warnings: string[] = [];
              if (
                img.width < HERO_RECOMMENDED_WIDTH ||
                img.height < HERO_RECOMMENDED_HEIGHT
              ) {
                warnings.push(
                  `Below recommended size (${HERO_RECOMMENDED_SIZE_LABEL}). May appear blurry.`,
                );
              }

              const brandImageData: BrandImageData = {
                url,
                fileName,
                fileSize: 0,
                width: img.width,
                height: img.height,
                recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
                status: (warnings.length > 0 ? "warning" : "ok") as
                  | "ok"
                  | "warning"
                  | "error",
                warnings,
              };

              handleHeroBackgroundImageChange(brandImageData);
              setHeroGalleryOpen(false);
            };
            img.onerror = () => {
              const brandImageData: BrandImageData = {
                url,
                fileName,
                fileSize: 0,
                width: 0,
                height: 0,
                recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
                status: "ok",
                warnings: [],
              };
              handleHeroBackgroundImageChange(brandImageData);
              setHeroGalleryOpen(false);
            };
            img.src = url;
          }
        }}
      />
    </div>
  );
}
