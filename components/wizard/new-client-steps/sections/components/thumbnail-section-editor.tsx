"use client";

import { CardTitle } from "@/components/ui/card";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import { FEATURED_IMAGE_HELPER_TEXT } from "../../constants/brand-image-guides";
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
        Featured Image
      </CardTitle>
      <p className="text-sm text-muted-foreground mt-2 dark:text-gray-400">
        This image appears beside the company introduction on your Benefits Hub
        homepage and in card and preview placements. Upload a centered image
        with space around the edges.
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
            recommendedSize: "900×1000 px",
            // Shares the Featured Image helper line with the card in
            // `BrandImagesSection`, so the two Create Plan surfaces match.
            helperText: FEATURED_IMAGE_HELPER_TEXT,
            defaultPhoteButton: true,
            required: true,
            // `.webp` was missing here while the helper text (and the shared slot)
            // both list it — the file picker would have rejected a format the card
            // says it accepts.
            accept: ".png,.jpg,.jpeg,.webp",
            // 9:10 — the same shape the shared cropper pair in
            // `constants/brand-image-guides` writes to this slot, and the same
            // frame the mission section uses in the portal.
            previewAspectRatio: 9 / 10,
            previewLabel: "Featured preview (9:10)",
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

