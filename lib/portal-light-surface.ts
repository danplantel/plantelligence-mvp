"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the page currently on screen is a PORTAL page.
 *
 * Portal pages are always light-branded, whatever the advisor's dashboard theme
 * is. The portal layout already strips the `.dark` class from `<html>`, which
 * covers every `dark:` utility — but a few third-party overlays carry their own
 * theme prop instead of reading the class. Sonner is one of them: it reads
 * `useTheme()` from next-themes and paints `data-theme="dark"` toasts while the
 * dashboard is in dark mode, even though the portal it is floating over is
 * light.
 *
 * So the portal layout HOLDS this flag for as long as it is mounted, and any
 * surface with its own theme prop subscribes and pins itself to light. Nested
 * portals (the inline editing panel inside a portal page) stack the holds, so
 * the flag stays up until the last one leaves.
 */

let portalLightHolds = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Take a hold on the light surface; the returned function releases it.
 *
 * Releasing twice is a no-op, so a component that calls it from both an effect
 * cleanup and an early return cannot drive the counter negative.
 */
export function holdPortalLightSurface(): () => void {
  portalLightHolds += 1;
  emit();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    portalLightHolds = Math.max(0, portalLightHolds - 1);
    emit();
  };
}

/** True while at least one portal page is mounted. */
export function isPortalLightSurface(): boolean {
  return portalLightHolds > 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Subscribe to the flag. The server snapshot is `false`: the dashboard's own
 * theme is the safe assumption until a portal layout says otherwise.
 */
export function usePortalLightSurface(): boolean {
  return useSyncExternalStore(subscribe, isPortalLightSurface, () => false);
}
