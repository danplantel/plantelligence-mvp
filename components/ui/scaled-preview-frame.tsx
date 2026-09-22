"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Lays `children` out at a fixed design width and scales the result down to the
 * width actually available, so a preview keeps the layout it will have in the
 * portal instead of reflowing into a narrower column.
 *
 * Why a transform rather than reflowing: components in this app break their
 * grids on *viewport* width (Tailwind's `md:` / `lg:`), not container width. In a
 * narrower parent they therefore keep the same column count and each card is
 * squeezed — which reads as stretched-tall. Scaling a layout that was composed at
 * the real width keeps every proportion intact, only smaller.
 *
 * The wrapper reserves the scaled height so whatever follows does not overlap it.
 * The height is measured on the unscaled layout — which `transform` does not
 * affect — so a single measurement per content change is enough.
 *
 * Callers: a transformed ancestor becomes the containing block for
 * `position: fixed` descendants. Any full-screen overlay inside `children` must
 * therefore be rendered through a portal, or it will be positioned and scaled
 * inside this frame rather than over the page.
 */
export function ScaledPreviewFrame({
  children,
  designWidth,
  className,
}: {
  children: ReactNode;
  /** Width the children are laid out at before being scaled down. */
  designWidth: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  // Never upscale: a parent wider than the design width shows the layout 1:1.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const available = container.clientWidth;
      if (available > 0) setScale(Math.min(1, available / designWidth));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [designWidth]);

  // Re-measure when the content grows (cards arriving from a fetch, for example).
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const update = () => setContentHeight(content.offsetHeight);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={contentHeight != null ? { height: contentHeight * scale } : undefined}
    >
      <div
        ref={contentRef}
        style={{
          width: `${designWidth}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
