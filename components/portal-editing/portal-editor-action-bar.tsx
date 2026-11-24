"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";

interface PortalEditorActionBarProps {
  /** The editor holds a change the autosave has not written yet. */
  isDirty: boolean;
  /**
   * What **Done** does. Defaults to closing the panel, which is all there is
   * left to do now that the panel writes by itself.
   */
  onClose?: () => void;
  className?: string;
}

/**
 * The portal Editing Panel's footer row.
 *
 * Portal panels write their own drafts a beat after the advisor stops typing
 * (see [`usePortalAutosave`](./use-portal-autosave.ts:1)), so there is nothing
 * to Save and nothing to Cancel — only the write's status and a way out. The
 * bar is shared by the Home, benefit-hub, News & Events and Employee Resources
 * panels rather than duplicated in each.
 *
 * It is handed to the panel's own `footer` slot (`EditorPanelWrapper`), so it
 * docks to the bottom of the Editing Panel — inside the tool column, not over
 * the portal — and stays visible while the sections above it scroll.
 */
export function PortalEditorActionBar({
  isDirty,
  onClose,
  className,
}: PortalEditorActionBarProps) {
  const editing = useOptionalPortalEditing();

  const saving = editing?.saveState === "saving";
  const failed = editing?.saveState === "error";
  const status = saving
    ? "Saving…"
    : failed
      ? editing?.saveError || "Could not save these changes."
      : isDirty
        ? "Saving automatically…"
        : "All changes saved";

  const close = onClose ?? editing?.closePanel;

  return (
    <div
      className={cn("flex w-full items-center justify-between gap-3", className)}
      data-portal-editor-action-bar
    >
      <p
        className={cn(
          "min-w-0 truncate text-xs",
          failed ? "text-red-500" : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {saving ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {status}
          </span>
        ) : (
          status
        )}
      </p>

      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        onClick={() => close?.()}
        data-portal-editor-done
      >
        Done
      </Button>
    </div>
  );
}
