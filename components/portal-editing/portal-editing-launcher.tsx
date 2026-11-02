"use client";

import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";

/**
 * The floating Edit button.
 *
 * It sits to the LEFT of the Comments button, which in turn sits left of the
 * "Ask a question" pill. The offset clears both controls so all three remain
 * visible in the bottom-right cluster.
 */
export function PortalEditingLauncher() {
  const { target, canEdit, isOpen, togglePanel } = usePortalEditing();
  if (!target) return null;

  const label = canEdit
    ? isOpen
      ? "Close editing panel"
      : "Edit this page"
    : "You have view-only access to this page";

  return (
    <button
      type="button"
      onClick={togglePanel}
      disabled={!canEdit}
      aria-pressed={isOpen}
      aria-label={label}
      title={label}
      style={{
        right:
          "calc(max(1.5rem, calc(max(var(--comments-inset, 0px), var(--messages-inset, 0px)) + 1.5rem)) + 15.5rem)",
      }}
      className={cn(
        "fixed bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors",
        isOpen
          ? "text-accent-blue"
          : "text-muted-foreground hover:text-foreground",
        !canEdit && "cursor-not-allowed opacity-60",
      )}
    >
      <Pencil className="h-5 w-5" />
      {isOpen && (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent-blue" />
      )}
    </button>
  );
}
