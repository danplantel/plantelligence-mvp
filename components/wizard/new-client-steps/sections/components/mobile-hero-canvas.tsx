"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Move, RotateCcw } from "lucide-react";
import type { MobileHeroPosition } from "@/types/new-client-wizard";

const CANVAS_WIDTH = 280;
const CANVAS_HEIGHT = 200;

interface MobileHeroCanvasProps {
  /** The hero image URL to display and position */
  imageUrl: string | undefined;
  /** Current mobile background position (percentage-based) */
  position: MobileHeroPosition;
  /** Called when the user drags to a new position */
  onPositionChange: (position: MobileHeroPosition) => void;
  /** Whether the canvas is disabled (e.g., no image selected) */
  disabled?: boolean;
}

export function MobileHeroCanvas({
  imageUrl,
  position,
  onPositionChange,
  disabled = false,
}: MobileHeroCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startPosX: number; startPosY: number } | null>(null);

  // Convert percentage position to CSS background-position
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

      // Scale the drag sensitivity: moving the mouse N pixels moves the
      // background position by a proportional amount.
      // Smaller divisor = more sensitive dragging.
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

  // Also end drag if pointer leaves
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
          Drag the image to choose which portion is visible on mobile devices.
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

      {/* Mobile phone frame */}
      <div className="flex justify-center">
        <div className="relative rounded-[18px] border-[3px] border-gray-800 dark:border-gray-600 bg-gray-900 overflow-hidden shadow-lg"
          style={{ width: CANVAS_WIDTH + 16, paddingTop: 16, paddingBottom: 16 }}
        >
          {/* Screen area */}
          <div className="mx-auto rounded-[10px] overflow-hidden bg-gray-100 dark:bg-gray-800"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          >
            <div
              ref={canvasRef}
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
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: `${bgPositionX}% ${bgPositionY}%`,
                    backgroundRepeat: "no-repeat",
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                  <Move className="w-6 h-6 mb-1 opacity-40" />
                  <span className="text-[10px]">No hero image selected</span>
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

          {/* Phone notch */}
          <div className="absolute top-[6px] left-1/2 -translate-x-1/2 w-16 h-1.5 bg-gray-700 dark:bg-gray-500 rounded-full" />
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
