"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query, SSR-safely.
 *
 * `useSyncExternalStore` is used so the server render and the first client
 * (hydration) render agree on `serverFallback` — avoiding a hydration mismatch —
 * and the real match is applied immediately afterwards.
 *
 * `serverFallback` defaults to `true` because the surfaces that use this gate
 * (the setup wizard, the advisor dashboard) are desktop-first: assuming desktop
 * on the server means a desktop visitor never sees the "use a computer" notice
 * flash before their real viewport width is measured.
 *
 * When `matchMedia` is unavailable (very old browsers, some test environments)
 * the hook resolves to `serverFallback` and never updates.
 */
export function useMediaQuery(query: string, serverFallback = true): boolean {
  const mql = useMemo(
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(query)
        : null,
    [query],
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!mql) return () => {};
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [mql],
  );

  const getSnapshot = useCallback(
    () => (mql ? mql.matches : serverFallback),
    [mql, serverFallback],
  );

  const getServerSnapshot = useCallback(
    () => serverFallback,
    [serverFallback],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
