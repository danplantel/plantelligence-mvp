"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
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

interface FieldSelection {
  start: number;
  end: number;
  quote: string;
}

/**
 * Marks one field as a text-range anchor target.
 *
 * Off, it is a transparent passthrough. On, selecting text inside it (a form control's
 * selection, or a drag over static copy) reveals a small "Comment" affordance; existing
 * text threads on the field get a numbered pin, and the active one is highlighted by
 * {@link TextHighlight}.
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
  const [selection, setSelection] = useState<FieldSelection | null>(null);

  useEffect(() => {
    if (!commenting) setSelection(null);
  }, [commenting]);

  if (!commenting) return <>{children}</>;

  const threads = mode!.threads.filter(
    (thread) =>
      thread.anchorKind === "text" &&
      thread.sectionKey === sectionKey &&
      thread.fieldKey === fieldKey,
  );
  const activeThread =
    threads.find((thread) => thread.id === mode!.activeThreadId) ?? null;

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
        setSelection({ start, end, quote: input.value.slice(start, end) });
      } else {
        setSelection(null);
      }
      return;
    }

    const selected = (window.getSelection()?.toString() ?? "").trim();
    if (selected && (container.innerText ?? "").includes(selected)) {
      // Static copy has no caret offsets, so the quote is the real anchor and the
      // range is nominal (0..len) — the server accepts it and highlighting matches the
      // quote, not the offset.
      setSelection({ start: 0, end: selected.length, quote: selected });
      return;
    }
    setSelection(null);
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

      {threads.map((thread, index) => (
        <button
          key={thread.id}
          type="button"
          onClick={() =>
            mode!.setActiveThreadId(
              thread.id === mode!.activeThreadId ? null : thread.id,
            )
          }
          aria-label={`Text comment ${index + 1}${thread.resolvedAt ? " (resolved)" : ""}`}
          title={thread.quote ?? "Text comment"}
          className={cn(
            "absolute right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold shadow-sm",
            thread.resolvedAt
              ? "border-border bg-muted text-muted-foreground"
              : "border-accent-blue bg-accent-blue text-white",
          )}
          style={{ top: `${0.25 + index * 1.5}rem` }}
        >
          {index + 1}
        </button>
      ))}

      {selection ? (
        <button
          type="button"
          onClick={() => {
            mode!.startDraft({
              anchorKind: "text",
              sectionKey,
              fieldKey,
              rangeStart: selection.start,
              rangeEnd: selection.end,
              quote: selection.quote,
            });
            setSelection(null);
          }}
          className="absolute right-1 top-1 z-20 inline-flex items-center gap-1 rounded-full border border-accent-blue/40 bg-background px-2 py-1 text-[10px] font-medium text-accent-blue shadow-sm transition-colors hover:bg-accent-blue hover:text-white"
        >
          <Plus className="h-3 w-3" />
          Comment
        </button>
      ) : null}

      {activeThread ? (
        <TextHighlight containerRef={containerRef} thread={activeThread} />
      ) : null}
    </div>
  );
}
