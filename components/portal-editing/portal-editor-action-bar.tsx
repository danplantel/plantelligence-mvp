"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";

interface PortalEditorActionBarProps {
  /** Has the draft diverged from the saved row? Save stays disabled until it has. */
  isDirty: boolean;
  onSave: () => void;
  onCancel: () => void;
  className?: string;
}

/**
 * The portal Editing Panel's Save/Cancel row.
 *
 * Portal editors preview every keystroke in the live page beside them but never
 * write on their own: nothing reaches the API until Save, and Cancel throws the
 * draft away in favour of the saved row. The bar is the only place that says so,
 * so it is shared by the Home (plan branding) and benefit-hub editors rather
 * than duplicated in each.
 *
 * It is handed to the panel's own `footer` slot (`EditorPanelWrapper`), so it
 * docks to the bottom of the Editing Panel — inside the tool column, not over
 * the portal — and stays visible while the sections above it scroll.
 */
export function PortalEditorActionBar({
  isDirty,
  onSave,
  onCancel,
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
        ? "Unsaved changes — the page beside you is a live preview"
        : "No unsaved changes";

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

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="button" onClick={onSave} disabled={!isDirty || saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}
