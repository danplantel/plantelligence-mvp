"use client";

/**
 * The dashboard's Notifications surface: turn phone/desktop push on, and choose what it may send.
 *
 * Deliberately state-driven rather than a single switch. Every reason push cannot work has a
 * different remedy, and a disabled switch would leave the reader guessing which one applies:
 *
 *  - `unsupported` / `insecure` → say so plainly; nothing here can fix it.
 *  - `install-required`         → iOS/iPadOS: the app must be added to the Home Screen first.
 *  - `denied`                   → only browser settings can undo a refusal; name the path.
 *  - `not-configured`           → a deployment problem; the reader is told not to wait.
 *  - `idle`                     → the one state that gets a real button.
 *
 * The category switches exist because "notifications" is not one thing to an advisor: a direct
 * message is urgent, a comment thread is not, and an assignment is work. They are stored per BROWSER
 * (the subscription row), because that is the only place a push preference can be enforced — the
 * OS-level permission is per origin, not per user.
 */

import { useState } from "react";
import { Bell, BellRing, Loader2, ShieldAlert, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import type { PushCategory } from "@/lib/push/types";

const CATEGORY_COPY: Array<{
  category: PushCategory;
  label: string;
  description: string;
}> = [
  {
    category: "direct_message",
    label: "Direct messages",
    description: "Someone sent you a message in PlanTelligence.",
  },
  {
    category: "comment",
    label: "Comments",
    description: "A reply or a mention in a plan's comment thread.",
  },
  {
    category: "task",
    label: "Assigned tasks",
    description: "Somebody handed you work from a comment thread.",
  },
];

export function PushOptInCard() {
  const {
    status,
    busy,
    preferences,
    lastFailure,
    subscribe,
    unsubscribe,
    setCategoryEnabled,
  } = usePushNotifications({ surface: "dashboard" });

  const [justSubscribed, setJustSubscribed] = useState(false);

  const handleSubscribe = async () => {
    const failure = await subscribe();
    if (!failure) setJustSubscribed(true);
  };

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F3A60]/10">
          <BellRing className="h-4 w-4 text-[#1F3A60]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">
            Push notifications
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get told about a message or a comment when PlanTelligence is closed.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Checking this browser…
          </p>
        )}

        {status === "unsupported" && (
          <Notice icon={ShieldAlert} tone="muted">
            This browser cannot receive push notifications. Chrome, Edge, Firefox
            and Safari 16.4 or later can.
          </Notice>
        )}

        {status === "insecure" && (
          <Notice icon={ShieldAlert} tone="muted">
            Push needs a secure connection (https). This page is not served over
            https, so the browser will not allow it.
          </Notice>
        )}

        {status === "install-required" && (
          <Notice icon={Smartphone} tone="info">
            On iPhone and iPad, notifications only work after PlanTelligence is
            added to the Home Screen. Open this site in Safari, tap Share, then
            Add to Home Screen, and turn notifications on from there.
          </Notice>
        )}

        {status === "denied" && (
          <Notice icon={ShieldAlert} tone="warning">
            Notifications are blocked for this site. Allow them in your site
            settings in the browser, then reload this page.
          </Notice>
        )}

        {status === "not-configured" && (
          <Notice icon={ShieldAlert} tone="muted">
            Push notifications are not configured on this deployment yet.
          </Notice>
        )}

        {status === "idle" && (
          <Button
            type="button"
            onClick={handleSubscribe}
            disabled={busy}
            className="rounded-full bg-[#1F3A60] text-white hover:bg-[#2C4B80]"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Bell className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Turn on notifications
          </Button>
        )}

        {status === "subscribed" && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <BellRing className="h-4 w-4" aria-hidden="true" />
              {justSubscribed
                ? "This browser is now registered."
                : "This browser is registered for notifications."}
            </p>

            <ul className="space-y-3">
              {CATEGORY_COPY.map(({ category, label, description }) => {
                const enabled = preferences[category] !== false;
                return (
                  <li
                    key={category}
                    className="flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {description}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={label}
                      onClick={() => setCategoryEnabled(category, !enabled)}
                      className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        enabled ? "bg-[#1F3A60]" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          enabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={unsubscribe}
              disabled={busy}
              className="rounded-full"
            >
              {busy && (
                <Loader2
                  className="mr-2 h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              )}
              Turn off for this browser
            </Button>
          </div>
        )}

        {lastFailure && status !== "subscribed" && (
          <p className="mt-3 text-xs text-amber-700" role="status">
            That did not go through. Try again, or check the notification
            settings in the browser.
          </p>
        )}
      </div>
    </div>
  );
}

function Notice({
  icon: Icon,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "muted" | "info" | "warning";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "info"
        ? "border-sky-200 bg-sky-50 text-sky-900"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <p
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${toneClass}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
