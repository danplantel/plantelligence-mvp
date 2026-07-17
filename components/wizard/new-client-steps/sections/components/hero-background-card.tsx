"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Monitor, Smartphone } from "lucide-react";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import { MobileHeroCanvas } from "@/components/wizard/new-client-steps/sections/components/mobile-hero-canvas";
import type { BrandImageData, MobileHeroPosition } from "@/types/new-client-wizard";

const HERO_RECOMMENDED_SIZE_LABEL = "1920×1080 px";

export type HeroSegmentMode = "desktop" | "mobile";

interface HeroBackgroundCardProps {
  heroImageData: BrandImageData | null;
  onImageChange: (imageData: BrandImageData) => void;
  onImageRemove: () => void;
  onEditClick: () => void;
  onFileSelect: (imageData: BrandImageData) => void;
  onDefaultPhotoClick: () => void;
  /** Current segment mode (Desktop / Mobile) */
  segmentMode: HeroSegmentMode;
  /** Called when the user switches between Desktop and Mobile tabs */
  onSegmentModeChange: (mode: HeroSegmentMode) => void;
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
  mobilePosition,
  onMobilePositionChange,
}: HeroBackgroundCardProps) {
  // Resolve the image URL for the mobile canvas preview
  const imageUrl = heroImageData?.previewUrl || heroImageData?.url || undefined;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground dark:text-gray-400">
        This image displays in the header background of your Employee Benefits Hub. Upload a wide hero image for best results. If not uploading a picture, the Square Thumbnail will be used.
      </p>

      {/* ── Desktop / Mobile segment toggle ── */}
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-0.5">
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

      {/* ── Content per segment ── */}
      {segmentMode === "desktop" ? (
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
      ) : (
        <MobileHeroCanvas
          imageUrl={imageUrl}
          position={mobilePosition}
          onPositionChange={onMobilePositionChange}
          disabled={!heroImageData}
        />
      )}
    </div>
  );
}
