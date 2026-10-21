"use client";

/**
 * portal-comments-zoom — scales the PORTAL down while the Comments rail is open.
 *
 * The rail is 24rem of a desktop window. Rather than reflowing the participant's page into the
 * narrower column (which re-wraps headlines and re-breaks every grid at a width the plan was never
 * designed for), the portal is drawn as a scaled-down replica of itself: every element keeps the
 * proportions it has on the employee's real screen, the header included, and the rail takes the
 * space that the scale gives back.
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
 * A transformed ancestor becomes the containing block for `position: fixed` descendants, so the
 * portal's fixed header behaves like an absolutely positioned element INSIDE the replica: it is
 * scaled with everything else and scrolls with the page. That is the point — it is a preview of the
 * participant's screen, not a second chrome — and it is why this wrapper is only mounted on the
 * portal, where the rail is an inspection tool, never in the dashboard.
 *
 * The rail and its floating button are SIBLINGS of this component (see `portal-comments-rail.tsx`),
 * so neither is scaled, and both keep reading the real `--comments-inset`.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useOptionalCommentMode } from "@/components/comments/comment-mode-provider";
import { useOptionalMessagesMode } from "@/components/messages/messages-mode-provider";
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

export function PortalCommentsZoom({
  children,
}: {
  children: React.ReactNode;
}) {
  const comments = useOptionalCommentMode();
  const messages = useOptionalMessagesMode();
  // Comments and Direct Messages share the same right-hand column (see
  // lib/right-panel.ts), so the portal scales for either one.
  const open = Boolean(
    (comments?.canComment && comments.mode === "on") || messages?.open,
  );

  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // The scale is a pure function of the window width. `clientWidth` excludes the scrollbar, so the
  // replica ends at the rail's edge exactly rather than under it.
  useEffect(() => {
    if (!open) {
      setScale(1);
      return;
    }
    const update = () => {
      const width = document.documentElement.clientWidth;
      if (!width) return;
      const next = (width - RAIL_PX) / width;
      setScale(Math.max(MIN_SCALE, Math.min(1, next)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

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
  }, [comments, messages]);

  // No provider at all — an unarmed portal, or any dashboard page. Contribute nothing.
  if (!comments && !messages) return <>{children}</>;

  const scaled = open && scale < 1;

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
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                transition: "transform 200ms cubic-bezier(0, 0, 0.2, 1)",
                willChange: "transform",
                // The scale already leaves the rail's column clear — see the file comment.
                "--comments-inset": "0px",
                "--messages-inset": "0px",
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
