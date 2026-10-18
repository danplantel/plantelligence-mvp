/**
 * The browser's install prompt, captured once and shared.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt` ONCE per page load, and only after the manifest has
 * been fetched and installability has been verified — which is often after the React tree has
 * mounted. Listening from a component's `useEffect` therefore races the browser and can miss the
 * event entirely, leaving the Download button with nothing to call. This module registers the
 * listener when the client bundle is evaluated (the earliest moment we control), keeps the event,
 * and broadcasts it to whoever subscribes later.
 *
 * `preventDefault()` is called deliberately: it suppresses Chrome's own mini-infobar so the portal
 * can show its own dismissible prompt instead of two CTAs competing for the same corner.
 *
 * The event is SINGLE-USE. `prompt()` consumes it; a second call throws. `promptForInstall` drops
 * the cached event as it consumes it so callers can fall back to manual instructions rather than
 * call a spent prompt.
 *
 * Nothing here runs on the server: the module-level capture is guarded, and every reader is a
 * client component.
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

export type InstallPromptOutcome = "accepted" | "dismissed" | "unavailable";

type InstallPromptListener = (event: BeforeInstallPromptEvent | null) => void;

let deferredEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<InstallPromptListener>();
let captureBound = false;

function notify(): void {
  for (const listener of listeners) {
    try {
      listener(deferredEvent);
    } catch {
      // A subscriber's failure must not stop the others from being told.
    }
  }
}

function bindCapture(): void {
  if (captureBound || typeof window === "undefined") return;
  captureBound = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredEvent = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredEvent = null;
    notify();
  });
}

bindCapture();

/**
 * Watch the captured prompt. The listener is called immediately with the current event (or null),
 * then on every change, including the app being installed. Returns an unsubscribe function.
 */
export function subscribeToInstallPrompt(
  listener: InstallPromptListener,
): () => void {
  bindCapture();
  listeners.add(listener);
  listener(deferredEvent);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Show the browser's install prompt. `"unavailable"` means this browser/user agent cannot prompt
 * (iOS Safari has no such API, and Chrome may have consumed or withheld the event) — the caller
 * should show manual instructions instead.
 */
export async function promptForInstall(): Promise<InstallPromptOutcome> {
  bindCapture();
  const event = deferredEvent;
  if (!event) return "unavailable";

  // Consume it: the event cannot be prompted twice.
  deferredEvent = null;

  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    return "dismissed";
  } finally {
    notify();
  }
}

/** True when the page is already running as an installed app (either platform's signal). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const queries = ["(display-mode: standalone)", "(display-mode: fullscreen)", "(display-mode: minimal-ui)"];
    if (queries.some((query) => window.matchMedia(query).matches)) return true;
  } catch {
    // matchMedia unavailable — fall through to the iOS flag.
  }
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };
  return navigatorWithStandalone.standalone === true;
}

export interface InstallEnvironment {
  /** iPhone/iPad, including iPadOS 13+ which reports itself as a Mac. */
  isIOS: boolean;
  isAndroid: boolean;
  /**
   * iOS browsers are all WebKit shells around Safari, but only SAFARI can add a page to the Home
   * Screen. Chrome/Firefox/Edge on iOS need the reader to re-open the portal in Safari first.
   */
  isIOSBrowserOtherThanSafari: boolean;
}

export function readInstallEnvironment(): InstallEnvironment {
  if (typeof window === "undefined") {
    return { isIOS: false, isAndroid: false, isIOSBrowserOtherThanSafari: false };
  }
  const userAgent = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;

  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    // iPadOS 13+ presents as "MacIntel" with touch support.
    (platform === "MacIntel" && maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isIOSBrowserOtherThanSafari =
    isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);

  return { isIOS, isAndroid, isIOSBrowserOtherThanSafari };
}
