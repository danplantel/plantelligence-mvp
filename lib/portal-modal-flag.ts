"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * "A portal modal is open" — shared by the modal and the floating chrome.
 *
 * The hub's document preview covers the page, but the portal's floating
 * "Ask a question" pill is rendered by a DIFFERENT tree (the portal layout, see
 * `app/(portal)/[id]/layout.tsx`), outside the dialog's portal. A dialog cannot
 * hide a sibling it does not own, so the state travels through this module
 * instead of through props or context.
 *
 * It is reference-counted: two modals overlapping (a document preview opened
 * from an editor panel) only release the flag when the last one closes.
 */

let openCount = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Claim the flag. The returned release is idempotent, so an effect cleanup that
 * runs twice cannot drain the count below zero.
 */
export function holdPortalModalOpen(): () => void {
  openCount += 1;
  emit();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount = Math.max(0, openCount - 1);
    emit();
  };
}

/** True while at least one portal modal holds the flag. */
export function isPortalModalOpen(): boolean {
  return openCount > 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The flag as a boolean. The server snapshot is `false`: nothing is open during
 * render, and every caller is a client component.
 */
export function usePortalModalOpen(): boolean {
  return useSyncExternalStore(subscribe, isPortalModalOpen, () => false);
}

/** Hold the flag for as long as `open` stays true. */
export function useHoldPortalModal(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    return holdPortalModalOpen();
  }, [open]);
}
