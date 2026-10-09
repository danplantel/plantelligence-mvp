"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pins its children to the top of the viewport via translateY so the
 * element stays in its natural DOM position (no horizontal issues) while
 * bypassing all ancestor overflow / transform / containing-block constraints.
 *
 * Extracted from the Create Plan Key Contact slide so the invite-acceptance
 * page pins its card exactly the same way instead of re-implementing the
 * scroll maths.
 */
export function StickyPreviewContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);
  const offsetYRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const threshold = 130; // px from viewport top — start pinning well before the header
    const BOTTOM_PADDING = 180; // px to keep clear at the bottom for the buttons + bottom nav bar

    const recalc = () => {
      const rect = el.getBoundingClientRect();
      // rect.top includes any translateY already applied.
      // Subtract the current offset to get the natural (untransformed) position.
      const naturalTop = rect.top - offsetYRef.current;
      const elHeight = rect.height;
      const viewportHeight = window.innerHeight;

      if (naturalTop < threshold) {
        // Desired offset to bring the element's top to `threshold`
        let newOffset = threshold - naturalTop;

        // Bottom constraint: keep the card's bottom edge above the
        // Back / Save & Continue buttons and the fixed bottom nav bar.
        const elementBottomWithOffset = threshold + elHeight;
        const maxAllowedBottom = viewportHeight - BOTTOM_PADDING;

        if (elementBottomWithOffset > maxAllowedBottom) {
          // Cap the offset so the bottom aligns with maxAllowedBottom
          newOffset = maxAllowedBottom - naturalTop - elHeight;
          if (newOffset < 0) newOffset = 0;
        }

        offsetYRef.current = newOffset;
        setOffsetY(newOffset);
      } else {
        offsetYRef.current = 0;
        setOffsetY(0);
      }
    };

    window.addEventListener("scroll", recalc, { passive: true });
    window.addEventListener("resize", recalc, { passive: true });
    recalc();

    return () => {
      window.removeEventListener("scroll", recalc);
      window.removeEventListener("resize", recalc);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="flex flex-col items-center justify-start gap-2 pt-1 will-change-transform"
      style={{ transform: offsetY > 0 ? `translateY(${offsetY}px)` : undefined }}
    >
      {children}
    </div>
  );
}
