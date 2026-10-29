/**
 * The push SENDER.
 *
 * Called from the notification writers — a comment fan-out, a direct-message send — so it must obey
 * the same rule they already follow: **never fail the thing that triggered it.** Every failure is
 * caught and logged, because a comment that was written and stored must not be reported as failed
 * just because a phone happened to be offline.
 *
 * Delivery is best-effort by nature. The in-app bell poll remains the source of truth
 * (`hooks/useNotifications.ts`); push is the reason the reader finds out sooner.
 *
 * Three details worth knowing before touching this file:
 *
 *  1. **One subscription, two audiences.** The dashboard and the portals share an origin and a
 *     service worker, so a browser holds exactly one endpoint. What differs per subscription is the
 *     DESTINATION, which is why the URL is computed per row rather than once per send.
 *  2. **`topic` collapses at the push service, `tag` collapses in the tray.** Both are derived from
 *     the thread id: five replies must be one notification, not five.
 *  3. **404/410 means the device is gone → delete the row.** Anything else means we do not know, so
 *     the row stays and only the failure counter moves. Deleting on a transient 5xx would silently
 *     unsubscribe a healthy reader.
 *
 * Node runtime only — `web-push` performs crypto and HTTP that the Edge runtime cannot host.
 * Server-only.
 */

import webPush from "web-push";
import prisma from "@/lib/prisma";
import {
  planIdFromNotificationHref,
  portalHrefForNotification,
  threadIdFromNotificationHref,
} from "@/lib/push/portal-href";
import {
  deletePushSubscriptions,
  isPushCategoryEnabled,
  listPushSubscriptionsForUsers,
  recordPushFailure,
  recordPushSuccess,
  type StoredPushSubscription,
} from "@/lib/push/subscriptions.server";
import {
  pushCategoryForType,
  type PushPayload,
  type PushSurface,
} from "@/lib/push/types";

/** Twelve hours: a notification nobody saw within half a day is stale enough to drop. */
const DEFAULT_TTL_SECONDS = 60 * 60 * 12;

/**
 * Where a dashboard subscriber lands when the notification carries no usable href. The bell has no
 * separate "inbox" page, and `/dashboard` is the surface that shows recent activity and the bell.
 */
const DASHBOARD_FALLBACK = "/dashboard";

interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * Resolved once per process. `undefined` means "not read yet"; `null` means "read, not configured".
 *
 * A missing key is a DEPLOYMENT state, not a per-request error: logging it on every comment would
 * bury real failures, so it is warned once.
 */
let vapidConfig: VapidConfig | null | undefined;

function readVapidConfig(): VapidConfig | null {
  if (vapidConfig !== undefined) return vapidConfig;

  const publicKey = (
    process.env.VAPID_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    ""
  ).trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const subject =
    (process.env.VAPID_SUBJECT ?? "").trim() || "mailto:support@plantel.pro";

  if (!publicKey || !privateKey) {
    console.warn(
      "[push] VAPID keys are not configured — web push is disabled. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.",
    );
    vapidConfig = null;
    return vapidConfig;
  }

  try {
    webPush.setVapidDetails(subject, publicKey, privateKey);
  } catch (error) {
    console.error("[push] VAPID configuration is invalid", error);
    vapidConfig = null;
    return vapidConfig;
  }

  vapidConfig = { publicKey, privateKey, subject };
  return vapidConfig;
}

/**
 * A push-service topic must be 1–32 URL-safe characters. Thread ids are cuids and already qualify,
 * but the shape is enforced rather than assumed — an invalid topic makes `sendNotification` throw,
 * which would turn every message in that thread into a silent failure.
 */
function normalizeTopic(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "");
  return cleaned ? cleaned.slice(0, 32) : undefined;
}

/**
 * Only same-origin absolute paths are delivery targets. The service worker refuses anything else as
 * well; this is the sender's half of the same rule.
 */
function readDashboardPath(href: string | null | undefined): string {
  const value = (href ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return DASHBOARD_FALLBACK;
  }
  return value;
}

/** Distinct plan slugs for the plans these subscriptions care about, keyed by `Client.id`. */
async function resolvePlanSlugs(
  clientIds: Array<string | null>,
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(clientIds.filter((value): value is string => Boolean(value))),
  ];
  if (unique.length === 0) return new Map();

  const rows = await prisma.client.findMany({
    where: { id: { in: unique } },
    select: { id: true, slug: true },
  });

  const slugs = new Map<string, string>();
  for (const row of rows) {
    if (row.slug) slugs.set(row.id, row.slug);
  }
  return slugs;
}

export interface SendPushInput {
  /** Who should be told. Duplicates and blanks are ignored. */
  userIds: string[];
  title: string;
  body?: string | null;
  /** The persisted notification `type` — decides which preference switch governs this send. */
  type: string;
  /** The notification's own href, as stored. Dashboard-shaped; converted per subscription. */
  href?: string | null;
  /** The plan this is about, so portal subscribers can be routed to their portal. */
  clientId?: string | null;
  /** Per-plan icon override (the portal's own logo), when the caller has it. */
  icon?: string | null;
  /** Conversation key: collapses both the tray entry and the push-service notification. */
  threadId?: string | null;
  urgency?: "very-low" | "low" | "normal" | "high";
  ttlSeconds?: number;
}

