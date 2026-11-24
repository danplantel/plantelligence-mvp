"use client";

/**
 * The portal panels' name for the shared autosave loop.
 *
 * The implementation lives in [`hooks/use-autosave`](../../hooks/useAutosave.ts:1)
 * because the dashboard's Edit Plan form uses the same behaviour — the panels and
 * that form must write on the same rhythm, or the two surfaces feel like
 * different products. This alias keeps every portal editor's import (and its
 * "portal" wording) intact.
 */
export {
  AUTOSAVE_DELAY as PORTAL_AUTOSAVE_DELAY,
  useAutosave as usePortalAutosave,
} from "@/hooks/useAutosave";
export type { UseAutosaveOptions as PortalAutosaveOptions } from "@/hooks/useAutosave";
