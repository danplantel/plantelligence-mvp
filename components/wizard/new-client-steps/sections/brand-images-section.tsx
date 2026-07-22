"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image as ImageIcon } from "lucide-react";
import { BrandImagesData, BrandImageData } from "@/types/new-client-wizard";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { ModalGallery } from "@/components/ui/modalGallery";
import { BrandImageUpload } from "../../../ui/brand-image-upload";
import { toR2BrandingKey, getR2ObjectProxyUrl } from "@/lib/branding-image-url";

interface BrandImagesSectionProps {
  brandImages: BrandImagesData;
  onBrandImagesChange: (brandImages: BrandImagesData) => void;
  errorFields?: string[];
  validationErrors?: Record<string, string[]>;
  visibleSlots?: (keyof BrandImagesData)[]; // Optional: filter which slots to show
}

const BRAND_IMAGE_SLOTS = [
  {
    key: "header" as keyof BrandImagesData,
    title: "Background Image",
    description:
      "This image displays in the header background of your Employee Benefits Hub. Upload a wide hero image for best results. If not uploading a picture, the Square Thumbnail will be used.",
    recommendedSize: "1920×1080 px",
    defaultPhoteButton: true,
    required: false,
    accept: ".png,.jpg,.jpeg,.webp",
    previewAspectRatio: 2.75,
    previewLabel: "Hero preview (2.75:1)",
  },
  {
    key: "thumbnail" as keyof BrandImagesData,
    title: "Square Thumbnail",
    description:
      "This image is used in square thumbnail placements across your Employee Hub. Upload a centered image with space around the edges.",
    recommendedSize: "900×900 px",
    previewText: "Preview thumb",
    defaultPhoteButton: true,
    required: true,
    accept: ".png,.jpg,.jpeg,.webp",
    previewAspectRatio: 1,
    previewLabel: "Thumbnail preview (1:1)",
  },
  {
    key: "secondaryBanner" as keyof BrandImagesData,
    title: "Secondary Section",
    description: "Used for secondary sections (like below Welcome Statement).",
    recommendedSize: "1600×600 px",
    required: false,
    accept: ".png,.jpg,.jpeg,.webp",
    defaultPhoteButton: true,
    previewAspectRatio: 16 / 9,
    previewLabel: "Banner preview (16:9)",
  },
];

