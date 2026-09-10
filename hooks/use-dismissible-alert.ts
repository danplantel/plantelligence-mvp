"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "plantelligence:dismissed-alert:";

/**
 * Persistently dismisses an informational alert for the current device.
 *
 * The dismissal is stored in `localStorage` under a stable key so the alert
 * never renders again on that device/browser. SSR-safe: the first render always
 * reports `false` (undismissed) so server and client markup match, and the
 * stored value is applied in an effect after mount.
 *
 * @param key Stable identifier for the alert (e.g. "plan-documents-overview-list").
 */
export function useDismissibleAlert(key: string): {
  isDismissed: boolean;
  dismiss: () => void;
} {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(storageKey) === "1") {
        setIsDismissed(true);
      }
    } catch {
      // Ignore storage access errors (private mode / disabled storage).
    }
  }, [storageKey]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage access errors.
    }
  }, [storageKey]);

  return { isDismissed, dismiss };
}
