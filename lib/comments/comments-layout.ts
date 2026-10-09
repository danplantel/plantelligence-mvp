"use client";

import { useEffect } from "react";

/** Width of the right-hand Comments rail. */
export const COMMENTS_RAIL_WIDTH = "22rem";

/**
 * Window event fired while the Comments rail is open, mirroring
 * `PREVIEW_EDITOR_LAYOUT_EVENT` (lib/preview-editor-layout.ts). Anything that must
 * clear the rail can listen, and anything offset can subtract `--comments-inset`.
 */
export const COMMENTS_LAYOUT_EVENT = "commentsLayoutChange";

/**
 * Reserve a column for the Comments rail on the right of the page.
 *
 * The same contract as the Preview inline Editing Panel on the LEFT (`--editor-inset`),
 * so a single expression clears both:
 *
 *   `calc(var(--editor-inset, 0px))` on the left, `var(--comments-inset, 0px)` on the right.
 *
 * The variable lives on the document root and is removed on close, so a page that never
 * opens comments is unaffected.
 */
export function useCommentsLayout(
  isOpen: boolean,
  panelWidth: string = COMMENTS_RAIL_WIDTH,
) {
  useEffect(() => {
    const root = document.documentElement;

    const dispatch = (open: boolean) => {
      window.dispatchEvent(
        new CustomEvent(COMMENTS_LAYOUT_EVENT, {
          detail: { isOpen: open, panelWidth },
        }),
      );
    };

    if (isOpen) {
      root.style.setProperty("--comments-inset", panelWidth);
    } else {
      root.style.removeProperty("--comments-inset");
    }
    dispatch(isOpen);

    return () => {
      root.style.removeProperty("--comments-inset");
      dispatch(false);
    };
  }, [isOpen, panelWidth]);
}
