"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Canvas, Image as FabricImage } from "fabric";
import { Button } from "./button";
import { Label } from "./label";
import { Slider } from "./slider";
import {
  FlipHorizontal,
  FlipVertical,
  Upload,
  X,
  AlertTriangle,
  Maximize2,
  Loader2,
} from "lucide-react";
import { CropMetadata } from "./simple-image-editor-modal";
import { uploadFileToR2 } from "@/lib/upload-to-r2";
import { isR2BrandingKey, toFabricImageLoadUrl } from "@/lib/branding-image-url";
import { Headshot } from "@/components/ui/headshot";

// Types for different use cases
export type ImageEditorType = "headshot" | "logo" | "normalizer" | "custom";

export type PreviewFormat = "circle" | "square" | "rectangular" | "custom";

export interface ImageEditorConfig {
  // Canvas settings
  canvasWidth: number;
  canvasHeight: number;

  // Preview settings
  previewFormats: PreviewFormat[];
  previewSizes: {
    circle?: { width: number; height: number };
    square?: { width: number; height: number };
    rectangular?: { width: number; height: number };
    custom?: { width: number; height: number };
  };

  // Functionality
  allowFlipping: boolean;
  allowScaling: boolean;

  // Validation
  minResolution: number;
  maxFileSize: number;
  acceptedTypes: string[];

  // UI
  modalTitle: string;
  modalDescription: string;
  buttonText: string;
  saveButtonText: string;

  // Features
  showFileDetails: boolean;
  showWarnings: boolean;
  showLayoutButtons: boolean;
  saveToAPI: boolean;
  // Fit behavior
  fitByHeight?: boolean; // If true, scale to fit height only (not width)
  fitToSolidLine?: boolean; // If true, scale to fit solid line instead of dotted line
  // Custom padding for guidelines
  safeZonePadding?: number; // Custom padding for solid line (default: 10% of canvas)
  innerPadding?: number; // Custom padding for dotted line (default: 50% of safeZonePadding)
}

// Default configurations for different use cases
export const IMAGE_EDITOR_CONFIGS: Record<ImageEditorType, ImageEditorConfig> =
{
  headshot: {
    canvasWidth: 500,
    canvasHeight: 500,
    previewFormats: ["circle", "square"],
    previewSizes: {
      circle: { width: 200, height: 200 },
      square: { width: 200, height: 200 },
    },
    allowFlipping: false,
    allowScaling: true,
    minResolution: 400,
    maxFileSize: 5 * 1024 * 1024,
    acceptedTypes: [".jpg", ".jpeg", ".png", ".webp"],
    modalTitle: "Edit Headshot",
    modalDescription:
      "Upload a clear, front-facing photo. Keep your face inside the circle guide for best results.",
    buttonText: "Upload Headshot",
    saveButtonText: "Save Headshot",
    showFileDetails: false,
    showWarnings: false,
    showLayoutButtons: false,
    saveToAPI: false,
  },

  logo: {
    canvasWidth: 600,
    canvasHeight: 450,
    previewFormats: ["rectangular"],
    previewSizes: {
      rectangular: { width: 300, height: 250 },
    },
    allowFlipping: false,
    allowScaling: true,
    minResolution: 0,
    maxFileSize: 5 * 1024 * 1024,
    acceptedTypes: [".jpg", ".jpeg", ".png", ".webp", ".svg"],
    modalTitle: "Edit Logo",
    modalDescription:
      "Upload your company logo. Keep it centered and clear for best results.",
    buttonText: "Upload Logo",
    saveButtonText: "Save Logo",
    showFileDetails: false,
    showWarnings: false,
    showLayoutButtons: true,
    saveToAPI: false,
  },

  normalizer: {
    canvasWidth: 600,
    canvasHeight: 550,
    previewFormats: ["custom"],
    previewSizes: {
      rectangular: { width: 300, height: 200 },
      custom: { width: 152, height: 90 }, // Header bar preview - dynamically updated based on mode (120×90 normal, 150×60 compact)
    },
    allowFlipping: false,
    allowScaling: true,
    minResolution: 200,
    maxFileSize: 5 * 1024 * 1024,
    acceptedTypes: [".jpg", ".jpeg", ".png", ".webp", ".svg"],
    modalTitle: "Logo Normalizer",
    modalDescription:
      "Fit your logo inside the safe zone so it works across headers, cards, and PDFs. You can fine-tune later.",
    buttonText: "Upload Logo",
    saveButtonText: "Save Logo",
    showFileDetails: true,
    showWarnings: true,
    showLayoutButtons: true,
    saveToAPI: false,
  },

  custom: {
    canvasWidth: 500,
    canvasHeight: 500,
    previewFormats: ["rectangular"],
    previewSizes: {
      rectangular: { width: 300, height: 200 },
    },
    allowFlipping: true,
    allowScaling: true,
    minResolution: 200,
    maxFileSize: 5 * 1024 * 1024,
    acceptedTypes: [".jpg", ".jpeg", ".png", ".webp"],
    modalTitle: "Edit Image",
    modalDescription: "Upload and edit your image.",
    buttonText: "Upload Image",
    saveButtonText: "Save Image",
    showFileDetails: false,
    showWarnings: false,
    showLayoutButtons: false,
    saveToAPI: false,
  },
};

interface UniversalImageEditorModalProps {
  // Core props
  value?: string;
  originalValue?: string;
  fileName?: string;
  existingCropData?: CropMetadata;
  onChange: (
    value: string,
    fileName: string,
    headshotData?: any,
    cropData?: CropMetadata,
  ) => void;
  onRemove: () => void;
  modalDescription?: string;
  // Configuration
  type?: ImageEditorType;
  customConfig?: Partial<ImageEditorConfig>;
  tip?: string;
  previewTitle?: string;
  previewText?: string;
  modalTitle?: string; // Custom modal title
  // UI props
  placeholder?: string;
  destructive?: boolean;
  icon?: React.ReactNode;
  saveButtonText?: string; // Custom save button text

  // Modal state
  isOpen?: boolean;
  onClose?: () => void;
  // Default scale multiplier (e.g., 1.4 for 140%)
  defaultScale?: number;
  autoSizeOnOpen?: boolean;
  // Hide "Perfect" message
  hidePerfectMessage?: boolean;
  forceCircularGuidelines?: boolean;
}

async function validateImage(
  file: File,
  maxFileSize: number,
  minResolution: number,
  acceptedTypes: string[],
): Promise<{ valid: boolean; message?: string }> {
  // Check file type
  const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!acceptedTypes.includes(fileExtension)) {
    return {
      valid: false,
      message: `Please upload a ${acceptedTypes.join(", ")} file.`,
    };
  }

  // Check file size
  if (file.size > maxFileSize) {
    return {
      valid: false,
      message: `File size must be less than ${Math.round(
        maxFileSize / 1024 / 1024,
      )}MB`,
    };
  }

  // Skip resolution check for SVG
  if (file.type === "image/svg+xml") {
    return { valid: true };
  }

  if (minResolution === 0) {
    return { valid: true };
  }

  // Check image resolution
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width < minResolution || img.height < minResolution) {
        resolve({
          valid: false,
          message: `Image must be at least ${minResolution}x${minResolution} pixels`,
        });
      } else {
        resolve({ valid: true });
      }
    };
    img.onerror = () => {
      resolve({ valid: false, message: "Invalid image file" });
    };
    img.src = URL.createObjectURL(file);
  });
}

