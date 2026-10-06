"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image as ImageIcon, Eye, Crop, CheckCircle } from "lucide-react";
import { BrandImagesData, BrandImageData } from "@/types/new-client-wizard";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import {
  ModalGallery,
  type GalleryBackground,
} from "@/components/ui/modalGallery";
import { BrandImageUpload } from "../../../ui/brand-image-upload";
import { toR2BrandingKey, getR2ObjectProxyUrl } from "@/lib/branding-image-url";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { Button } from "@/components/ui/button";
import {
  THUMBNAIL_GUIDE_WIDTH,
  THUMBNAIL_GUIDE_HEIGHT,
  THUMBNAIL_EXPORT_SCALE,
} from "../constants/brand-image-guides";

/**
 * Turn a stored brand-image value into something the crop editor can actually load.
 *
 * A persisted brand image is an R2 KEY (`org/…/uploads/branding/…`). Neither `<img>`
 * nor Fabric can load a bare key — the browser treats it as a relative path and 404s —
 * so handing the stored value straight to `SimpleImageEditorModal` showed a broken
 * preview and an empty canvas when an existing image was reopened for editing. Anything
 * already loadable (`data:`, `blob:`, `http…`, the `/api/r2/object` proxy) passes
 * through untouched.
 */
function resolveBrandImageUrl(raw: string | null | undefined): string {
  const value = raw || "";
  if (!value) return "";
  const r2Key = toR2BrandingKey(value);
  if (!r2Key) return value;
  return getR2ObjectProxyUrl(r2Key) ?? value;
}

interface BrandImagesSectionProps {
  brandImages: BrandImagesData;
  onBrandImagesChange: (brandImages: BrandImagesData) => void | Promise<void>;
  errorFields?: string[];
  validationErrors?: Record<string, string[]>;
  visibleSlots?: (keyof BrandImagesData)[]; // Optional: filter which slots to show
  /** Company logo URL (R2 key or data URL) shown in the News & Events header preview navbar */
  logoUrl?: string | null;
  /** Company name used as the preview navbar fallback when no logo is selected */
  companyName?: string;
  /** Optional curated images shown in the "Choose a Default Image" modal. When
   *  omitted, the benefit-hub default backgrounds are used. */
  galleryImages?: GalleryBackground[];
}

