"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { CommentThreadView } from "@/lib/comments/types";

/**
 * Tint the stored text range of a thread.
 *
 * Form fields get a mirrored overlay ABOVE the control: transparent text with a
 * semi-transparent `<mark>`, so the real value shows through tinted at exactly the
 * stored offsets. The stored `quote` is validated against the current value first, so a
 * range that no longer matches is simply not drawn (the thread still lists in the rail).
 *
 * Static copy is highlighted in place by wrapping the quoted text node in a `<mark>`,
 * undone on unmount.
 */
export function TextHighlight({
  containerRef,
  thread,
}: {
  containerRef: RefObject<HTMLElement>;
  thread: CommentThreadView;
}) {
  const quote = thread.quote ?? "";
  const start = thread.rangeStart ?? 0;
  const end = thread.rangeEnd ?? 0;

  const [overlayStyle, setOverlayStyle] = useState<CSSProperties | null>(null);
  const [parts, setParts] = useState<{
    before: string;
    match: string;
    after: string;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    setOverlayStyle(null);
    setParts(null);
    if (!container || !quote) return;

    const el = container.querySelector(
      "input, textarea",
    ) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;

    const value = el.value;
    const s = Math.max(0, Math.min(start, value.length));
    const e = Math.max(s, Math.min(end, value.length));
    if (e <= s || value.slice(s, e) !== quote) return;

    const cs = window.getComputedStyle(el);
    setParts({
      before: value.slice(0, s),
      match: value.slice(s, e),
      after: value.slice(e),
    });
    setOverlayStyle({
      position: "absolute",
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
      boxSizing: cs.boxSizing as CSSProperties["boxSizing"],
      padding: cs.padding,
      borderWidth: cs.borderWidth,
      borderStyle: cs.borderStyle,
      borderColor: "transparent",
      borderRadius: cs.borderRadius,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      letterSpacing: cs.letterSpacing,
      lineHeight: cs.lineHeight,
      whiteSpace: "pre-wrap",
      overflow: "hidden",
      color: "transparent",
      pointerEvents: "none",
      zIndex: 5,
    });
  }, [containerRef, quote, start, end, thread.id]);

  useTextNodeHighlight(
    containerRef,
    overlayStyle ? null : quote,
    thread.id,
  );

  if (!overlayStyle || !parts) return null;

  return (
    <div aria-hidden style={overlayStyle}>
      {parts.before}
      <mark className="rounded bg-amber-200/70 dark:bg-amber-500/40">
        {parts.match}
      </mark>
      {parts.after}
    </div>
  );
}

/** Wrap the first matching static text node in a `<mark>`; unwrap on cleanup. */
function useTextNodeHighlight(
  containerRef: RefObject<HTMLElement>,
  quote: string | null,
  key: string,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !quote) return;

    const marks: HTMLElement[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = (node as Text).parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("input, textarea, mark, script, style")) {
          return NodeFilter.FILTER_REJECT;
        }
        return (node.nodeValue ?? "").includes(quote)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    const node = walker.nextNode() as Text | null;
    const text = node?.nodeValue ?? "";
    const index = text.indexOf(quote);

    if (node && index >= 0) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + quote.length);
      const mark = document.createElement("mark");
      mark.setAttribute("data-comment-highlight", "true");
      mark.className = "rounded bg-amber-200/70 dark:bg-amber-500/40";
      try {
        range.surroundContents(mark);
        marks.push(mark);
      } catch {
        // The range spans element boundaries — leave the copy unhighlighted.
      }
    }

    return () => {
      for (const mark of marks) {
        const parent = mark.parentNode;
        if (!parent) continue;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        // Merge the text nodes the unwrap left behind, so repeatedly highlighting does
        // not fragment the copy into ever-smaller nodes.
        (parent as Node).normalize();
      }
    };
  }, [containerRef, quote, key]);
}
