"use client";

/**
 * portal-comments-zoom — scales the PORTAL down while the Comments rail is open.
 *
 * The rail is 24rem of a desktop window. Rather than reflowing the participant's page into the
 * narrower column (which re-wraps headlines and re-breaks every grid at a width the plan was never
 * designed for), the portal is drawn as a scaled-down replica of itself: every element keeps the
 * proportions it has on the employee's real screen, and the rail takes the space that the scale
 * gives back. The portal's fixed header is the one piece that stays OUTSIDE this transform — it is
 * redrawn at the same scale by `app/(portal)/[id]/layout.tsx`, which is what lets it stay pinned
 * while the page scrolls (a `fixed` bar inside a transform can only move on the JS frame that reads
 * the scroll, so it visibly lags the compositor).
 *
 * HOW IT WORKS
 *
 *  1. **One transform, applied to the whole portal tree.** `transform: scale(s)` with
 *     `transform-origin: top left` shrinks the layout visually without re-running any of its media
 *     queries — the plan still lays itself out at the viewport width and is then photographed
 *     smaller. `s = (viewport - rail) / viewport`, so the scaled page ends exactly where the rail
 *     begins and nothing is hidden underneath it.
 *
 *  2. **The reservation collapses inside the scaled tree.** `--comments-inset` is still set on the
 *     document root (`lib/comments/comments-layout.ts`); this wrapper overrides it to `0px` for its
 *     subtree, because the scale has ALREADY left the rail's column clear. Without that override the
 *     page would both scale and reserve the column, losing twice. The fixed header reads the same
 *     variable for its `right`, so it follows automatically.
 *
 *  3. **The layout height is divided down as well.** A transform does not change layout height, so
 *     the wrapper would otherwise leave a band of empty page below the shrunken portal equal to the
 *     part the scale removed. The content's UNSCALED `offsetHeight` is observed (`ResizeObserver`,
 *     so images and accordions are accounted for) and the wrapper is set to that height times the
 *     scale. `min-height: 100dvh` keeps the white surface filling a short page.
 *
 * WHAT THIS DELIBERATELY CHANGES
 *
 * A transformed ancestor becomes the containing block for `position: fixed` descendants, so nothing
 * that must stay pinned to the viewport can live inside the replica. That is why the fixed header is
 * a SIBLING of this component rather than one of its children: it keeps the participant's fixed
 * behaviour and is drawn at this component's scale from the metrics published below. This wrapper is
 * only mounted on the portal, where the rail is an inspection tool, never in the dashboard.
 *
 * The rail and its floating button are SIBLINGS of this component (see `portal-comments-rail.tsx`),
 * so neither is scaled, and both keep reading the real `--comments-inset`.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useOptionalCommentMode } from "@/components/comments/comment-mode-provider";
import { useOptionalMessagesMode } from "@/components/messages/messages-mode-provider";
import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { COMMENTS_RAIL_WIDTH } from "@/lib/comments/comments-layout";

/**
 * The rail's width in CSS pixels, derived from the single constant that also drives
 * `--comments-inset`. The portal never changes the root font size, so a `rem` there is 16px.
 */
const RAIL_PX = (() => {
  const match = /^([\d.]+)(rem|px)$/.exec(COMMENTS_RAIL_WIDTH.trim());
  if (!match) return 384;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return 384;
  return match[2] === "rem" ? value * 16 : value;
})();

/** Never shrink past this — below it the replica stops being readable. */
const MIN_SCALE = 0.5;

/** The portal Editing Panel's reserved column, in CSS pixels (`36rem`). */
const EDITOR_PANEL_PX = 36 * 16;

/** A small clearance so the replica never touches the rail's left border. */
const RAIL_CLEARANCE_PX = 8;

/** How the portal page is being drawn right now. */
export interface PortalReplicaGeometry {
  /** The page is drawn scaled — a rail and/or the edit panel is open. */
  scaled: boolean;
  scale: number;
  /** The replica's left edge in viewport pixels (the editor's reserved column). */
  leftInsetPx: number;
  /** The width the replica was laid out at (scrollbar excluded). */
  pageWidthPx: number;
  /** The portal Editing Panel is the reason for the left inset. */
  editorOpen: boolean;
}

