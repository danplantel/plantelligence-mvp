"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BannerPreviewSection } from "../banner-preview-section";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageIcon, Settings, Image as ImageIcon2, Loader2 } from "lucide-react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import { BannerOverlaySettingsCard } from "./banner-overlay-settings-card";
import { HeroBackgroundCard, type HeroSegmentMode } from "./hero-background-card";
import { ModalGallery } from "@/components/ui/modalGallery";
import { useHeroOverlaySettings } from "../hooks/use-hero-overlay-settings";
import {
  HERO_RECOMMENDED_SIZE_LABEL,
  HERO_RECOMMENDED_WIDTH,
  HERO_RECOMMENDED_HEIGHT,
} from "../utils/hero-utils";
import type {
  BrandImageData,
  CompanyLogoData,
  MobileHeroPosition,
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
  /** Ref to the Hero Background Header Image card (used to scroll it into view) */
  heroBackgroundCardRef?: React.RefObject<HTMLDivElement>;
  /** Called when the user switches between Edit / Desktop / Mobile in Hero Background */
  onHeroSegmentModeChange?: (mode: HeroSegmentMode) => void;
  /** Called when any interactive element inside the editor gains focus */
  onFieldFocus?: () => void;
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
  heroBackgroundCardRef,
  onHeroSegmentModeChange,
  isLogoModalOpen,
  pendingLogoData,
  onLogoModalChange,
  onLogoModalRemove,
  onLogoModalClose,
  onFieldFocus,
}: BannerSectionEditorProps) {
  // Overlay settings hook for Hero section
  const storeCompanyBasics = useNewClientWizardStore((state) => state.stepData.companyBasics);

  // ── Hero Background segment mode & position state ──
  const [heroSegmentMode, setHeroSegmentMode] = useState<HeroSegmentMode>("edit");
  const [desktopHeroPosition, setDesktopHeroPosition] = useState<MobileHeroPosition>(
    () => (storeCompanyBasics as any)?.desktopHeroBackgroundPosition ?? { x: 50, y: 50 },
  );
  const [mobileHeroPosition, setMobileHeroPosition] = useState<MobileHeroPosition>(
    () => (storeCompanyBasics as any)?.mobileHeroBackgroundPosition ?? { x: 50, y: 50 },
  );
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
  const [isHeroUploading, setIsHeroUploading] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);

  // Derive hero image data from store
  const heroImageData = storeCompanyBasics?.brandImages?.header ?? null;

  // Hero background handlers
  const handleHeroBackgroundImageChange = async (imageData: BrandImageData) => {
    const store = useNewClientWizardStore.getState();
    const current = store.stepData.companyBasics;
    if (!current) return;

    const draftClientId = store.draftClientId;
    const isDataUrl = !!imageData.url?.startsWith("data:");

    // 1) Persist the data URL immediately (with previewUrl) so the hero
    //    background renders right away instead of waiting for the R2 upload.
    const displayImage: BrandImageData = isDataUrl
      ? { ...imageData, previewUrl: imageData.url }
      : imageData;
    store.saveStepDataLocally("companyBasics", {
      ...current,
      brandImages: { ...(current.brandImages || {}), header: displayImage },
    });

    // 2) Upload to R2 in the background and swap in the persistent key once
    //    done (so the image survives a refresh / draft-continue).
    if (draftClientId && isDataUrl) {
      setIsHeroUploading(true);
      try {
        const { uploadBrandingToR2 } = await import("@/lib/branding-r2");
        const r2Key = await uploadBrandingToR2({
          dataUrlOrFile: imageData.url,
          fileName: imageData.fileName || "hero.png",
          clientId: draftClientId,
          slot: "background",
        });
        if (r2Key) {
          const latest = useNewClientWizardStore.getState().stepData.companyBasics;
          if (latest) {
            const persisted = {
              ...(latest.brandImages || {}),
              header: { ...displayImage, url: r2Key },
            };
            useNewClientWizardStore
              .getState()
              .saveStepDataLocally("companyBasics", {
                ...latest,
                brandImages: persisted,
              });
          }
        }
      } catch (_) {
        // Keep the data URL if the upload fails.
      } finally {
        setIsHeroUploading(false);
      }
    }
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

  /**
   * Exports the source image at its ORIGINAL full resolution — no crop and no
   * rescale. Used for default photos so the crop editor receives the actual,
   * original photo (not a pre-cropped band), and the user decides the crop
   * themselves before it is saved. Mirrors Step 1's brand-images flow.
   */
  const exportFullResolutionImage = (
    imageUrl: string,
  ): Promise<{ dataUrl: string; width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({
            dataUrl: canvas.toDataURL("image/jpeg", 0.92),
            width: canvas.width,
            height: canvas.height,
          });
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageUrl;
    });

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
      <Card
        className="dark:bg-gray-800 relative overflow-hidden"
        onMouseDown={() => onFieldFocus?.()}
      >
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
        <CardContent className="relative">
          {isLogoUploading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 rounded-b-xl backdrop-blur-[1px]">
              <Loader2 className="w-6 h-6 animate-spin text-accent-blue" />
            </div>
          )}
          <UniversalImageEditorModal
            type="logo"
            icon={<ImageIcon className="w-4 h-4" />}
            onUploadStateChange={setIsLogoUploading}
            value={
              useNewClientWizardStore.getState().stepData.companyBasics
                ?.companyLogo?.url || ""
            }
            previewDataUrl={
              useNewClientWizardStore.getState().stepData.companyBasics
                ?.companyLogo?.previewUrl
            }
            fileName={
              useNewClientWizardStore.getState().stepData.companyBasics
                ?.companyLogo?.fileName || ""
            }
            onChange={async (value, fileName, headshotData) => {
              const store = useNewClientWizardStore.getState();
              const current = store.stepData.companyBasics;
              if (!current) return;
              const previewDataUrl = (
                headshotData as { previewDataUrl?: string } | undefined
              )?.previewDataUrl;
              store.saveStepDataLocally("companyBasics", {
                ...current,
                companyLogo: {
                  url: value,
                  previewUrl: previewDataUrl,
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
      <Card className="dark:bg-gray-800" ref={heroBackgroundCardRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <ImageIcon2 className="w-5 h-5 text-accent-blue" />
            Background Header Image (Hero){" "}
            <span className="text-red-500">*</span>
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
            segmentMode={heroSegmentMode}
            onSegmentModeChange={(mode) => {
              setHeroSegmentMode(mode);
              if (onHeroSegmentModeChange) {
                onHeroSegmentModeChange(mode);
              }
            }}
            desktopPosition={desktopHeroPosition}
            onDesktopPositionChange={(pos) => {
              setDesktopHeroPosition(pos);
              onCompanyDataChange("desktopHeroBackgroundPosition", pos);
            }}
            mobilePosition={mobileHeroPosition}
            onMobilePositionChange={(pos) => {
              setMobileHeroPosition(pos);
              onCompanyDataChange("mobileHeroBackgroundPosition", pos);
            }}
            onFieldFocus={onFieldFocus}
            isUploading={isHeroUploading}
          />
        </CardContent>
      </Card>

      {/* Hero Overlay Settings */}
      <Card className="dark:bg-gray-800" onMouseDown={() => onFieldFocus?.()}>
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

          // Match the Step 1 brand-images flow: hand the ORIGINAL (full
          // resolution, never pre-cropped) photo to the crop editor so the user
          // frames it to the hero guidelines themselves, instead of auto-cropping
          // and applying immediately. Nothing is applied until the user saves.
          try {
            const exported = await exportFullResolutionImage(url);
            setPendingHeroImageData({
              url: exported.dataUrl,
              originalUrl: url,
              fileName,
              fileSize: 0,
              width: exported.width,
              height: exported.height,
              recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
              status: "ok",
              warnings: [],
            } as BrandImageData);
          } catch (error) {
            console.error("Failed to load default photo for editing:", error);
            // Fall back to the raw URL so the editor can still open.
            setPendingHeroImageData({
              url,
              originalUrl: url,
              fileName,
              fileSize: 0,
              width: 0,
              height: 0,
              recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
              status: "ok",
              warnings: [],
            } as BrandImageData);
          }
          setHeroGalleryOpen(false);
          setIsHeroModalOpen(true);
        }}
      />
    </div>
  );
}
