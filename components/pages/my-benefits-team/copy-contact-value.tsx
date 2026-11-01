"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Copy a value to the clipboard, with a fallback for browsers (and frames) where
 * the async Clipboard API is unavailable or blocked.
 *
 * Returns whether the value actually reached the clipboard, so the caller can say
 * "Copied" only when it did — a silent failure is worse than no affordance.
 */
export async function copyTextToClipboard(value: string): Promise<boolean> {
  const text = (value || "").trim();
  if (!text) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied / not allowed in this frame — fall through.
  }

  try {
    if (typeof document === "undefined") return false;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    // Off-screen rather than hidden: a display:none node cannot be selected.
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

type CopyState = "idle" | "copied" | "failed";

export interface CopyContactValueProps {
  /** What gets copied — the address, or the dial-ready phone number. */
  value: string;
  /** What the row is, for the accessible label ("Copy email: …"). */
  kind: "email" | "phone";
  /** The text on screen. Defaults to `value` (the phone shows a formatted one). */
  display?: string;
  /** Leading icon, already sized by the caller. */
  icon: React.ReactNode;
  /** Classes for the clickable row (callers set alignment/gaps per card variant). */
  className?: string;
  /** Classes for the text itself (the caller's element tier). */
  textClassName?: string;
  /** Inline colour for the text, so the card's palette still applies. */
  textStyle?: React.CSSProperties;
  /** Tooltip for the text — the full value where it is truncated. */
  title?: string;
}

/**
 * A contact's email or phone as a COPY-ON-CLICK value.
 *
 * These used to be `mailto:` / `tel:` links, which handed the participant off to a
 * mail client or the dialer. On a portal most people read the address or number and
 * paste it somewhere else, so clicking now copies it and says so — a short "Copied"
 * chip right beside the value, which is where the reader is already looking. It
 * reverts on its own, and says "Couldn't copy" when the clipboard refused, so the
 * feedback is never a lie.
 */
export function CopyContactValue({
  value,
  kind,
  display,
  icon,
  className,
  textClassName,
  textStyle,
  title,
}: CopyContactValueProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    const copied = await copyTextToClipboard(value);
    setState(copied ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  }, [value]);

  const text = display || value;

  return (
    <button
      type="button"
      // A button, not a link: nothing navigates, so the keyboard and screen-reader
      // contract should be the "press to act" one.
      onClick={() => void handleCopy()}
      aria-label={`Copy ${kind}: ${text}`}
      title={title || `Copy ${kind}`}
      className={cn(
        // `relative` hosts the feedback chip; `min-w-0` + `max-w-full` keep a long
        // address inside the card instead of widening its column. No gap here: each
        // card already spaces its icon and text, and two competing `gap-*` classes
        // on one element resolve by stylesheet order.
        "relative flex min-w-0 max-w-full items-center rounded text-left transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-current/40",
        className,
      )}
    >
      {icon}
      {/* `min-w-0` is what lets `truncate` actually truncate: a flex item refuses to
          shrink below its content width without it, which is how a long address used
          to push its way out of the card. */}
      <span className={cn("min-w-0 truncate", textClassName)} style={textStyle}>
        {text}
      </span>
      {/*
        The confirmation FLOATS: absolutely positioned, so it never widens the row
        (which pushed long values out of the card) and never pushes the card's own
        content around. It carries its own background and a z-index because it sits
        over whatever is beneath it — the next contact line, or a neighbouring card —
        and is `pointer-events-none` so it cannot swallow a second click. It is a live
        region, so a screen reader hears the result too.
      */}
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute -top-1 left-0 z-20 -translate-y-full whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white shadow-md transition-opacity duration-150 dark:bg-gray-100 dark:text-gray-900",
          state === "idle" ? "opacity-0" : "opacity-100",
          state === "failed" && "normal-case tracking-normal",
        )}
      >
        {state === "copied"
          ? `Copied ${kind === "email" ? "Email" : "Phone"}`
          : state === "failed"
          ? "Couldn't copy"
          : ""}
      </span>
    </button>
  );
}
