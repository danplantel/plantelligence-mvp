"use client";

import type { Canvas as FabricCanvas } from "fabric";

/**
 * Shared Fabric input-plumbing helpers used by the image editor modals
 * (simple-image-editor-modal.tsx and universal-image-editor-modal.tsx).
 *
 * These were previously duplicated inline in both modals; keeping them here
 * makes the scaling behavior a single source of truth. Canvas lifecycle,
 * type-specific image placement, preview generation, and guideline shapes stay
 * per-modal because they genuinely differ between the two editors.
 */

/**
 * Force proportional scaling always (even with Shift). Attach to Fabric's
 * `object:scaling` event. Keeps scaleX/scaleY equal.
 */
export function handleUniformScale(e: {
  target?: { scaleX?: number; scaleY?: number } | null;
}): void {
  const obj = e?.target;
  if (!obj || obj.scaleX === undefined || obj.scaleY === undefined) return;
  // Only sync if scales are significantly different (to avoid unnecessary updates)
  const diff = Math.abs(obj.scaleX - obj.scaleY);
  if (diff > 0.001) {
    // Always keep scaleX and scaleY equal
    const maxScale = Math.max(obj.scaleX, obj.scaleY);
    obj.scaleX = maxScale;
    obj.scaleY = maxScale;
  }
}

/**
 * Enable centered scaling while the Shift key is held down. Attaches window
 * keydown/keyup listeners that toggle `centeredScaling` on the active object.
 * Returns a cleanup function that removes the listeners.
 */
export function installShiftCenteredScaling(
  canvas: Pick<FabricCanvas, "getActiveObject">,
): () => void {
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

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
}
