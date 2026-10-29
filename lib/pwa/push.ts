/**
 * Web Push, browser side.
 *
 * Three things live here, in the order a caller needs them:
 *
 *  1. **Capability** — whether push can work *at all* in this browser, and if not, why not. The
 *     interesting answer is `"install-required"`: iOS/iPadOS 16.4+ exposes the Push API only to a
 *     page running as the installed app, so a Safari tab can never subscribe. Reporting that
 *     distinctly is what lets the UI show the Add to Home Screen steps instead of a dead button.
 *  2. **Subscription** — `PushSubscription` round trips, reported to the server so it knows where to
 *     deliver. The server owns the row; this module owns the browser half.
 *  3. **Teardown** — unsubscribe locally *and* forget the endpoint server-side.
 *
 * The permission prompt is deliberately NOT requested on mount: every platform requires a user
 * gesture, and iOS rejects the request outright without one. Callers are button handlers.
 *
 * One worker serves both surfaces. The dashboard and the plan portals share an origin and a scope,
 * so a subscription belongs to the BROWSER, not to the installed app — see
 * `plans/web-push-notifications.md`. `surface` is recorded so the sender can still address the right
 * audience, not to imply two channels exist.
 *
 * Client-only: every function short-circuits when `window` is absent.
 */

import { isStandaloneDisplay, readInstallEnvironment } from "@/lib/pwa/install-prompt";
import type { PushPreferences, PushSurface } from "@/lib/push/types";

/** Where the service worker lives. Exported so registration and lookups cannot drift. */
export const SERVICE_WORKER_PATH = "/sw.js";

/** The one endpoint that records or forgets a subscription. */
export const PUSH_SUBSCRIBE_ENDPOINT = "/api/push/subscribe";

/** Which product surface the reader opted in from. Re-exported so callers have one import. */
export type { PushSurface, PushPreferences };

/**
 * Why push can or cannot be offered.
 *
 * `"install-required"` is a real, actionable state (show the install instructions), not a failure.
 */
export type PushSupport = "supported" | "install-required" | "unsupported" | "insecure";

export type PushSubscribeFailure =
  | PushSupport
  | "not-configured"
  | "no-service-worker"
  | "denied"
  | "dismissed"
  | "save-failed";

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: PushSubscribeFailure };

export interface PushCapability {
  support: PushSupport;
  /** The OS-level permission for this origin, or null when the API is missing entirely. */
  permission: NotificationPermission | null;
  /** True when THIS browser already holds a live subscription. */
  subscribed: boolean;
}

export interface PushSubscribeInput {
  surface: PushSurface;
  /**
   * Portal only: the plan the reader opted in from. The server resolves it to a `Client.id` so a
   * portal notification can open the portal route rather than a dashboard one.
   */
  planSlug?: string | null;
}

