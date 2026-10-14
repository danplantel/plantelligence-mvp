"use client";

import { useEffect } from "react";

/**
 * Width of the right-hand Messages rail.
 *
 * The SAME width as the comments rail (`COMMENTS_RAIL_WIDTH`) on purpose: the two panels occupy one
 * column and the dashboard takes the `max` of their insets, so any difference between them would
 * shift the whole page sideways every time the reader swapped rails.
 */
export const MESSAGES_RAIL_WIDTH = "24rem";

/**
 * Window event fired while the Messages rail is open, mirroring `COMMENTS_LAYOUT_EVENT` — which
 * itself mirrors the Preview inline Editing Panel's. Anything that must clear the rail can listen,
 * and anything offset can subtract `--messages-inset`.
 */
export const MESSAGES_LAYOUT_EVENT = "messagesLayoutChange";

/**
 * Reserve a column for the Messages rail on the right of the page.
 *
 * The same contract as `--editor-inset` (left) and `--comments-inset` (right), with one difference
 * that matters: those two CAN be open together (the preview panel is page-local, comments is
 * global), whereas Messages and Comments are mutually exclusive by construction — the arbiter in
 * `lib/right-panel.ts` guarantees at most one of them is open. The dashboard's `paddingRight`
 * therefore takes the MAXIMUM of the two variables rather than their sum, which is why the rail
 * swapping between them does not shift the page by a rail's width.
 */
export function useMessagesLayout(
  isOpen: boolean,
  panelWidth: string = MESSAGES_RAIL_WIDTH,
) {
  useEffect(() => {
    const root = document.documentElement;

    const dispatch = (open: boolean) => {
      window.dispatchEvent(
        new CustomEvent(MESSAGES_LAYOUT_EVENT, {
          detail: { isOpen: open, panelWidth },
        }),
      );
    };

    if (isOpen) {
      root.style.setProperty("--messages-inset", panelWidth);
    } else {
      root.style.removeProperty("--messages-inset");
    }
    dispatch(isOpen);

    return () => {
      root.style.removeProperty("--messages-inset");
      dispatch(false);
    };
  }, [isOpen, panelWidth]);
}
