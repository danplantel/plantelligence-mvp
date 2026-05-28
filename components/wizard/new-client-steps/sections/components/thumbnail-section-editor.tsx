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
}

export function ThumbnailSectionEditor({
  currentImage,
  isHighlighted,
  onImageChange,
  onImageRemove,
  onDefaultPhotoClick,
  onEditClick,
  onFileSelect,
}: ThumbnailSectionEditorProps) {
  return (
    <div className="pt-6 border-t border-border dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide dark:text-gray-400">
          Section 2
        </h3>
        <div className="h-px w-12 bg-border mt-2 dark:bg-gray-600" />
      </div>
      <CardTitle className="flex pt-2 items-center gap-2 text-base font-semibold dark:text-gray-100">
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
        />
      </div>
    </div>
  );
}