const BRAND_IMAGE_SLOTS = [
  {
    key: "header" as keyof BrandImagesData,
    title: "Hero Banner Image",
    description:
      "The large banner at the top of your Benefits Hub homepage, behind the welcome message. If none is uploaded, the Featured Image is used.",
    recommendedSize: "1920×1080 px",
    defaultPhoteButton: true,
    required: false,
    accept: ".png,.jpg,.jpeg,.webp",
    previewAspectRatio: 2.75,
    previewLabel: "Hero preview (2.75:1)",
  },
  {
    key: "thumbnail" as keyof BrandImagesData,
    title: "Featured Image",
    description:
      "Appears beside the company introduction on your Benefits Hub homepage and in card and preview placements",
    recommendedSize: "900×1000 px",
    previewText: "Preview thumb",
    defaultPhoteButton: true,
    required: true,
    accept: ".png,.jpg,.jpeg,.webp",
    previewAspectRatio: 9 / 10,
    previewLabel: "Featured preview (9:10)",
  },
  {
    key: "secondaryBanner" as keyof BrandImagesData,
    title: "Page Header Image",
    description: "Used as the header background on interior Benefits Hub pages, such as News & Events. If none is uploaded, the Hero Banner Image is used. ",
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
  logoUrl,
  companyName,
  galleryImages,
}: BrandImagesSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSlotKey, setActiveSlotKey] = useState<
    keyof BrandImagesData | null
  >(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Incremented each time the "Choose a Default Image" modal is opened and used
  // as its React `key`. Remounting the gallery on every open guarantees its
  // internal selection state starts fresh — a previously picked-but-cancelled
  // image can never show up as "selected" on the next open.
  const [gallerySession, setGallerySession] = useState(0);
  const [pendingImageData, setPendingImageData] = useState<{
    slotKey: keyof BrandImagesData;
    data: BrandImageData;
  } | null>(null);
  /**
   * Which slot's crop is still being saved.
   *
   * The editor modal closes as soon as the crop is exported, but the R2 upload and
   * the proxy preload still have to finish, so the card needs its own spinner for
   * that window — the same overlay Create Plan's Featured Image card shows from
   * `isThumbnailUploading`.
   */
  const [uploadingSlotKey, setUploadingSlotKey] = useState<
    keyof BrandImagesData | null
  >(null);
  const [newsEventsPreviewOpen, setNewsEventsPreviewOpen] = useState(false);

  // Resolve the secondary banner image for the News & Events header preview
  const { url: resolvedSecondaryBannerUrl } = useBrandingImageUrl(
    brandImages?.secondaryBanner?.url ?? null,
  );

  // Resolve the company logo (R2 key or data URL) for the preview navbar
  const { url: resolvedLogoUrl } = useBrandingImageUrl(logoUrl ?? null);

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

  const handleImageRemove = async (slotKey: keyof BrandImagesData) => {
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
    // Await the parent's removal chain (R2 delete + persistence) so the Delete
    // button's spinner stays visible until the image is actually gone.
    await onBrandImagesChange(updatedBrandImages);
  };

  const handleSecondaryBannerUpload = async (imageData: BrandImageData) => {
    // Auto-crop the uploaded image (same logic as gallery flow), save it,
    // then open the combined preview/editor dialog directly.
    // Save the uploaded image directly — object-cover handles fitting
    // to the 72:25 preview container, so auto-cropping is unnecessary
    // and would create a mismatched aspect ratio that causes zooming.
    const updatedBrandImages = {
      ...brandImages,
      secondaryBanner: imageData,
    };
    await onBrandImagesChange(updatedBrandImages);

    // Open the combined preview dialog
    setNewsEventsPreviewOpen(true);
  };

  /**
   * Open the crop editor on an ALREADY-stored image.
   *
   * The stored value is an R2 KEY (`org/…/uploads/branding/…`), which neither `<img>`
   * nor Fabric can load — the browser resolves it as a relative path and 404s. Handing
   * it over unresolved is what produced a broken preview and an empty canvas when Hero
   * Banner Image / Featured Image were reopened for editing; the secondary banner's own
   * preview button had already worked around it locally, which is why only that slot
   * behaved. Resolve the three URL fields the editor reads; anything already loadable
   * (`data:`, `blob:`, `http…`) passes through untouched.
   */
  const handleEditClick = (slotKey: keyof BrandImagesData) => {
    const currentImage = brandImages?.[slotKey];
    if (!currentImage) return;
    setPendingImageData({
      slotKey,
      data: {
        ...currentImage,
        url: resolveBrandImageUrl(currentImage.url),
        originalUrl: resolveBrandImageUrl(currentImage.originalUrl) || undefined,
        previewUrl: resolveBrandImageUrl(currentImage.previewUrl) || undefined,
      },
    });
    setIsModalOpen(true);
  };

  const handleFileSelectForEdit = (
    slotKey: keyof BrandImagesData,
    imageData: BrandImageData,
  ) => {
    setPendingImageData({ slotKey, data: imageData });
    setIsModalOpen(true);
  };

  /**
   * Save a finished crop.
   *
   * Deliberately fire-and-forget: `SimpleImageEditorModal` awaits this handler and then
   * keeps its own Save-button spinner up for another 500ms before closing, so returning
   * the upload promise left the modal open — and spinning — for the whole R2 round-trip,
   * which meant the card's loading state was never visible. Create Plan's save handler is
   * synchronous for the same reason: the editor closes as soon as the crop is exported,
   * and the CARD carries the loading state while the upload finishes.
   */
  const handleModalSave = (
    value: string,
    fileName: string,
    cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
  ): void => {
    if (!pendingImageData) {
      setIsModalOpen(false);
      setPendingImageData(null);
      return;
    }

    void new Promise<void>((resolve) => {
      // Spinner on the card for the upload that follows the export, matching Create
      // Plan's `isThumbnailUploading`.
      setUploadingSlotKey(pendingImageData.slotKey);
      const finish = () => {
        setUploadingSlotKey(null);
        resolve();
      };

      // Load image to get updated dimensions after editing
      const img = new Image();
      img.onload = async () => {
        const slot = BRAND_IMAGE_SLOTS.find(
          (s) => s.key === pendingImageData.slotKey,
        );
        if (!slot) {
          finish();
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

        // The card spinner stops the moment the upload lands — the same point Create
        // Plan clears `isThumbnailUploading`. The proxy preload below is not part of the
        // loading state; it keeps running unwatched.
        await onBrandImagesChange(updatedBrandImages);
        setUploadingSlotKey(null);

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

        // When editing a secondary banner from the preview dialog,
        // re-open the preview after saving so the user sees the
        // adjusted image immediately.
        if (pendingImageData.slotKey === "secondaryBanner") {
          setNewsEventsPreviewOpen(true);
        }

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
        finish();
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

  /**
   * Exports the source image at its ORIGINAL full resolution — no crop and no
   * rescale. Used for default photos on every slot so the crop editor receives
   * the actual, original photo (not a pre-cropped band), and the user decides
   * the crop themselves before it is saved.
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

  return (
    <Card data-section="brandImages" className="pt-5 dark:bg-gray-800">
      {/* <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-gray-100">
          <ImageIcon className="w-5 h-5 text-accent-blue" />
          Brand Images
        </CardTitle>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Upload brand images for different placements in your Employee Benefits
          Hub.
        </p>
      </CardHeader> */}
      <CardContent className="space-y-6">
        {BRAND_IMAGE_SLOTS.filter(
          (slot) => !visibleSlots || visibleSlots.includes(slot.key),
        ).map((slot) => {
          const currentImage = brandImages?.[slot.key];
          const isSecondaryBanner = slot.key === "secondaryBanner";
          return (
            <div key={slot.key} className="space-y-3">
              <BrandImageUpload
                slotKey={slot.key}
                slot={slot}
                currentImage={currentImage || undefined}
                onImageChange={(imageData) =>
                  handleImageChange(slot.key, imageData)
                }
                onImageRemove={() => handleImageRemove(slot.key)}
                // Card spinner while this slot's crop is uploaded and persisted.
                isUploading={uploadingSlotKey === slot.key}
                previewObjectFit={
                  slot.key === "header" ? "cover" : "contain"
                }
                onDefaultPhotoClick={() => {
                  setActiveSlotKey(slot.key);
                  setGallerySession((s) => s + 1);
                  setGalleryOpen(true);
                }}
                onEditClick={() => {
                  if (isSecondaryBanner && currentImage) {
                    // For secondary banner, edit opens the combined preview
                    // where the user can crop/adjust while seeing the header
                    setNewsEventsPreviewOpen(true);
                  } else {
                    handleEditClick(slot.key);
                  }
                }}
                onFileSelect={(imageData) => {
                  if (isSecondaryBanner) {
                    // Skip the separate editor modal — auto-crop, save,
                    // and open the combined preview dialog directly
                    handleSecondaryBannerUpload(imageData);
                  } else {
                    handleFileSelectForEdit(slot.key, imageData);
                  }
                }}
                headerAction={
                  isSecondaryBanner && currentImage ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewsEventsPreviewOpen(true)}
                      className="shrink-0"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview in News & Events Header
                    </Button>
                  ) : undefined
                }
              />
            </div>
          );
        })}
      </CardContent>

      <ModalGallery
        key={gallerySession}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        images={galleryImages}
        awaitSelection
        busyLabel="Loading Preview..."
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

          // Build BrandImageData from the image chosen in the gallery. The
          // crop editor (opened below) lets the user frame it to the slot's
          // guidelines before anything is applied.
          const buildImageData = (
            displayUrl: string,
            width: number,
            height: number,
          ): BrandImageData => {
            const warnings: string[] = [];
            const [recWidth, recHeight] = slot.recommendedSize
              .split("×")
              .map((s) => parseInt(s));
            if (
              recWidth > 0 &&
              recHeight > 0 &&
              (width < recWidth || height < recHeight)
            ) {
              warnings.push(
                `Below recommended size (${slot.recommendedSize}). May appear blurry.`,
              );
            }
            return {
              url: displayUrl,
              fileName,
              fileSize: 0,
              width,
              height,
              recommendedSize: slot.recommendedSize,
              status: warnings.length > 0 ? "warning" : "ok",
              warnings,
            };
          };

          // For every slot, open the crop editor with the ORIGINAL photo
          // (full resolution — never pre-cropped or pre-scaled) so the user can
          // frame the default image to that slot's own guidelines before saving,
          // just like the "Crop / Adjust Image" flow. No image is applied on
          // selection; the editor's Save handler (handleModalSave) persists the
          // final crop and, for the Secondary Banner, re-opens the News &
          // Events preview afterwards.
          let displayUrl = url;
          let displayWidth = 0;
          let displayHeight = 0;
          try {
            const exported = await exportFullResolutionImage(url);
            displayUrl = exported.dataUrl;
            displayWidth = exported.width;
            displayHeight = exported.height;
          } catch (error) {
            console.error("Failed to load default photo for editing:", error);
          }
          setPendingImageData({
            slotKey: activeSlotKey,
            data: buildImageData(displayUrl, displayWidth, displayHeight),
          });
          // Close the gallery and hand off to the crop editor.
          setGalleryOpen(false);
          setActiveSlotKey(null);
          setIsModalOpen(true);
        }}
      />

      {pendingImageData && (
        <SimpleImageEditorModal
          modalTitle={
            pendingImageData.slotKey === "header"
              ? "Background image"
              : pendingImageData.slotKey === "thumbnail"
              ? "Featured image"
              : pendingImageData.slotKey === "secondaryBanner"
              ? "Banner image"
              : pendingImageData.slotKey === "favicon"
              ? "Favicon"
              : "Background image"
          }
          modalDescription={
            pendingImageData.slotKey === "header"
              ? "This image displays in the header background of your Employee Benefits Hub. Upload a wide hero image for best results. If not uploading, the Featured Image will be used."
              : pendingImageData.slotKey === "thumbnail"
              ? "This image appears beside the company introduction on your Benefits Hub homepage and in card and preview placements. Upload a centered image with space around the edges."
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
              ? "Save Featured Image"
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
          // Full-bleed slots (hero header background, secondary banner) must
          // export at high resolution. The editing canvas is small (~580px
          // guideline), so without exportScale the saved crop is ~580px and
          // looks grainy when stretched across a full-screen banner.
          // The Featured Image (thumbnail) guide frame is 396×440 on screen, so the
          // crop is scaled up to the 900×1000 the slot recommends — otherwise the
          // saved crop is far smaller (and softer) than the default image it
          // replaces. Full-bleed slots carry their own multiplier for the same
          // reason.
          exportScale={
            pendingImageData.slotKey === "header" ||
            pendingImageData.slotKey === "secondaryBanner"
              ? 3.5
              : pendingImageData.slotKey === "thumbnail"
              ? THUMBNAIL_EXPORT_SCALE
              : 1
          }
          // The Featured Image (the "thumbnail" slot) is a 9:10 portrait, so its two
          // axes take the pair from `constants/brand-image-guides` instead of one
          // shared size — the saved crop IS the guide rectangle, so the ratio has to
          // be expressed there, and all three croppers of this slot read it from there.
          guidelineWidth={
            pendingImageData.slotKey === "thumbnail"
              ? THUMBNAIL_GUIDE_WIDTH
              : pendingImageData.slotKey === "header" ||
                pendingImageData.slotKey === "secondaryBanner"
              ? 580
              : 300
          }
          guidelineHeight={
            pendingImageData.slotKey === "thumbnail"
              ? THUMBNAIL_GUIDE_HEIGHT
              : pendingImageData.slotKey === "header" ||
                pendingImageData.slotKey === "secondaryBanner"
              ? 240
              : 300
          }
          guidelinePadding={20}
          canvasOverlay={
            pendingImageData.slotKey === "secondaryBanner" ? (
              // Centered "News & Events" block — same as NewsEventsHeader — overlaid
              // on the crop canvas so the title position can be previewed while cropping.
              // Sized smaller than the crop guideline so it reads like the header title
              // badge rather than spanning the whole canvas.
              <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-6">
                <div className="bg-black/60 backdrop-blur-sm rounded-xl w-full max-w-[430px] px-4 py-3 sm:px-5 sm:py-4">
                  <h1 className="font-dm-serif text-white text-xl sm:text-2xl text-center leading-tight">
                    News & Events
                  </h1>
                </div>
              </div>
            ) : undefined
          }
        />
      )}

      {/* News & Events Header Preview Dialog */}
      <Dialog open={newsEventsPreviewOpen} onOpenChange={setNewsEventsPreviewOpen}>
        {/* `portal-root` forces Light Mode regardless of the dashboard dark theme —
            the preview must look like the (always-light) employee portal. */}
        <DialogContent className="portal-root max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>News & Events Header Preview</DialogTitle>
          </DialogHeader>

          {/* Full-page mockup: non-interactive navbar + header at desktop proportions */}
          <div className="flex flex-col bg-white">
            {/* Mock Top Navbar — non-interactive visual copy styled like the app header */}
            <div className="flex items-center h-16 px-10 border-b border-border bg-background shrink-0">
              {/* Logo on the left — actual company logo if selected */}
              <div className="flex items-center gap-2 mr-8 shrink-0">
                {resolvedLogoUrl ? (
                  <img
                    src={resolvedLogoUrl}
                    alt={`${companyName || "Company"} logo`}
                    className="h-8 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <>
                    <div className="h-7 w-7 rounded-full bg-gray-300" />
                    <span className="text-sm font-semibold text-gray-400">
                      {companyName || "Company"}
                    </span>
                  </>
                )}
              </div>

              {/* Nav links — matching the employee portal header tabs */}
              <nav className="flex items-center gap-1 text-xs ml-auto">
                <span className="px-3 py-1.5 rounded-md text-gray-400">
                  Your Benefits
                </span>
                <span className="px-3 py-1.5 rounded-md text-gray-700 bg-gray-100 font-medium">
                  News & Events
                </span>
                <span className="px-3 py-1.5 rounded-md text-gray-400">
                  My Benefits Team
                </span>
              </nav>
            </div>

            {/* Header — matches the 1008×350 px ratio of the News & Events
                 header section (1008/350 ≈ 2.88:1). */}
            <div className="relative w-full aspect-[72/25] overflow-hidden">
              {/* Background image */}
              {resolvedSecondaryBannerUrl ? (
                <img
                  src={resolvedSecondaryBannerUrl}
                  alt="Secondary banner preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gray-200" />
              )}

              {/* Dark overlay — same as NewsEventsHeader */}
              <div className="absolute inset-0 bg-black/40" />

              {/* Centered "News & Events" block — same as NewsEventsHeader */}
              <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-6">
                <div className="bg-black/60 backdrop-blur-sm rounded-xl w-full max-w-[90%] sm:max-w-[700px] px-6 py-6 sm:px-10 sm:py-8">
                  <h1 className="font-dm-serif text-white text-3xl sm:text-[40px] text-center leading-tight">
                    News & Events
                  </h1>
                </div>
              </div>
            </div>

            {/* Edit controls bar */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
              <Button
                className="bg-gray-700 text-white hover:bg-gray-800"
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const currentImage = brandImages?.secondaryBanner;
                  if (currentImage) {
                    // Same R2-key resolution as `handleEditClick` — see
                    // `resolveBrandImageUrl` for why the raw stored value cannot be
                    // handed straight to SimpleImageEditorModal.
                    setPendingImageData({
                      slotKey: "secondaryBanner",
                      data: {
                        ...currentImage,
                        url: resolveBrandImageUrl(currentImage.url),
                        originalUrl:
                          resolveBrandImageUrl(currentImage.originalUrl) ||
                          undefined,
                        previewUrl:
                          resolveBrandImageUrl(currentImage.previewUrl) ||
                          undefined,
                      },
                    });
                    setIsModalOpen(true);
                  }
                }}
              >
                <Crop className="w-4 h-4 mr-2" />
                Crop / Adjust Image
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setNewsEventsPreviewOpen(false)}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Save Banner
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
