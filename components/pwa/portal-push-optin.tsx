"use client";

/**
 * The portal's push opt-in — offered INSIDE the installed app, never in a browser tab.
 *
 * That restriction is the whole design:
 *
 *  - On iOS/iPadOS it is the only context where push can work at all; a Safari tab cannot subscribe.
 *  - Everywhere else it keeps the bar away from an anonymous employee who opened their benefits once.
 *    Push is a long-lived commitment, and the reader who deliberately installed the app is the one who
 *    is asking for it.
 *
 * It therefore renders nothing unless `isStandaloneDisplay()` is true, and it disappears on its own
 * once the browser reports a live subscription. Only `idle` earns a prompt: `install-required`,
 * `denied`, `unsupported` and `not-configured` are all explained where the reader can act on them
 * (the install bar, or the dashboard's Notifications settings) rather than in a bar they cannot fix.
 *
 * Dismissal is remembered per plan, matching the install prompt's convention — silencing one client's
 * portal must not silence the next one.
 *
 * The bar reuses the install prompt's fixed, viewport-sized layer for the same iOS reason documented
 * there: a fixed element at the end of the document can be folded into the page's scrollable overflow
 * and leave blank space under the footer.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { Bell, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStandaloneDisplay } from "@/lib/pwa/install-prompt";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/** Per plan, like `portal:install-app-dismissed:`. */
const DISMISS_KEY_PREFIX = "portal:push-optin-dismissed:";

export function PortalPushOptIn() {
  const params = useParams<{ id?: string }>();
  const slug = typeof params?.id === "string" ? params.id : "";

  const { status, busy, subscribe } = usePushNotifications({
    surface: "portal",
    planSlug: slug,
  });

  // Start hidden: the install state and the stored dismissal are browser-only facts, and a bar that
  // appears then vanishes is worse than one that appears a beat late.
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalHost(document.body);
  }, []);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    if (slug) {
      try {
        setDismissed(
          window.localStorage.getItem(DISMISS_KEY_PREFIX + slug) === "1",
        );
      } catch {
        setDismissed(false);
      }
    } else {
      setDismissed(false);
    }
    setReady(true);
  }, [slug]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (!slug) return;
    try {
      window.localStorage.setItem(DISMISS_KEY_PREFIX + slug, "1");
    } catch {
      // Storage can be blocked; the bar simply returns next visit.
    }
  }, [slug]);

  const visible = ready && installed && !dismissed && status === "idle";

  if (!visible || !portalHost) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden print:hidden"
      style={{ contain: "layout paint" }}
    >
      <div
        className="absolute flex justify-center px-3"
        style={{
          left: 0,
          right: "var(--comments-inset, 0px)",
          bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="pointer-events-auto flex w-full max-w-lg items-center gap-2 rounded-2xl border border-black/5 bg-white p-2 pl-3 shadow-[0_10px_35px_rgba(15,23,42,0.18)] sm:w-auto sm:rounded-full">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F3A60]/10">
            <Bell className="h-4 w-4 text-[#1F3A60]" aria-hidden="true" />
          </span>

          <p className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-gray-900">
            Get notified about new messages and comments
          </p>

          <Button
            type="button"
            size="sm"
            onClick={() => void subscribe()}
            disabled={busy}
            className="shrink-0 rounded-full bg-[#1F3A60] px-3 text-white hover:bg-[#2C4B80]"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              "Turn on"
            )}
          </Button>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss the notifications prompt"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    portalHost,
  );
}
