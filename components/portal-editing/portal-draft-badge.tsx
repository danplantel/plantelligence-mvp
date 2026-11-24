"use client";

import { useEffect } from "react";

import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";

/**
 * Tells the panel whether the editor holds an unwritten draft.
 *
 * Portal panels write their own drafts (see
 * [`usePortalAutosave`](./use-portal-autosave.ts:1)), so nothing in the header
 * needs an "Unsaved changes" chip any more — the save-status chip reports the
 * write itself. The provider still tracks the flag, because "the panel is
 * showing something the server does not have yet" is worth knowing outside the
 * badge: it is what tells the autosave loop there is work left.
 *
 * Each editor owns its own draft state (a pending field map, a blob, dirty asset
 * ids), so it reports it here rather than the provider guessing from
 * `saveState`.
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
