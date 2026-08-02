"use client";

import { useState, useRef, useCallback } from "react";
import { Move, RotateCcw } from "lucide-react";
import type { FlyerImagePosition } from "./flyer-templates";

const CANVAS_WIDTH = 320;
const DEFAULT_CANVAS_HEIGHT = 180;

interface FlyerImagePositionEditorProps {
  /** The custom header image URL to display and position */
  imageUrl?: string;
  /** Current focal point (percentage-based) */
  position: FlyerImagePosition;
  /** Called when the user drags to a new position */
  onPositionChange: (position: FlyerImagePosition) => void;
  /** Whether the canvas is disabled (e.g., no image selected) */
  disabled?: boolean;
  /** Destination image region aspect ratio (width / height) on the flyer. The canvas matches
   *  this so the preview reflects exactly what is visible in the flyer. Falls back to 16:9. */
  aspectRatio?: number;
}

/**
 * Single-device drag-to-reposition control for the flyer header image.
 * Mirrors the Step 2 Background Image Positioning canvas, but without a
 * mobile/desktop distinction — there is one shared focal point.
 */
export function FlyerImagePositionEditor({
  imageUrl,
  position,
  onPositionChange,
  disabled = false,
  aspectRatio,
}: FlyerImagePositionEditorProps) {
  // Match the canvas to the destination image region's aspect ratio (e.g. a wide flyer header
  // vs. a portrait card), so the user sees exactly the crop that appears on the flyer.
  const canvasHeight =
    aspectRatio && aspectRatio > 0
      ? Math.max(80, Math.round(CANVAS_WIDTH / aspectRatio))
      : DEFAULT_CANVAS_HEIGHT;
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startPosX: number; startPosY: number } | null>(null);

  const bgPositionX = position.x;
  const bgPositionY = position.y;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || !imageUrl) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        startPosX: position.x,
        startPosY: position.y,
      };
    },
    [disabled, imageUrl, position.x, position.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      e.preventDefault();

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const sensitivity = 2.5;
      let newX = dragStartRef.current.startPosX - dx / sensitivity;
      let newY = dragStartRef.current.startPosY - dy / sensitivity;

      // Clamp to 0-100 range
      newX = Math.max(0, Math.min(100, newX));
      newY = Math.max(0, Math.min(100, newY));

      onPositionChange({ x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 });
    },
    [isDragging, onPositionChange],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsDragging(false);
      dragStartRef.current = null;
    },
    [isDragging],
  );

  const handlePointerLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
  }, [isDragging]);

  const handleReset = useCallback(() => {
    onPositionChange({ x: 50, y: 50 });
  }, [onPositionChange]);

  const hasImage = !!imageUrl && !disabled;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground dark:text-gray-400">
          Drag the image to set the focal point visible in the flyer header.
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasImage}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* Canvas frame */}
      <div className="flex justify-center">
        <div
          className="relative rounded-[18px] border-[3px] border-gray-800 dark:border-gray-600 bg-gray-900 overflow-hidden shadow-lg"
          style={{ width: CANVAS_WIDTH + 16, paddingTop: 16, paddingBottom: 16 }}
        >
          {/* Screen area */}
          <div
            className="mx-auto rounded-[10px] overflow-hidden bg-gray-100 dark:bg-gray-800"
            style={{ width: CANVAS_WIDTH, height: canvasHeight }}
          >
            <div
              className="relative w-full h-full overflow-hidden select-none"
              style={{
                cursor: hasImage ? (isDragging ? "grabbing" : "grab") : "not-allowed",
                touchAction: "none",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onPointerCancel={handlePointerUp}
            >
              {hasImage ? (
                <img
                  src={imageUrl}
                  alt="Flyer header preview"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    objectFit: "cover",
                    objectPosition: `${bgPositionX}% ${bgPositionY}%`,
                  }}
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                  <Move className="w-6 h-6 mb-1 opacity-40" />
                  <span className="text-[10px]">No custom image</span>
                </div>
              )}

              {/* Crosshair overlay showing the current focal point */}
              {hasImage && (
                <>
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${bgPositionX}%`,
                      top: 0,
                      bottom: 0,
                      width: "1px",
                      backgroundColor: isDragging ? "rgba(59,130,246,0.8)" : "rgba(255,255,255,0.5)",
                      transform: "translateX(-50%)",
                    }}
                  />
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top: `${bgPositionY}%`,
                      left: 0,
                      right: 0,
                      height: "1px",
                      backgroundColor: isDragging ? "rgba(59,130,246,0.8)" : "rgba(255,255,255,0.5)",
                      transform: "translateY(-50%)",
                    }}
                  />
                  {/* Focal dot */}
                  <div
                    className="absolute pointer-events-none w-3 h-3 rounded-full border-2"
                    style={{
                      left: `${bgPositionX}%`,
                      top: `${bgPositionY}%`,
                      transform: "translate(-50%, -50%)",
                      borderColor: isDragging ? "rgba(59,130,246,0.9)" : "rgba(255,255,255,0.7)",
                      backgroundColor: isDragging ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.15)",
                    }}
                  />
                </>
              )}

              {/* Drag indicator */}
              {hasImage && !isDragging && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 text-white text-[10px] pointer-events-none">
                  <Move className="w-2.5 h-2.5" />
                  Drag to reposition
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Position readout */}
      {hasImage && (
        <div className="flex justify-center gap-3 text-[10px] text-muted-foreground dark:text-gray-400">
          <span>X: {bgPositionX.toFixed(1)}%</span>
          <span>Y: {bgPositionY.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
