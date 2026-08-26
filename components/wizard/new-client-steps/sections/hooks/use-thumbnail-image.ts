import { useState, useCallback, useRef } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import type { BrandImageData, BrandImagesData } from "@/types/new-client-wizard";

export function useThumbnailImage() {
  const { stepData, saveStepDataLocally } = useNewClientWizardStore();
  const [isThumbnailModalOpen, setIsThumbnailModalOpen] = useState(false);
  const [pendingThumbnailData, setPendingThumbnailData] =
    useState<BrandImageData | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [isThumbnailHighlighted, setIsThumbnailHighlighted] = useState(false);
  const [isThumbnailUploading, setIsThumbnailUploading] = useState(false);
  const thumbnailHighlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleBrandImagesChange = useCallback(
    (brandImages: BrandImagesData) => {
      if (stepData.companyBasics) {
        const updatedCompanyBasics = {
          ...stepData.companyBasics,
          brandImages,
        };
        saveStepDataLocally("companyBasics", updatedCompanyBasics);
      }
    },
    [stepData.companyBasics, saveStepDataLocally],
  );

  const handleThumbnailImageChange = useCallback(
    async (imageData: BrandImageData) => {
      const draftClientId = useNewClientWizardStore.getState().draftClientId;
      const isDataUrl = !!imageData.url?.startsWith("data:");

      // 1) Persist the data URL immediately (with previewUrl) so the thumbnail
      //    renders right away instead of waiting for the R2 upload.
      const displayImage: BrandImageData = isDataUrl
        ? { ...imageData, previewUrl: imageData.url }
        : imageData;
      const updatedBrandImages: BrandImagesData = {
        ...(stepData.companyBasics?.brandImages || {
          header: null,
          thumbnail: null,
          secondaryBanner: null,
          favicon: null,
        }),
        thumbnail: displayImage,
      };
      handleBrandImagesChange(updatedBrandImages);

      // 2) Upload to R2 in the background and swap in the persistent key once
      //    done (so the image survives a refresh / draft-continue).
      if (draftClientId && isDataUrl) {
        setIsThumbnailUploading(true);
        try {
          const { uploadBrandingToR2 } = await import("@/lib/branding-r2");
          const r2Key = await uploadBrandingToR2({
            dataUrlOrFile: imageData.url,
            fileName: imageData.fileName || "thumbnail.png",
            clientId: draftClientId,
            slot: "thumbnail",
          });
          if (r2Key) {
            const state = useNewClientWizardStore.getState();
            const latest = state.stepData.companyBasics;
            if (latest) {
              const persisted: BrandImagesData = {
                ...(latest.brandImages || {
                  header: null,
                  thumbnail: null,
                  secondaryBanner: null,
                  favicon: null,
                }),
                thumbnail: { ...displayImage, url: r2Key },
              };
              state.saveStepDataLocally("companyBasics", {
                ...latest,
                brandImages: persisted,
              });
            }
          }
        } catch (_) {
          // Keep the data URL if the upload fails.
        } finally {
          setIsThumbnailUploading(false);
        }
      }
    },
    [stepData.companyBasics?.brandImages, handleBrandImagesChange],
  );

  const handleThumbnailImageRemove = useCallback(() => {
    const currentImage = stepData.companyBasics?.brandImages?.thumbnail;
    if (currentImage?.url) {
      URL.revokeObjectURL(currentImage.url);
    }
    const updatedBrandImages = {
      ...(stepData.companyBasics?.brandImages || {
        header: null,
        thumbnail: null,
        secondaryBanner: null,
        favicon: null,
      }),
      thumbnail: null,
    };
    handleBrandImagesChange(updatedBrandImages);
  }, [stepData.companyBasics?.brandImages, handleBrandImagesChange]);

  const handleThumbnailEditClick = useCallback(() => {
    const currentImage = stepData.companyBasics?.brandImages?.thumbnail;
    if (currentImage) {
      setPendingThumbnailData(currentImage);
      setIsThumbnailModalOpen(true);
    }
  }, [stepData.companyBasics?.brandImages?.thumbnail]);

  const handleThumbnailFileSelect = useCallback((imageData: BrandImageData) => {
    setPendingThumbnailData(imageData);
    setIsThumbnailModalOpen(true);
  }, []);

  return {
    isThumbnailModalOpen,
    setIsThumbnailModalOpen,
    pendingThumbnailData,
    setPendingThumbnailData,
    galleryOpen,
    setGalleryOpen,
    isThumbnailHighlighted,
    setIsThumbnailHighlighted,
    isThumbnailUploading,
    setIsThumbnailUploading,
    thumbnailHighlightTimeoutRef,
    handleThumbnailImageChange,
    handleThumbnailImageRemove,
    handleThumbnailEditClick,
    handleThumbnailFileSelect,
  };
}

