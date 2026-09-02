"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { X, Upload, AlertTriangle, Plus, Edit2, Loader2 } from "lucide-react";
import { BrandImageData } from "@/types/new-client-wizard";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { toR2BrandingKey } from "@/lib/branding-image-url";
import {
  isZipFile,
  extractImagesFromZip,
  revokeZipImagePreviews,
  type ExtractedFile,
  type ExtractedImage,
} from "@/lib/zip-image-extract";
import { ZipFilePickerModal } from "@/components/ui/zip-file-picker-modal";

interface BrandImageUploadProps {
  slotKey: string;
  slot: {
    title: string;
    description: string;
    recommendedSize: string;
    accept: string;
    required: boolean;
    previewAspectRatio?: number;
    previewLabel?: string;
    defaultPhoteButton?: boolean;
  };
  currentImage?: BrandImageData;
  onImageChange: (imageData: BrandImageData) => void;
  onImageRemove: () => void;
  onDefaultPhotoClick?: () => void;
  onEditClick?: () => void;
  onFileSelect?: (imageData: BrandImageData) => void;
  hideButtons?: boolean; // Hide Replace, Edit, Remove buttons
  useUniversalModal?: boolean; // Use UniversalImageEditorModal instead of onFileSelect
  universalModalType?: "headshot" | "logo" | "normalizer" | "custom"; // Type for UniversalImageEditorModal
  universalModalCustomConfig?: Partial<import("@/components/ui/universal-image-editor-modal").ImageEditorConfig>; // Custom config overrides
  maxFileSize?: number; // Max file size in MB (default: 15)
  editableDescription?: boolean; // Allow editing description
  onDescriptionChange?: (description: string) => void; // Callback when description changes
  hidePerfectMessage?: boolean; // Hide "Perfect" message in modal
  renderModalOutside?: boolean; // When true, modal will not be rendered inside this component
  onModalStateChange?: (state: {
    isOpen: boolean;
    pendingData: BrandImageData | null;
    onSave: (
      value: string,
      fileName: string,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => void;
    onClose: () => void;
  }) => void; // Callback to get modal state for external rendering
  isHighlighted?: boolean;
  /** Called when any interactive element inside the upload area gains focus */
  onFocus?: () => void;
  /**
   * Object-fit for the thumbnail preview. Defaults to "contain" (shows the whole
   * image, appropriate for logos). Use "cover" for full-bleed assets (e.g. a hero
   * header background) so the preview fills the box exactly like the rendered banner.
   */
  previewObjectFit?: React.CSSProperties["objectFit"];
  /** Optional action rendered on the right side of the header/title row. */
  headerAction?: React.ReactNode;
  /** When true, shows a loading overlay on the upload area (e.g. while an R2 upload is in flight). */
  isUploading?: boolean;
}

export function BrandImageUpload({
  slot,
  currentImage,
  onImageChange,
  onImageRemove,
  onDefaultPhotoClick,
  onEditClick,
  onFileSelect,
  hideButtons = false,
  useUniversalModal = false,
  universalModalType = "normalizer",
  maxFileSize = 15,
  editableDescription = false,
  onDescriptionChange,
  hidePerfectMessage = false,
  renderModalOutside = false,
  onModalStateChange,
  isHighlighted = false,
  universalModalCustomConfig = {},
  onFocus,
  previewObjectFit = "contain",
  headerAction,
  isUploading = false,
}: BrandImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingImageData, setPendingImageData] =
    useState<BrandImageData | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(slot.description);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isZipPickerOpen, setIsZipPickerOpen] = useState(false);
  const [pendingZipImages, setPendingZipImages] = useState<
    ExtractedImage[] | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastModalStateRef = useRef<{
    isOpen: boolean;
    pendingData: BrandImageData | null;
  } | null>(null);

  const storedLogoUrl = currentImage?.url ?? null;
  const { url: displayUrl } = useBrandingImageUrl(storedLogoUrl);
  // Never fall back to raw org/… keys in <img src> — the browser resolves them as /org/… (404).
  const isStoredR2Key = toR2BrandingKey(storedLogoUrl) != null;
  // Use previewUrl (data URL from the editor) for instant display — no R2 proxy
  // round-trip needed. NOTE: use `||` (not `??`) — the persist layer may strip
  // the large base64 previewUrl to "" (localStorage quota), and `??` would keep
  // that empty string and render a broken <img>, whereas `||` falls back to the
  // resolved R2 proxy / data URL so the image still displays after refresh.
  const previewSrc =
    currentImage?.previewUrl ||
    (isStoredR2Key
      ? displayUrl ?? undefined
      : displayUrl ?? storedLogoUrl ?? undefined);

  useEffect(() => {
  }, [pendingImageData]);
  // Sync editedDescription with slot.description when it changes externally
  useEffect(() => {
    if (!isEditingDescription) {
      setEditedDescription(slot.description);
    }
  }, [slot.description, isEditingDescription]);

  const processImageFile = (file: File) => {
    const allowedTypes = new Set([
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      ...slot.accept
        .split(",")
        .map((type) => `image/${type.replace(/^\./, "").trim()}`),
    ]);
    if (!file.type || !allowedTypes.has(file.type)) {
      const fallbackImage = file.type?.startsWith("image/");
      if (!fallbackImage) {
        alert(`Unsupported file. Please upload an image (PNG, JPG, JPEG, WebP, or SVG), or a .zip folder of images.`);
        return;
      }
    }

    if (file.size > maxFileSize * 1024 * 1024) {
      alert(`File too large. Please upload a file under ${maxFileSize} MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const warnings: string[] = [];
        const dims = slot.recommendedSize.match(/\d+/g);
        const recWidth = dims?.[0] ? parseInt(dims[0], 10) : 0;
        const recHeight = dims?.[1] ? parseInt(dims[1], 10) : 0;
        if (recWidth > 0 && recHeight > 0 && (img.width < recWidth || img.height < recHeight)) {
          warnings.push(
            `Below recommended size (${slot.recommendedSize}). May appear blurry.`,
          );
        }

        const brandImageData: BrandImageData = {
          url: base64String,
          fileName: file.name,
          fileSize: file.size,
          width: img.width,
          height: img.height,
          recommendedSize: slot.recommendedSize,
          status: warnings.length > 0 ? "warning" : "ok",
          warnings,
        };

        // Compress large images before proceeding
        const processImage = async () => {
          if (base64String.length > 200000) { // Compress if > 200KB
            try {
              const { compressImage } = await import("@/lib/image-compression");
              // For full-bleed slots (hero header background, inner header image,
              // etc.) never downscale below the slot's recommended size and use a
              // higher JPEG quality — the old flat 1600px cap + q0.8 left large
              // heroes pixelated/grainy when stretched to fill the banner.
              const isFullBleed = recWidth >= 1600 || recHeight >= 1080;
              const cap = isFullBleed
                ? Math.max(2560, recWidth, recHeight)
                : Math.max(1600, recWidth, recHeight);
              const compressedUrl = await compressImage(base64String, {
                maxWidth: cap,
                maxHeight: cap,
                quality: isFullBleed ? 0.92 : 0.8,
              });
              brandImageData.url = compressedUrl;
            } catch (err) {
              console.warn("Image compression failed, using original", err);
            }
          }

          if (useUniversalModal) {
            // Open UniversalImageEditorModal (from upload, not edit)
            setPendingImageData(brandImageData);
            setIsEditMode(false);
            setIsModalOpen(true);
          } else if (onFileSelect) {
            onFileSelect(brandImageData);
          } else {
            onImageChange(brandImageData);
          }
        };

        processImage();
      };

      img.src = base64String;
    };

    reader.readAsDataURL(file);
  };

  // When a .zip is dropped/selected, extract the images in the browser and use
  // the single image directly (or open a thumbnail picker for multiple).
  const handleFileSelect = async (file: File) => {
    if (isZipFile(file)) {
      try {
        const extracted = await extractImagesFromZip(file);
        if (extracted.length === 1) {
          processImageFile(extracted[0].file);
          return;
        }
        setPendingZipImages(extracted);
        setIsZipPickerOpen(true);
        return;
      } catch (err) {
        alert((err as Error).message || "Could not read that .zip file.");
        return;
      }
    }
    processImageFile(file);
  };

  const handleZipImageSelected = (image: ExtractedFile) => {
    setIsZipPickerOpen(false);
    setPendingZipImages((prev) => {
      if (prev) revokeZipImagePreviews(prev);
      return null;
    });
    processImageFile(image.file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    if (currentImage?.url?.startsWith?.("blob:")) {
      URL.revokeObjectURL(currentImage.url);
    }
    onImageRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleModalSave = useCallback(
    (
      value: string,
      fileName: string,
      headshotData?: any,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => {
      if (pendingImageData) {
        // Update image data with edited image
        const updatedImageData: BrandImageData = {
          ...pendingImageData,
          url: value, // Cropped image for UI
          originalUrl:
            cropData?.originalImage || pendingImageData.originalUrl || value, // Original image for reset
          fileName: fileName,
          cropData: cropData, // Save crop metadata
        };
        onImageChange(updatedImageData);
      }
      setIsModalOpen(false);
      setPendingImageData(null);
    },
    [pendingImageData, onImageChange],
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setPendingImageData(null);
    setIsEditMode(false);
  }, []);

  // Notify parent about modal state changes when renderModalOutside is true
  useEffect(() => {
    if (renderModalOutside && onModalStateChange && useUniversalModal) {
      const currentState = {
        isOpen: isModalOpen,
        pendingData: pendingImageData,
      };

      // Only call onModalStateChange if state actually changed
      const lastState = lastModalStateRef.current;
      if (
        !lastState ||
        lastState.isOpen !== currentState.isOpen ||
        lastState.pendingData !== currentState.pendingData
      ) {
        lastModalStateRef.current = currentState;
        onModalStateChange({
          ...currentState,
          onSave: handleModalSave,
          onClose: handleModalClose,
        });
      }
    }
  }, [
    isModalOpen,
    pendingImageData,
    renderModalOutside,
    onModalStateChange,
    useUniversalModal,
    handleModalSave,
    handleModalClose,
  ]);

  const handleEditClickWithModal = () => {
    if (currentImage) {
      setPendingImageData(currentImage);
      setIsEditMode(true);
      setIsModalOpen(true);
    }
  };

  const handleDescriptionSave = () => {
    if (onDescriptionChange) {
      onDescriptionChange(editedDescription);
    }
    setIsEditingDescription(false);
  };

  const handleDescriptionCancel = () => {
    setEditedDescription(slot.description);
    setIsEditingDescription(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-sm dark:text-gray-100">
            {slot.title}
          </h4>
          {editableDescription ? (
            <div className="mt-1">
              {isEditingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="text-xs min-h-[60px]"
                    placeholder="Enter description..."
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDescriptionSave}
                      className="h-6 text-xs px-2"
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDescriptionCancel}
                      className="h-6 text-xs px-2"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  {editedDescription && editedDescription.trim() ? (
                    <p className="text-xs text-muted-foreground mt-1 flex-1">
                      {editedDescription}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingDescription(true)}
                    className="h-6 w-6 p-0 mt-0.5"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            slot.description &&
            slot.description.trim() && (
              <p className="text-xs text-muted-foreground mt-1">{slot.description}</p>
            )
          )}
        </div>
        {headerAction}
      </div>

      <div
        className={`relative overflow-hidden border-2 border-dashed rounded-lg p-4 text-center transition-all duration-300 ${isDragOver
          ? "border-accent-blue bg-accent-blue/5"
          : isHighlighted
            ? "border-blue-500/50 bg-white dark:bg-gray-800 scale-[1.02] shadow-sm"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseDown={() => onFocus?.()}
      >
        {isUploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 rounded-lg backdrop-blur-[1px]">
            <Loader2 className="w-6 h-6 animate-spin text-accent-blue" />
          </div>
        )}
        {currentImage ? (
          <div className="w-full">
            <div className="relative flex flex-col md:flex-row items-center gap-4 p-4 rounded-xl bg-muted/20 border border-gray-200 dark:border-gray-700">
              {/* Preview Column */}
              <div className="flex items-center justify-center flex-shrink-0">
                <div
                  className={`relative overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 ${
                    universalModalType === "headshot"
                      ? "h-[140px] w-[140px] rounded-full"
                      : "flex items-center justify-center w-full max-w-[300px] h-[150px] rounded-xl"
                  }`}
                >
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt={currentImage.fileName}
                      className={`max-h-full max-w-full ${
                        universalModalType === "headshot"
                          ? "h-full w-full object-cover rounded-full"
                          : previewObjectFit === "cover"
                            ? "object-cover"
                            : "object-contain"
                      }`}
                    />
                  ) : isStoredR2Key ? (
                    <div className="h-full w-full animate-pulse bg-muted/50" aria-hidden />
                  ) : null}
                </div>
              </div>

              {/* Controls Column */}
              <div className="flex flex-col items-center md:items-start gap-3 flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground break-words truncate text-center md:text-left w-full">
                  {currentImage.fileName}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-6 h-6 mx-auto text-gray-400 dark:text-gray-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">No file selected</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Recommended: {slot.recommendedSize} • Accepted: {slot.accept} •
                Max
                {maxFileSize} MB
              </p>
              <p className="text-xs text-accent-blue mt-1">
                Drag & drop an image (or a .zip) here, or choose a file below
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-1" />
              Choose File
            </Button>

            {slot.defaultPhoteButton && onDefaultPhotoClick && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDefaultPhotoClick}
                className="mt-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                add default photo
              </Button>
            )}
          </div>
        )}
      </div>

      <input
        ref={(el) => (fileInputRef.current = el)}
        type="file"
        accept={`${slot.accept},.zip`}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Universal Image Editor Modal */}
      {useUniversalModal && pendingImageData && !renderModalOutside && (
        <UniversalImageEditorModal
          type={universalModalType}
          customConfig={universalModalCustomConfig}
          value={pendingImageData.url || ""}
          originalValue={pendingImageData.originalUrl}
          fileName={pendingImageData.fileName || ""}
          existingCropData={pendingImageData.cropData}
          onChange={handleModalSave}
          onRemove={handleModalClose}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          hidePerfectMessage={hidePerfectMessage || isEditMode}
        />
      )}

      {/* ZIP file picker — shown when a dropped .zip contains multiple images */}
      <ZipFilePickerModal
        open={isZipPickerOpen}
        files={pendingZipImages ?? []}
        multiple={false}
        onSelect={(files) => {
          const f = files[0];
          if (f) handleZipImageSelected(f);
        }}
        onClose={() => {
          setIsZipPickerOpen(false);
          setPendingZipImages((prev) => {
            if (prev) revokeZipImagePreviews(prev);
            return null;
          });
        }}
      />
    </div>
  );
}