export function UniversalImageEditorModal({
  value,
  originalValue,
  fileName,
  existingCropData,
  onChange,
  onRemove,
  modalDescription,
  tip,
  previewTitle,
  previewText,
  modalTitle,
  type = "custom",
  customConfig = {},
  placeholder = "Upload Image",
  destructive = false,
  icon,
  saveButtonText,
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  defaultScale = 1,
  autoSizeOnOpen = false,
  hidePerfectMessage = false,
  forceCircularGuidelines = false,
}: UniversalImageEditorModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const isInitializedRef = useRef(false);
  const autoSizeInitializedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);

  // Canvas layout mode state (must be declared before config)
  const [canvasMode, setCanvasMode] = useState<"normal" | "compact">("normal");

  // Merge config with custom overrides
  const baseConfig = {
    ...IMAGE_EDITOR_CONFIGS[type],
    ...customConfig,
  };

  // Update preview sizes based on canvas mode
  const config: ImageEditorConfig = {
    ...baseConfig,
    previewSizes: {
      ...baseConfig.previewSizes,
      rectangular: { width: 300, height: 250 }, // Normal mode: 200x100 (landscape)
      custom:
        canvasMode === "compact"
          ? { width: 500, height: 80 } // Compact mode: 150x100 (landscape)
          : { width: 300, height: 250 }, // Normal mode: 200x100 (landscape)
    },
  };

  // Internal modal state (for standalone usage)
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [isBeyondMaxAspectRatio, setIsBeyondMaxAspectRatio] = useState(false);
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<number | null>(
    null,
  );

  const [minScale, setMinScale] = useState(1);
  const [maxScale, setMaxScale] = useState(1);
  const [isHeadshotCropped, setIsHeadshotCropped] = useState(false);
  const [isOutsideSafeZone, setIsOutsideSafeZone] = useState(false);
  const [isNearDottedLine, setIsNearDottedLine] = useState(false);
  const [isTooSmall, setIsTooSmall] = useState(false);
  const [isOutsideDottedLine, setIsOutsideDottedLine] = useState(false);
  const [hasTooMuchBlankSpace, setHasTooMuchBlankSpace] = useState(false);
  const [isNotScaledEnough, setIsNotScaledEnough] = useState(false);
  const [baseScale, setBaseScale] = useState(1);
  // Header-preview metrics (for normalizer)
  const [headerMetrics, setHeaderMetrics] = useState<{
    headerPx: number;
    recommendedPx: number;
    safePx: number;
    renderedLogoHeightPx: number;
    status: "perfect" | "ok" | "too_large";
  } | null>(null);

  // Responsive canvas dimensions
  const [responsiveCanvasWidth, setResponsiveCanvasWidth] = useState(
    config.canvasWidth, // Always 600px
  );
  const [responsiveCanvasHeight, setResponsiveCanvasHeight] = useState(
    canvasMode === "compact" ? 300 : config.canvasHeight,
  );

  // Check if headshot image is cropped (for headshot type only)
  const checkHeadshotCropping = useCallback(() => {
    if (type !== "headshot") return false;

    const canvas = fabricCanvasRef.current;
    if (!canvas) return false;

    const activeObject = canvas.getActiveObject();
    if (!activeObject) return false;

    const canvasWidth = responsiveCanvasWidth;
    const canvasHeight = responsiveCanvasHeight;
    const objBoundingRect = activeObject.getBoundingRect();

    // Check if the image fills the circular area adequately
    // Since we use 0.65 scale factor in preview, the image needs to be large enough
    // to fill the circle without empty spaces
    const circleRadius = Math.min(canvasWidth, canvasHeight) / 2;
    const imageCenterX = objBoundingRect.left + objBoundingRect.width / 2;
    const imageCenterY = objBoundingRect.top + objBoundingRect.height / 2;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;

    // Calculate the distance from image center to canvas center
    const distanceFromCenter = Math.sqrt(
      Math.pow(imageCenterX - canvasCenterX, 2) +
      Math.pow(imageCenterY - canvasCenterY, 2),
    );

    // Get the actual scale from the fabric object
    const actualScale = activeObject.scaleX || 1;

    // Calculate the actual image dimensions after scaling
    const actualImageWidth = objBoundingRect.width;
    const actualImageHeight = objBoundingRect.height;

    // Calculate how much of the circle the image covers
    const imageCoverageRatio =
      Math.min(actualImageWidth, actualImageHeight) / (circleRadius * 2);

    // Calculate how far the image center is from the canvas center
    const centerOffsetRatio = distanceFromCenter / circleRadius;

    // Calculate if the scaled image (with 0.65 factor) will cover the circle
    const previewScaleFactor = 0.65;
    const previewImageWidth = actualImageWidth / previewScaleFactor;
    const previewImageHeight = actualImageHeight / previewScaleFactor;

    // Calculate the preview image center position
    const previewImageCenterX =
      canvasCenterX + (imageCenterX - canvasCenterX) / previewScaleFactor;
    const previewImageCenterY =
      canvasCenterY + (imageCenterY - canvasCenterY) / previewScaleFactor;

    // Check if preview image covers the circle
    const previewLeft = previewImageCenterX - previewImageWidth / 2;
    const previewRight = previewImageCenterX + previewImageWidth / 2;
    const previewTop = previewImageCenterY - previewImageHeight / 2;
    const previewBottom = previewImageCenterY + previewImageHeight / 2;

    const circleLeft = canvasCenterX - circleRadius;
    const circleRight = canvasCenterX + circleRadius;
    const circleTop = canvasCenterY - circleRadius;
    const circleBottom = canvasCenterY + circleRadius;

    // Check if preview image covers the circle (with small tolerance)
    const previewCoversCircle =
      previewLeft <= circleLeft + 10 &&
      previewRight >= circleRight - 10 &&
      previewTop <= circleTop + 10 &&
      previewBottom >= circleBottom - 10;

    // Show warning only if:
    // 1. Image is very small (covers less than 30% of circle)
    // 2. Image is very far from center (offset more than 70% of radius)
    // 3. Preview won't cover the circle
    const isTooSmall = imageCoverageRatio < 0.3;
    const isTooFarFromCenter = centerOffsetRatio > 0.7;

    return isTooSmall || isTooFarFromCenter || !previewCoversCircle;
  }, [type, responsiveCanvasWidth, responsiveCanvasHeight]);

  // Use external modal state if provided, otherwise use internal
  const modalOpen =
    externalIsOpen !== undefined ? externalIsOpen : internalModalOpen;
  const handleClose = externalOnClose || (() => setInternalModalOpen(false));

  // Calculate responsive canvas dimensions based on viewport
  useEffect(() => {
    const calculateCanvasDimensions = () => {
      const viewportWidth =
        typeof window !== "undefined" ? window.innerWidth : 1200;
      const viewportHeight =
        typeof window !== "undefined" ? window.innerHeight : 800;

      // Calculate available space for canvas (2/3 of modal width minus padding)
      const modalWidth = Math.min(viewportWidth * 0.95, 1280);
      const canvasAreaWidth = modalWidth * 0.67;
      const availableWidth = Math.min(
        canvasAreaWidth * 0.9,
        canvasMode === "compact" ? 700 : config.canvasWidth,
      );

      const availableHeight = Math.min(
        (viewportHeight * 0.95 - 80) * 0.85,
        canvasMode === "compact" ? 300 : config.canvasHeight,
      );

      // Maintain aspect ratio
      const baseWidth = canvasMode === "compact" ? 700 : config.canvasWidth;
      const baseHeight = canvasMode === "compact" ? 300 : config.canvasHeight;
      const aspectRatio = baseWidth / baseHeight;
      let newWidth = availableWidth;
      let newHeight = availableWidth / aspectRatio;

      // If height exceeds available space, recalculate based on height
      if (newHeight > availableHeight) {
        newHeight = availableHeight;
        newWidth = availableHeight * aspectRatio;
      }

      // Ensure minimum size for usability
      const minSize = 250;
      if (newWidth < minSize || newHeight < minSize) {
        if (aspectRatio >= 1) {
          newWidth = minSize;
          newHeight = minSize / aspectRatio;
        } else {
          newHeight = minSize;
          newWidth = minSize * aspectRatio;
        }
      }

      setResponsiveCanvasWidth(Math.round(newWidth));
      setResponsiveCanvasHeight(Math.round(newHeight));
    };

    calculateCanvasDimensions();
    window.addEventListener("resize", calculateCanvasDimensions);

    return () =>
      window.removeEventListener("resize", calculateCanvasDimensions);
  }, [config.canvasWidth, config.canvasHeight, canvasMode]);

  // Set imageSrc when modal opens. R2 keys use same-origin /api/r2/object so Fabric avoids CORS failures on presigned R2 URLs.
  useEffect(() => {
    if (!modalOpen) {
      isInitializedRef.current = false;
      setOriginalImageSrc(null);
      setImageSrc(null);
      return;
    }
    if (!value) return;

    const loadable = toFabricImageLoadUrl(value);
    if (!loadable) return;

    setImageSrc(loadable);
    const originalFromCrop = existingCropData?.originalImage;
    const persistedOriginal = originalValue || originalFromCrop || value;
    const loadableOriginal =
      toFabricImageLoadUrl(persistedOriginal) || loadable;
    setOriginalImageSrc(loadableOriginal);
    if (!isInitializedRef.current) {
      generateWarnings(loadable);
    }
  }, [value, originalValue, existingCropData, modalOpen]);

  // Generate warnings based on image properties
  const generateWarnings = (imageSrc: string) => {
    const warnings: string[] = [];

    // Create image to analyze
    const img = new Image();
    img.onload = () => {
      // Check recommended size (900x900+)
      if (img.width < 900 || img.height < 900) {
        warnings.push("Recommendation: 900+ pixels wide");
      }

      // Check for transparency (PNG/SVG have transparency, JPEG doesn't)
      const hasTransparency =
        imageSrc.includes("data:image/png") ||
        imageSrc.includes("data:image/svg");

      // Only warn about transparency for JPEG files
      if (imageSrc.includes("data:image/jpeg")) {
        warnings.push("No transparency — will render on white");
        warnings.push("Background may not be white");
      }

      setWarnings(warnings);
    };

    img.src = imageSrc;
  };

  const computeScaleRange = (
    img: FabricImage,
    baseScale: number,
    hasDefaultScale: boolean = false,
  ) => {
    const photoWidth = img.width || 1;
    const photoHeight = img.height || 1;

    const scaleBase = baseScale;

    // If defaultScale is used, allow larger scaling range
    const maxMultiplier = hasDefaultScale ? 2.5 : 1.4;
    const maxMultiplierWide = hasDefaultScale ? 2.5 : 1.5;

    let maxScale = scaleBase * maxMultiplier;
    let minScale = scaleBase * 0.4;
    if (photoWidth / photoHeight > 2.5) {
      maxScale = scaleBase * maxMultiplierWide;
      minScale = scaleBase * 0.5;
    }

    return { minScale, maxScale, scaleBase };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsLoading(true);

    const validation = await validateImage(
      file,
      config.maxFileSize,
      config.minResolution,
      config.acceptedTypes,
    );

    if (!validation.valid) {
      setError(validation.message || "Invalid file");
      setIsLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as string;

      // Logging: New file uploaded

      setImageSrc(dataURL);
      setOriginalImageSrc(dataURL);
      generateWarnings(dataURL);
      if (externalIsOpen === undefined) {
        setInternalModalOpen(true);
      }
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Generate previews based on configuration
  const generatePreviews = useCallback(() => {
    try {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const activeObject = canvas.getActiveObject();
      if (!activeObject) return;

      // Temporarily hide guidelines before export
      const objects = canvas.getObjects();
      const guidelines: any[] = [];
      objects.forEach((obj: any) => {
        if (obj.isGuideline) {
          guidelines.push(obj);
          obj.visible = false;
        }
      });

      // Export entire canvas
      const dataURL = canvas.toDataURL({
        format: "png",
        quality: 0.9,
        multiplier: 1,
      });

      // Restore guidelines visibility
      guidelines.forEach((obj) => {
        obj.visible = true;
      });
      canvas.renderAll();

      const newPreviews: Record<string, string> = {};

      config.previewFormats.forEach((format) => {
        const size = config.previewSizes[format];
        if (size) {
          // For rectangular, preserve existing preview in compact mode (but generate first time)
          if (
            format === "rectangular" &&
            canvasMode === "compact" &&
            previews["rectangular"]
          ) {
            // Preserve existing rectangular preview in compact mode
            newPreviews["rectangular"] = previews["rectangular"];
            return;
          }

          // Create preview with specific size
          const tempCanvas = document.createElement("canvas");
          const tempCtx = tempCanvas.getContext("2d");
          if (tempCtx) {
            // Use 3x multiplier for higher resolution and better quality
            const multiplier = 3;
            tempCanvas.width = size.width * multiplier;
            tempCanvas.height = size.height * multiplier;

            const img = new Image();
            img.onload = () => {
              // Enable high quality image smoothing
              tempCtx.imageSmoothingEnabled = true;
              tempCtx.imageSmoothingQuality = "high";

              // Scale context for high-res rendering
              tempCtx.scale(multiplier, multiplier);

              if (format === "circle") {
                const scaleFactor = 0.65;
                const scaledWidth = size.width / scaleFactor;
                const scaledHeight = size.height / scaleFactor;

                // Center the scaled image
                const offsetX = (size.width - scaledWidth) / 2;
                const offsetY = (size.height - scaledHeight) / 2;

                // Create circular mask
                tempCtx.beginPath();
                tempCtx.arc(
                  size.width / 2,
                  size.height / 2,
                  size.width / 2,
                  0,
                  2 * Math.PI,
                );
                tempCtx.clip();

                // Draw the scaled image (showing more of the original)
                tempCtx.drawImage(
                  img,
                  offsetX,
                  offsetY,
                  scaledWidth,
                  scaledHeight,
                );
              } else if (format === "square") {
                // For square, also use a larger source area to get more photo content
                // Use 0.6 scale factor to show more of the original image (zoom out effect)
                const scaleFactor = 0.65;
                const scaledWidth = size.width / scaleFactor;
                const scaledHeight = size.height / scaleFactor;

                // Center the scaled image
                const offsetX = (size.width - scaledWidth) / 2;
                const offsetY = (size.height - scaledHeight) / 2;

                // Draw the scaled image (showing more of the original)
                tempCtx.drawImage(
                  img,
                  offsetX,
                  offsetY,
                  scaledWidth,
                  scaledHeight,
                );
              } else {
                // For rectangular format, maintain aspect ratio
                const imgAspectRatio = img.width / img.height;
                const previewAspectRatio = size.width / size.height;

                let drawWidth = size.width;
                let drawHeight = size.height;
                let offsetX = 0;
                let offsetY = 0;

                if (imgAspectRatio > previewAspectRatio) {
                  // Image is wider than preview - fit to width
                  drawHeight = size.width / imgAspectRatio;
                  offsetY = (size.height - drawHeight) / 2;
                } else {
                  // Image is taller than preview - fit to height
                  drawWidth = size.height * imgAspectRatio;
                  offsetX = (size.width - drawWidth) / 2;
                }

                tempCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
              }
              newPreviews[format] = tempCanvas.toDataURL("image/png", 0.9);
              setPreviews({ ...newPreviews });
            };
            img.src = dataURL;
          }
        }
      });

      // Compute header metrics for normalizer based on AR buckets
      if (type === "normalizer" && fabricCanvasRef.current) {
        const c = fabricCanvasRef.current;
        const obj = c.getActiveObject();
        if (obj) {
          const originalW = obj.width || 1;
          const originalH = obj.height || 1;
          const ar = originalW / originalH; // uploaded art AR
          let headerPx = 140;
          if (ar >= 1.4) headerPx = 140; // Wide
          else if (ar >= 1.0) headerPx = 150; // Near-square
          else if (ar >= 0.85) headerPx = 160; // Square
          else headerPx = 140; // Tall/stacked

          const recommendedPx = Math.round(headerPx * 0.385);
          const safePx = Math.round(headerPx * 0.457);

          // Rendered height of the logo in final header = (current object height / canvas height) * headerPx
          const objBounds = obj.getBoundingRect();
          const canvasHeightLocal = fabricCanvasRef.current?.getHeight() || 1;
          const renderedLogoHeightPx = Math.round(
            (objBounds.height / canvasHeightLocal) * headerPx,
          );

          let status: "perfect" | "ok" | "too_large" = "perfect";
          if (renderedLogoHeightPx <= recommendedPx) status = "perfect";
          else if (renderedLogoHeightPx <= safePx) status = "ok";
          else status = "too_large";

          setHeaderMetrics({
            headerPx,
            recommendedPx,
            safePx,
            renderedLogoHeightPx,
            status,
          });
        }
      }
    } catch (error) {
      console.error("Error generating previews:", error);
    }
  }, [config.previewFormats, config.previewSizes]);

  // Draw safe zone and guidelines
  const drawSafeZoneAndGuidelines = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove existing guidelines
    const objects = canvas.getObjects();
    objects.forEach((obj: any) => {
      if (obj.isGuideline) {
        canvas.remove(obj);
      }
    });

    const canvasWidth = responsiveCanvasWidth;
    const canvasHeight = responsiveCanvasHeight;

    // Import Rect and Line from fabric
    const { Rect, Line } = require("fabric");

    // 3. Draw center guidelines if enabled
    if (showGuidelines) {
      // Horizontal center line
      const hLine = new Line(
        [0, canvasHeight / 2, canvasWidth, canvasHeight / 2],
        {
          stroke: "#9ca3af",
          strokeWidth: 1,
          strokeDashArray: [3, 3],
          selectable: false,
          evented: false,
          isGuideline: true,
        },
      );
      canvas.add(hLine);
      if (typeof (canvas as any).bringObjectToFront === "function") {
        (canvas as any).bringObjectToFront(hLine);
      }

      // Vertical center line
      const vLine = new Line(
        [canvasWidth / 2, 0, canvasWidth / 2, canvasHeight],
        {
          stroke: "#9ca3af",
          strokeWidth: 1,
          strokeDashArray: [3, 3],
          selectable: false,
          evented: false,
          isGuideline: true,
        },
      );
      canvas.add(vLine);
      if (typeof (canvas as any).bringObjectToFront === "function") {
        (canvas as any).bringObjectToFront(vLine);
      }
    }

    canvas.renderAll();
  }, [
    config,
    type,
    showGuidelines,
    isOutsideSafeZone,
    isNearDottedLine,
    isTooSmall,
    isOutsideDottedLine,
    responsiveCanvasWidth,
    responsiveCanvasHeight,
  ]);

  const checkSafeZone = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const obj = canvas.getActiveObject();
    if (!obj) return;

    const cw = responsiveCanvasWidth;
    const ch = responsiveCanvasHeight;

    const r = obj.getBoundingRect();
    const baseW = Math.max(1, r.width);
    const baseH = Math.max(1, r.height);
    const ar = baseW / baseH;

    // Use custom padding if provided, otherwise calculate defaults
    const safePad = config.safeZonePadding ?? Math.min(cw, ch) * 0.1;
    const innerPad = config.innerPadding ?? safePad * 0.5;

    const maxDotW = Math.max(0, cw - 2 * (safePad + innerPad));
    const maxDotH = Math.max(0, ch - 2 * (safePad + innerPad));

    const outlinePct = 0.1;

    let dottedW: number, dottedH: number;
    if (ar > 2) {
      dottedH = Math.round(ch - 2 * safePad);
      dottedH = Math.min(dottedH, maxDotH);

      const desiredW = Math.round(baseW + outlinePct * baseW * 0.5);
      dottedW = Math.min(desiredW, maxDotW);
    } else {
      const desiredW = Math.round(baseW + outlinePct);
      dottedW = Math.min(desiredW, maxDotW);
      dottedH = Math.round(ch - 2 * safePad);
      dottedH = Math.min(dottedH, maxDotH);
    }

    const dottedLeft = Math.round((cw - dottedW) / 2);
    const dottedTop = Math.round((ch - dottedH) / 2);
    const dottedRight = dottedLeft + dottedW;
    const dottedBottom = dottedTop + dottedH;

    let solidW: number, solidH: number, solidLeft: number, solidTop: number;
    if (type === "logo" || type === "normalizer") {
      if (ar > 2) {
        const desiredW = Math.round(baseW + outlinePct * baseW * 0.5);
        solidW = Math.min(desiredW, Math.max(0, cw - 2 * safePad));
        solidH = Math.round(ch - 2 * safePad);
      } else {
        const desiredW = Math.round(baseW + outlinePct * baseW);
        const desiredH = Math.round(baseH + outlinePct * baseH * 1.5);
        solidW = Math.min(desiredW, Math.max(0, cw - 2 * safePad));
        solidH = Math.min(desiredH, Math.max(0, ch - 2 * safePad));
      }
      solidLeft = Math.round((cw - solidW) / 2);
      solidTop = Math.round((ch - solidH) / 2);
    } else {
      solidLeft = Math.round(safePad);
      solidTop = Math.round(safePad);
      solidW = Math.round(cw - 2 * safePad);
      solidH = Math.round(ch - 2 * safePad);
    }
    const solidRight = solidLeft + solidW;
    const solidBottom = solidTop + solidH;

    const objLeft = r.left;
    const objTop = r.top;
    const objW = r.width;
    const objH = r.height;
    const objRight = objLeft + objW;
    const objBottom = objTop + objH;
    const tol = Math.max(
      2,
      Math.round((0.001 * Math.min(cw, ch)) / (window.devicePixelRatio || 1)),
    );

    const isTouchingSolidLine =
      objLeft <= solidLeft ||
      objTop <= solidTop ||
      objRight >= solidRight ||
      objBottom >= solidBottom;

    const isOutsideDottedLine =
      objLeft < dottedLeft ||
      objTop < dottedTop ||
      objRight > dottedRight + tol ||
      objBottom > dottedBottom + tol;

    const baseDim = Math.min(cw, ch);
    const posTol = Math.max(3, 0.012 * baseDim);
    const sizeTolX = Math.max(3, 0.012 * dottedW);
    const sizeTolY = Math.max(3, 0.012 * dottedH);
    const centerTol = Math.max(3, 0.012 * baseDim);

    const dL = Math.abs(objLeft - dottedLeft);
    const dR = Math.abs(objRight - dottedRight);
    const dT = Math.abs(objTop - dottedTop);
    const dB = Math.abs(objBottom - dottedBottom);

    const nearXEdges = dL <= posTol && dR <= posTol;
    const nearYEdges = dT <= posTol && dB <= posTol;

    const nearW = Math.abs(objW - dottedW) <= sizeTolX;
    const nearH = Math.abs(objH - dottedH) <= sizeTolY;

    const objCX = (objLeft + objRight) / 2;
    const objCY = (objTop + objBottom) / 2;
    const dotCX = (dottedLeft + dottedRight) / 2;
    const dotCY = (dottedTop + dottedBottom) / 2;
    const nearCenter =
      Math.abs(objCX - dotCX) <= centerTol &&
      Math.abs(objCY - dotCY) <= centerTol;

    const objCenter = (obj as any).getCenterPoint
      ? (obj as any).getCenterPoint()
      : { x: r.left + r.width / 2, y: r.top + r.height / 2 };

    const EDGE_INSET_ASSUMED = 5;
    // For wide images, use larger tolerance since they scale to fit height
    const edgeTolerance =
      ar > 2.5
        ? Math.max(EDGE_INSET_ASSUMED, Math.min(15, dottedH * 0.05))
        : EDGE_INSET_ASSUMED;

    // For normal images (ar <= 2.5), use relaxed tolerance for left/right edges after auto-size
    const normalImageTolerance =
      ar <= 2.5
        ? Math.max(edgeTolerance, Math.min(20, dottedW * 0.08))
        : edgeTolerance;

    const touchesLeft = dL <= normalImageTolerance;
    const touchesRight = dR <= normalImageTolerance;
    const touchesLR = touchesLeft && touchesRight;
    const touchesLRRelaxed =
      ar <= 2.5
        ? dL <= normalImageTolerance && dR <= normalImageTolerance
        : touchesLR;

    const touchesTop = dT <= edgeTolerance;
    const touchesBottom = dB <= edgeTolerance;
    const touchesTB = touchesTop && touchesBottom;

    const objCY1 = objCenter.y;

    // For normal images, use larger tolerance for vertical centering
    const centerTolY =
      ar <= 2.5 ? Math.max(5, 0.03 * dottedH) : Math.max(3, 0.02 * dottedH);
    // For wide images, use larger tolerance for horizontal centering
    const centerTolX =
      ar > 2.5 ? Math.max(5, 0.03 * dottedW) : Math.max(3, 0.02 * dottedW);

    const nearCenterY = Math.abs(objCY1 - dotCY) <= centerTolY;
    const nearCenterX = Math.abs(objCX - dotCX) <= centerTolX;

    // For wide images (ar > 2.5), check if it touches top/bottom edges and is centered horizontally
    // For normal images, check if it touches left/right edges and is centered vertically
    // Use relaxed tolerance for wide images after auto-size
    const wideImageTolerance =
      ar > 2.5
        ? Math.max(edgeTolerance, Math.min(20, dottedH * 0.08))
        : edgeTolerance;
    const touchesTBRelaxed =
      ar > 2.5
        ? dT <= wideImageTolerance && dB <= wideImageTolerance
        : touchesTB;

    const isPerfect =
      !isTouchingSolidLine &&
      !isOutsideDottedLine &&
      ((ar > 2.5 && touchesTBRelaxed && nearCenterX) ||
        (ar <= 2.5 && touchesLRRelaxed && nearCenterY));

    // For wide images (ar > 2.5), check if it's properly positioned
    // (touches top/bottom edges and is centered horizontally)
    const isWideImageProperlySized =
      ar > 2.5 && touchesTBRelaxed && nearCenterX;

    // For normal images (ar <= 2.5), check if it's properly positioned
    // (touches left/right edges and is centered vertically)
    const isNormalImageProperlySized =
      ar <= 2.5 && touchesLRRelaxed && nearCenterY;

    const largeAndOutsideSafe = isOutsideDottedLine && isTouchingSolidLine;
    const largeButNotCentered =
      isOutsideDottedLine && !isTouchingSolidLine && !nearCenter;

    // For wide images (ar > 2.5), check if it's too small based on vertical edges
    // For normal images, check if it's too small based on horizontal edges
    const tooSmallInsideDotted =
      (type === "logo" || type === "normalizer") &&
      !isTouchingSolidLine &&
      !isOutsideDottedLine &&
      !isPerfect &&
      !isWideImageProperlySized &&
      !isNormalImageProperlySized &&
      ((ar > 2.5 && (!touchesTBRelaxed || !nearCenterX)) ||
        (ar <= 2.5 && (!touchesLRRelaxed || !nearCenterY)));

    // For wide images (ar > 2.5), check if it touches top/bottom edges
    // For normal images, check if it touches left/right edges
    const notTouchingTwoEdges =
      (type === "logo" || type === "normalizer") &&
      !isTouchingSolidLine &&
      !isOutsideDottedLine &&
      ((ar > 2.5 && !touchesTBRelaxed) || (ar <= 2.5 && !touchesLRRelaxed));

    setIsOutsideSafeZone(isTouchingSolidLine); // SOLID
    setIsOutsideDottedLine(largeButNotCentered || largeAndOutsideSafe); // DOTTED
    // For both wide and normal images, consider properly sized as "near dotted line" (perfect)
    setIsNearDottedLine(
      isPerfect || isWideImageProperlySized || isNormalImageProperlySized,
    );

    setIsTooSmall(type === "headshot" ? false : !!tooSmallInsideDotted);

    // Don't show "too much blank space" if:
    // 1. It's perfect
    // 2. For wide images: it touches top/bottom and is centered horizontally
    // 3. For normal images: it touches left/right and is centered vertically
    const shouldShowTooMuchBlankSpace =
      type !== "headshot" &&
      tooSmallInsideDotted &&
      !isPerfect &&
      !isWideImageProperlySized &&
      !isNormalImageProperlySized;

    setHasTooMuchBlankSpace(shouldShowTooMuchBlankSpace);
    setIsNotScaledEnough(
      type === "headshot"
        ? false
        : !!(
          notTouchingTwoEdges &&
          !isPerfect &&
          !isWideImageProperlySized &&
          !isNormalImageProperlySized
        ),
    );

    if (type === "headshot") {
      setIsHeadshotCropped(checkHeadshotCropping());
    } else {
      setIsHeadshotCropped(false);
    }
  }, [
    fabricCanvasRef,
    responsiveCanvasWidth,
    responsiveCanvasHeight,
    type,
    checkHeadshotCropping,
  ]);

  // Auto-detect image orientation and set canvas mode BEFORE canvas initialization
  const [isDetectingMode, setIsDetectingMode] = useState(true);

  useEffect(() => {
    if (imageSrc && !fabricCanvasRef.current) {
      setIsDetectingMode(true);
      const img = new Image();
      img.onload = () => {
        const imageAspectRatio = img.width / img.height;
        // If image is significantly wider than tall (aspect ratio > 1.5), use compact mode
        if (imageAspectRatio > 1.5) {
          setCanvasMode("compact");
          // Update responsive canvas dimensions for compact mode
          setResponsiveCanvasWidth(700);
          setResponsiveCanvasHeight(300);
        } else {
          setCanvasMode("normal");
          // Update responsive canvas dimensions for normal mode
          setResponsiveCanvasWidth(config.canvasWidth);
          setResponsiveCanvasHeight(config.canvasHeight);
        }
        setIsDetectingMode(false);
      };
      img.onerror = () => {
        setIsDetectingMode(false);
      };
      img.src = imageSrc;
    }
  }, [imageSrc, type, config.canvasWidth, config.canvasHeight]);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (
      modalOpen &&
      imageSrc &&
      canvasRef.current &&
      !fabricCanvasRef.current &&
      !isDetectingMode
    ) {
      const canvas = new Canvas(canvasRef.current, {
        width: responsiveCanvasWidth,
        height: responsiveCanvasHeight,
        backgroundColor: "transparent",
      });

      fabricCanvasRef.current = canvas;

      FabricImage.fromURL(imageSrc).then((img: FabricImage) => {
        if (img) {
          // Compute aspect ratio and set max-AR warning for logos/normalizer
          if (type === "logo" || type === "normalizer") {
            const originalW = img.width || 1;
            const originalH = img.height || 1;
            const objAR = originalW / originalH;
            const maxAR = 350 / 140; // ≈ 2.5
            setDetectedAspectRatio(objAR);
            setIsBeyondMaxAspectRatio(objAR > maxAR);
          } else {
            setDetectedAspectRatio(null);
            setIsBeyondMaxAspectRatio(false);
          }

          const canvasWidth = responsiveCanvasWidth;
          const canvasHeight = responsiveCanvasHeight;
          // Use custom padding if provided, otherwise calculate defaults
          const safeZonePadding =
            config.safeZonePadding ?? Math.min(canvasWidth, canvasHeight) * 0.1; // solid border
          const innerPadding = config.innerPadding ?? safeZonePadding * 0.5; // Additional padding for dotted line

          const dottedLeft = safeZonePadding + innerPadding;
          const dottedTop = safeZonePadding + innerPadding;
          const dottedRight = canvasWidth - (safeZonePadding + innerPadding);
          const dottedBottom = canvasHeight - (safeZonePadding + innerPadding);

          const dottedWidth = dottedRight - dottedLeft;
          const dottedHeight = dottedBottom - dottedTop;

          // Calculate solid line dimensions
          const solidWidth = canvasWidth - 2 * safeZonePadding;
          const solidHeight = canvasHeight - 2 * safeZonePadding;

          // --- Auto scale to dotted or solid area ---
          const marginPx = 2;
          // If fitToSolidLine is true, use solid dimensions; otherwise use dotted
          const targetWidth = config.fitToSolidLine ? solidWidth : dottedWidth;
          const targetHeight = config.fitToSolidLine
            ? solidHeight
            : dottedHeight;
          const adjustedWidth = Math.max(0, targetWidth - marginPx * 2);
          const adjustedHeight = Math.max(0, targetHeight - marginPx * 2);

          const scaleX = adjustedWidth / (img.width || 1);
          const scaleY = adjustedHeight / (img.height || 1);

          // Calculate image aspect ratio
          const imageAspectRatio = (img.width || 1) / (img.height || 1);

          // For square canvas (thumbnail), use max scale to fill entire area (cover behavior)
          // For other canvas types, use min scale to fit within area (contain behavior)
          const isSquareCanvas = Math.abs(canvasWidth - canvasHeight) < 10;
          const shouldFitByHeight =
            (config.fitByHeight && imageAspectRatio >= 1) ||
            (config.fitToSolidLine && imageAspectRatio > 2.7);

          let fitScale;
          if (isSquareCanvas) {
            // For square canvas, always use the larger scale to ensure full coverage
            fitScale = Math.max(scaleX, scaleY);
          } else if (shouldFitByHeight) {
            fitScale = scaleY;
          } else {
            fitScale = Math.min(scaleX, scaleY);
          }

          // If defaultScale is provided and not 1, first fit image normally, then apply defaultScale
          let adjustedScale = fitScale;
          let finalBaseScale = fitScale;

          if (defaultScale !== 1) {
            // First, scale image to fit normally (touching top and bottom lines in dotted area)
            // Then apply defaultScale multiplier, but ensure it still fits within dotted area
            adjustedScale = fitScale * defaultScale;

            // Calculate maximum scale that still fits within dotted or solid area
            // This ensures image doesn't exceed the lines
            const maxFitScaleX =
              (config.fitToSolidLine ? solidWidth : dottedWidth) /
              (img.width || 1);
            const maxFitScaleY =
              (config.fitToSolidLine ? solidHeight : dottedHeight) /
              (img.height || 1);
            // Calculate image aspect ratio for dynamic fitByHeight
            const imageAspectRatio = (img.width || 1) / (img.height || 1);
            // For square canvas, use max scale; otherwise use fitByHeight logic
            const isSquareCanvas = Math.abs(canvasWidth - canvasHeight) < 10;
            const shouldFitByHeight =
              (config.fitByHeight && imageAspectRatio >= 1) ||
              (config.fitToSolidLine && imageAspectRatio > 2.7);

            let maxFitScale;
            if (isSquareCanvas) {
              maxFitScale = Math.max(maxFitScaleX, maxFitScaleY);
            } else if (shouldFitByHeight) {
              maxFitScale = maxFitScaleY;
            } else {
              maxFitScale = Math.min(maxFitScaleX, maxFitScaleY);
            }

            // Don't exceed maxFitScale to ensure image fits within dotted lines
            adjustedScale = Math.min(adjustedScale, maxFitScale);

            // baseScale should be adjustedScale so percentages show correctly from the new base
            finalBaseScale = adjustedScale;
          }

          img.scale(adjustedScale);
          img.set({
            left: canvasWidth / 2,
            top: canvasHeight / 2,
            originX: "center",
            originY: "center",
            selectable: true,
            hasControls: true,
            hasBorders: true,
            borderColor: "#3b82f6",
            cornerColor: "#3b82f6",
            cornerStyle: "circle",
            transparentCorners: false,
            lockRotation: true,
            lockScalingFlip: true,
            uniformScaling: true,
          });

          img.setControlsVisibility({
            mt: false,
            mb: false,
            ml: false,
            mr: false,
            tl: true,
            tr: true,
            bl: true,
            br: true,
            mtr: false,
          });

          canvas.add(img);
          canvas.setActiveObject(img);

          setBaseScale(finalBaseScale);

          const { minScale, maxScale, scaleBase } = computeScaleRange(
            img,
            adjustedScale,
            defaultScale !== 1,
          );
          setMinScale(minScale);
          setMaxScale(maxScale);
          setScale(scaleBase);
          // --- Draw and render ---
          drawSafeZoneAndGuidelines();
          canvas.renderAll();

          // Ensure controls are visible and canvas is rendered
          setTimeout(() => {
            const activeObj = canvas.getActiveObject();
            if (activeObj) {
              activeObj.setCoords();
              canvas.renderAll();
            }
          }, 100);

          // --- Update previews ---
          generatePreviews();
        }
      });

      return () => {
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.dispose();
          fabricCanvasRef.current = null;
        }
      };
    }
  }, [
    modalOpen,
    imageSrc,
    responsiveCanvasWidth,
    responsiveCanvasHeight,
    isDetectingMode,
  ]);

  // Cleanup canvas when modal closes
  useEffect(() => {
    if (!modalOpen) {
      autoSizeInitializedRef.current = false;
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      // Reset all state when modal closes
      setImageSrc(null);
      setOriginalImageSrc(null);
      setScale(1);
      setFlipHorizontal(false);
      setFlipVertical(false);
      setPreviews({});
      setError(null);
      setShowGuidelines(true);
      setIsOutsideSafeZone(false);
      setIsNearDottedLine(false);
      setIsTooSmall(false);
      setIsOutsideDottedLine(false);
      setIsNotScaledEnough(false);
      setCanvasMode("normal");
      setResponsiveCanvasWidth(config.canvasWidth);
      setResponsiveCanvasHeight(config.canvasHeight);
    }
  }, [modalOpen, config.canvasWidth, config.canvasHeight]);

  // Generate previews when canvas changes
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;

    const handleObjectChange = () => {
      generatePreviews();
      checkSafeZone();

      // Update scale state when object is scaled manually
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        const currentScale = activeObject.scaleX || 1;
        setScale(currentScale);
      }
    };

    // Force proportional scaling always (even with Shift key)
    const handleUniformScaling = (e: any) => {
      const obj = e.target;
      if (obj && obj.scaleX !== undefined && obj.scaleY !== undefined) {
        // Always keep scaleX and scaleY equal
        const maxScale = Math.max(obj.scaleX, obj.scaleY);
        obj.scaleX = maxScale;
        obj.scaleY = maxScale;
      }
    };

    // Enable centered scaling when Shift is held
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          activeObject.set({ centeredScaling: true });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          activeObject.set({ centeredScaling: false });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    canvas.on("object:modified", handleObjectChange);
    canvas.on("object:moving", handleObjectChange);
    canvas.on("object:scaling", handleUniformScaling);
    canvas.on("object:scaling", handleObjectChange);
    canvas.on("object:rotating", handleObjectChange);
    canvas.on("object:skewing", handleObjectChange);

    // Draw guidelines overlay on top canvas so they're always above the image
    const drawGuidelinesOverlay = () => {
      const topEl: HTMLCanvasElement | undefined = (canvas as any)
        .upperCanvasEl;
      if (!topEl) return;
      const ctx = topEl.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, topEl.width, topEl.height);

      const cw = canvas.getWidth();
      const ch = canvas.getHeight();
      const safePad = Math.min(cw, ch) * 0.1;
      const innerPad = safePad * 0.5;
      const activeObject = canvas.getActiveObject();
      if (!activeObject) return;
      const rect = activeObject.getBoundingRect();
      const photoWidth = rect.width;
      const photoHeight = rect.height;

      const outlinePct = 0.1;

      ctx.save();
      ctx.strokeStyle = isOutsideSafeZone ? "#ef4444" : "#3b82f6";
      ctx.lineWidth = 2;
      if (type === "logo" || type === "normalizer") {
        const ar = photoWidth / photoHeight;

        let dottedX: number,
          dottedY: number,
          dottedWidth: number,
          dottedHeight: number;

        if (ar > 2.5) {
          const desiredW = Math.round(
            photoWidth + outlinePct * photoWidth * 0.5,
          );

          dottedWidth = desiredW;
          dottedHeight = ch - safePad * 2;
          dottedY = Math.round((ch - dottedHeight) / 2);
          dottedX = Math.round((cw - dottedWidth) / 2);
        } else {
          const desiredH = Math.round(
            photoHeight + outlinePct * photoHeight * 1.5,
          );
          const desiredW = Math.round(photoWidth + outlinePct * photoWidth);

          dottedHeight = desiredH;
          dottedWidth = desiredW;

          dottedY = Math.round((ch - dottedHeight) / 2);
          dottedX = Math.round((cw - dottedWidth) / 2);
        }

        ctx.strokeRect(dottedX, dottedY, dottedWidth, dottedHeight);
      } else if (type === "headshot" || forceCircularGuidelines) {
        const radius = Math.min(cw, ch) / 2 - safePad - 36;

        ctx.beginPath();
        ctx.arc(cw / 2, ch / 2, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(safePad, safePad, cw - safePad * 2, ch - safePad * 2);
      }
      ctx.restore();
      // Draw dotted line (recommended area)
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = isNearDottedLine
        ? "#22c55e"
        : isOutsideSafeZone
          ? "#ef4444"
          : isTooSmall || isOutsideDottedLine
            ? "#f97316"
            : "#9ca3af";
      if (type === "logo" || type === "normalizer") {
        const ar = photoWidth / photoHeight;
        const maxDottedH = ch - (safePad + innerPad) * 2;
        const maxDottedW = cw - (safePad + innerPad) * 2;

        let dottedX: number,
          dottedY: number,
          dottedWidth: number,
          dottedHeight: number;

        if (ar > 2.5) {
          dottedHeight = Math.round(maxDottedH);
          dottedWidth = Math.round(photoWidth + 2);
          dottedWidth = Math.min(dottedWidth, maxDottedW);

          dottedY = Math.round((ch - dottedHeight) / 2);
          dottedX = Math.round((cw - dottedWidth) / 2);
        } else {
          const desiredH = Math.round(photoHeight + outlinePct);
          const desiredW = Math.round(photoWidth + 2);

          dottedHeight = Math.min(desiredH, maxDottedH);
          dottedWidth = Math.min(desiredW, maxDottedW);

          dottedY = Math.round((ch - dottedHeight) / 2);
          dottedX = Math.round((cw - dottedWidth) / 2);
        }

        ctx.strokeRect(dottedX, dottedY, dottedWidth, dottedHeight);
      } else if (type === "headshot" || forceCircularGuidelines) {
      } else {
        ctx.strokeRect(
          safePad + innerPad,
          safePad + innerPad,
          cw - (safePad + innerPad) * 2,
          ch - (safePad + innerPad) * 2,
        );
      }

      ctx.restore();

      // Draw center guidelines
      if (showGuidelines) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#9ca3af";
        // Horizontal
        ctx.beginPath();
        ctx.moveTo(0, ch / 2);
        ctx.lineTo(cw, ch / 2);
        ctx.stroke();
        // Vertical
        ctx.beginPath();
        ctx.moveTo(cw / 2, 0);
        ctx.lineTo(cw / 2, ch);
        ctx.stroke();
        ctx.restore();
      }
    };

    canvas.on("after:render", drawGuidelinesOverlay);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.off("object:modified", handleObjectChange);
      canvas.off("object:moving", handleObjectChange);
      canvas.off("object:scaling", handleUniformScaling);
      canvas.off("object:scaling", handleObjectChange);
      canvas.off("object:rotating", handleObjectChange);
      canvas.off("object:skewing", handleObjectChange);
      canvas.off("after:render", drawGuidelinesOverlay);
    };
  }, [
    modalOpen,
    imageSrc,
    generatePreviews,
    checkSafeZone,
    checkHeadshotCropping,
    isOutsideSafeZone,
    isNearDottedLine,
    isTooSmall,
    isOutsideDottedLine,
    isNotScaledEnough,
    showGuidelines,
    canvasMode, // Add canvasMode dependency to trigger preview regeneration
  ]);

  useEffect(() => {
    if (fabricCanvasRef.current && modalOpen) {
      drawSafeZoneAndGuidelines();
    }
  }, [
    showGuidelines,
    isOutsideSafeZone,
    isNearDottedLine,
    isTooSmall,
    isOutsideDottedLine,
    isNotScaledEnough,
    modalOpen,
    drawSafeZoneAndGuidelines,
  ]);

  const handleSave = async () => {
    if (!fabricCanvasRef.current || !imageSrc || !originalImageSrc) return;

    // Set saving state to show spinner
    setIsSaving(true);

    const canvas = fabricCanvasRef.current;
    const activeObject = canvas.getActiveObject();
    if (!activeObject) {
      setIsSaving(false);
      return;
    }

    if ((type === "logo" || type === "normalizer") && isOutsideSafeZone) {
      const confirmSave = window.confirm(
        `⚠️ Your ${previewTitle ? previewTitle : "logo"
        } touches the boundary and may get cropped. Continue?`,
      );
      if (!confirmSave) {
        setIsSaving(false);
        return;
      }
    }

    const objects = canvas.getObjects();
    const hiddenObjects: any[] = [];
    objects.forEach((obj: any) => {
      if (obj.isGuideline || obj.type === "rect" || obj.type === "line") {
        hiddenObjects.push(obj);
        obj.visible = false;
      }
    });

    const prevSelection = activeObject.hasControls;
    activeObject.hasControls = false;
    activeObject.hasBorders = false;

    canvas.discardActiveObject();
    canvas.renderAll();

    const cw = canvas.getWidth();
    const ch = canvas.getHeight();
    const safePad = Math.min(cw, ch) * 0.1;

    // Use current bounding rect for calculation
    const currentRect = activeObject.getBoundingRect();
    const photoWidth = currentRect.width;
    const photoHeight = currentRect.height;
    const ar = photoWidth / photoHeight;

    const outlinePct = 0.1;

    let cropX = 0,
      cropY = 0,
      cropWidth = 0,
      cropHeight = 0;

    if (type === "logo" || type === "normalizer") {
      if (ar > 2) {
        const solidHeight = Math.round(ch - safePad * 2);
        const solidWidth = Math.round(
          photoWidth + outlinePct * photoWidth * 0.5,
        );

        cropWidth = Math.min(solidWidth, cw - 2);
        cropHeight = Math.min(solidHeight, ch - 2);

        cropX = Math.round((cw - cropWidth) / 2);
        cropY = Math.round((ch - cropHeight) / 2);
      } else {
        const solidWidth = Math.round(photoWidth + outlinePct * photoWidth);
        const solidHeight = Math.round(
          photoHeight + outlinePct * photoHeight * 1.5,
        );

        cropWidth = Math.min(solidWidth, cw - 2);
        cropHeight = Math.min(solidHeight, ch - 2);

        cropX = Math.round((cw - cropWidth) / 2);
        cropY = Math.round((ch - cropHeight) / 2);
      }
    } else if (type === "headshot") {
      const solidHeight = Math.round(ch - safePad * 2);
      const solidWidth = Math.round(photoWidth + outlinePct * photoWidth * 0.5);

      const cropFactor = 0.8;

      cropWidth = Math.min(Math.round(solidWidth * cropFactor), cw - 2);
      cropHeight = Math.min(Math.round(solidHeight * cropFactor), ch - 2);

      cropX = Math.round((cw - cropWidth) / 2);
      cropY = Math.round((ch - cropHeight) / 2);
    } else {
      const innerPad = safePad * 0.5;
      cropX = Math.round(safePad + innerPad);
      cropY = Math.round(safePad + innerPad);
      cropWidth = Math.round(cw - (safePad + innerPad) * 2);
      cropHeight = Math.round(ch - (safePad + innerPad) * 2);
    }

    const sourceCanvas = (canvas as any).lowerCanvasEl as HTMLCanvasElement;
    const ratio = window.devicePixelRatio || 1;

    const exportCanvas = document.createElement("canvas");
    const exportCtx = exportCanvas.getContext("2d")!;
    exportCanvas.width = cropWidth * ratio;
    exportCanvas.height = cropHeight * ratio;

    exportCtx.scale(ratio, ratio);
    exportCtx.imageSmoothingEnabled = true;
    exportCtx.imageSmoothingQuality = "high";

    exportCtx.drawImage(
      sourceCanvas,
      cropX * ratio,
      cropY * ratio,
      cropWidth * ratio,
      cropHeight * ratio,
      0,
      0,
      cropWidth,
      cropHeight,
    );

    // Check for transparency to decide between PNG and JPEG
    const pixelData = exportCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height).data;
    let hasTransparency = false;
    for (let i = 3; i < pixelData.length; i += 4) {
      if (pixelData[i] < 255) {
        hasTransparency = true;
        break;
      }
    }

    const exportFormat = hasTransparency ? "image/png" : "image/jpeg";
    const exportQuality = hasTransparency ? 1.0 : 0.85;
    const croppedPreview = exportCanvas.toDataURL(exportFormat, exportQuality);

    hiddenObjects.forEach((obj) => (obj.visible = true));
    activeObject.hasControls = prevSelection;
    activeObject.hasBorders = true;
    canvas.renderAll();

    const originalFileName =
      inputRef.current?.files?.[0]?.name || fileName || "image.png";
    const extension = exportFormat === "image/png" ? ".png" : ".jpg";
    const newFileName =
      originalFileName.replace(/\.[^/.]+$/, "") + "_cropped" + extension;

    const originalImageWidth = activeObject.width || 1;
    const originalImageHeight = activeObject.height || 1;
    const currentScale = activeObject.scaleX || 1;

    const actualImageWidth = originalImageWidth * currentScale;
    const actualImageHeight = originalImageHeight * currentScale;

    const imageCenterX = activeObject.left || cw / 2;
    const imageCenterY = activeObject.top || ch / 2;
    const imageLeft = imageCenterX - actualImageWidth / 2;
    const imageTop = imageCenterY - actualImageHeight / 2;
    const imageRight = imageLeft + actualImageWidth;
    const imageBottom = imageTop + actualImageHeight;

    const cropLeft = Math.max(cropX, imageLeft);
    const cropTop = Math.max(cropY, imageTop);
    const cropRight = Math.min(cropX + cropWidth, imageRight);
    const cropBottom = Math.min(cropY + cropHeight, imageBottom);

    const cropXInImage = (cropLeft - imageLeft) / currentScale;
    const cropYInImage = (cropTop - imageTop) / currentScale;
    const cropWidthInImage = (cropRight - cropLeft) / currentScale;
    const cropHeightInImage = (cropBottom - cropTop) / currentScale;

    const cropXPercent = Math.max(0, (cropXInImage / originalImageWidth) * 100);
    const cropYPercent = Math.max(
      0,
      (cropYInImage / originalImageHeight) * 100,
    );
    const cropWidthPercent = Math.min(
      100,
      (cropWidthInImage / originalImageWidth) * 100,
    );
    const cropHeightPercent = Math.min(
      100,
      (cropHeightInImage / originalImageHeight) * 100,
    );

    const finalize = async () => {
      try {
        let finalOriginalImage = originalImageSrc;
        if (originalImageSrc.length > 300000) { // Compress if > 300KB
          try {
            const { compressImage } = await import("@/lib/image-compression");
            finalOriginalImage = await compressImage(originalImageSrc, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 });
          } catch (err) {
            console.warn("Failed to compress original image in modal", err);
          }
        }

        const cropData: CropMetadata = {
          x: Math.round(cropXPercent * 100) / 100,
          y: Math.round(cropYPercent * 100) / 100,
          width: Math.round(cropWidthPercent * 100) / 100,
          height: Math.round(cropHeightPercent * 100) / 100,
          originalWidth: Math.round(originalImageWidth),
          originalHeight: Math.round(originalImageHeight),
          cropped: true,
          originalImage: finalOriginalImage, // Always use originalImageSrc for backend
        };

        // Headshot / Logo: upload to R2 (advisor assets), store only key in DB
        if (type === "headshot" || type === "logo") {
          try {
            const res = await fetch(croppedPreview);
            const blob = await res.blob();
            const mime = exportFormat === "image/png" ? "image/png" : "image/jpeg";
            const file = new File([blob], newFileName, { type: mime });
            const subPath = type === "headshot" ? "advisor/headshot" : "advisor/logo";
            const r2Key = await uploadFileToR2({
              file,
              purpose: "upload",
              subPath,
              fileName: newFileName,
            });
            if (r2Key) {
              // Pass croppedPreview DataURL as headshotData so callers can use it
              // for logo preview and color extraction without fetching the R2 URL
              onChange(r2Key, newFileName, { previewDataUrl: croppedPreview }, cropData);
              // Reset saving state and close modal after a delay to show spinner
              setTimeout(() => {
                setIsSaving(false);
                handleClose();
              }, 500);
              return;
            }
          } catch (err) {
            console.warn(`[${type}] R2 upload failed, falling back to inline`, err);
          }
        }

        const result = onChange(croppedPreview, newFileName, undefined, cropData);
        if (result != null && typeof (result as Promise<unknown>).then === "function") {
          await (result as Promise<unknown>);
        }
        // Reset saving state and close modal after a delay to show spinner
        setTimeout(() => {
          setIsSaving(false);
          handleClose();
          // Scroll to bottom after modal closes (only for custom type like background images)
          if (type === "custom") {
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          }
        }, 500);
      } catch (error) {
        console.error("Error saving image:", error);
        setIsSaving(false);
      }
    };

    finalize();
  };

  const handleCancel = () => {
    if (imageSrc && fabricCanvasRef.current) {
      if (
        confirm("Are you sure you want to cancel? Your changes will be lost.")
      ) {
        handleClose();
      }
    } else {
      handleClose();
    }
  };

  const centerImage = () => {
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        activeObject.set({
          left: canvas.width! / 2,
          top: canvas.height! / 2,
        });
        activeObject.setCoords();
        canvas.renderAll();
        checkSafeZone();
        generatePreviews();
      }
    }
  };

  const resetImage = () => {
    if (fabricCanvasRef.current && originalImageSrc) {
      const canvas = fabricCanvasRef.current;

      const objects = canvas.getObjects();
      objects.forEach((obj) => {
        canvas.remove(obj);
      });
      canvas.clear();
      canvas.renderAll();

      // Update imageSrc to original for proper initialization
      setImageSrc(originalImageSrc);
      isInitializedRef.current = true;

      FabricImage.fromURL(originalImageSrc)
        .then((img: FabricImage) => {
          if (img && fabricCanvasRef.current) {
            if (fabricCanvasRef.current.getObjects().length > 0) {
              fabricCanvasRef.current.clear();
            }

            // Compute aspect ratio and set max-AR warning for logos/normalizer
            if (type === "logo" || type === "normalizer") {
              const originalW = img.width || 1;
              const originalH = img.height || 1;
              const objAR = originalW / originalH;
              const maxAR = 350 / 140; // ≈ 2.5
              setDetectedAspectRatio(objAR);
              setIsBeyondMaxAspectRatio(objAR > maxAR);
            } else {
              setDetectedAspectRatio(null);
              setIsBeyondMaxAspectRatio(false);
            }

            const canvasWidth = responsiveCanvasWidth;
            const canvasHeight = responsiveCanvasHeight;
            const safeZonePadding =
              config.safeZonePadding ??
              Math.min(canvasWidth, canvasHeight) * 0.1;
            const innerPadding = config.innerPadding ?? safeZonePadding * 0.5;

            const dottedLeft = safeZonePadding + innerPadding;
            const dottedTop = safeZonePadding + innerPadding;
            const dottedRight = canvasWidth - (safeZonePadding + innerPadding);
            const dottedBottom =
              canvasHeight - (safeZonePadding + innerPadding);

            const dottedWidth = dottedRight - dottedLeft;
            const dottedHeight = dottedBottom - dottedTop;

            const solidWidth = canvasWidth - 2 * safeZonePadding;
            const solidHeight = canvasHeight - 2 * safeZonePadding;

            const marginPx = 2;
            const targetWidth = config.fitToSolidLine
              ? solidWidth
              : dottedWidth;
            const targetHeight = config.fitToSolidLine
              ? solidHeight
              : dottedHeight;
            const adjustedWidth = Math.max(0, targetWidth - marginPx * 2);
            const adjustedHeight = Math.max(0, targetHeight - marginPx * 2);

            const scaleX = adjustedWidth / (img.width || 1);
            const scaleY = adjustedHeight / (img.height || 1);

            const imageAspectRatio = (img.width || 1) / (img.height || 1);
            const isSquareCanvas = Math.abs(canvasWidth - canvasHeight) < 10;
            const shouldFitByHeight =
              (config.fitByHeight && imageAspectRatio >= 1) ||
              (config.fitToSolidLine && imageAspectRatio > 2.7);

            let fitScale;
            if (isSquareCanvas) {
              fitScale = Math.max(scaleX, scaleY);
            } else if (shouldFitByHeight) {
              fitScale = scaleY;
            } else {
              fitScale = Math.min(scaleX, scaleY);
            }

            let adjustedScale = fitScale;
            let finalBaseScale = fitScale;

            if (defaultScale !== 1) {
              adjustedScale = fitScale * defaultScale;

              const maxFitScaleX =
                (config.fitToSolidLine ? solidWidth : dottedWidth) /
                (img.width || 1);
              const maxFitScaleY =
                (config.fitToSolidLine ? solidHeight : dottedHeight) /
                (img.height || 1);

              let maxFitScale;
              if (isSquareCanvas) {
                maxFitScale = Math.max(maxFitScaleX, maxFitScaleY);
              } else if (shouldFitByHeight) {
                maxFitScale = maxFitScaleY;
              } else {
                maxFitScale = Math.min(maxFitScaleX, maxFitScaleY);
              }

              adjustedScale = Math.min(adjustedScale, maxFitScale);
              finalBaseScale = adjustedScale;
            }

            img.scale(adjustedScale);
            img.set({
              left: canvasWidth / 2,
              top: canvasHeight / 2,
              originX: "center",
              originY: "center",
              selectable: true,
              hasControls: true,
              hasBorders: true,
              borderColor: "#3b82f6",
              cornerColor: "#3b82f6",
              cornerStyle: "circle",
              transparentCorners: false,
              lockRotation: true,
              lockScalingFlip: true,
              uniformScaling: true,
              angle: 0,
              flipX: false,
              flipY: false,
            });

            img.setControlsVisibility({
              mt: false,
              mb: false,
              ml: false,
              mr: false,
              tl: true,
              tr: true,
              bl: true,
              br: true,
              mtr: false,
            });

            fabricCanvasRef.current.add(img);
            fabricCanvasRef.current.setActiveObject(img);

            setBaseScale(finalBaseScale);

            const { minScale, maxScale, scaleBase } = computeScaleRange(
              img,
              adjustedScale,
              defaultScale !== 1,
            );
            setMinScale(minScale);
            setMaxScale(maxScale);
            setScale(scaleBase);
            setFlipHorizontal(false);
            setFlipVertical(false);

            isInitializedRef.current = true;

            drawSafeZoneAndGuidelines();
            canvas.renderAll();

            setTimeout(() => {
              const activeObj = canvas.getActiveObject();
              if (activeObj) {
                activeObj.setCoords();
                canvas.renderAll();
              }
            }, 100);

            checkSafeZone();
            generatePreviews();
          }
        })
        .catch((error) => {
          console.error("Error loading original image:", error);
          setError("Failed to load original image");
        });
    } else if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        const canvasWidth = responsiveCanvasWidth;
        const canvasHeight = responsiveCanvasHeight;
        const safeZonePadding = Math.min(canvasWidth, canvasHeight) * 0.1;

        const safeZoneLeft = safeZonePadding;
        const safeZoneTop = safeZonePadding;
        const safeZoneRight = canvasWidth - safeZonePadding;
        const safeZoneBottom = canvasHeight - safeZonePadding;

        const safeZoneWidth = safeZoneRight - safeZoneLeft;
        const safeZoneHeight = safeZoneBottom - safeZoneTop;

        const originalWidth = activeObject.width || 0;
        const originalHeight = activeObject.height || 0;

        const margin = 0.15; // 15% margin from safe zone boundaries (smaller than auto-size)
        const adjustedWidth = safeZoneWidth * (1 - margin);
        const adjustedHeight = safeZoneHeight * (1 - margin);

        const scaleX = adjustedWidth / originalWidth;
        const scaleY = adjustedHeight / originalHeight;
        const fitScale = Math.min(scaleX, scaleY);

        // If defaultScale is provided and not 1, first fit image normally, then apply defaultScale
        let initialScale = fitScale;

        if (defaultScale !== 1) {
          // First, scale image to fit normally (touching top and bottom lines)
          // Then apply defaultScale multiplier, but ensure it still fits within adjusted area
          initialScale = fitScale * defaultScale;

          // Calculate maximum scale that still fits within adjusted area (not entire canvas)
          // This ensures image doesn't exceed the boundaries
          const maxFitScaleX = adjustedWidth / originalWidth;
          const maxFitScaleY = adjustedHeight / originalHeight;
          const maxFitScale = Math.min(maxFitScaleX, maxFitScaleY);

          // Don't exceed maxFitScale to ensure image fits within boundaries
          initialScale = Math.min(initialScale, maxFitScale);

          // Update baseScale so percentages show correctly from the new base
          setBaseScale(initialScale);
        }

        activeObject.set({
          left: canvas.width! / 2,
          top: canvas.height! / 2,
          scaleX: initialScale,
          scaleY: initialScale,
          angle: 0,
          flipX: false,
          flipY: false,
        });
        activeObject.setCoords();
        canvas.renderAll();
        setScale(initialScale);
        setFlipHorizontal(false);
        setFlipVertical(false);
        checkSafeZone();
        generatePreviews();
      }
    }
  };

  const autoSizeImage = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    const cw = responsiveCanvasWidth;
    const ch = responsiveCanvasHeight;

    if (type === "headshot") {
      const canvasCenterX = cw / 2;
      const canvasCenterY = ch / 2;
      const circleRadius = Math.min(cw, ch) / 2;

      const previewScaleFactor = 0.65;
      const objBoundingRect = activeObject.getBoundingRect();
      const actualImageWidth = objBoundingRect.width;
      const actualImageHeight = objBoundingRect.height;

      const circleDiameter = circleRadius * 2;

      const requiredScaleForWidth =
        (circleDiameter * previewScaleFactor) / actualImageWidth;
      const requiredScaleForHeight =
        (circleDiameter * previewScaleFactor) / actualImageHeight;

      const scaleMultiplier = Math.max(
        requiredScaleForWidth,
        requiredScaleForHeight,
      );

      const currentScale = activeObject.scaleX || 1;
      let targetScale = currentScale * scaleMultiplier;

      activeObject.set({
        scaleX: targetScale,
        scaleY: targetScale,
        left: canvasCenterX,
        top: canvasCenterY,
        originX: "center",
        originY: "center",
      });

      activeObject.setCoords();
      canvas.renderAll();

      setScale(targetScale);
      setBaseScale(targetScale);
      checkSafeZone();
      generatePreviews();

      return;
    }

    const safePad = Math.min(cw, ch) * 0.1;
    const innerPad = safePad * 0.5;

    const dottedLeft = safePad + innerPad;
    const dottedTop = safePad + innerPad;
    const dottedRight = cw - (safePad + innerPad);
    const dottedBottom = ch - (safePad + innerPad);
    const dottedW = dottedRight - dottedLeft;
    const dottedH = dottedBottom - dottedTop;

    // Calculate solid line dimensions
    const solidW = cw - 2 * safePad;
    const solidH = ch - 2 * safePad;

    const origW = activeObject.width || 1;
    const origH = activeObject.height || 1;

    const marginPx = 2.5;
    const slackPx = 2;
    const totalInset = marginPx + slackPx;

    // If fitToSolidLine is true, use solid dimensions; otherwise use dotted
    const targetW = config.fitToSolidLine ? solidW : dottedW;
    const targetH = config.fitToSolidLine ? solidH : dottedH;
    const constraintW = Math.max(1, targetW - totalInset * 2);
    const constraintH = Math.max(1, targetH - totalInset * 2);

    // Calculate image aspect ratio for dynamic fitByHeight
    const imageAspectRatio = origW / origH;
    // If fitByHeight is true (and image isn't portrait), or if fitToSolidLine is true and aspect ratio > 2.7, scale to fit height only
    const shouldFitByHeight =
      (config.fitByHeight && imageAspectRatio >= 1) ||
      (config.fitToSolidLine && imageAspectRatio > 2.7);

    // If shouldFitByHeight is true, scale to fit height only
    // If defaultScale is used, scale to fit width (side lines) only, not height
    let targetScale: number;
    if (shouldFitByHeight) {
      // Scale to fit height only
      targetScale = constraintH / origH;
    } else if (defaultScale !== 1) {
      // Scale to fit side lines (left/right) only
      targetScale = constraintW / origW;
    } else {
      // Normal behavior: scale to fit both width and height
      targetScale = Math.min(constraintW / origW, constraintH / origH);
    }

    if (!isFinite(targetScale) || targetScale <= 0) targetScale = 1;

    activeObject.set({
      scaleX: targetScale,
      scaleY: targetScale,
      left: cw / 2,
      top: ch / 2,
      originX: "center",
      originY: "center",
    });
    activeObject.setCoords();

    canvas.renderAll();
    setScale(targetScale);

    checkSafeZone();
    generatePreviews();

    // Always show "Perfect!" after auto-size
    setIsNearDottedLine(true);
    setHasTooMuchBlankSpace(false);
    setIsTooSmall(false);
    setIsNotScaledEnough(false);
  };

  useEffect(() => {
    if (imageSrc) {
      autoSizeInitializedRef.current = false;
    }
  }, [imageSrc]);

  useEffect(() => {
    if (!autoSizeOnOpen) return;
    if (!modalOpen || !imageSrc) return;
    if (!fabricCanvasRef.current) return;
    if (autoSizeInitializedRef.current) return;

    const timeoutId = window.setTimeout(() => {
      if (!fabricCanvasRef.current) return;
      autoSizeImage();
      autoSizeInitializedRef.current = true;
    }, 100);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSizeOnOpen, modalOpen, imageSrc]);

  const flipHorizontalImage = () => {
    if (fabricCanvasRef.current && config.allowFlipping) {
      const canvas = fabricCanvasRef.current;
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        activeObject.set({
          flipX: !flipHorizontal,
        });
        activeObject.setCoords();
        canvas.renderAll();
        setFlipHorizontal(!flipHorizontal);
        generatePreviews();
      }
    }
  };

  const flipVerticalImage = () => {
    if (fabricCanvasRef.current && config.allowFlipping) {
      const canvas = fabricCanvasRef.current;
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        activeObject.set({
          flipY: !flipVertical,
        });
        activeObject.setCoords();
        canvas.renderAll();
        setFlipVertical(!flipVertical);
        generatePreviews();
      }
    }
  };

  const toggleCanvasMode = () => {
    const newMode = canvasMode === "normal" ? "compact" : "normal";
    setCanvasMode(newMode);

    // Update canvas dimensions
    const newWidth = newMode === "compact" ? 700 : config.canvasWidth; // Always 600px
    const newHeight = newMode === "compact" ? 300 : config.canvasHeight;

    setResponsiveCanvasWidth(newWidth);
    setResponsiveCanvasHeight(newHeight);

    // Update fabric canvas if it exists
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      canvas.setDimensions({
        width: newWidth,
        height: newHeight,
      });

      // Re-center the image if it exists
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        activeObject.set({
          left: newWidth / 2,
          top: newHeight / 2,
        });
        activeObject.setCoords();
      }

      // Redraw guidelines and update previews
      drawSafeZoneAndGuidelines();
      canvas.renderAll();
      checkSafeZone();
      generatePreviews();
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={inputRef}
        hidden
        accept={config.acceptedTypes.join(",")}
        onChange={handleFileChange}
      />

      <div
        onClick={() => inputRef.current?.click()}
        className={`w-full h-9 border rounded-lg px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer flex items-center relative ${destructive
          ? "!border-red-500 focus-visible:!border-red-500 focus-visible:ring-red-500/20"
          : value
            ? "!border-accent-blue bg-[#23919C]/10 focus-visible:ring-accent-blue/20 dark:focus-visible:ring-accent-blue/30"
            : "!border-gray-300 dark:!border-gray-500 bg-background focus-visible:!border-accent-blue dark:focus-visible:!border-accent-blue focus-visible:ring-accent-blue/20 dark:focus-visible:ring-accent-blue/30"
          }`}
      >
        {value ? (
          <>
            <div className="relative mr-3 h-8 w-8 shrink-0">
              <Headshot
                src={value}
                alt="Uploaded file"
                objectFit="contain"
                wrapperClassName="h-full w-full"
              />
            </div>
            <span className="flex-1 text-sm truncate min-w-0">
              {fileName
                ? fileName.length > 30
                  ? `${fileName.substring(0, 27)}...`
                  : fileName
                : `${placeholder} uploaded`}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
              className="p-1 text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center space-x-2">
            {icon || <Upload className="w-4 h-4" />}
            <span>{placeholder}</span>
          </div>
        )}
      </div>

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      {/* Modal */}
      {modalOpen &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-6xl mx-auto max-h-[95vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-3 sm:p-4 border-b dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  {modalTitle || previewTitle || config.modalTitle}
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {modalDescription
                    ? modalDescription
                    : config.modalDescription}
                </p>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-row overflow-hidden min-h-0">
                {/* Left: Editing Canvas */}
                <div className="w-2/3 p-2 sm:p-3 md:p-4 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                  {imageSrc && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div
                        style={{
                          background: `
                          repeating-conic-gradient(#f0f0f0 0% 25%, #ffffff 0% 50%) 
                          50% / 20px 20px
                        `,
                          padding: "2px",
                          width: canvasMode === "compact" ? "700px" : "600px",
                          height: canvasMode === "compact" ? "300px" : "550px",
                          display: "inline-block",
                        }}
                      >
                        <canvas
                          ref={canvasRef}
                          className="w-full h-full"
                          style={{ border: "1px solid #ddd" }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Info Panel */}
                <div className="w-1/3 p-2 sm:p-3 md:p-4 space-y-1.5 sm:space-y-2 md:space-y-3 flex flex-col overflow-y-auto text-xs sm:text-sm bg-white dark:bg-gray-850 dark:text-gray-100">
                  <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
                    {/* Logo Guidelines */}
                    {(type === "logo" || type === "normalizer") &&
                      (tip === "no-text" ? null : (
                        <div className="p-2 sm:p-2.5 md:p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 rounded-md space-y-1 sm:space-y-1.5">
                          <h4 className="text-[10px] sm:text-xs md:text-sm font-semibold text-blue-900 dark:text-blue-900">
                            {previewTitle ? previewTitle : "Logo"} Guidelines
                          </h4>
                          <ul className="space-y-1 sm:space-y-1.5 text-[9px] sm:text-[10px] md:text-xs text-blue-800 dark:text-blue-100">
                            <li className="flex items-start gap-2">
                              <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                              <span className="dark:text-gray-700">
                                Resize your{" "}
                                {previewTitle ? previewTitle : "logo"} so it
                                fits inside the <strong>dashed line</strong>.
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                              <span className="dark:text-gray-700">
                                The dashed line marks the recommended{" "}
                                {previewTitle ? previewTitle : "logo"} area (for
                                best display on all devices).
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                              <span className="dark:text-gray-700">
                                The solid border line marks the safe zone –
                                anything beyond it may be cropped or hidden.
                              </span>
                            </li>
                          </ul>
                        </div>
                      ))}

                    {type === "headshot" && (
                      <div className="p-2 sm:p-2.5 md:p-3 bg-blue-50 border border-blue-200 rounded-md space-y-1 sm:space-y-1.5">
                        <h4 className="text-[10px] sm:text-xs md:text-sm font-semibold text-blue-900">
                          Photo Adjustment Tips
                        </h4>
                        <ul className="space-y-1 sm:space-y-1.5 text-[9px] sm:text-[10px] md:text-xs text-blue-800">
                          <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span>
                              Grab the blue circles at the edges of your photo
                              to resize.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span>
                              Use the Scale slider below for fine-tuning.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span>
                              Center your face inside the dotted circle for best
                              results.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span>
                              photo sizes and formats vary, please review
                              carefully to make sure there’s no blank space or
                              cutoff areas in the preview.
                            </span>
                          </li>
                        </ul>
                      </div>
                    )}

                    {/* Safe Zone Warnings - Only for logo and normalizer types */}
                    {(type === "logo" || type === "normalizer") && (
                      <>
                        {/* Max Aspect Ratio Warning */}
                        {isBeyondMaxAspectRatio && (
                          <div className="flex items-start space-x-1.5 sm:space-x-2 p-2 sm:p-2.5 md:p-3 bg-red-50 border border-red-200 rounded-md">
                            <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <p className="text-[9px] sm:text-[10px] md:text-xs text-yellow-600">
                              Image is wider than the supported max aspect ratio
                              (2.5:1). It will be cropped to fit the header
                              constraints.
                            </p>
                          </div>
                        )}

                        {/* Safe Zone Warning - RED (touching solid line) */}
                        {isOutsideSafeZone && (
                          <div className="flex items-start space-x-1.5 sm:space-x-2 p-2 sm:p-2.5 md:p-3 bg-red-50 border border-red-200 rounded-md">
                            <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <p className="text-[9px] sm:text-[10px] md:text-xs text-red-600">
                              {previewTitle ? previewTitle : "Logo"} is touching
                              the solid line boundary. Scale down or reposition
                              to stay within the safe zone.
                            </p>
                          </div>
                        )}

                        {/* Outside Dotted Line Warning - ORANGE (between dotted and solid) */}
                        {isOutsideDottedLine && !isOutsideSafeZone && (
                          <div className="flex items-start space-x-1.5 sm:space-x-2 p-2 sm:p-2.5 md:p-3 bg-orange-50 border border-orange-200 rounded-md">
                            <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                            <p className="text-[9px] sm:text-[10px] md:text-xs text-orange-600">
                              {previewTitle ? previewTitle : "Logo"} extends
                              beyond the dotted line. Scale down to fit within
                              the dotted boundary for optimal display.
                            </p>
                          </div>
                        )}

                        {/* Too Small Warning - ORANGE (inside dotted but too small) */}
                        {isTooSmall &&
                          !isOutsideSafeZone &&
                          !isOutsideDottedLine && (
                            <div className="flex items-start space-x-1.5 sm:space-x-2 p-2 sm:p-2.5 md:p-3 bg-orange-50 border border-orange-200 rounded-md">
                              <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                              <p className="text-[9px] sm:text-[10px] md:text-xs text-orange-600">
                                Too much blank space. Please scale up to the
                                dotted line for optimal display.
                              </p>
                            </div>
                          )}

                        {/* Not Scaled Enough Warning - ORANGE (specific scaling warning) */}
                        {isNotScaledEnough &&
                          !isOutsideSafeZone &&
                          !isOutsideDottedLine &&
                          !isTooSmall && (
                            <div className="flex items-start space-x-1.5 sm:space-x-2 p-2 sm:p-2.5 md:p-3 bg-orange-50 border border-orange-200 rounded-md">
                              <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                              <p className="text-[9px] sm:text-[10px] md:text-xs text-orange-600">
                                Image is not scaled enough. Increase the scale
                                to fit within the dotted guidelines.
                              </p>
                            </div>
                          )}

                        {/* Good Position Indicator - GREEN (perfect alignment) */}
                        {!hidePerfectMessage &&
                          isNearDottedLine &&
                          !isOutsideSafeZone &&
                          !isOutsideDottedLine && (
                            <div className="flex items-start space-x-1.5 sm:space-x-2 p-2 sm:p-2.5 md:p-3 bg-green-50 border border-green-200 rounded-md">
                              <svg
                                className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-green-600 mt-0.5 flex-shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              <p className="text-[9px] sm:text-[10px] md:text-xs text-green-600">
                                Perfect! {previewTitle ? previewTitle : "Logo"}{" "}
                                is properly scaled to the dotted line.
                              </p>
                            </div>
                          )}
                      </>
                    )}

                    {/* Previews based on configuration */}
                    {config.previewFormats.map((format) => {
                      const size = config.previewSizes[format];
                      if (!size) return null;

                      // Special styling for Header Bar preview in normalizer
                      const isHeaderBarPreview =
                        type === "normalizer" && format === "custom";

                      return (
                        <div key={format}>
                          <Label className="text-sm font-medium text-gray-600">
                            {previewText ||
                              previewTitle ||
                              modalTitle ||
                              config.modalTitle}
                          </Label>
                          <div className="mt-2">
                            {isHeaderBarPreview ? (
                              <div className="space-y-2">
                                <div
                                  className="border-[1px] border-white rounded-lg bg-white relative mx-auto overflow-hidden"
                                  style={{
                                    width: `100%`,
                                    height:
                                      canvasMode === "compact"
                                        ? "92px"
                                        : "122px",
                                  }}
                                >
                                  {previews[format] ? (
                                    <img
                                      src={previews[format]}
                                      alt="Header Bar Preview"
                                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 object-cover"
                                      style={{
                                        height:
                                          canvasMode === "compact"
                                            ? "100px"
                                            : "150px",
                                        imageRendering:
                                          "-webkit-optimize-contrast",
                                      }}
                                    />
                                  ) : (
                                    <span className="text-gray-400 text-xs">
                                      Adjusting...
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              // Standard preview for other formats
                              <div
                                className={`overflow-hidden bg-white flex items-center justify-center border-2 border-gray-300 ${format === "circle"
                                  ? "rounded-full"
                                  : "rounded-lg"
                                  }`}
                                style={{
                                  width: `${size.width}px`,
                                  height: `${size.height}px`,
                                }}
                              >
                                {previews[format] ? (
                                  <img
                                    src={previews[format]}
                                    alt={`${format} Preview`}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <span className="text-gray-400 text-xs">
                                    Adjusting...
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {previewTitle === "Thumbnail image" && (
                            <div className="flex items-start space-x-1.5 sm:space-x-2 p-2 sm:p-2.5 md:p-3 bg-orange-50 border border-orange-200 rounded-md mt-3">
                              <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                              <p className="text-[9px] sm:text-[10px] md:text-xs text-orange-600">
                                The preview is square (900×900). Make sure your
                                image fits well within these dimensions for best
                                results.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Headshot Crop Warning - Show under previews for headshot type */}
                    {type === "headshot" && isHeadshotCropped && (
                      <div className="flex items-start space-x-1.5 sm:space-x-2 p-2 sm:p-2.5 md:p-3 bg-orange-50 border border-orange-200 rounded-md mt-3">
                        <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <p className="text-[9px] sm:text-[10px] md:text-xs text-orange-600">
                          Image may not fill the circular preview completely.
                          Increase the scale or center the image better.
                        </p>
                      </div>
                    )}

                    {/* File Details */}
                    {config.showFileDetails && imageSrc && (
                      <div className="space-y-2 text-sm">
                        <h4 className="font-medium">File Details</h4>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium">PNG</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Size:</span>
                          <span className="font-medium">
                            {type === "normalizer" || type === "logo"
                              ? canvasMode === "compact"
                                ? `${700}×${300}px`
                                : `${config.canvasWidth}×${config.canvasHeight}px`
                              : `${config.canvasWidth}×${config.canvasHeight}px`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">File Size:</span>
                          <span className="font-medium">~18 KB</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Transparency:</span>
                          <span className="font-medium">Yes</span>
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {config.showWarnings && warnings.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Warnings</h4>
                        <div className="space-y-1">
                          {warnings.map((warning, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 text-yellow-600"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-sm">{warning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="p-4 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Scale Control */}
                    {config.allowScaling && (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Label className="text-[10px] sm:text-xs md:text-sm">
                          Scale
                        </Label>
                        <Slider
                          value={[
                            (() => {
                              const range = maxScale - minScale;
                              if (range === 0 || !Number.isFinite(range)) return 50;
                              const raw = ((scale - minScale) / range) * 100;
                              return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 50;
                            })(),
                          ]}
                          onValueChange={([percent]) => {
                            const newScale =
                              minScale +
                              (percent / 100) * (maxScale - minScale);

                            setScale(newScale);

                            const canvas = fabricCanvasRef.current;
                            if (!canvas) return;

                            const activeObject = canvas.getActiveObject();
                            if (!activeObject) return;

                            activeObject.set({
                              scaleX: newScale,
                              scaleY: newScale,
                            });

                            activeObject.setCoords();
                            canvas.renderAll();
                            generatePreviews();
                            checkSafeZone();
                          }}
                          min={0}
                          max={100}
                          step={0.25}
                          className="w-20 sm:w-24 md:w-32"
                        />

                        <span className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground w-8 sm:w-10 md:w-12">
                          {Math.round((scale / baseScale) * 100)}%
                        </span>
                      </div>
                    )}

                    {/* Show Guidelines Checkbox */}
                    <div className="flex items-center space-x-1.5 sm:space-x-2">
                      <input
                        type="checkbox"
                        id="showGuidelines"
                        checked={showGuidelines}
                        onChange={(e) => setShowGuidelines(e.target.checked)}
                        className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="showGuidelines"
                        className="text-[10px] sm:text-xs md:text-sm font-medium"
                      >
                        Show Guidelines
                      </label>
                    </div>

                    {/* Center, Reset, Auto-size, and Canvas Mode Buttons */}
                    <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={centerImage}
                        disabled={isLoading}
                        className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9"
                      >
                        Center
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetImage}
                        disabled={isLoading}
                        className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9"
                      >
                        Reset
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={autoSizeImage}
                        disabled={isLoading}
                        className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9 min-w-[80px] sm:min-w-[90px] md:min-w-[100px]"
                      >
                        Auto-size
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isLoading}
                      className="flex-1 text-[10px] sm:text-xs md:text-sm h-8 sm:h-9 md:h-10 whitespace-nowrap"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 text-[10px] sm:text-xs md:text-sm h-8 sm:h-9 md:h-10 bg-accent-blue hover:bg-accent-blue/90 text-white dark:bg-accent-blue dark:hover:bg-accent-blue/80"
                    >
                      {isSaving ? (
                        <div className="flex items-center justify-center gap-1.5 w-full">
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin flex-shrink-0" />
                          <span className="truncate">Saving...</span>
                        </div>
                      ) : (
                        <span className="truncate">{saveButtonText || config.saveButtonText}</span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
