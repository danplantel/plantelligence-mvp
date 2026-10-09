"use client";

import { useEffect, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalCommentMode } from "./comment-mode-provider";

export interface CommentAnchorProps {
  /** Stable semantic key for this region, e.g. "company", "benefit:faqs". */
  sectionKey: string;
  /** Readable label used by the pin's tooltip. */
  label?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Marks a section as commentable.
 *
 * Off, it is a plain wrapper (a no-op for layout and interaction). On, it registers the
 * section key, outlines the region when one of its threads is selected, and shows a
 * margin "add" pin plus a numbered pin per existing section thread.
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

  return (
    <div
      data-comment-anchor={sectionKey}
      className={cn(
        "relative rounded-lg",
        isActive && "ring-2 ring-amber-300 dark:ring-amber-500/60",
        className,
      )}
    >
      <button
        type="button"
        onClick={() =>
          mode!.startDraft({ anchorKind: "section", sectionKey })
        }
        aria-label={`Add a comment${label ? ` about ${label}` : ""}`}
        title={`Add a comment${label ? ` — ${label}` : ""}`}
        className="absolute -left-3 top-2 z-10 flex h-6 w-6 -translate-x-full items-center justify-center rounded-full border border-accent-blue/40 bg-background text-accent-blue shadow-sm transition-colors hover:bg-accent-blue hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {threads.map((thread, index) => (
        <button
          key={thread.id}
          type="button"
          onClick={() =>
            mode!.setActiveThreadId(
              thread.id === activeThreadId ? null : thread.id,
            )
          }
          aria-label={`Comment thread ${index + 1}${thread.resolvedAt ? " (resolved)" : ""}`}
          title={thread.messages[0]?.body?.slice(0, 80) ?? "Comment thread"}
          className={cn(
            "absolute z-10 flex h-6 w-6 -translate-x-full items-center justify-center rounded-full border text-[11px] font-semibold shadow-sm transition-colors",
            thread.resolvedAt
              ? "border-border bg-muted text-muted-foreground"
              : "border-accent-blue bg-accent-blue text-white",
          )}
          style={{ left: "-0.75rem", top: `${2 + index * 1.75}rem` }}
        >
          {index + 1}
        </button>
      ))}

      {children}
    </div>
  );
}
