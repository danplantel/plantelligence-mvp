"use client";

import { useEffect, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOptionalCommentMode } from "./comment-mode-provider";

export interface CommentAnchorProps {
  /** Stable semantic key for this region, e.g. "company", "benefit:faqs". */
  sectionKey: string;
  /** Readable label used by the tooltip. */
  label?: string;
  className?: string;
  children: ReactNode;
}

/** Elements that own their own clicks — a section click must never hijack them. */
const INTERACTIVE_SELECTOR =
  "input, textarea, select, button, a, label, [role='button'], [contenteditable='true'], [data-comment-field], [data-comment-ignore]";

/**
 * Marks a section as a comment target.
 *
 * Off, it is a plain wrapper (a no-op for layout and interaction). On, it registers the
 * section key, outlines the region when one of its threads is selected in the rail, and
 * aims the rail's composer at this section when the region is clicked.
 *
 * The page carries NO comment chrome — no add button and no pins. The rail is the only
 * place threads appear; the composer is the only way to create them.
 */
export function CommentAnchor({
  sectionKey,
  label,
  className,
  children,
}: CommentAnchorProps) {
  const mode = useOptionalCommentMode();
  const commenting = Boolean(mode?.canComment && mode?.mode === "on");

  const registerSection = mode?.registerSection;
  const unregisterSection = mode?.unregisterSection;

  // Registered even when off, so the rail's "Unanchored" grouping is correct the moment
  // comments are switched on.
  useEffect(() => {
    if (!registerSection || !unregisterSection) return;
    registerSection(sectionKey);
    return () => unregisterSection(sectionKey);
  }, [registerSection, unregisterSection, sectionKey]);

  const threads = commenting
    ? mode!.threads.filter(
        (thread) =>
          thread.sectionKey === sectionKey && thread.anchorKind === "section",
      )
    : [];
  const activeThreadId = mode?.activeThreadId ?? null;
  const isActive = threads.some((thread) => thread.id === activeThreadId);

  if (!commenting) {
    return <div className={className}>{children}</div>;
  }

  const handleSectionClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    // Never hijack a real interaction — the region's own surface is what targets it.
    if (target?.closest(INTERACTIVE_SELECTOR)) return;
    mode!.setComposerTarget({ anchorKind: "section", sectionKey });
  };

  return (
    <div
      data-comment-anchor={sectionKey}
      onClick={handleSectionClick}
      title={`Click to comment${label ? ` on ${label}` : ""}`}
      className={cn(
        "relative rounded-lg transition-shadow",
        "hover:ring-1 hover:ring-accent-blue/30",
        isActive && "ring-2 ring-amber-300 dark:ring-amber-500/60",
        className,
      )}
    >
      {children}
    </div>
  );
}
