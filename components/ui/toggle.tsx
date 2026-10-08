"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The toggle's state (controlled). */
  pressed?: boolean;
  /** Called with the next state when the button is activated. */
  onPressedChange?: (pressed: boolean) => void;
}

/**
 * A toggle button: a two-state control whose state is exposed to assistive tech
 * via `aria-pressed` and painted from `data-state`.
 *
 * Dependency-free on purpose — the project ships no `@radix-ui/react-toggle`,
 * and adding a package for one toggle is not worth it. The API mirrors the
 * shadcn `Toggle`, so it can be swapped for the Radix one later without touching
 * call sites.
 */
export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    { pressed = false, onPressedChange, className, children, onClick, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      data-state={pressed ? "on" : "off"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onPressedChange?.(!pressed);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
        "data-[state=on]:border-accent-blue data-[state=on]:bg-accent-blue data-[state=on]:text-white data-[state=on]:hover:bg-accent-blue/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
Toggle.displayName = "Toggle";
