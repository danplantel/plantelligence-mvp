"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOptionalCommentMode } from "./comment-mode-provider";
import { TextHighlight } from "./text-highlight";

export interface CommentableFieldProps {
  sectionKey: string;
  /** Stable key for the field inside the section, e.g. "missionStatement". */
  fieldKey: string;
  className?: string;
  children: ReactNode;
}

/**
 * Marks one field as a text-range target.
 *
 * Off, it is a transparent passthrough. On, selecting text inside it aims the rail's
 * composer at that range — there is no floating add button and no pin: the rail lists the
 * field's threads, and the active one is highlighted by {@link TextHighlight}.
 */
export function CommentableField({
  sectionKey,
  fieldKey,
  className,
  children,
}: CommentableFieldProps) {
  const mode = useOptionalCommentMode();
  const commenting = Boolean(mode?.canComment && mode?.mode === "on");
  const containerRef = useRef<HTMLDivElement>(null);

  if (!commenting) return <>{children}</>;

  const threads = mode!.threads.filter(
    (thread) =>
      thread.anchorKind === "text" &&
      thread.sectionKey === sectionKey &&
      thread.fieldKey === fieldKey,
  );
  const activeThread =
    threads.find((thread) => thread.id === mode!.activeThreadId) ?? null;

  /** Aim the rail's composer at the current selection, when there is a usable one. */
  const capture = () => {
    const container = containerRef.current;
    if (!container) return;

    const el = document.activeElement as HTMLElement | null;
    if (
      el &&
      container.contains(el) &&
      (el.tagName === "INPUT" || el.tagName === "TEXTAREA")
    ) {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      if (end > start) {
        mode!.setComposerTarget({
          anchorKind: "text",
          sectionKey,
          fieldKey,
          rangeStart: start,
          rangeEnd: end,
          quote: input.value.slice(start, end),
        });
      }
      return;
    }

    const selected = (window.getSelection()?.toString() ?? "").trim();
    if (selected && (container.innerText ?? "").includes(selected)) {
      // Static copy has no caret offsets, so the quote is the real anchor and the range is
      // nominal (0..len) — the server accepts it and highlighting matches the quote.
      mode!.setComposerTarget({
        anchorKind: "text",
        sectionKey,
        fieldKey,
        rangeStart: 0,
        rangeEnd: selected.length,
        quote: selected,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      data-comment-field={fieldKey}
      onMouseUp={capture}
      onKeyUp={capture}
      className={cn(
        "relative rounded",
        activeThread && "ring-2 ring-amber-300/70 dark:ring-amber-500/50",
        className,
      )}
    >
      {children}

      {activeThread ? (
        <TextHighlight containerRef={containerRef} thread={activeThread} />
      ) : null}
    </div>
  );
}
