"use client";

/**
 * The portal's "Download App" prompt.
 *
 * A fixed, dismissible bar at the bottom of every participant portal page:
 *
 *  - **Android** — the browser's own install flow. The `beforeinstallprompt` event is captured
 *    early by [`lib/pwa/install-prompt`](../../../lib/pwa/install-prompt.ts) and calling `prompt()`
 *    hands the user straight into the native install dialog.
 *  - **iOS** — there is no install API. Tapping Download opens a modal with the Safari
 *    Share → View More → Add to Home Screen steps (and says so when the reader is in
 *    Chrome/Firefox/Edge on iOS, where adding to the home screen is impossible).
 *  - **Anything else without a prompt** — a modal with the browser-menu steps, so the button never
 *    silently does nothing.
 *
 * The prompt is MOBILE-ONLY (`md:hidden`). On a desktop display the browser already exposes its own
 * install affordance (the address-bar icon), so a bar offering the same thing is noise. The manifest
 * and service worker still register on desktop — they are what keep the page installable.
 *
 * It also does the two things the install needs to be possible at all: it points the document's
 * `<link rel="manifest">` at the per-plan manifest (`/api/pwa/manifest`) and registers the
 * cache-free service worker.
 *
 * Dismissal is remembered per plan in localStorage, the prompt hides itself once the app is running
 * standalone, and it is rendered OUTSIDE `PortalCommentsZoom` so the Comments preview cannot scale
 * or scroll it away.
 *
 * The bar is PORTALED into `document.body` and lives inside a fixed, viewport-sized layer with
 * `overflow: hidden` and paint containment. That is deliberate: a fixed element that merely sits at
 * the end of the page markup can be folded into the document's scrollable overflow by iOS Safari,
 * which shows up as blank space below the footer. In a fixed layer the bar's box can never be
 * larger than the viewport, so it cannot lengthen the page in any browser.
 *
 * Its offset also includes `env(safe-area-inset-bottom)` — a STATIC value. It used to lift on a
 * downward scroll to clear the retracting browser toolbar, but changing a fixed element's geometry
 * during a scroll is exactly the kind of thing that makes iOS recompute the page extent. The safe
 * area plus a constant margin keeps the rounded corners clear without touching layout while the
 * reader scrolls.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  MoreVertical,
  Share,
  Smartphone,
  SquarePlus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  isStandaloneDisplay,
  promptForInstall,
  readInstallEnvironment,
  subscribeToInstallPrompt,
  type InstallEnvironment,
} from "@/lib/pwa/install-prompt";

/** Per-plan so dismissing one client's portal does not silence the next one. */
const DISMISS_KEY_PREFIX = "portal:install-app-dismissed:";

/** Where the plan-aware manifest lives (see app/api/pwa/manifest/route.ts). */
const MANIFEST_PATH = "/api/pwa/manifest";

