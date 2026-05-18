"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { X, Upload, AlertTriangle, Plus, Edit2 } from "lucide-react";
import { BrandImageData } from "@/types/new-client-wizard";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { toR2BrandingKey } from "@/lib/branding-image-url";

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
}: BrandImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingImageData, setPendingImageData] =
    useState<BrandImageData | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(slot.description);
  const [isEditMode, setIsEditMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastModalStateRef = useRef<{
    isOpen: boolean;
    pendingData: BrandImageData | null;
  } | null>(null);

  const storedLogoUrl = currentImage?.url ?? null;
  const { url: displayUrl } = useBrandingImageUrl(storedLogoUrl);
  // Never fall back to raw org/… keys in <img src> — the browser resolves them as /new/org/… (404).
  const isStoredR2Key = toR2BrandingKey(storedLogoUrl) != null;
  const previewSrc = isStoredR2Key
    ? displayUrl ?? undefined
    : displayUrl ?? storedLogoUrl ?? undefined;

  useEffect(() => {
  }, [pendingImageData]);
  // Sync editedDescription with slot.description when it changes externally
  useEffect(() => {
    if (!isEditingDescription) {
      setEditedDescription(slot.description);
    }
  }, [slot.description, isEditingDescription]);

  const handleFileSelect = (file: File) => {
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
        alert(`Unsupported format. Please upload image files (PNG, JPG, JPEG, or WebP).`);
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
              const compressedUrl = await compressImage(base64String, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 });
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
          <h4 className="font-medium text-sm">{slot.title}</h4>
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
                    <p className="text-xs text-gray-600 mt-1 flex-1">
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
              <p className="text-xs text-gray-600 mt-1">{slot.description}</p>
            )
          )}
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-300 ${isDragOver
          ? "border-accent-blue bg-accent-blue/5"
          : isHighlighted
            ? "border-blue-500/50 bg-white scale-[1.02] shadow-sm"
            : "border-gray-300 hover:border-gray-400"
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {currentImage ? (
          <div className="w-full space-y-3">
            <div
              className="relative grid gap-2 p-2 rounded-xl bg-muted/20 border border-gray-200 md:grid-cols-[60%_40%] md:items-start"
              style={{
                minHeight: "230px",
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="absolute top-2 right-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1 z-10"
              >
                <X className="w-4 h-4" />
              </Button>

              {/* Sticky Preview Column */}
              <div className="flex flex-col space-y-1 md:sticky md:top-0 md:self-start">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 inline-block min-h-[180px] min-w-[120px]">
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt={currentImage.fileName}
                      className="h-[180px] w-auto object-contain"
                    />
                  ) : isStoredR2Key ? (
                    <div
                      className="h-[180px] w-[200px] animate-pulse bg-muted/50"
                      aria-hidden
                    />
                  ) : null}
                </div>
              </div>

              {/* Scrollable Controls Column */}
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[230px] pr-1">
                <div className="flex items-start gap-2">
                  <div className="w-12 h-12 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                    {previewSrc ? (
                      <img
                        src={previewSrc}
                        alt={currentImage.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : isStoredR2Key ? (
                      <div
                        className="h-full w-full animate-pulse bg-muted/50"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="text-left space-y-0.5 flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground break-words truncate">
                      {currentImage.fileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      <p>{Math.round(currentImage.fileSize / 1024)} KB</p>
                      <span>•</span>
                      <p>
                        {currentImage.width}×{currentImage.height}px
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUploadClick}
                    className="text-accent-blue border-accent-blue hover:bg-accent-blue/10 text-xs px-2 py-0.5 h-7 w-full justify-center"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Replace
                  </Button>
                  {(onEditClick || useUniversalModal) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={
                        useUniversalModal
                          ? handleEditClickWithModal
                          : onEditClick
                      }
                      className="text-accent-blue border-accent-blue hover:bg-accent-blue/10 text-xs px-2 py-0.5 h-7 w-full justify-center"
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemove}
                    className="text-red-600 border-red-300 hover:bg-red-50 text-xs px-2 py-0.5 h-7 w-full justify-center"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>

                {currentImage.warnings && currentImage.warnings.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {currentImage.warnings.map((warning, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-amber-600 border-amber-300 text-xs px-1.5 py-0.5"
                      >
                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                        {warning}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-6 h-6 mx-auto text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">No file selected</p>
              <p className="text-xs text-gray-500">
                Recommended: {slot.recommendedSize} • Accepted: {slot.accept} •
                Max
                {maxFileSize} MB
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
        accept={slot.accept}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Universal Image Editor Modal */}
      {useUniversalModal && pendingImageData && !renderModalOutside && (
        <UniversalImageEditorModal
          type={universalModalType}
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
    </div>
  );
}
