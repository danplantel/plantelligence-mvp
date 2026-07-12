"use client";

import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { flushSync } from "react-dom";
import { Canvas, Image as FabricImage, Rect } from "fabric";
import { Button } from "./button";
import { Label } from "./label";
import { Slider } from "./slider";
import { Upload, X, Loader2 } from "lucide-react";

// Export CropMetadata type for use in other components
export interface CropMetadata {
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  cropped: boolean;
  originalImage?: string;
}

interface SimpleImageEditorModalProps {
  value?: string;
  originalValue?: string;
  fileName?: string;
  existingCropData?: CropMetadata;
  onChange: (value: string, fileName: string, cropData?: CropMetadata) => void;
  onRemove: () => void;
  modalTitle?: string;
  modalDescription?: string;
  placeholder?: string;
  saveButtonText?: string;
  isOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  canvasWidth?: number;
  canvasHeight?: number;
  showGuidelines?: boolean;
  guidelineWidth?: number;
  guidelineHeight?: number;
  guidelinePadding?: number;
  autoSizeOnOpen?: boolean;
  guidelinesTitle?: string;
  guidelinesContent?: ReactNode;
  disabled?: boolean;
}

export function SimpleImageEditorModal({
  value,
  originalValue,
  fileName,
  existingCropData,
  onChange,
  onRemove,
  modalTitle = "Edit Image",
  modalDescription = "Upload and edit your image.",
  placeholder = "Upload Image",
  saveButtonText = "Save Image",
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  onOpen: externalOnOpen,
  canvasWidth = 600,
  canvasHeight = 400,
  showGuidelines = true,
  guidelineWidth,
  guidelineHeight,
  guidelinePadding,
  autoSizeOnOpen = false,
  guidelinesTitle,
  guidelinesContent,
  disabled = false,
}: SimpleImageEditorModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const isInitializedRef = useRef(false);
  const autoSizeInitializedRef = useRef(false);
  const isAutoSizingRef = useRef(false); // Track if auto-size is currently executing

  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [baseScale, setBaseScale] = useState(1);
  const [initialScale, setInitialScale] = useState(1); // Original scale when image was first loaded
  const [minScale, setMinScale] = useState(0.1);
  const [maxScale, setMaxScale] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isEditingRef = useRef(false);
  const ignoreScaleDifferenceCheckRef = useRef(false); // Flag to ignore scale difference check after auto-size
  const [
    hadLargeScaleDifferenceBeforeAutoSize,
    setHadLargeScaleDifferenceBeforeAutoSize,
  ] = useState(false); // Remember if hadLargeScaleDifference was true before auto-size
  const [guidelineError, setGuidelineError] = useState<string | null>(null);
  const [isOutsideGuidelines, setIsOutsideGuidelines] = useState(false);
  const [isPerfectlyScaled, setIsPerfectlyScaled] = useState(false);
  const [isPerfectlyScaledLenient, setIsPerfectlyScaledLenient] =
    useState(false);
  const [wasAutoSized, setWasAutoSized] = useState(false);
  const [showCropWarning, setShowCropWarning] = useState(false);
  const [hasTooMuchBlankSpace, setHasTooMuchBlankSpace] = useState(false);
  const [hasLargeScaleDifference, setHasLargeScaleDifference] = useState(false);

  const modalOpen =
    externalIsOpen !== undefined ? externalIsOpen : internalModalOpen;
  const handleClose = externalOnClose || (() => setInternalModalOpen(false));

  // Set imageSrc from value prop when modal opens
  useEffect(() => {
    if (value && modalOpen) {
      setImageSrc(value);

      const originalFromCrop = existingCropData?.originalImage;
      const originalToSave = originalValue || originalFromCrop || value;

      if (!originalImageSrc) {
        setOriginalImageSrc(originalToSave);
      } else if (originalValue || originalFromCrop) {
        setOriginalImageSrc(originalValue || originalFromCrop || null);
      }
      autoSizeInitializedRef.current = false;
    }

    if (!modalOpen) {
      setImageSrc(null);
      setOriginalImageSrc(null);
      isInitializedRef.current = false;
      autoSizeInitializedRef.current = false;
    }
  }, [value, originalValue, existingCropData, modalOpen]);

  // Reset initialization flag when imageSrc changes (for new file uploads)
  const previousImageSrcRef = useRef<string | null>(null);
  useEffect(() => {
    if (imageSrc && modalOpen && imageSrc !== previousImageSrcRef.current) {
      isInitializedRef.current = false;
      previousImageSrcRef.current = imageSrc;
    }
  }, [imageSrc, modalOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsLoading(true);

    // Basic validation
    const maxFileSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxFileSize) {
      setError("File size must be less than 15MB");
      setIsLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as string;
      setImageSrc(dataURL);
      setOriginalImageSrc(dataURL);
      setIsLoading(false);

      // Open modal after image is loaded
      if (externalIsOpen === undefined) {
        setInternalModalOpen(true);
      } else if (externalOnOpen) {
        // If controlled, call onOpen to open modal
        // Use setTimeout to ensure imageSrc is set before modal opens
        setTimeout(() => {
          externalOnOpen();
        }, 50);
      }
    };
    reader.readAsDataURL(file);
  };

  // Store guidelines visibility state
  const [guidelinesVisible, setGuidelinesVisibleState] = useState(true);

  // Cleanup canvas when modal closes
  useEffect(() => {
    if (!modalOpen) {
      autoSizeInitializedRef.current = false;
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      setImageSrc(null);
      setOriginalImageSrc(null);
      setPreviewSrc(null);
      setScale(1);
      setError(null);
      setGuidelineError(null);
      setIsOutsideGuidelines(false);
      setIsPerfectlyScaled(false);
      setIsPerfectlyScaledLenient(false);
      setWasAutoSized(false);
      setShowCropWarning(false);
      setHasTooMuchBlankSpace(false);
      setHasLargeScaleDifference(false);
      setInitialScale(1);
      ignoreScaleDifferenceCheckRef.current = false;
      setHadLargeScaleDifferenceBeforeAutoSize(false);
      isInitializedRef.current = false;
    }
  }, [modalOpen]);

  // Generate preview from canvas
  const setGuidelinesVisibility = (visible: boolean) => {
    setGuidelinesVisibleState(visible);
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.renderAll();
    }
  };

  const getGuidelineMetrics = useCallback(() => {
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

    return {
      outerLeft,
      outerTop,
      outerRight: outerLeft + outerWidth,
      outerBottom: outerTop + outerHeight,
    };
  }, [
    canvasWidth,
    canvasHeight,
    guidelineWidth,
    guidelineHeight,
    guidelinePadding,
  ]);

  const checkAutoSizeMatch = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return false;

    const activeObject =
      canvas.getActiveObject() || canvas.getObjects()?.[0] || null;

    if (!activeObject) return false;

    const pad =
      guidelinePadding ??
      Math.max(10, Math.min(canvasWidth, canvasHeight) * 0.05);

    // Calculate guideline dimensions (same as autoSizeImage)
    const outerWidth = Math.min(
      guidelineWidth ?? canvasWidth - pad * 2,
      canvasWidth - pad * 2,
    );
    const outerHeight = Math.min(
      guidelineHeight ?? canvasHeight - pad * 2,
      canvasHeight - pad * 2,
    );

    const origW = activeObject.width || 1;
    const origH = activeObject.height || 1;

    const marginPx = 2.5;
    const slackPx = 2;
    const totalInset = marginPx + slackPx;

    const constraintW = Math.max(1, outerWidth - totalInset * 2);
    const constraintH = Math.max(1, outerHeight - totalInset * 2);

    // Calculate target scale (same as autoSizeImage)
    const scaleX = constraintW / origW;
    const scaleY = constraintH / origH;
    const targetScale = Math.min(scaleX, scaleY);

    if (!isFinite(targetScale) || targetScale <= 0) return false;

    // Ensure coordinates are up to date
    activeObject.setCoords();

    // Get current scale and position
    const currentScale = activeObject.scaleX || 1;
    const currentLeft = activeObject.left || 0;
    const currentTop = activeObject.top || 0;

    // Tolerance for scale (within 3% of target scale)
    const scaleTolerance = targetScale * 0.03;
    const scaleMatch = Math.abs(currentScale - targetScale) <= scaleTolerance;

    // Tolerance for position (within 15px of center)
    const positionTolerance = 15;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const positionMatch =
      Math.abs(currentLeft - centerX) <= positionTolerance &&
      Math.abs(currentTop - centerY) <= positionTolerance;

    // FINAL RESULT → only scale + position
    return scaleMatch && positionMatch;
  }, [
    canvasWidth,
    canvasHeight,
    guidelineWidth,
    guidelineHeight,
    guidelinePadding,
  ]);

  const evaluateGuidelineBounds = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObject =
      canvas.getActiveObject() || canvas.getObjects()?.[0] || null;

    if (!activeObject) {
      setGuidelineError(null);
      setHasTooMuchBlankSpace(false);
      setIsPerfectlyScaled(false);
      setHasLargeScaleDifference(false);
      return;
    }

    activeObject.setCoords();
    const bounds = activeObject.getBoundingRect();

    const { outerLeft, outerTop, outerRight, outerBottom } =
      getGuidelineMetrics();

    const guidelineWidth = outerRight - outerLeft;
    const guidelineHeight = outerBottom - outerTop;

    // -----------------------------
    // tolerance for both sides
    // -----------------------------
    const tolerance = Math.max(
      5,
      Math.min(guidelineWidth, guidelineHeight) * 0.05,
    );

    // -----------------------------
    // Check blank space on EACH SIDE
    // -----------------------------
    const blankTop = bounds.top > outerTop + tolerance;
    const blankLeft = bounds.left > outerLeft + tolerance;
    const blankRight = bounds.left + bounds.width < outerRight - tolerance;
    const blankBottom = bounds.top + bounds.height < outerBottom - tolerance;

    const hasBlankSpace = blankTop || blankLeft || blankRight || blankBottom;

    // Check if image extends outside the guidelines (crop warning)
    const isOutsideLeft = bounds.left < outerLeft;
    const isOutsideTop = bounds.top < outerTop;
    const isOutsideRight = bounds.left + bounds.width > outerRight;
    const isOutsideBottom = bounds.top + bounds.height > outerBottom;
    const isOutsideGuidelinesBounds =
      isOutsideLeft || isOutsideTop || isOutsideRight || isOutsideBottom;

    setIsOutsideGuidelines(isOutsideGuidelinesBounds);
    setHasTooMuchBlankSpace(hasBlankSpace);
    setIsPerfectlyScaled(!hasBlankSpace);

    // -----------------------------
    // Check if image is too large (scale is significantly larger than optimal)
    // -----------------------------
    if (!ignoreScaleDifferenceCheckRef.current) {
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

      const origW = activeObject.width || 1;
      const origH = activeObject.height || 1;

      const marginPx = 2.5;
      const slackPx = 2;
      const totalInset = marginPx + slackPx;

      const constraintW = Math.max(1, outerWidth - totalInset * 2);
      const constraintH = Math.max(1, outerHeight - totalInset * 2);

      // Calculate optimal scale (same as autoSizeImage)
      const scaleX = constraintW / origW;
      const scaleY = constraintH / origH;
      const targetScale = Math.max(scaleX, scaleY);

      if (isFinite(targetScale) && targetScale > 0) {
        const currentScale = activeObject.scaleX || 1;
        // Image is too large if current scale is more than 5% larger than target
        const isTooLarge = currentScale > targetScale * 1.05;
        
        setHasLargeScaleDifference(isTooLarge);
      } else {
        setHasLargeScaleDifference(false);
      }
    }

    setGuidelineError(
      hasBlankSpace
        ? "Too much blank space. Please scale up to the dotted line for optimal display."
        : null,
    );
  }, [
    getGuidelineMetrics,
    canvasWidth,
    canvasHeight,
    guidelineWidth,
    guidelineHeight,
    guidelinePadding,
  ]);

  useEffect(() => {
    evaluateGuidelineBounds();
  }, [evaluateGuidelineBounds, modalOpen]);

  // Show crop warning immediately when image is outside guidelines
  useEffect(() => {
    if (isOutsideGuidelines) {
      // Show warning after a short delay (async)
      const timeoutId = setTimeout(() => {
        setShowCropWarning(true);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      // Hide warning immediately when image is back within guidelines
      setShowCropWarning(false);
    }
  }, [isOutsideGuidelines]);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (
      modalOpen &&
      imageSrc &&
      canvasRef.current &&
      !isInitializedRef.current
    ) {
      // Dispose existing canvas if any
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }

      const canvas = new Canvas(canvasRef.current, {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: "transparent",
      });

      fabricCanvasRef.current = canvas;

      canvas.clear();

      FabricImage.fromURL(imageSrc)
        .then((img: FabricImage) => {
          if (img && fabricCanvasRef.current) {
            if (fabricCanvasRef.current.getObjects().length > 0) {
              fabricCanvasRef.current.clear();
            }
            // Calculate scale to fit image within canvas
            const scaleX = (canvasWidth * 0.9) / (img.width || 1);
            const scaleY = (canvasHeight * 0.9) / (img.height || 1);
            const initialScale = Math.min(scaleX, scaleY);

            img.scale(initialScale);
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

            fabricCanvasRef.current.add(img);
            fabricCanvasRef.current.setActiveObject(img);

            setScale(initialScale);
            setBaseScale(initialScale);
            setInitialScale(initialScale);
            setMinScale(initialScale * 0.05);
            setMaxScale(initialScale * 5);

            fabricCanvasRef.current.renderAll();
            isInitializedRef.current = true;
            evaluateGuidelineBounds();

            // Generate initial preview
            setTimeout(() => {
              const activeObj = fabricCanvasRef.current?.getActiveObject();
              if (activeObj && fabricCanvasRef.current) {
                const prevControls = activeObj.hasControls;
                const prevBorders = activeObj.hasBorders;
                activeObj.hasControls = false;
                activeObj.hasBorders = false;

                setGuidelinesVisibility(false);
                fabricCanvasRef.current.discardActiveObject();
                fabricCanvasRef.current.renderAll();

                // Get guideline bounds for cropping
                const { outerLeft, outerTop, outerRight, outerBottom } =
                  getGuidelineMetrics();
                const guidelineWidth = outerRight - outerLeft;
                const guidelineHeight = outerBottom - outerTop;

                // Export full canvas first
                const fullCanvasData = fabricCanvasRef.current.toDataURL({
                  format: "png",
                  quality: 1,
                  multiplier: 1,
                });

                // Create a new canvas for cropping to guideline bounds
                const cropCanvas = document.createElement("canvas");
                cropCanvas.width = guidelineWidth;
                cropCanvas.height = guidelineHeight;
                const cropCtx = cropCanvas.getContext("2d");

                if (cropCtx) {
                  const img = new Image();
                  img.onload = () => {
                    // Draw only the guideline area from the full canvas
                    cropCtx.drawImage(
                      img,
                      outerLeft,
                      outerTop,
                      guidelineWidth,
                      guidelineHeight,
                      0,
                      0,
                      guidelineWidth,
                      guidelineHeight,
                    );

                    // Export cropped canvas as preview
                    const dataURL = cropCanvas.toDataURL("image/png");
                    setPreviewSrc(dataURL);

                    // Restore controls
                    if (fabricCanvasRef.current) {
                      setGuidelinesVisibility(true);
                      activeObj.hasControls = prevControls;
                      activeObj.hasBorders = prevBorders;
                      fabricCanvasRef.current.setActiveObject(activeObj);
                      fabricCanvasRef.current.renderAll();
                    }
                  };
                  img.src = fullCanvasData;
                } else {
                  // Fallback to original export if crop canvas creation fails
                  if (fabricCanvasRef.current) {
                    const dataURL = fabricCanvasRef.current.toDataURL({
                      format: "png",
                      quality: 0.9,
                      multiplier: 1,
                    });
                    if (dataURL) {
                      setPreviewSrc(dataURL);
                    }

                    // Restore controls
                    setGuidelinesVisibility(true);
                    activeObj.hasControls = prevControls;
                    activeObj.hasBorders = prevBorders;
                    fabricCanvasRef.current.setActiveObject(activeObj);
                    fabricCanvasRef.current.renderAll();
                  }
                }
              }
            }, 100);
          }
        })
        .catch((error) => {
          console.error("Error loading image:", error);
          setError("Failed to load image");
        });

      return () => {
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.dispose();
          fabricCanvasRef.current = null;
        }
        isInitializedRef.current = false;
      };
    }
  }, [
    modalOpen,
    imageSrc,
    canvasWidth,
    canvasHeight,
    evaluateGuidelineBounds,
    getGuidelineMetrics,
  ]);

  const generatePreview = useCallback(() => {
    if (!fabricCanvasRef.current || isEditingRef.current) return;

    const canvas = fabricCanvasRef.current;
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    // Use requestAnimationFrame to avoid blocking
    requestAnimationFrame(() => {
      if (!fabricCanvasRef.current || isEditingRef.current) return;

      const currentActiveObject = canvas.getActiveObject();
      if (!currentActiveObject) return;

      // Temporarily hide controls
      const prevControls = currentActiveObject.hasControls;
      const prevBorders = currentActiveObject.hasBorders;
      currentActiveObject.hasControls = false;
      currentActiveObject.hasBorders = false;

      setGuidelinesVisibility(false);
      canvas.discardActiveObject();
      canvas.renderAll();

      // Get guideline bounds for cropping
      const { outerLeft, outerTop, outerRight, outerBottom } =
        getGuidelineMetrics();
      const guidelineWidth = outerRight - outerLeft;
      const guidelineHeight = outerBottom - outerTop;

      // Export full canvas first
      const fullCanvasData = canvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1,
      });

      // Create a new canvas for cropping to guideline bounds
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = guidelineWidth;
      cropCanvas.height = guidelineHeight;
      const cropCtx = cropCanvas.getContext("2d");

      if (cropCtx) {
        const img = new Image();
        img.onload = () => {
          // Draw only the guideline area from the full canvas
          cropCtx.drawImage(
            img,
            outerLeft,
            outerTop,
            guidelineWidth,
            guidelineHeight,
            0,
            0,
            guidelineWidth,
            guidelineHeight,
          );

          // Export cropped canvas as preview
          const dataURL = cropCanvas.toDataURL("image/png");
          setPreviewSrc(dataURL);

          // Restore controls immediately
          setGuidelinesVisibility(true);
          currentActiveObject.hasControls = prevControls;
          currentActiveObject.hasBorders = prevBorders;
          canvas.setActiveObject(currentActiveObject);
          canvas.renderAll();
        };
        img.src = fullCanvasData;
      } else {
        // Fallback to original export if crop canvas creation fails
        const dataURL = canvas.toDataURL({
          format: "png",
          quality: 0.9,
          multiplier: 1,
        });
        setPreviewSrc(dataURL);

        // Restore controls immediately
        setGuidelinesVisibility(true);
        currentActiveObject.hasControls = prevControls;
        currentActiveObject.hasBorders = prevBorders;
        canvas.setActiveObject(currentActiveObject);
        canvas.renderAll();
      }
    });
  }, [getGuidelineMetrics]);

  // Handle object changes
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    let previewTimeout: NodeJS.Timeout | null = null;

    const handleObjectMoving = () => {
      isEditingRef.current = true;
      // Reset auto-size flag when user manually edits
      setWasAutoSized(false);
      // Re-enable scale difference check when user starts editing
      ignoreScaleDifferenceCheckRef.current = false;
      // Reset the flag that remembers if image was too large before auto-size
      setHadLargeScaleDifferenceBeforeAutoSize(false);
      // Update scale during movement but don't generate preview
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        const currentScale = activeObject.scaleX || 1;
        setScale(currentScale);
      }
      evaluateGuidelineBounds();
    };

    const handleObjectModified = () => {
      // Reset auto-size flag when user manually edits
      setWasAutoSized(false);
      // Re-enable scale difference check when user starts editing
      ignoreScaleDifferenceCheckRef.current = false;
      // Reset the flag that remembers if image was too large before auto-size
      setHadLargeScaleDifferenceBeforeAutoSize(false);
      // Update scale immediately
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        const currentScale = activeObject.scaleX || 1;
        setScale(currentScale);
      }
      evaluateGuidelineBounds();

      // Mark editing as complete and generate preview after delay
      // Use a longer delay to ensure editing is truly complete
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }

      // Wait a bit before marking as not editing
      setTimeout(() => {
        isEditingRef.current = false;
        previewTimeout = setTimeout(() => {
          if (!isEditingRef.current) {
            generatePreview();
          }
        }, 300);
      }, 100);
    };

    // Force proportional scaling always (even with Shift key)
    const handleUniformScaling = (e: any) => {
      if (!e || !e.target) return;
      const obj = e.target;
      if (obj && obj.scaleX !== undefined && obj.scaleY !== undefined) {
        // Only sync if scales are significantly different (to avoid unnecessary updates)
        const diff = Math.abs(obj.scaleX - obj.scaleY);
        if (diff > 0.001) {
          // Always keep scaleX and scaleY equal
          const maxScale = Math.max(obj.scaleX, obj.scaleY);
          obj.scaleX = maxScale;
          obj.scaleY = maxScale;
        }
      }
    };

    const handleScaling = () => {
      isEditingRef.current = true;
      // Re-enable scale difference check when user starts editing
      ignoreScaleDifferenceCheckRef.current = false;
      // Reset the flag that remembers if image was too large before auto-size
      setHadLargeScaleDifferenceBeforeAutoSize(false);
      // Update scale during scaling but don't generate preview
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        const currentScale = activeObject.scaleX || 1;
        setScale(currentScale);
      }
      evaluateGuidelineBounds();
    };

    // Handle mouse down to mark start of editing
    const handleMouseDown = () => {
      isEditingRef.current = true;
    };

    // Handle mouse up to detect end of editing
    const handleMouseUp = () => {
      // Small delay to ensure all events are processed
      setTimeout(() => {
        isEditingRef.current = false;
        // Generate preview after mouse is released
        if (previewTimeout) {
          clearTimeout(previewTimeout);
        }
        previewTimeout = setTimeout(() => {
          if (!isEditingRef.current) {
            generatePreview();
          }
        }, 500);
      }, 100);
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

    canvas.on("object:modified", handleObjectModified);
    canvas.on("object:moving", handleObjectMoving);
    canvas.on("object:scaling", handleUniformScaling);
    canvas.on("object:scaling", handleScaling);
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:up", handleMouseUp);
    canvas.on("object:rotating", handleObjectModified);
    canvas.on("object:skewing", handleObjectModified);

    // Draw guidelines overlay on top canvas so they're always above the image
    const drawGuidelinesOverlay = () => {
      if (!showGuidelines || !guidelinesVisible) return;

      const topEl: HTMLCanvasElement | undefined = (canvas as any)
        .upperCanvasEl;
      if (!topEl) return;
      const ctx = topEl.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, topEl.width, topEl.height);

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

      // Draw outer rectangle (solid line)
      ctx.save();
      ctx.strokeStyle = isOutsideGuidelines ? "#ef4444" : "#3b82f6";
      ctx.lineWidth = 2;
      ctx.strokeRect(outerLeft, outerTop, outerWidth, outerHeight);
      ctx.restore();

      // Draw inner rectangle (dashed line)
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = isOutsideGuidelines ? "#ef4444" : "#9ca3af";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        outerLeft + pad / 2,
        outerTop + pad / 2,
        outerWidth - pad,
        outerHeight - pad,
      );
      ctx.restore();
    };

    canvas.on("after:render", drawGuidelinesOverlay);

    return () => {
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.off("object:modified", handleObjectModified);
      canvas.off("object:moving", handleObjectMoving);
      canvas.off("object:scaling", handleUniformScaling);
      canvas.off("object:scaling", handleScaling);
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:up", handleMouseUp);
      canvas.off("object:rotating", handleObjectModified);
      canvas.off("object:skewing", handleObjectModified);
      canvas.off("after:render", drawGuidelinesOverlay);
    };
  }, [
    modalOpen,
    imageSrc,
    generatePreview,
    showGuidelines,
    guidelinesVisible,
    canvasWidth,
    canvasHeight,
    guidelineWidth,
    guidelineHeight,
    guidelinePadding,
    evaluateGuidelineBounds,
    isOutsideGuidelines,
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

    // Get guideline bounds
    const { outerLeft, outerTop, outerRight, outerBottom } =
      getGuidelineMetrics();
    const guidelineWidth = outerRight - outerLeft;
    const guidelineHeight = outerBottom - outerTop;

    // Get original image dimensions from the active object
    const originalImageWidth = activeObject.width || 1;
    const originalImageHeight = activeObject.height || 1;
    const currentScale = activeObject.scaleX || 1;

    // Calculate actual image dimensions in canvas coordinates
    const actualImageWidth = originalImageWidth * currentScale;
    const actualImageHeight = originalImageHeight * currentScale;

    // Calculate crop position relative to original image
    // We need to find where the guideline bounds are relative to the image
    const imageLeft = (activeObject.left || 0) - actualImageWidth / 2;
    const imageTop = (activeObject.top || 0) - actualImageHeight / 2;

    // Calculate crop coordinates relative to original image (before scaling)
    const cropX = Math.max(0, (outerLeft - imageLeft) / currentScale);
    const cropY = Math.max(0, (outerTop - imageTop) / currentScale);
    const cropWidth = Math.min(
      originalImageWidth - cropX,
      guidelineWidth / currentScale,
    );
    const cropHeight = Math.min(
      originalImageHeight - cropY,
      guidelineHeight / currentScale,
    );

    // Convert to percentages (0-100) relative to original image
    const cropXPercent = (cropX / originalImageWidth) * 100;
    const cropYPercent = (cropY / originalImageHeight) * 100;
    const cropWidthPercent = (cropWidth / originalImageWidth) * 100;
    const cropHeightPercent = (cropHeight / originalImageHeight) * 100;

    // Create crop metadata in percentages
    const cropData: CropMetadata = {
      x: Math.round(cropXPercent * 100) / 100, // Round to 2 decimal places
      y: Math.round(cropYPercent * 100) / 100,
      width: Math.round(cropWidthPercent * 100) / 100,
      height: Math.round(cropHeightPercent * 100) / 100,
      originalWidth: Math.round(originalImageWidth),
      originalHeight: Math.round(originalImageHeight),
      cropped: true,
    };

    // Hide controls and guidelines before export
    activeObject.hasControls = false;
    activeObject.hasBorders = false;
    setGuidelinesVisibility(false);

    canvas.discardActiveObject();
    canvas.renderAll();

    // Create a new canvas for cropping to guideline bounds
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = guidelineWidth;
    cropCanvas.height = guidelineHeight;
    const cropCtx = cropCanvas.getContext("2d");

    if (cropCtx) {
      // Get the full canvas as image data
      const fullCanvasData = canvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1,
      });

      const img = new Image();
      img.onload = async () => {
        try {
          // Draw only the guideline area from the full canvas
          cropCtx.drawImage(
            img,
            outerLeft,
            outerTop,
            guidelineWidth,
            guidelineHeight,
            0,
            0,
            guidelineWidth,
            guidelineHeight,
          );

          const croppedPreview = cropCanvas.toDataURL("image/png");

          setGuidelinesVisibility(true);
          activeObject.hasControls = true;
          activeObject.hasBorders = true;
          canvas.setActiveObject(activeObject);
          canvas.renderAll();

          const originalFileName =
            inputRef.current?.files?.[0]?.name || fileName || "image.png";
          const newFileName =
            originalFileName.replace(/\.[^/.]+$/, "") + "_edited.png";

          const cropDataWithOriginal: CropMetadata = {
            ...cropData,
            originalImage: originalImageSrc,
          };

          const result = onChange(croppedPreview, newFileName, cropDataWithOriginal);
          if (result != null && typeof (result as Promise<unknown>).then === "function") {
            await (result as Promise<unknown>);
          }
          // Reset saving state and close modal after a delay to show spinner
          setTimeout(() => {
            setIsSaving(false);
            handleClose();
          }, 500);
        } catch (error) {
          console.error("Error saving image:", error);
          setIsSaving(false);
        }
      };
      img.src = fullCanvasData;
    } else {
      try {
        // Fallback to original export if crop canvas creation fails
        const dataURL = canvas.toDataURL({
          format: "png",
          quality: 0.95,
          multiplier: 1,
        });

        // Restore controls and guidelines
        setGuidelinesVisibility(true);
        activeObject.hasControls = true;
        activeObject.hasBorders = true;
        canvas.setActiveObject(activeObject);
        canvas.renderAll();

        const originalFileName =
          inputRef.current?.files?.[0]?.name || fileName || "image.png";
        const newFileName =
          originalFileName.replace(/\.[^/.]+$/, "") + "_edited.png";

        // If crop failed, don't send crop data (image not cropped)
        const result = onChange(dataURL, newFileName);
        if (result != null && typeof (result as Promise<unknown>).then === "function") {
          await (result as Promise<unknown>);
        }
        // Reset saving state and close modal after a delay to show spinner
        setTimeout(() => {
          setIsSaving(false);
          handleClose();
        }, 500);
      } catch (error) {
        console.error("Error saving image:", error);
        setIsSaving(false);
      }
    }
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
        // Reset auto-size flag when user manually centers
        setWasAutoSized(false);
        activeObject.set({
          left: canvas.width! / 2,
          top: canvas.height! / 2,
        });
        activeObject.setCoords();
        canvas.renderAll();
        evaluateGuidelineBounds();
        generatePreview();
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

      isInitializedRef.current = true;

      FabricImage.fromURL(originalImageSrc)
        .then((img: FabricImage) => {
          if (img && fabricCanvasRef.current) {
            if (fabricCanvasRef.current.getObjects().length > 0) {
              fabricCanvasRef.current.clear();
            }

            // Calculate scale to fit image within canvas
            const scaleX = (canvasWidth * 0.9) / (img.width || 1);
            const scaleY = (canvasHeight * 0.9) / (img.height || 1);
            const initialScale = Math.min(scaleX, scaleY);

            img.scale(initialScale);
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

            fabricCanvasRef.current.add(img);
            fabricCanvasRef.current.setActiveObject(img);

            setScale(initialScale);
            setBaseScale(initialScale);
            setInitialScale(initialScale);
            setMinScale(initialScale * 0.05);
            setMaxScale(initialScale * 5);

            // Reset auto-size flag
            setWasAutoSized(false);
            ignoreScaleDifferenceCheckRef.current = false;
            setHadLargeScaleDifferenceBeforeAutoSize(false);

            fabricCanvasRef.current.renderAll();
            isInitializedRef.current = true;
            evaluateGuidelineBounds();

            // Generate initial preview
            setTimeout(() => {
              generatePreview();
            }, 100);
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
        // Reset auto-size flag when user manually resets
        setWasAutoSized(false);
        const scaleX = (canvasWidth * 0.9) / (activeObject.width || 1);
        const scaleY = (canvasHeight * 0.9) / (activeObject.height || 1);
        const resetScale = Math.min(scaleX, scaleY);

        activeObject.set({
          left: canvas.width! / 2,
          top: canvas.height! / 2,
          scaleX: resetScale,
          scaleY: resetScale,
          angle: 0,
        });
        activeObject.setCoords();
        canvas.renderAll();
        setScale(resetScale);
        evaluateGuidelineBounds();
        generatePreview();
      }
    }
  };

  const autoSizeImage = useCallback(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    const pad =
      guidelinePadding ??
      Math.max(10, Math.min(canvasWidth, canvasHeight) * 0.05);

    // Calculate guideline dimensions
    const outerWidth = Math.min(
      guidelineWidth ?? canvasWidth - pad * 2,
      canvasWidth - pad * 2,
    );
    const outerHeight = Math.min(
      guidelineHeight ?? canvasHeight - pad * 2,
      canvasHeight - pad * 2,
    );

    const origW = activeObject.width || 1;
    const origH = activeObject.height || 1;

    const marginPx = 2.5;
    const slackPx = 2;
    const totalInset = marginPx + slackPx;

    const constraintW = Math.max(1, outerWidth - totalInset * 2);
    const constraintH = Math.max(1, outerHeight - totalInset * 2);

    // Calculate scale to fill guidelines - use Math.max so the smaller side fills the lines
    const scaleX = constraintW / origW;
    const scaleY = constraintH / origH;
    const targetScale = Math.max(scaleX, scaleY);
    if (!isFinite(targetScale) || targetScale <= 0) return;

    // Check current state before auto-size to determine if image was too large/small
    // First, temporarily enable check to get accurate current state
    const wasIgnoring = ignoreScaleDifferenceCheckRef.current;
    ignoreScaleDifferenceCheckRef.current = false;

    const currentScaleBeforeAutoSize = activeObject.scaleX || 1;
    const wasTooLargeBeforeAutoSize =
      currentScaleBeforeAutoSize > targetScale * 1.05;
    const wasTooSmallBeforeAutoSize =
      currentScaleBeforeAutoSize < targetScale * 0.95;

    // Also use current hasLargeScaleDifference state if it's set
    // This ensures we capture the state even if user manually adjusted the image
    const currentStateHasLargeDifference = hasLargeScaleDifference;

    // Restore ignore flag before setting it again
    ignoreScaleDifferenceCheckRef.current = wasIgnoring;

    const hadSignificantDifferenceBeforeAutoSize =
      wasTooLargeBeforeAutoSize ||
      wasTooSmallBeforeAutoSize ||
      currentStateHasLargeDifference;

    setHadLargeScaleDifferenceBeforeAutoSize(
      hadSignificantDifferenceBeforeAutoSize,
    );

    

    ignoreScaleDifferenceCheckRef.current = true;

    activeObject.set({
      scaleX: targetScale,
      scaleY: targetScale,
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      originX: "center",
      originY: "center",
    });
    activeObject.setCoords();
    canvas.renderAll();

    setScale(targetScale);
    setBaseScale(targetScale);
    setMinScale(targetScale * 0.05);
    setMaxScale(targetScale * 5);

    // Use flushSync to force synchronous state updates so UI updates immediately
    flushSync(() => {
      setWasAutoSized(true);
      setIsPerfectlyScaled(true);
      setHasTooMuchBlankSpace(false);
      setHasLargeScaleDifference(false);
      setIsPerfectlyScaledLenient(true);
    });

    

    // Reset the ignore flag immediately so evaluation can run properly
    ignoreScaleDifferenceCheckRef.current = false;

    // Use requestAnimationFrame to ensure DOM is updated before evaluation
    requestAnimationFrame(() => {
      evaluateGuidelineBounds();
      generatePreview();
    });
  }, [generatePreview, evaluateGuidelineBounds]);

  // Auto-size on open
  useEffect(() => {
    if (!autoSizeOnOpen) return;
    if (!modalOpen || !imageSrc) return;
    if (!fabricCanvasRef.current) return;
    if (autoSizeInitializedRef.current) return;

    const timeoutId = window.setTimeout(() => {
      if (!fabricCanvasRef.current) return;
      autoSizeImage();
      autoSizeInitializedRef.current = true;
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [autoSizeOnOpen, modalOpen, imageSrc, autoSizeImage]);

  return (
    <div>
      <input
        type="file"
        ref={inputRef}
        hidden
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled}
      />

      <div
        onClick={() => {
          if (disabled) return;
          if (value) {
            // If image exists, open modal for editing
            if (externalIsOpen === undefined) {
              setInternalModalOpen(true);
            } else if (externalOnOpen) {
              // If controlled, call onOpen to open modal
              externalOnOpen();
            }
          } else {
            // If no image, open file picker
            inputRef.current?.click();
          }
        }}
        className={`w-full h-9 border rounded-lg px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 flex items-center relative ${
          disabled
            ? "cursor-not-allowed opacity-50 bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600"
            : value
            ? "border-accent-blue bg-[#23919C]/10 focus-visible:ring-ring cursor-pointer"
            : "border-input bg-background focus-visible:ring-ring cursor-pointer"
        }`}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Uploaded file"
              className="w-8 h-8 object-contain mr-3"
            />
            <span className="flex-1 text-sm truncate">
              {fileName || `${placeholder} uploaded`}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                onRemove();
                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
              disabled={disabled}
              className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center space-x-2">
            <Upload className="w-4 h-4" />
            <span>{placeholder}</span>
          </div>
        )}
      </div>

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-6xl mx-auto max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-3 sm:p-4 border-b dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {modalTitle}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {modalDescription}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-row overflow-hidden min-h-0">
              {/* Left: Editing Canvas */}
              <div className="w-2/3 p-2 sm:p-3 md:p-4 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                {imageSrc ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div
                      style={{
                        background: `
                          repeating-conic-gradient(#f0f0f0 0% 25%, #ffffff 0% 50%) 
                          50% / 20px 20px
                        `,
                        padding: "2px",
                        width: `${canvasWidth}px`,
                        height: `${canvasHeight}px`,
                        display: "inline-block",
                      }}
                    >
                      <canvas
                        ref={canvasRef}
                        width={canvasWidth}
                        height={canvasHeight}
                        style={{
                          border: "1px solid #ddd",
                          display: "block",
                          maxWidth: "100%",
                          maxHeight: "100%",
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 dark:text-gray-500">
                    <p className="text-sm">No image selected</p>
                    <p className="text-xs mt-1">
                      Upload an image to start editing
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Info Panel */}
              <div className="w-1/3 p-2 sm:p-3 md:p-4 space-y-4 flex flex-col overflow-y-auto text-xs sm:text-sm bg-white dark:bg-gray-800 dark:text-gray-100">
                {guidelinesContent && (
                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 text-blue-900 dark:text-blue-200 text-[11px] sm:text-xs space-y-2">
                    {guidelinesTitle && (
                      <p className="font-semibold text-blue-900 dark:text-blue-300 text-xs sm:text-sm">
                        {guidelinesTitle}
                      </p>
                    )}
                    <div className="text-blue-800 dark:text-blue-200">{guidelinesContent}</div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Preview
                  </Label>
                  <div className="mt-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700 flex items-center justify-center">
                    <div
                      style={{
                        width: "200px",
                        height: "150px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {previewSrc || imageSrc ? (
                        <img
                          src={previewSrc || imageSrc || ""}
                          alt="Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">No image</span>
                      )}
                    </div>
                  </div>
                  {(() => {
                    // Calculate target scale (same as autoSizeImage) to check if image is too large
                    let isMoreThan5PercentLargerThanAutoSize = false;
                    if (fabricCanvasRef.current) {
                      const activeObject =
                        fabricCanvasRef.current.getActiveObject() ||
                        fabricCanvasRef.current.getObjects()?.[0] ||
                        null;

                      if (activeObject) {
                        const pad =
                          guidelinePadding ??
                          Math.max(
                            10,
                            Math.min(canvasWidth, canvasHeight) * 0.05,
                          );

                        const outerWidth = Math.min(
                          guidelineWidth ?? canvasWidth - pad * 2,
                          canvasWidth - pad * 2,
                        );
                        const outerHeight = Math.min(
                          guidelineHeight ?? canvasHeight - pad * 2,
                          canvasHeight - pad * 2,
                        );

                        const origW = activeObject.width || 1;
                        const origH = activeObject.height || 1;

                        const marginPx = 2.5;
                        const slackPx = 2;
                        const totalInset = marginPx + slackPx;

                        const constraintW = Math.max(
                          1,
                          outerWidth - totalInset * 2,
                        );
                        const constraintH = Math.max(
                          1,
                          outerHeight - totalInset * 2,
                        );

                        const scaleX = constraintW / origW;
                        const scaleY = constraintH / origH;
                        const targetScale = Math.max(scaleX, scaleY);

                        if (isFinite(targetScale) && targetScale > 0) {
                          const currentScale = activeObject.scaleX || 1;
                          // Check if current scale is more than 5% larger than target scale
                          isMoreThan5PercentLargerThanAutoSize =
                            currentScale > targetScale * 1.05;
                        }
                      }
                    }

                    return (
                      isPerfectlyScaledLenient &&
                      !hasTooMuchBlankSpace &&
                      !isMoreThan5PercentLargerThanAutoSize &&
                      (hasLargeScaleDifference ||
                      hadLargeScaleDifferenceBeforeAutoSize ? (
                        <div className="mt-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-2 text-[11px] text-green-700 dark:text-green-300">
                          Perfect! Image is properly scaled to the safe area.
                          You can reposition or resize it as you prefer.
                        </div>
                      ) : (
                        <div className="mt-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-2 text-[11px] text-green-700 dark:text-green-300">
                          Image is already sized to the acceptable range. You
                          can still adjust it manually if you prefer.
                        </div>
                      ))
                    );
                  })()}
                  {hasTooMuchBlankSpace && (
                    <div className="mt-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-2 text-[11px] text-red-700 dark:text-red-300">
                      Too much blank space. Please scale up to the dotted line
                      for optimal display.
                    </div>
                  )}
                  {isOutsideGuidelines && (
                    <div className="mt-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                      Please note: the photo will only be saved within the
                      frame. Anything outside the frame will be automatically
                      cropped.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="p-4 border-t dark:border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Scale Control */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Label className="text-[10px] sm:text-xs md:text-sm">
                      Scale
                    </Label>
                    <Slider
                      value={[
                        ((scale - minScale) / (maxScale - minScale)) * 100,
                      ]}
                      onValueChange={([percent]) => {
                        isEditingRef.current = true;
                        // Reset auto-size flag when user manually adjusts scale
                        setWasAutoSized(false);
                        // Re-enable scale difference check when user starts editing
                        ignoreScaleDifferenceCheckRef.current = false;
                        // Reset the flag that remembers if image was too large before auto-size
                        setHadLargeScaleDifferenceBeforeAutoSize(false);
                        const newScale =
                          minScale + (percent / 100) * (maxScale - minScale);

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
                        evaluateGuidelineBounds();
                      }}
                      onValueCommit={([percent]) => {
                        isEditingRef.current = false;
                        setTimeout(() => {
                          if (!isEditingRef.current) {
                            generatePreview();
                          }
                        }, 300);
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

                  {/* Center, Reset, and Auto-size Buttons */}
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
                      size="sm"
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
                    className="flex-1 text-[10px] sm:text-xs md:text-sm h-8 sm:h-9 md:h-10"
                  >
                    {isSaving ? (
                      <div className="flex items-center justify-center gap-1.5 w-full">
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin flex-shrink-0" />
                        <span className="truncate">Saving...</span>
                      </div>
                    ) : (
                      <span className="truncate">{saveButtonText}</span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