interface PreparedSend {
  subscription: StoredPushSubscription;
  payload: PushPayload;
}

function buildPayloadFor(
  input: SendPushInput,
  subscription: StoredPushSubscription,
  planSlug: string | null,
): PushPayload {
  const surface: PushSurface = subscription.surface;

  const url =
    surface === "portal"
      ? (portalHrefForNotification({
          href: input.href,
          planSlug,
          // A portal subscriber with no plan hint still gets the portal root rather than a
          // dashboard link they cannot open.
        }) ?? (planSlug ? `/${planSlug}` : DASHBOARD_FALLBACK))
      : readDashboardPath(input.href);

  const topic = normalizeTopic(input.threadId);

  return {
    title: input.title,
    body: input.body ?? "",
    url,
    // Same thread → same tag → the newer notification REPLACES the older one.
    tag: topic ?? null,
    topic: topic ?? null,
    icon: input.icon ?? null,
    type: input.type,
    id: null,
  };
}

/**
 * Deliver one notification to every eligible browser belonging to `userIds`.
 *
 * Resolves when the sends have been attempted. Sends run in parallel and are awaited rather than
 * fired and forgotten: on a serverless host the invocation can be frozen the moment the handler
 * returns, which would silently drop a background send.
 */
export async function sendPushToUsers(input: SendPushInput): Promise<void> {
  try {
    if (input.userIds.length === 0) return;

    // The first release sends for comments and direct messages ONLY. An unmapped type is not a push
    // we have designed for — the team/ownership notifications were never part of this feature — so it
    // returns before touching the database or the VAPID configuration.
    const category = pushCategoryForType(input.type);
    if (!category) return;

    const config = readVapidConfig();
    if (!config) return;
    const subscriptions = await listPushSubscriptionsForUsers(input.userIds);
    if (subscriptions.length === 0) return;

    // The plan hint the caller supplies covers a notification about a plan; a subscription's own
    // `clientId` covers a portal opt-in that arrived without one. Both are consulted.
    // The plan this notification is about. Callers rarely pass it — the notification's own href
    // already names it for every comment link, so the sender reads it back rather than making three
    // call sites remember to forward one more value.
    const planId = input.clientId ?? planIdFromNotificationHref(input.href);

    const planSlugs = await resolvePlanSlugs([
      ...subscriptions.map((subscription) => subscription.clientId),
      planId,
    ]);

    // A conversation key lets every push in one thread collapse, whether or not the caller passed
    // it: comment links carry `?comment=<id>` and direct messages `?messages=<id>`.
    const threadId =
      input.threadId ?? threadIdFromNotificationHref(input.href) ?? null;
    const send: SendPushInput = { ...input, threadId };

    const prepared: PreparedSend[] = [];
    for (const subscription of subscriptions) {
      if (!isPushCategoryEnabled(subscription, category)) continue;
      const planSlug = subscription.clientId
        ? (planSlugs.get(subscription.clientId) ?? null)
        : planId
          ? (planSlugs.get(planId) ?? null)
          : null;
      prepared.push({
        subscription,
        payload: buildPayloadFor(send, subscription, planSlug),
      });
    }
    if (prepared.length === 0) return;

    const gone: string[] = [];
    const healthy: string[] = [];
    const failed: string[] = [];

    await Promise.all(
      prepared.map(async ({ subscription, payload }) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify(payload),
            {
              TTL: send.ttlSeconds ?? DEFAULT_TTL_SECONDS,
              urgency: send.urgency ?? "normal",
              // The DERIVED thread id, not the caller's: most call sites do not pass one and the
              // href already carries it. Using the raw input here would silently lose the
              // push-service collapse for comment replies.
              topic: normalizeTopic(threadId),
            },
          );
          healthy.push(subscription.endpoint);
        } catch (error) {
          const statusCode = (error as { statusCode?: number } | null)
            ?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // The push service no longer knows this device: an uninstalled app, a cleared profile,
            // or an expired endpoint. Pruning is the whole point.
            gone.push(subscription.endpoint);
          } else {
            failed.push(subscription.endpoint);
            console.warn("[push] send failed", statusCode ?? error);
          }
        }
      }),
    );

    // Bookkeeping is best-effort too: a failed UPDATE must not turn a delivered notification into an
    // error for the caller.
    await Promise.all([
      deletePushSubscriptions(gone),
      ...healthy.map((endpoint) =>
        recordPushSuccess(endpoint).catch(() => undefined),
      ),
      ...failed.map((endpoint) =>
        recordPushFailure(endpoint).catch(() => undefined),
      ),
    ]);
  } catch (error) {
    console.error("[push] sendPushToUsers", error);
  }
}
