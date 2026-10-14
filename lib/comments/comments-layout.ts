"use client";

import { useEffect } from "react";

/**
 * Width of the right-hand Comments rail.
 *
 * Deliberately EQUAL to the Messages rail's (`MESSAGES_RAIL_WIDTH`): the two panels occupy one column,
 * and the dashboard's `paddingRight` takes the `max` of the two insets — so a difference between them
 * would shift the whole page sideways every time the reader swapped rails. The panel's own class and
 * this constant have to move together; they are two spellings of one number.
 */
export const COMMENTS_RAIL_WIDTH = "24rem";

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
