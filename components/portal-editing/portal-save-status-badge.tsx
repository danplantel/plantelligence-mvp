"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";

/**
 * How long **Saved** stays on the header before the chip disappears.
 *
 * It is a receipt, not a status: long enough to notice after the advisor stops
 * typing, short enough that the header returns to its two-tag rhythm.
 */
export const SAVE_STATUS_VISIBLE_MS = 3000;

/**
 * The portal Editing Panel's save chip, right beside the red **Live** badge.
 *
 * Portal panels write their drafts by themselves (see
 * [`usePortalAutosave`](./use-portal-autosave.ts:1)), so the header reports what
 * the WRITE is doing rather than whether a button is enabled:
 *
 *  - **Saving…** while the request is in flight;
 *  - **Saved** for a moment afterwards;
 *  - **Couldn’t save** while the last attempt failed — the panel keeps the draft,
 *    so the advisor's work is not lost and the next keystroke retries;
 *  - nothing at all when there is nothing to say.
 */
export function PortalSaveStatusBadge() {
  const editing = useOptionalPortalEditing();
  const saveState = editing?.saveState ?? "idle";
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (saveState !== "saved") {
      setShowSaved(false);
      return;
    }
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), SAVE_STATUS_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [saveState]);

  if (saveState === "saving") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        data-portal-save-status="saving"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Saving…
      </span>
    );
  }

  if (saveState === "error") {
    return (
      <span
        className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 shadow-sm dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-300"
        title={
          editing?.saveError ||
          "The last change was not saved. Editing again retries it."
        }
        data-portal-save-status="error"
      >
        Couldn’t save
      </span>
    );
  }

  if (showSaved) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300"
        data-portal-save-status="saved"
      >
        <Check className="h-3 w-3" aria-hidden="true" />
        Saved
      </span>
    );
  }

  return null;
}
