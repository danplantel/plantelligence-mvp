"use client";

import { useEffect } from "react";

import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";

/**
 * Tells the panel HEADER whether the editor holds an unsaved draft.
 *
 * Every portal panel previews its edits in the live page beside it and writes nothing
 * until Save, so "what you see is not what is stored yet" needs to be visible without
 * scrolling to the action bar — and Cancel/Save may be out of sight while the advisor
 * works through the sections. Each editor owns its own draft state (a pending field
 * map, a blob, dirty asset ids), so it reports it here rather than the provider
 * guessing from `saveState`.
 */
export function usePortalDirtyReport(isDirty: boolean) {
  const setDirty = useOptionalPortalEditing()?.setDirty;

  useEffect(() => {
    if (!setDirty) return;
    setDirty(isDirty);
  }, [isDirty, setDirty]);

  // Leaving the page clears it: a draft that no longer exists must not leave the
  // next panel's header saying "Unsaved changes".
  useEffect(() => {
    if (!setDirty) return;
    return () => setDirty(false);
  }, [setDirty]);
}

/**
 * The amber **Unsaved changes** chip, rendered right beside the red **Live** badge.
 *
 * Amber, not red: the page is live, but what it is showing is a draft. It renders
 * nothing when the editor is clean, so the header keeps its two-tag rhythm.
 */
export function PortalDraftBadge() {
  const editing = useOptionalPortalEditing();
  if (!editing?.isDirty) return null;

  return (
    <span
      className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 shadow-sm dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300"
      title="The page beside you shows changes that have not been saved yet."
    >
      Unsaved changes
    </span>
  );
}
