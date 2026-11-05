"use client";

import type { CSSProperties } from "react";

/**
 * The placeholder that stands in for a floating portal control while its state
 * is still unknown.
 *
 * The Edit and Comments buttons used to render DISABLED during that window —
 * the access summary in flight, the comment surface not yet registered — which
 * read as a broken or forbidden control rather than one that is on its way. A
 * skeleton says "still resolving" and occupies the same 48px circle, so the
 * cluster does not shift when the real button replaces it.
 *
 * `role="status"` with an `aria-label` keeps it announced; it never becomes a
 * button, so there is nothing to press until the answer arrives.
 */
export function PortalChromeButtonSkeleton({
  label,
  style,
}: {
  /** What is being resolved, e.g. "Checking your access…". */
  label: string;
  /** The button's own offsets — the skeleton has to land in the same spot. */
  style?: CSSProperties;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      style={style}
      className="fixed bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-gray-100 animate-pulse"
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
