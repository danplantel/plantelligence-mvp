"use client";

import { useEffect, useState } from "react";

export interface VisualViewportBox {
  /** The visible height in px, with the browser's toolbar taken off. */
  height: number;
  /** How far the visible area begins from the layout viewport's top. */
  offsetTop: number;
}

/**
 * The part of the page a phone user can actually see, in pixels.
 *
 * Chrome on Android shows and hides its bottom toolbar as you scroll. `100vh`,
 * `100dvh` and `position: fixed`'s `inset: 0` all resolve against the LAYOUT
 * viewport, which the toolbar does not resize — so a full-screen sheet drawn that
 * way is taller than the visible area once the toolbar comes back, or loses its
 * top (the header slides under the address bar) while the toolbar is retracted.
 * That is the "distorted sheet with a gap above its header" report.
 *
 * `window.visualViewport` is the only source that reports the visible box while
 * the toolbar moves, and it fires `resize` and `scroll` for it. This hook mirrors
 * those numbers into React state so a sheet can be positioned exactly.
 *
 * Returns `null` until measured, and on browsers without `visualViewport` — the
 * caller then keeps its CSS-only sizing.
 */
export function useVisualViewportBox(
  enabled: boolean,
): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBox(null);
      return;
    }
    if (typeof window === "undefined") return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () =>
      setBox({ height: viewport.height, offsetTop: viewport.offsetTop });

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return box;
}
