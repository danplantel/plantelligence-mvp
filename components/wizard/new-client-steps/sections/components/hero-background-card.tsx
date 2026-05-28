"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import type { BrandImageData } from "@/types/new-client-wizard";

const HERO_RECOMMENDED_SIZE_LABEL = "1920×1080 px";

interface HeroBackgroundCardProps {
  heroImageData: BrandImageData | null;
  onImageChange: (imageData: BrandImageData) => void;
  onImageRemove: () => void;
  onEditClick: () => void;
  onFileSelect: (imageData: BrandImageData) => void;
  onDefaultPhotoClick: () => void;
}

export function HeroBackgroundCard({
  heroImageData,
  onImageChange,
  onImageRemove,
  onEditClick,
  onFileSelect,
  onDefaultPhotoClick,
}: HeroBackgroundCardProps) {
  return (
    <>
      <CardTitle className="flex pt-2 items-center gap-2 dark:text-gray-100">
        Background Header Image (Hero)
      </CardTitle>
      <p className="text-sm text-muted-foreground dark:text-gray-400">
        This image displays in the header background of your Employee Benefits Hub. Upload a wide hero image for best results. If not uploading a picture, the Square Thumbnail will be used.
      </p>

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
    </>
  );
}
