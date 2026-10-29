"use client";

/**
 * The web-push opt-in state machine, written once for both surfaces.
 *
 * The portal and the dashboard need the same five answers — can push work here, has the reader
 * granted permission, is THIS browser subscribed, which categories are on, and what went wrong — and
 * they need them in the same order. Writing that twice is how the two surfaces start disagreeing
 * about whether a reader is subscribed.
 *
 * The statuses are deliberately more granular than "on/off", because every failure here has a
 * DIFFERENT remedy and a generic "notifications unavailable" would strand the reader:
 *
 *   loading          → capability not read yet
 *   unsupported      → this browser has no Push API (old Safari, iOS browser that cannot install)
 *   insecure         → http origin; the worker cannot exist
 *   install-required → iOS/iPadOS: must be added to the Home Screen FIRST (fixable, show the steps)
 *   not-configured   → the deployment has no VAPID key; nothing the reader can do
 *   denied           → the reader said no; only browser settings can undo it
 *   idle             → supported and undecided; the button can succeed
 *   subscribed       → live
 *
 * `denied` and `not-configured` are never presented as a button, because a button that can only fail
 * is worse than an explanation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  readPushCapability,
  readPushPreferences,
  readVapidPublicKey,
  subscribeToPush,
  unsubscribeFromPush,
  updatePushPreferences,
  type PushSubscribeFailure,
  type PushSupport,
  type PushSurface,
} from "@/lib/pwa/push";
import type { PushCategory, PushPreferences } from "@/lib/push/types";

export type PushStatus =
  | "loading"
  | "unsupported"
  | "insecure"
  | "install-required"
  | "not-configured"
  | "denied"
  | "idle"
  | "subscribed";

export interface UsePushNotificationsOptions {
  surface: PushSurface;
  /** Portal only: the plan the reader opted in from. */
  planSlug?: string | null;
}

export interface UsePushNotificationsResult {
  status: PushStatus;
  /** True while a permission prompt, subscribe or unsubscribe is in flight. */
  busy: boolean;
  /** The raw support classification, for copy that needs to distinguish the unusable cases. */
  support: PushSupport;
  /** Per-category opt-outs for THIS browser. Empty when not subscribed. */
  preferences: PushPreferences;
  /** The reason the last action failed, or null. */
  lastFailure: PushSubscribeFailure | null;
  /** Re-read everything (after returning from browser settings, for example). */
  refresh: () => Promise<void>;
  /** Ask for permission and subscribe. MUST be called from a click handler. */
  subscribe: () => Promise<PushSubscribeFailure | null>;
  unsubscribe: () => Promise<void>;
  /** Turn one category on or off for this browser. */
  setCategoryEnabled: (category: PushCategory, enabled: boolean) => Promise<void>;
}

function deriveStatus(
  support: PushSupport,
  permission: NotificationPermission | null,
  subscribed: boolean,
  configured: boolean,
): PushStatus {
  if (support === "unsupported") return "unsupported";
  if (support === "insecure") return "insecure";
  if (support === "install-required") return "install-required";
  if (!configured) return "not-configured";
  if (subscribed) return "subscribed";
  if (permission === "denied") return "denied";
  return "idle";
}

export function usePushNotifications(
  options: UsePushNotificationsOptions,
): UsePushNotificationsResult {
  const { surface, planSlug } = options;

  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [status, setStatus] = useState<PushStatus>("loading");
  const [preferences, setPreferences] = useState<PushPreferences>({});
  const [busy, setBusy] = useState(false);
  const [lastFailure, setLastFailure] = useState<PushSubscribeFailure | null>(
    null,
  );

  // Guard every state write: the capability read resolves asynchronously and the reader may have
  // navigated away (this hook lives in a portal layout that unmounts on every page change).
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const capability = await readPushCapability();
    if (!mountedRef.current) return;

    const configured = Boolean(readVapidPublicKey());
    setSupport(capability.support);
    setStatus(
      deriveStatus(
        capability.support,
        capability.permission,
        capability.subscribed,
        configured,
      ),
    );

    if (capability.subscribed) {
      const stored = await readPushPreferences();
      if (!mountedRef.current) return;
      setPreferences(stored ?? {});
    } else {
      setPreferences({});
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  // Permission can be revoked (or granted) in browser settings while the page is open. Those changes
  // are invisible to React otherwise, and the reader would come back to a stale "denied" card.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
    let cancelled = false;

    const watch = async () => {
      try {
        const status = await navigator.permissions.query({
          // `notifications` is not in the DOM lib's PermissionName union everywhere.
          name: "notifications" as PermissionName,
        });
        if (cancelled) return;
        status.onchange = () => {
          void refresh();
        };
      } catch {
        // Unsupported query — the refresh button covers this case.
      }
    };

    void watch();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const subscribe = useCallback(async () => {
    setBusy(true);
    try {
      const result = await subscribeToPush({ surface, planSlug: planSlug ?? null });
      const failure = result.ok ? null : result.reason;
      if (mountedRef.current) setLastFailure(failure);
      await refresh();
      return failure;
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [planSlug, refresh, surface]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      if (mountedRef.current) setLastFailure(null);
      await refresh();
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [refresh]);

  const setCategoryEnabled = useCallback(
    async (category: PushCategory, enabled: boolean) => {
      // Optimistic: the switch moves under the finger. A failed PATCH puts it back, because a
      // preference that only exists in the browser is a promise the server will break.
      const previous = preferences;
      const next: PushPreferences = { ...preferences };
      if (enabled) delete next[category];
      else next[category] = false;
      setPreferences(next);

      const saved = await updatePushPreferences(next);
      if (!saved && mountedRef.current) setPreferences(previous);
    },
    [preferences],
  );

  return {
    status,
    busy,
    support,
    preferences,
    lastFailure,
    refresh,
    subscribe,
    unsubscribe,
    setCategoryEnabled,
  };
}
