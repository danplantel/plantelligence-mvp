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
      // Upload the thumbnail to R2 (if a draft exists) so it survives a page
      // refresh / draft-continue, matching how the Company Logo and step-1's
      // brand images are persisted. Base64 data URLs are ephemeral — the
      // persistent R2 key resolves to a proxy URL on reload.
      let image = imageData;
      const draftClientId = useNewClientWizardStore.getState().draftClientId;
      if (draftClientId && imageData.url?.startsWith("data:")) {
        try {
          const { uploadBrandingToR2 } = await import("@/lib/branding-r2");
          const r2Key = await uploadBrandingToR2({
            dataUrlOrFile: imageData.url,
            fileName: imageData.fileName || "thumbnail.png",
            clientId: draftClientId,
            slot: "thumbnail",
          });
          if (r2Key) image = { ...imageData, url: r2Key };
        } catch (_) {
          // Keep the original data URL if the upload fails.
        }
      }
      const updatedBrandImages = {
        ...(stepData.companyBasics?.brandImages || {
          header: null,
          thumbnail: null,
          secondaryBanner: null,
          favicon: null,
        }),
        thumbnail: image,
      };
      handleBrandImagesChange(updatedBrandImages);
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
    thumbnailHighlightTimeoutRef,
    handleThumbnailImageChange,
    handleThumbnailImageRemove,
    handleThumbnailEditClick,
    handleThumbnailFileSelect,
  };
}

