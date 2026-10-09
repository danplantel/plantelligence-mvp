import type { ReactNode } from "react";

export interface CommentAnchorProps {
  /**
   * Accepted for compatibility with the call sites. Anchoring is not surfaced in the UI —
   * there is no pin, no highlight and no click-to-target — so this is currently inert.
   */
  sectionKey?: string;
  /** Accepted for compatibility; unused. */
  label?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A plain wrapper around a page section.
 *
 * Commenting is no longer anchored from the page, so this is intentionally inert: it just
 * renders its children (applying any layout classes the caller passes). It is kept as the
 * structural seam the four surfaces already use, so anchoring could be switched back on
 * without touching them.
 */
export function CommentAnchor({ className, children }: CommentAnchorProps) {
  return <div className={className}>{children}</div>;
}
