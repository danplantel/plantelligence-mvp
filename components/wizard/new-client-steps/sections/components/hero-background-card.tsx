"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Monitor, Smartphone, ImageIcon } from "lucide-react";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import { HeroCanvas } from "@/components/wizard/new-client-steps/sections/components/mobile-hero-canvas";
import type { BrandImageData, MobileHeroPosition } from "@/types/new-client-wizard";

const HERO_RECOMMENDED_SIZE_LABEL = "1920×1080 px";

export type HeroSegmentMode = "desktop" | "mobile" | "edit";

interface HeroBackgroundCardProps {
  heroImageData: BrandImageData | null;
  onImageChange: (imageData: BrandImageData) => void;
  onImageRemove: () => void;
  onEditClick: () => void;
  onFileSelect: (imageData: BrandImageData) => void;
  onDefaultPhotoClick: () => void;
  /** Current segment mode (Desktop / Mobile / Edit) */
  segmentMode: HeroSegmentMode;
  /** Called when the user switches between tabs */
  onSegmentModeChange: (mode: HeroSegmentMode) => void;
  /** Current desktop background position */
  desktopPosition: MobileHeroPosition;
  /** Called when the user repositions the desktop hero background */
  onDesktopPositionChange: (position: MobileHeroPosition) => void;
  /** Current mobile background position */
  mobilePosition: MobileHeroPosition;
  /** Called when the user repositions the mobile hero background */
  onMobilePositionChange: (position: MobileHeroPosition) => void;
}

export function HeroBackgroundCard({
  heroImageData,
  onImageChange,
  onImageRemove,
  onEditClick,
  onFileSelect,
  onDefaultPhotoClick,
  segmentMode,
  onSegmentModeChange,
  desktopPosition,
  onDesktopPositionChange,
  mobilePosition,
  onMobilePositionChange,
}: HeroBackgroundCardProps) {
  // Resolve the image URL for the canvas preview
  const imageUrl = heroImageData?.previewUrl || heroImageData?.url || undefined;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground dark:text-gray-400">
        This image displays in the header background of your Employee Benefits Hub. Upload a wide hero image for best results.
      </p>

      {/* ── Desktop / Edit / Mobile segment toggle ── */}
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-0.5">
        <button
          type="button"
          onClick={() => onSegmentModeChange("edit")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
            segmentMode === "edit"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onSegmentModeChange("desktop")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
            segmentMode === "desktop"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          Desktop
        </button>
        <button
          type="button"
          onClick={() => onSegmentModeChange("mobile")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
            segmentMode === "mobile"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          Mobile
        </button>
      </div>

      {/* ── Edit tab: original photo upload/delete UI ── */}
      {segmentMode === "edit" ? (
        <BrandImageUpload
          slotKey="header"
          slot={{
            title: "",
            description: "",
            recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
            defaultPhoteButton: true,
            required: true,
            accept: ".png,.jpg,.jpeg,.webp",
            previewAspectRatio: 2.75,
            previewLabel: "Hero preview (2.75:1)",
          }}
          currentImage={heroImageData || undefined}
          onImageChange={onImageChange}
          onImageRemove={onImageRemove}
          onDefaultPhotoClick={onDefaultPhotoClick}
          onEditClick={onEditClick}
          onFileSelect={onFileSelect}
          maxFileSize={15}
        />
      ) : segmentMode === "desktop" ? (
        /* ── Desktop tab: reposition canvas ── */
        <div>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Desktop Focal Point
          </p>
          <HeroCanvas
            imageUrl={imageUrl}
            position={desktopPosition}
            onPositionChange={onDesktopPositionChange}
            disabled={!heroImageData}
            device="desktop"
          />
        </div>
      ) : (
        /* ── Mobile tab: reposition canvas ── */
        <div>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Mobile Focal Point
          </p>
          <HeroCanvas
            imageUrl={imageUrl}
            position={mobilePosition}
            onPositionChange={onMobilePositionChange}
            disabled={!heroImageData}
            device="mobile"
          />
        </div>
      )}
    </div>
  );
}
