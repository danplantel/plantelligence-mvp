"use client";

import {
  useEffect,
  useState,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { cn } from "@/lib/utils";

/** Single source of truth for the transition length; also drives the fallback timer. */
const COLLAPSE_MS = 300;

interface CollapsiblePanelProps {
  /** Whether the panel is expanded. */
  open: boolean;
  /** Panel content. Mounted on first open, then retained until the exit finishes. */
  children: ReactNode;
  /** id so a trigger can point at the panel with `aria-controls`. */
  id?: string;
  /** Accessible name for the region, announced while the panel holds content. */
  label?: string;
  className?: string;
}

/**
 * Height-animated disclosure for revealing a detail panel beneath a row of tiles.
 *
 * The wrapper is always in the DOM and only its `grid-template-rows` moves between
 * `0fr` and `1fr`, so the content's real height animates with no JS measurement and no
 * `max-height` guesswork. The inner element needs `min-h-0 overflow-hidden` for the
 * `0fr` track to actually collapse.
 *
 * Children mount on first open and are held through the closing transition — otherwise
 * the collapse would have nothing to animate and the panel would vanish instantly. They
 * are dropped once the exit completes so a collapsed panel's controls leave the tab
 * order rather than lingering as invisible, focusable elements.
 *
 * `prefers-reduced-motion` is respected: the transition is disabled and the fallback
 * timer still tears the content down.
 */
export function CollapsiblePanel({
  open,
  children,
  id,
  label,
  className,
}: CollapsiblePanelProps) {
  const [shouldRender, setShouldRender] = useState(open);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      return;
    }
    // `transitionend` never fires when the transition is disabled, so a timer
    // guarantees the content is dropped from the tab order either way.
    const timeout = window.setTimeout(
      () => setShouldRender(false),
      COLLAPSE_MS + 50,
    );
    return () => window.clearTimeout(timeout);
  }, [open]);

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    // Ignore transitions bubbling up from descendants.
    if (event.target !== event.currentTarget) return;
    if (!open) setShouldRender(false);
  };

  // `|| open` keeps content present in the same commit that starts the opening
  // transition, otherwise the panel would expand empty and pop its content in later.
  const showContent = shouldRender || open;

  return (
    <div
      id={id}
      role={showContent ? "region" : undefined}
      aria-label={showContent ? label : undefined}
      onTransitionEnd={handleTransitionEnd}
      style={{ transitionDuration: `${COLLAPSE_MS}ms` }}
      className={cn(
        "grid transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">
        {showContent ? children : null}
      </div>
    </div>
  );
}
