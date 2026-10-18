"use client";

/**
 * The portal's "Download App" prompt.
 *
 * A fixed, dismissible bar at the bottom of every participant portal page:
 *
 *  - **Android / desktop Chromium** — the browser's own install flow. The `beforeinstallprompt` event
 *    is captured early by [`lib/pwa/install-prompt`](../../../lib/pwa/install-prompt.ts) and calling
 *    `prompt()` hands the user straight into the native install dialog.
 *  - **iOS** — there is no install API. Tapping Download opens a modal with the Safari
 *    Share → Add to Home Screen steps (and says so when the reader is in Chrome/Firefox/Edge on
 *    iOS, where adding to the home screen is impossible).
 *  - **Anything else without a prompt** — a modal with the browser-menu steps, so the button never
 *    silently does nothing.
 *
 * It also does the two things the install needs to be possible at all: it points the document's
 * `<link rel="manifest">` at the per-plan manifest (`/api/pwa/manifest`) and registers the
 * cache-free service worker.
 *
 * Dismissal is remembered per plan in localStorage, the prompt hides itself once the app is running
 * standalone, and it is rendered OUTSIDE `PortalCommentsZoom` so the Comments preview cannot scale
 * or scroll it away.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
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

  // Point the manifest at THIS plan. The root layout links the manifest route so the browser always
  // has one; the slug and name make the installed app start at this portal and carry its name.
  useEffect(() => {
    if (!slug || typeof document === "undefined") return;
    const href = `${MANIFEST_PATH}?slug=${encodeURIComponent(
      slug,
    )}&name=${encodeURIComponent(appName)}`;

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

    // Leaving the portal restores the app-level manifest rather than leaving this plan's on a
    // dashboard page the browser may keep open.
    return () => {
      if (createdHere) {
        link?.remove();
      } else if (previousHref) {
        link?.setAttribute("href", previousHref);
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

  return (
    <>
      {visible && (
        <div
          // `right` rather than `inset-x-0`: while the Comments rail is open, the prompt centres in
          // the space that is left instead of sliding under the panel.
          className="pointer-events-none fixed bottom-3 left-0 z-40 flex justify-center px-3 print:hidden"
          style={{ right: "var(--comments-inset, 0px)" }}
        >
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border border-black/5 bg-white/95 p-2 pl-3 shadow-[0_10px_35px_rgba(15,23,42,0.18)] backdrop-blur sm:w-auto sm:rounded-full">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F3A60]/10">
              <Smartphone className="h-4 w-4 text-[#1F3A60]" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {`Get the ${appName} app`}
              </p>
              <p className="truncate text-[11px] text-gray-500">
                Add your benefits portal to your home screen.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleDownload}
              disabled={busy}
              className="shrink-0 rounded-full bg-[#1F3A60] px-3 text-white hover:bg-[#2C4B80]"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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
      )}

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{`Install ${appName}`}</DialogTitle>
            <DialogDescription>
              Add this benefits portal to your home screen so it opens like an app.
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
                  {"In Safari’s toolbar, tap the Share icon — the square with an arrow pointing up."}
                </InstructionStep>
                <InstructionStep
                  index={2}
                  icon={SquarePlus}
                  title="Add to Home Screen"
                >
                  {"Scroll the share sheet and tap “Add to Home Screen”."}
                </InstructionStep>
                <InstructionStep index={3} icon={CheckCircle2} title="Tap Add">
                  {"The portal appears on your home screen and opens full screen, just like an app."}
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
                {"Tap the three-dot menu in the top-right corner of your browser."}
              </InstructionStep>
              <InstructionStep
                index={2}
                icon={Download}
                title="Choose Install app"
              >
                {"Pick “Install app” (some browsers call it “Add to Home screen”)."}
              </InstructionStep>
              <InstructionStep index={3} icon={CheckCircle2} title="Confirm">
                {"Tap Install and the portal opens in its own window from now on."}
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