export function PortalInstallApp() {
  const params = useParams<{ id?: string }>();
  const slug = typeof params?.id === "string" ? params.id : "";
  const { clientData } = useClientPortal();
  const appName = (clientData?.companyName || "").trim() || "PlanTelligence";

  // Start hidden: the dismissal and standalone checks are browser-only, and a banner that appears
  // and then vanishes is worse than one that appears a beat late.
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [environment, setEnvironment] = useState<InstallEnvironment | null>(
    null,
  );
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // The element the bar is portaled into. Null during SSR and the first paint — the bar is hidden
  // until `ready` anyway.
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalHost(document.body);
  }, []);

  // Point the manifest at THIS plan. The root layout links the manifest route so the browser always
  // has one; the slug and name make the installed app start at this portal and carry its name.
  //
  // iOS ignores manifest icons when adding to the home screen, so the `apple-touch-icon` link is
  // re-pointed at the same plan-aware icon route. Without it an iOS install would keep the
  // PlanTelligence mark while Android/desktop use the plan's logo.
  useEffect(() => {
    if (!slug || typeof document === "undefined") return;
    const href = `${MANIFEST_PATH}?slug=${encodeURIComponent(
      slug,
    )}&name=${encodeURIComponent(appName)}`;
    // 192px is the closest square the route renders to iOS's 180px touch icon.
    const iconHref = `/api/pwa/icon?slug=${encodeURIComponent(slug)}&size=192`;

    let link = document.head.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    );
    const createdHere = !link;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }

    const previousHref = link.getAttribute("href");
    link.setAttribute("href", href);

    let appleLink = document.head.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon"]',
    );
    const appleCreatedHere = !appleLink;
    if (!appleLink) {
      appleLink = document.createElement("link");
      appleLink.rel = "apple-touch-icon";
      appleLink.setAttribute("sizes", "180x180");
      document.head.appendChild(appleLink);
    }
    const previousAppleHref = appleLink.getAttribute("href");
    appleLink.setAttribute("href", iconHref);

    // Leaving the portal restores the app-level manifest rather than leaving this plan's on a
    // dashboard page the browser may keep open.
    return () => {
      if (createdHere) {
        link?.remove();
      } else if (previousHref) {
        link?.setAttribute("href", previousHref);
      }
      if (appleCreatedHere) {
        appleLink?.remove();
      } else if (previousAppleHref) {
        appleLink?.setAttribute("href", previousAppleHref);
      }
    };
  }, [slug, appName]);

  // The service worker is what makes the page installable at all. It is a pass-through (see
  // public/sw.js), so registering it changes no request behaviour.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const secure =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!secure) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // A failed registration only costs installability on this visit.
    });
  }, []);

  // Browser-only facts: platform, standalone mode, stored dismissal, and the captured prompt.
  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setEnvironment(readInstallEnvironment());

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
    return subscribeToInstallPrompt((event) => setCanPrompt(Boolean(event)));
  }, [slug]);

  // Installing completes outside our control (the browser chrome), so hide on the event.
  useEffect(() => {
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (!slug) return;
    try {
      window.localStorage.setItem(DISMISS_KEY_PREFIX + slug, "1");
    } catch {
      // Storage can be blocked; the prompt just comes back next visit.
    }
  }, [slug]);

  const handleDownload = useCallback(async () => {
    if (!environment) return;

    // iOS has no programmatic install: always explain the Share sheet.
    if (environment.isIOS) {
      setInstructionsOpen(true);
      return;
    }

    if (!canPrompt) {
      setInstructionsOpen(true);
      return;
    }

    setBusy(true);
    const outcome = await promptForInstall();
    setBusy(false);

    // "accepted" resolves into `appinstalled`, which hides the bar. A refusal leaves the bar so the
    // reader can change their mind; "unavailable" means the event was spent, so explain instead.
    if (outcome === "unavailable") setInstructionsOpen(true);
  }, [canPrompt, environment]);

  const visible = ready && !dismissed && !installed;

  const installBar =
    visible && portalHost
      ? createPortal(
          // A fixed, VIEWPORT-SIZED layer. Its box is exactly the screen, so it cannot contribute
          // to the document's height. `overflow: hidden` + paint containment keep the pill, its
          // shadow and any browser compositing artefacts inside that box.
          <div
            // `md:hidden` keeps this mobile-only: desktop displays use the browser's own install
            // affordance, and the bar would otherwise cover the footer of a wide layout.
            className="pointer-events-none fixed inset-0 z-40 overflow-hidden print:hidden md:hidden"
            style={{ contain: "layout paint" }}
          >
            <div
              // `right` rather than `inset-x-0`: while the Comments rail is open, the prompt centres
              // in the space that is left instead of sliding under the panel.
              className="absolute flex justify-center px-3"
              style={{
                left: 0,
                right: "var(--comments-inset, 0px)",
                bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              <div className="pointer-events-auto flex w-full max-w-lg items-center gap-2 rounded-2xl border border-black/5 bg-white p-2 pl-3 shadow-[0_10px_35px_rgba(15,23,42,0.18)] sm:w-auto sm:rounded-full">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F3A60]/10">
                  <Smartphone
                    className="h-4 w-4 text-[#1F3A60]"
                    aria-hidden="true"
                  />
                </span>

                {/* One title capped at two lines. Kept short so it reads in full even beside
                    the button on a phone; `line-clamp-2` only bites on an unusually long
                    company name. */}
                <p className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-gray-900">
                  {`Get the ${appName} app`}
                </p>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleDownload}
                  disabled={busy}
                  className="shrink-0 rounded-full bg-[#1F3A60] px-3 text-white hover:bg-[#2C4B80]"
                >
                  {busy ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <>
                      <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Download
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Dismiss the app download prompt"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>,
          portalHost,
        )
      : null;

  return (
    <>
      {installBar}

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{`Install ${appName}`}</DialogTitle>
            <DialogDescription>
              Add this benefits portal to your home screen so it opens like an
              app.
            </DialogDescription>
          </DialogHeader>

          {environment?.isIOS ? (
            <>
              {environment.isIOSBrowserOtherThanSafari && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                  On iPhone and iPad, apps can only be added from Safari. Open
                  this page in Safari, then follow the steps below.
                </p>
              )}
              <ol className="space-y-4">
                <InstructionStep
                  index={1}
                  icon={Share}
                  title="Tap the Share button"
                >
                  {
                    "In Safari’s toolbar, tap the Share icon — the square with an arrow pointing up."
                  }
                </InstructionStep>
                <InstructionStep
                  index={2}
                  icon={ChevronDown}
                  title="Tap View More"
                >
                  {
                    "Tap the “View More” button — the downward arrow — to show every option in the Share Sheet."
                  }
                </InstructionStep>
                <InstructionStep
                  index={3}
                  icon={SquarePlus}
                  title="Add to Home Screen"
                >
                  {
                    "In the Share Sheet, tap “Add to Home Screen”, then tap “Add” to finish."
                  }
                </InstructionStep>
              </ol>
            </>
          ) : (
            <ol className="space-y-4">
              <InstructionStep
                index={1}
                icon={MoreVertical}
                title="Open the browser menu"
              >
                {
                  "Tap the three-dot menu in the top-right corner of your browser."
                }
              </InstructionStep>
              <InstructionStep
                index={2}
                icon={Download}
                title="Choose Install app"
              >
                {
                  "Pick “Install app” (some browsers call it “Add to Home screen”)."
                }
              </InstructionStep>
              <InstructionStep index={3} icon={CheckCircle2} title="Confirm">
                {
                  "Tap Install and the portal opens in its own window from now on."
                }
              </InstructionStep>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function InstructionStep({
  index,
  icon: Icon,
  title,
  children,
}: {
  index: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F3A60]/10">
        <Icon className="h-4 w-4 text-[#1F3A60]" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">
          {`${index}. ${title}`}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
          {children}
        </p>
      </div>
    </li>
  );
}
