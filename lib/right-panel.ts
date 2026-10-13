"use client";

import { useEffect, useRef } from "react";

/**
 * right-panel — ONE owner of the dashboard's right-hand column.
 *
 * The Comments rail and the Messages rail occupy the same box (fixed right, under the header), so
 * they must be mutually exclusive. This module is the arbiter, and it is deliberately a small
 * external store rather than each provider remembering to close the other: a rule that lives in two
 * places is a rule that will be enforced in one of them, and two stacked rails covering the same
 * column is the most likely first bug in this feature.
 *
 * The eviction is EVENT-DRIVEN for a reason worth keeping. On the commit where a panel opens, a
 * rendered "do I own the column?" boolean is still its PREVIOUS value — so a derived check would
 * make the opening panel close itself in the same tick it claimed. A subscription fires only on an
 * actual claim by the other panel, which is exactly the moment to stand down.
 */

export type RightPanelId = "comments" | "messages";

let currentOwner: RightPanelId | null = null;
const listeners = new Set<(owner: RightPanelId | null) => void>();

function emit(): void {
  for (const listener of listeners) listener(currentOwner);
}

/** Which panel holds the column right now. Read imperatively from event handlers, not in render. */
export function currentRightPanel(): RightPanelId | null {
  return currentOwner;
}

/** Take the column, evicting whoever holds it. */
export function requestRightPanel(panel: RightPanelId): void {
  if (currentOwner === panel) return;
  currentOwner = panel;
  emit();
}

/**
 * Give the column up — but only if YOU hold it.
 *
 * The ownership test is what stops a late cleanup from evicting the panel that replaced it: a
 * closing rail's teardown runs after the other rail has already claimed, and an unconditional
 * release there would leave the column nominally free while a rail is visibly open in it.
 */
export function releaseRightPanel(panel: RightPanelId): void {
  if (currentOwner !== panel) return;
  currentOwner = null;
  emit();
}

export function subscribeRightPanel(
  listener: (owner: RightPanelId | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Notified when ANOTHER panel has taken the column. */
export function subscribeRightPanelEviction(
  panel: RightPanelId,
  onEvicted: () => void,
): () => void {
  return subscribeRightPanel((owner) => {
    if (owner !== null && owner !== panel) onEvicted();
  });
}

/**
 * Own the column while `open`, and stand down when the other panel takes it.
 *
 * `onEvicted` is held in a ref so a provider can pass an inline closure without resubscribing on
 * every render — which would also re-fire the eviction for a claim that happened earlier.
 */
export function useRightPanel(
  panel: RightPanelId,
  open: boolean,
  onEvicted: () => void,
): void {
  const evicted = useRef(onEvicted);
  evicted.current = onEvicted;

  useEffect(
    () => subscribeRightPanelEviction(panel, () => evicted.current()),
    [panel],
  );

  useEffect(() => {
    if (!open) {
      releaseRightPanel(panel);
      return;
    }
    requestRightPanel(panel);
    return () => releaseRightPanel(panel);
  }, [panel, open]);
}
