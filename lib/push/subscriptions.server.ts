/**
 * Push subscription persistence.
 *
 * The row is the server's half of a browser handshake; `lib/pwa/push.ts` owns the browser's half.
 * Three rules shape everything here:
 *
 *  1. **`endpoint` is the device.** It is `@unique`, so a browser that re-subscribes (a re-install, a
 *     cleared cache, a rotation by the push service) UPSERTS instead of leaving a dead row behind.
 *  2. **`userId` is rebound on every save.** A shared browser can change hands, and a notification
 *     delivered to the previous user of that device is a data-leak-shaped bug rather than a
 *     mismatched one.
 *  3. **Nothing here throws into a caller's happy path.** Every function is awaited by code that
 *     must not fail because push failed — a comment write, a direct message send — so the sender
 *     swallows its own errors and the routes answer cleanly.
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";
import type { PushCategory, PushPreferences, PushSurface } from "@/lib/push/types";
import { isCategoryEnabled } from "@/lib/push/types";

/**
 * Push service URLs are long but bounded. The cap is a guard against a caller using this table as
 * arbitrary storage, not a limit any real endpoint hits.
 */
const MAX_ENDPOINT_LENGTH = 2048;

/** p256dh is 65 bytes and auth is 16; base64url inflates them, and the cap leaves room. */
const MAX_KEY_LENGTH = 256;
const MIN_KEY_LENGTH = 16;

/**
 * A push endpoint is always an HTTPS URL on the push service. Requiring the scheme keeps a
 * `javascript:` or relative value out of a column that is handed to `web-push` verbatim.
 */
export function readPushEndpoint(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ENDPOINT_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return trimmed;
}

/** The browser's payload-encryption keys travel as base64url. Anything else is not a key. */
export function readPushKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < MIN_KEY_LENGTH || trimmed.length > MAX_KEY_LENGTH) {
    return null;
  }
  return /^[A-Za-z0-9_-]+={0,2}$/.test(trimmed) ? trimmed : null;
}

export interface SavePushSubscriptionInput {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  surface: PushSurface;
  /** Resolved plan id for a portal opt-in; null for the dashboard. */
  clientId?: string | null;
  userAgent?: string | null;
}

/**
 * Record (or refresh) this browser's endpoint for this user.
 *
 * `failureCount` is reset because a save means the browser just proved the endpoint works — without
 * that reset, one transient failure would leave a healthy device looking suspect forever.
 */
export async function savePushSubscription(
  input: SavePushSubscriptionInput,
): Promise<void> {
  const shared = {
    p256dh: input.p256dh,
    auth: input.auth,
    userId: input.userId,
    surface: input.surface,
    // Only a portal opt-in carries a plan; anything else clears it so a stale plan id cannot make a
    // dashboard subscription look like it belongs to a portal.
    clientId: input.surface === "portal" ? (input.clientId ?? null) : null,
    userAgent: input.userAgent ?? null,
  };

  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...shared },
    update: { ...shared, failureCount: 0 },
  });
}

/**
 * Forget one endpoint — but only if it belongs to the caller.
 *
 * Scoping the delete to `userId` is what stops a caller removing another person's device by
 * presenting an endpoint they happen to know. The endpoint is a bearer capability; it is not a
 * secret every client is trusted with.
 */
export async function removePushSubscription(input: {
  userId: string;
  endpoint: string;
}): Promise<boolean> {
  const result = await prisma.pushSubscription.deleteMany({
    where: { endpoint: input.endpoint, userId: input.userId },
  });
  return result.count > 0;
}

export interface EndpointRegistration {
  surface: PushSurface;
  clientId: string | null;
  preferences: PushPreferences | null;
}

/**
 * This browser's row for this user, or null — the state the Settings surface reads.
 *
 * Returns the preferences as well as the existence, so the UI can paint the real switch positions on
 * its first frame instead of after a second round trip.
 */
export async function findPushSubscriptionForEndpoint(input: {
  userId: string;
  endpoint: string;
}): Promise<EndpointRegistration | null> {
  const row = await prisma.pushSubscription.findFirst({
    where: { endpoint: input.endpoint, userId: input.userId },
    select: { surface: true, clientId: true, preferences: true },
  });
  if (!row) return null;
  return {
    surface: row.surface === "portal" ? "portal" : "dashboard",
    clientId: row.clientId,
    preferences: readPreferences(row.preferences),
  };
}

export interface StoredPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  surface: PushSurface;
  clientId: string | null;
  preferences: PushPreferences | null;
}

function readPreferences(value: unknown): PushPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as PushPreferences;
}

/** Every registered browser for these users. The send path's only read. */
export async function listPushSubscriptionsForUsers(
  userIds: string[],
): Promise<StoredPushSubscription[]> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return [];

  const rows = await prisma.pushSubscription.findMany({
    where: { userId: { in: unique } },
    select: {
      endpoint: true,
      p256dh: true,
      auth: true,
      surface: true,
      clientId: true,
      preferences: true,
    },
  });

  return rows.map((row) => ({
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    surface: row.surface === "portal" ? "portal" : "dashboard",
    clientId: row.clientId,
    preferences: readPreferences(row.preferences),
  }));
}

/** Prune endpoints the push service says are gone. */
export async function deletePushSubscriptions(
  endpoints: string[],
): Promise<void> {
  const unique = [...new Set(endpoints.filter(Boolean))];
  if (unique.length === 0) return;
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: { in: unique } },
  });
}

/** A send that the push service accepted. */
export async function recordPushSuccess(endpoint: string): Promise<void> {
  await prisma.pushSubscription.updateMany({
    where: { endpoint },
    data: { lastSuccessAt: new Date(), failureCount: 0 },
  });
}

/**
 * A send that failed for a reason other than "gone".
 *
 * Deliberately not a delete: a transient 5xx or a timeout says nothing about whether the device is
 * still there, and dropping a healthy subscription on one bad minute would silently unsubscribe the
 * reader.
 */
export async function recordPushFailure(endpoint: string): Promise<void> {
  await prisma.pushSubscription.updateMany({
    where: { endpoint },
    data: { failureCount: { increment: 1 } },
  });
}

/** Which switches are on for this subscription. Exported for the sender's filter. */
export function isPushCategoryEnabled(
  subscription: Pick<StoredPushSubscription, "preferences">,
  category: PushCategory | null,
): boolean {
  return isCategoryEnabled(subscription.preferences, category);
}