/**
 * The replica's geometry.
 *
 * Read here to draw the scaled page, and by the portal layout to draw the fixed
 * header at the same scale: the header has to live OUTSIDE the transform to stay
 * genuinely fixed (`app/(portal)/[id]/layout.tsx`), so it cannot be told the
 * scale by being a child of this component.
 */
export function usePortalReplicaGeometry(): PortalReplicaGeometry {
  const comments = useOptionalCommentMode();
  const messages = useOptionalMessagesMode();
  const editing = useOptionalPortalEditing();
  // Comments and Direct Messages share the same right-hand column (see
  // lib/right-panel.ts), so the portal scales for either one.
  const open = Boolean(
    (comments?.canComment && comments.mode === "on") || messages?.open,
  );
  const editorOpen = Boolean(editing?.isOpen && editing.canEdit);
  const leftInsetPx = editorOpen ? EDITOR_PANEL_PX : 0;
  const [scale, setScale] = useState(1);
  const [pageWidthPx, setPageWidthPx] = useState(0);

  // The scale is a pure function of the window width. `clientWidth` excludes the scrollbar, so the
  // replica ends at the rail's edge exactly rather than under it.
  useEffect(() => {
    if (!open && !editorOpen) {
      setScale(1);
      return;
    }
    const update = () => {
      const width = document.documentElement.clientWidth;
      if (!width) return;
      setPageWidthPx(width);
      // The replica is photographed at the full viewport width and scaled down
      // by every open tool column — the editor on the left, the rail on the
      // right. It is translated past the editor so the visible copy starts at
      // the panel's edge, exactly like the Create/Edit Client previews.
      const rightInset = open
        ? RAIL_PX + (editorOpen ? RAIL_CLEARANCE_PX : 0)
        : 0;
      const next = (width - leftInsetPx - rightInset) / width;
      // With BOTH panels open the exact ratio can be well below half. Keeping
      // the 0.5 readability floor there left the replica wider than the gap and
      // the Comments rail painted over it, so the editor case may shrink to fit.
      const floor = editorOpen ? 0.1 : MIN_SCALE;
      setScale(Math.max(floor, Math.min(1, next)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open, editorOpen, leftInsetPx]);

  return { scaled: scale < 1, scale, leftInsetPx, pageWidthPx, editorOpen };
}

export function PortalCommentsZoom({
  children,
}: {
  children: React.ReactNode;
}) {
  const comments = useOptionalCommentMode();
  const messages = useOptionalMessagesMode();
  const { scaled, scale, editorOpen } = usePortalReplicaGeometry();
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Measure the UNSCALED height. `offsetHeight` ignores transforms, which is exactly what the
  // wrapper has to be divided down by.
  useEffect(() => {
    if (!comments && !messages) return;
    const element = contentRef.current;
    if (!element) return;
    const measure = () => setContentHeight(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [comments, messages, editorOpen]);

  // No provider at all — an unarmed portal, or any dashboard page. Contribute nothing.
  if (!comments && !messages) return <>{children}</>;

  const transform = editorOpen
    ? `translateX(${EDITOR_PANEL_PX}px) scale(${scale})`
    : `scale(${scale})`;

  return (
    <div
      // `overflow-hidden` turns the leftover layout height (the part the transform removed) into no
      // scroll space at all. The visual content already fits inside the computed height, so nothing
      // visible is clipped.
      className={scaled ? "overflow-hidden bg-white" : undefined}
      style={
        scaled
          ? {
              height: contentHeight ? contentHeight * scale : undefined,
              minHeight: "100dvh",
            }
          : undefined
      }
    >
      <div
        ref={contentRef}
        style={
          scaled
            ? ({
                transform,
                transformOrigin: "top left",
                transition: "transform 200ms cubic-bezier(0, 0, 0.2, 1)",
                willChange: "transform",
                // The scale already leaves the rail's column and the editor's
                // column clear — see the file comment.
                "--comments-inset": "0px",
                "--messages-inset": "0px",
                "--portal-editor-inset": "0px",
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