/** https, or the loopback hosts browsers treat as secure. */
function isSecureContextForWorker(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  return (
    protocol === "https:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

/** The VAPID public key, or null when the deployment has not been configured. */
export function readVapidPublicKey(): string | null {
  const value = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Classify push support for this browser.
 *
 * Order matters: an insecure context has no service worker at all, so it is reported before the
 * missing-API case, and the iOS install gate is checked last because it is the only one that is
 * fixable without changing browser or deployment.
 */
export function readPushSupport(): PushSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "unsupported";
  }
  if (!isSecureContextForWorker()) return "insecure";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  // iOS/iPadOS is the one platform where push requires the Home Screen install. This also covers
  // iOS Chrome/Firefox/Edge, which cannot install at all — their only route is Safari.
  const environment = readInstallEnvironment();
  if (environment.isIOS && !isStandaloneDisplay()) return "install-required";
  return "supported";
}

/**
 * Base64url → bytes. `applicationServerKey` is a byte array, but VAPID keys travel as base64url
 * strings, so the padding and the two substituted characters have to be put back.
 */
function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = window.atob(withPadding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

let registrationInFlight: Promise<ServiceWorkerRegistration | null> | null =
  null;

/**
 * Register the worker once per page load, and share the attempt.
 *
 * Concurrent callers (the install banner, the push opt-in, a Settings toggle) must not race three
 * identical `register()` calls. A failure is not cached: it costs only this visit, and the next
 * caller deserves a fresh attempt.
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registrationInFlight) return registrationInFlight;
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !isSecureContextForWorker()
  ) {
    return Promise.resolve(null);
  }

  registrationInFlight = navigator.serviceWorker
    .register(SERVICE_WORKER_PATH, { scope: "/" })
    .catch(() => {
      registrationInFlight = null;
      return null;
    });
  return registrationInFlight;
}

/** The registration controlling this page, or null. Never registers. */
async function findRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

/**
 * The live subscription for this browser, or null.
 *
 * `getSubscription()` can throw when the worker is gone or the browser is in a bad state, which is
 * indistinguishable from "not subscribed" for a caller's purposes.
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  const registration = await findRegistration();
  if (!registration) return null;
  try {
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Support, permission and subscription state, read together for the UI. */
export async function readPushCapability(): Promise<PushCapability> {
  const support = readPushSupport();
  const permission =
    typeof Notification === "undefined" ? null : Notification.permission;

  if (support !== "supported") {
    return { support, permission, subscribed: false };
  }

  const subscription = await getExistingPushSubscription();
  return { support, permission, subscribed: Boolean(subscription) };
}

/**
 * Ask for permission, subscribe, and record the endpoint server-side.
 *
 * MUST be called from a user gesture. Every failure is returned rather than thrown, because the
 * caller always has something useful to say about it: `"install-required"` → install steps,
 * `"denied"` → browser settings, `"dismissed"` → a quieter retry affordance.
 */
export async function subscribeToPush(
  input: PushSubscribeInput,
): Promise<PushSubscribeResult> {
  const support = readPushSupport();
  if (support !== "supported") return { ok: false, reason: support };

  const publicKey = readVapidPublicKey();
  if (!publicKey) return { ok: false, reason: "not-configured" };

  const registration = await registerServiceWorker();
  if (!registration) return { ok: false, reason: "no-service-worker" };

  // `Notification.requestPermission()` is the gesture-consuming call; it must not be moved behind
  // another await that could lose the user activation.
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return { ok: false, reason: "dismissed" };
  }
  if (permission !== "granted") {
    return { ok: false, reason: permission === "denied" ? "denied" : "dismissed" };
  }

  let created = false;
  let subscription: PushSubscription;
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      subscription = existing;
    } else {
      subscription = await registration.pushManager.subscribe({
        // Every browser that ships push requires this flag; without it Chrome rejects the call.
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(publicKey) as BufferSource,
      });
      created = true;
    }
  } catch {
    return { ok: false, reason: "save-failed" };
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint ?? subscription.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    if (created) await subscription.unsubscribe().catch(() => undefined);
    return { ok: false, reason: "save-failed" };
  }

  try {
    const response = await fetch(PUSH_SUBSCRIBE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint,
        keys: { p256dh, auth },
        surface: input.surface,
        planSlug: input.planSlug ?? null,
      }),
    });
    if (!response.ok) {
      // The browser is subscribed but the server never learned where to send: roll the browser half
      // back so the UI's picture and the database agree. A pre-existing subscription is kept — it
      // may belong to another account and is not ours to discard on a transient 500.
      if (created) await subscription.unsubscribe().catch(() => undefined);
      return { ok: false, reason: "save-failed" };
    }
  } catch {
    if (created) await subscription.unsubscribe().catch(() => undefined);
    return { ok: false, reason: "save-failed" };
  }

  return { ok: true };
}

/** The reader's per-category opt-outs for THIS browser, or null when it is not subscribed. */
export async function readPushPreferences(): Promise<PushPreferences | null> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return null;
  try {
    const response = await fetch(
      `${PUSH_SUBSCRIBE_ENDPOINT}?endpoint=${encodeURIComponent(subscription.endpoint)}`,
      // The answer is this device's live setting; a cached copy would show a stale toggle.
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      preferences?: PushPreferences;
    } | null;
    return payload?.preferences ?? {};
  } catch {
    return null;
  }
}

/**
 * Replace this browser's per-category opt-outs.
 *
 * Returns false when there is no subscription to attach them to — the caller should not pretend a
 * preference was saved for a device the server has never heard of.
 */
export async function updatePushPreferences(
  preferences: PushPreferences,
): Promise<boolean> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return false;
  try {
    const response = await fetch(PUSH_SUBSCRIBE_ENDPOINT, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        preferences,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Forget this browser: local subscription first, then the server row.
 *
 * The server call is attempted even when the local subscription is already gone — the row can
 * outlive a browser-side reset, and a stale endpoint would keep receiving failed sends until it is
 * evicted on a 410.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getExistingPushSubscription();
  const endpoint = subscription?.endpoint ?? null;

  let removedLocally = false;
  if (subscription) {
    try {
      removedLocally = await subscription.unsubscribe();
    } catch {
      removedLocally = false;
    }
  }

  if (endpoint) {
    try {
      await fetch(PUSH_SUBSCRIBE_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      // The sender prunes on 410, so a failed delete only delays cleanup.
    }
  }

  return removedLocally || Boolean(endpoint);
}