export function BrandImagesSection({
  brandImages,
  onBrandImagesChange,
  errorFields = [],
  validationErrors = {},
  visibleSlots,
}: BrandImagesSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSlotKey, setActiveSlotKey] = useState<
    keyof BrandImagesData | null
  >(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [pendingImageData, setPendingImageData] = useState<{
    slotKey: keyof BrandImagesData;
    data: BrandImageData;
  } | null>(null);

  const handleImageChange = (
    slotKey: keyof BrandImagesData,
    imageData: BrandImageData,
  ) => {
    const updatedBrandImages = {
      ...brandImages,
      [slotKey]: imageData,
    };
    onBrandImagesChange(updatedBrandImages);
  };

  const handleImageRemove = (slotKey: keyof BrandImagesData) => {
    const currentImage = brandImages?.[slotKey];
    // Only revoke blob URLs (from createObjectURL), not data URLs or external URLs
    if (currentImage?.url?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(currentImage.url);
      } catch {
        // Ignore if already revoked
      }
    }
    const updatedBrandImages = {
      ...brandImages,
      [slotKey]: undefined,
    };
    onBrandImagesChange(updatedBrandImages);
  };

  const handleEditClick = (slotKey: keyof BrandImagesData) => {
    const currentImage = brandImages?.[slotKey];
    if (currentImage) {
      setPendingImageData({
        slotKey,
        data: currentImage,
      });
      setIsModalOpen(true);
    }
  };

  const handleFileSelectForEdit = (
    slotKey: keyof BrandImagesData,
    imageData: BrandImageData,
  ) => {
    setPendingImageData({ slotKey, data: imageData });
    setIsModalOpen(true);
  };

  const handleModalSave = (
    value: string,
    fileName: string,
    cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
  ): Promise<void> => {
    if (!pendingImageData) {
      setIsModalOpen(false);
      setPendingImageData(null);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      // Load image to get updated dimensions after editing
      const img = new Image();
      img.onload = async () => {
        const slot = BRAND_IMAGE_SLOTS.find(
          (s) => s.key === pendingImageData.slotKey,
        );
        if (!slot) {
          resolve();
          return;
        }

        const warnings: string[] = [];
        const [recWidth, recHeight] = slot.recommendedSize
          .split("×")
          .map((s) => parseInt(s));
        if (img.width < recWidth || img.height < recHeight) {
          warnings.push(
            `Below recommended size (${slot.recommendedSize}). May appear blurry.`,
          );
        }

        const updatedBrandImages = {
          ...brandImages,
          [pendingImageData.slotKey]: {
            ...pendingImageData.data,
            url: value,
            previewUrl: value, // data URL for instant preview display
            originalUrl:
              cropData?.originalImage ||
              pendingImageData.data.originalUrl ||
              value,
            fileName,
            width: img.width,
            height: img.height,
            status: warnings.length > 0 ? "warning" : "ok",
            warnings,
            cropData: cropData,
          },
        };

        // Await the parent's async chain (R2 upload + state update)
        // before resolving — this keeps the modal spinner alive
        await onBrandImagesChange(updatedBrandImages);

        // Read final R2 URLs from the store (handleBrandImagesChange
        // replaced the data URLs with R2 keys internally) and preload
        // the proxy URLs so the browser cache has them ready for step 2.
        const { useNewClientWizardStore } = await import(
          "@/lib/new-client-wizard-store"
        );
        const store = useNewClientWizardStore.getState();
        const finalBrandImages = store.stepData.companyBasics?.brandImages;
        const preloads: Promise<void>[] = [];
        if (finalBrandImages) {
          const slotsToCheck: (keyof BrandImagesData)[] = [
            "header", "thumbnail", "secondaryBanner", "favicon",
          ];
          for (const key of slotsToCheck) {
            const img = finalBrandImages[key];
            if (img?.url) {
              const r2Key = toR2BrandingKey(img.url);
              if (r2Key) {
                const proxyUrl = getR2ObjectProxyUrl(r2Key);
                if (proxyUrl) {
                  preloads.push(
                    new Promise<void>((r) => {
                      const preloadImg = new Image();
                      preloadImg.onload = () => r();
                      preloadImg.onerror = () => r();
                      preloadImg.src = proxyUrl;
                    }),
                  );
                }
              }
            }
          }
        }
        await Promise.all(preloads);

        resolve();
      };

      img.onerror = async () => {
        // Fallback if image fails to load
        const updatedBrandImages = {
          ...brandImages,
          [pendingImageData.slotKey]: {
            ...pendingImageData.data,
            url: value,
            originalUrl:
              cropData?.originalImage ||
              pendingImageData.data.originalUrl ||
              value,
            fileName,
            cropData: cropData,
          },
        };
        await onBrandImagesChange(updatedBrandImages);
        resolve();
      };

      img.src = value;
    });
    // NOTE: do NOT set isModalOpen / pendingImageData here —
    // SimpleImageEditorModal will call handleModalClose after
    // the promise resolves and the 500ms spinner delay completes.
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setPendingImageData(null);
  };

  const autoCropImage = (
    imageUrl: string,
    slotKey: keyof BrandImagesData,
  ): Promise<{ croppedUrl: string; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const slot = BRAND_IMAGE_SLOTS.find((s) => s.key === slotKey);
      if (!slot) {
        reject(new Error("Slot not found"));
        return;
      }

      // Get guideline settings based on slot type
      const canvasWidth =
        slotKey === "header" || slotKey === "secondaryBanner"
          ? 640
          : slotKey === "thumbnail"
          ? 600
          : 500;
      const canvasHeight =
        slotKey === "header" || slotKey === "secondaryBanner"
          ? 600
          : slotKey === "thumbnail"
          ? 600
          : 500;
      const guidelineWidth =
        slotKey === "thumbnail"
          ? 400
          : slotKey === "header" || slotKey === "secondaryBanner"
          ? 580
          : 300;
      const guidelineHeight =
        slotKey === "thumbnail"
          ? 400
          : slotKey === "header" || slotKey === "secondaryBanner"
          ? 240
          : 300;
      const guidelinePadding = 20;

      // Calculate guideline bounds (centered)
      const pad =
        guidelinePadding ??
        Math.max(10, Math.min(canvasWidth, canvasHeight) * 0.05);
      const outerWidth = Math.min(
        guidelineWidth ?? canvasWidth - pad * 2,
        canvasWidth - pad * 2,
      );
      const outerHeight = Math.min(
        guidelineHeight ?? canvasHeight - pad * 2,
        canvasHeight - pad * 2,
      );
      const outerLeft = (canvasWidth - outerWidth) / 2;
      const outerTop = (canvasHeight - outerHeight) / 2;

      // Load the image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Create a canvas for the full image with guideline dimensions
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvasWidth;
        tempCanvas.height = canvasHeight;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Calculate scale to cover the guideline area
        const scaleX = canvasWidth / img.width;
        const scaleY = canvasHeight / img.height;
        const scale = Math.max(scaleX, scaleY);

        // Calculate scaled dimensions
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        // Center the image
        const x = (canvasWidth - scaledWidth) / 2;
        const y = (canvasHeight - scaledHeight) / 2;

        // Draw the scaled image
        tempCtx.drawImage(img, x, y, scaledWidth, scaledHeight);

        // Create crop canvas for guideline area
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = outerWidth;
        cropCanvas.height = outerHeight;
        const cropCtx = cropCanvas.getContext("2d");
        if (!cropCtx) {
          reject(new Error("Failed to get crop canvas context"));
          return;
        }

        // Crop to guideline bounds
        cropCtx.drawImage(
          tempCanvas,
          outerLeft,
          outerTop,
          outerWidth,
          outerHeight,
          0,
          0,
          outerWidth,
          outerHeight,
        );

        // Get cropped image as data URL
        const croppedUrl = cropCanvas.toDataURL("image/png");
        resolve({
          croppedUrl,
          width: outerWidth,
          height: outerHeight,
        });
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      img.src = imageUrl;
    });
  };

  return (
    <Card data-section="brandImages" className="dark:bg-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-gray-100">
          <ImageIcon className="w-5 h-5 text-accent-blue" />
          Brand Images
        </CardTitle>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Upload brand images for different placements in your Employee Benefits
          Hub.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {BRAND_IMAGE_SLOTS.filter(
          (slot) => !visibleSlots || visibleSlots.includes(slot.key),
        ).map((slot) => {
          const currentImage = brandImages?.[slot.key];
          return (
            <BrandImageUpload
              key={slot.key}
              slotKey={slot.key}
              slot={slot}
              currentImage={currentImage || undefined}
              onImageChange={(imageData) =>
                handleImageChange(slot.key, imageData)
              }
              onImageRemove={() => handleImageRemove(slot.key)}
              onDefaultPhotoClick={() => {
                setActiveSlotKey(slot.key);
                setGalleryOpen(true);
              }}
              onEditClick={() => handleEditClick(slot.key)}
              onFileSelect={(imageData) =>
                handleFileSelectForEdit(slot.key, imageData)
              }
            />
          );
        })}
      </CardContent>

      <ModalGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={async (url) => {
          if (!activeSlotKey) return;
          const slot = BRAND_IMAGE_SLOTS.find((s) => s.key === activeSlotKey);
          if (!slot) return;

          // Determine file extension from URL
          let fileName = "default-image.png";
          let fileExtension = "png";

          // Check if it's a data URL
          if (url.startsWith("data:image/")) {
            const match = url.match(/data:image\/(\w+);/);
            if (match && match[1]) {
              fileExtension = match[1];
              fileName = `default-image.${fileExtension}`;
            }
          } else {
            // Try to extract extension from URL
            const urlMatch = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i);
            if (urlMatch && urlMatch[1]) {
              fileExtension = urlMatch[1].toLowerCase();
              fileName = `default-image.${fileExtension}`;
            }
          }

          try {
            // Auto-crop the image according to guideline settings
            const { croppedUrl, width, height } = await autoCropImage(
              url,
              activeSlotKey,
            );

            // Check warnings
            const warnings: string[] = [];
            const [recWidth, recHeight] = slot.recommendedSize
              .split("×")
              .map((s) => parseInt(s));
            if (width < recWidth || height < recHeight) {
              warnings.push(
                `Below recommended size (${slot.recommendedSize}). May appear blurry.`,
              );
            }

            const brandImageData: BrandImageData = {
              url: croppedUrl,
              fileName,
              fileSize: 0,
              width,
              height,
              recommendedSize: slot.recommendedSize,
              status: warnings.length > 0 ? "warning" : "ok",
              warnings,
            };

            const updatedBrandImages = {
              ...brandImages,
              [activeSlotKey]: brandImageData,
            };

            onBrandImagesChange(updatedBrandImages);
            setGalleryOpen(false);
            setActiveSlotKey(null);
          } catch (error) {
            console.error("Failed to auto-crop image:", error);
            // Fallback: save without cropping
            const img = new Image();
            img.onload = () => {
              const warnings: string[] = [];
              const [recWidth, recHeight] = slot.recommendedSize
                .split("×")
                .map((s) => parseInt(s));
              if (img.width < recWidth || img.height < recHeight) {
                warnings.push(
                  `Below recommended size (${slot.recommendedSize}). May appear blurry.`,
                );
              }

              const brandImageData: BrandImageData = {
                url,
                fileName,
                fileSize: 0,
                width: img.width,
                height: img.height,
                recommendedSize: slot.recommendedSize,
                status: warnings.length > 0 ? "warning" : "ok",
                warnings,
              };

              const updatedBrandImages = {
                ...brandImages,
                [activeSlotKey]: brandImageData,
              };

              onBrandImagesChange(updatedBrandImages);
              setGalleryOpen(false);
              setActiveSlotKey(null);
            };

            img.onerror = () => {
              // Final fallback
              const brandImageData: BrandImageData = {
                url,
                fileName,
                fileSize: 0,
                width: 0,
                height: 0,
                recommendedSize: slot.recommendedSize,
                status: "ok",
                warnings: [],
              };

              const updatedBrandImages = {
                ...brandImages,
                [activeSlotKey]: brandImageData,
              };

              onBrandImagesChange(updatedBrandImages);
              setGalleryOpen(false);
              setActiveSlotKey(null);
            };

            img.src = url;
          }
        }}
      />

      {pendingImageData && (
        <SimpleImageEditorModal
          modalTitle={
            pendingImageData.slotKey === "header"
              ? "Background image"
              : pendingImageData.slotKey === "thumbnail"
              ? "Thumbnail image"
              : pendingImageData.slotKey === "secondaryBanner"
              ? "Banner image"
              : pendingImageData.slotKey === "favicon"
              ? "Favicon"
              : "Background image"
          }
          modalDescription={
            pendingImageData.slotKey === "header"
              ? "This image displays in the header background of your Employee Benefits Hub. Upload a wide hero image for best results. If not uploading, the Square Thumbnail will be used."
              : pendingImageData.slotKey === "thumbnail"
              ? "This image is used in square thumbnail placements across your Employee Hub. Upload a centered image with space around the edges."
              : "Upload and edit your image."
          }
          value={pendingImageData.data.url || ""}
          originalValue={pendingImageData.data.originalUrl}
          fileName={pendingImageData.data.fileName || ""}
          existingCropData={pendingImageData.data.cropData}
          onChange={handleModalSave}
          onRemove={handleModalClose}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          saveButtonText={
            pendingImageData.slotKey === "header"
              ? "Save Background"
              : pendingImageData.slotKey === "thumbnail"
              ? "Save Thumbnail"
              : pendingImageData.slotKey === "secondaryBanner"
              ? "Save Banner"
              : pendingImageData.slotKey === "favicon"
              ? "Save Icon"
              : "Save Image"
          }
          canvasWidth={
            pendingImageData.slotKey === "header" ||
            pendingImageData.slotKey === "secondaryBanner"
              ? 640
              : pendingImageData.slotKey === "thumbnail"
              ? 600
              : 500
          }
          canvasHeight={
            pendingImageData.slotKey === "header" ||
            pendingImageData.slotKey === "secondaryBanner"
              ? 600
              : pendingImageData.slotKey === "thumbnail"
              ? 600
              : 500
          }
          guidelineWidth={
            pendingImageData.slotKey === "thumbnail"
              ? 400
              : pendingImageData.slotKey === "header" ||
                pendingImageData.slotKey === "secondaryBanner"
              ? 580
              : 300
          }
          guidelineHeight={
            pendingImageData.slotKey === "thumbnail"
              ? 450
              : pendingImageData.slotKey === "header" ||
                pendingImageData.slotKey === "secondaryBanner"
              ? 240
              : 300
          }
          guidelinePadding={20}
        />
      )}
    </Card>
  );
}
