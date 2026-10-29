"use client";

/**
 * Registers the service worker for EVERY surface, not only the portal.
 *
 * It used to be registered from the portal's install banner, which was correct while the worker
 * existed purely to make the portal installable. It now also owns web push, and the dashboard needs
 * a worker for the same reason — without one, `serviceWorker.ready` never resolves there and the
 * push opt-in has nothing to subscribe through.
 *
 * Rendered once in the root layout, outside the marketing branch: the marketing site has no app
 * shell and no reason to claim a worker on the app origin.
 *
 * Also the last leg of a notification tap. The worker focuses an existing tab and calls
 * `client.navigate()` itself, but a client that cannot be navigated posts `push:navigate` instead;
 * this listens for that so the fallback is not a message into the void.
 */

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa/push";

export function ServiceWorkerBootstrap(): null {
  useEffect(() => {
    // Fire and forget. A failed registration costs installability and push on this visit only, and
    // must never surface as an error in the React tree.
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (!data || data.type !== "push:navigate") return;
      if (typeof data.url !== "string" || !data.url) return;
      // Same-origin only: the worker already validated the payload, but this is the last hop before
      // a navigation, so the rule is enforced here too rather than trusted across a boundary.
      try {
        const target = new URL(data.url, window.location.origin);
        if (target.origin !== window.location.origin) return;
        window.location.assign(target.href);
      } catch {
        // An unparseable URL is not a destination; stay put.
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
