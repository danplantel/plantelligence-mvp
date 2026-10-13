"use client";

import { useEffect } from "react";

/**
 * Width of the right-hand Messages rail.
 *
 * Wider than the comments rail's 22rem on purpose: a chat line runs longer than a comment card and
 * the composer wants room, and the two panels are never open together, so nothing has to fit both.
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
