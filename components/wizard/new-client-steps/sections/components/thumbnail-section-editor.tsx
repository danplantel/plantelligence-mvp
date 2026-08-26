"use client";

import { CardTitle } from "@/components/ui/card";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import type { BrandImageData } from "@/types/new-client-wizard";

interface ThumbnailSectionEditorProps {
  currentImage?: BrandImageData;
  isHighlighted: boolean;
  onImageChange: (imageData: BrandImageData) => void;
  onImageRemove: () => void;
  onDefaultPhotoClick: () => void;
  onEditClick: () => void;
  onFileSelect: (imageData: BrandImageData) => void;
  /** Called when any interactive element inside the upload area gains focus */
  onFieldFocus?: () => void;
  /** When true, shows a loading overlay on the upload area (e.g. while an R2 upload is in flight). */
  isUploading?: boolean;
}

export function ThumbnailSectionEditor({
  currentImage,
  isHighlighted,
  onImageChange,
  onImageRemove,
  onDefaultPhotoClick,
  onEditClick,
  onFileSelect,
  onFieldFocus,
  isUploading = false,
}: ThumbnailSectionEditorProps) {
  return (
    <div className="rounded-xl border border-[#efefef] dark:border-[#1c1c1c] bg-card dark:bg-gray-800 text-card-foreground p-6">
      <CardTitle className="flex items-center gap-2 text-base font-semibold dark:text-gray-100">
        Square Thumbnail <span className="text-xs text-red-500">*</span>
      </CardTitle>
      <p className="text-sm text-muted-foreground mt-2 dark:text-gray-400">
        This image is used in square thumbnail placements across your Employee Hub. Upload a centered image with space around the edges.
      </p>
      <div
        className="transition-all duration-500"
        data-section-id="thumbnail"
      >
        <BrandImageUpload
          slotKey="thumbnail"
          slot={{
            title: "",
            description: "",
            recommendedSize: "900×900 px",
            defaultPhoteButton: true,
            required: true,
            accept: ".png,.jpg,.jpeg",
            previewAspectRatio: 1,
            previewLabel: "Thumbnail preview (1:1)",
          }}
          currentImage={currentImage}
          onImageChange={onImageChange}
          onImageRemove={onImageRemove}
          onDefaultPhotoClick={onDefaultPhotoClick}
          onEditClick={onEditClick}
          onFileSelect={onFileSelect}
          isHighlighted={isHighlighted}
          onFocus={onFieldFocus}
          isUploading={isUploading}
        />
      </div>
    </div>
  );
}

