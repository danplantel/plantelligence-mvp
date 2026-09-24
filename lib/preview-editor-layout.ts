"use client";

import { useEffect } from "react";

/** Width of the inline Preview Editing Panel (Edit Plan / Edit Benefit). */
export const PREVIEW_EDITOR_PANEL_WIDTH = "36rem";

/**
 * Window event fired by the Preview pages so the Sidebar can rail-collapse while
 * their inline Editing Panel is open. `detail.isOpen` is the panel state.
 */
export const PREVIEW_EDITOR_LAYOUT_EVENT = "previewEditorLayoutChange";

/**
 * Shared layout contract for the Preview pages (Edit Plan `/edit-client/[id]`
 * and Edit Benefit `/edit-benefit/[planId]/[category]`).
 *
 * Those pages render a fixed inline Editing Panel. It used to be pinned to
 * `left: 0` while `--sidebar-width` was widened to the panel's width, which
 * painted the panel straight over the sidebar (the nav disappeared).
 *
 * Instead we now reserve a column for the panel *beside* the sidebar:
 *
 * - `--editor-inset` holds the panel width while it is open (and is removed when
 *   closed), so any offset that must clear both can be written as
 *   `calc(var(--sidebar-width, 16rem) + var(--editor-inset, 0px))`.
 * - The Sidebar listens for {@link PREVIEW_EDITOR_LAYOUT_EVENT} and collapses to
 *   its icon rail while the panel is open, restoring the user's own
 *   open/collapsed preference when it closes — so the nav stays visible.
 *
 * The wizards keep their existing `--sidebar-width = 36rem` behaviour; they do
 * not use this hook.
 */
export function usePreviewEditorLayout(
  isOpen: boolean,
  panelWidth: string = PREVIEW_EDITOR_PANEL_WIDTH,
) {
  useEffect(() => {
    const root = document.documentElement;

    const dispatch = (open: boolean) => {
      window.dispatchEvent(
        new CustomEvent(PREVIEW_EDITOR_LAYOUT_EVENT, {
          detail: { isOpen: open, panelWidth },
        }),
      );
    };

    if (isOpen) {
      root.style.setProperty("--editor-inset", panelWidth);
    } else {
      root.style.removeProperty("--editor-inset");
    }
    dispatch(isOpen);

    return () => {
      root.style.removeProperty("--editor-inset");
      dispatch(false);
    };
  }, [isOpen, panelWidth]);
}
