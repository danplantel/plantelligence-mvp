export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrgSession } from "@/lib/organization-session";
import { planIdOrSlug } from "@/lib/plan-lookup";
import {
  findPushSubscriptionForEndpoint,
  readPushEndpoint,
  readPushKey,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/push/subscriptions.server";
import {
  isPushCategory,
  isPushSurface,
  type PushPreferences,
} from "@/lib/push/types";

/**
 * /api/push/subscribe — the server half of a browser's web-push handshake.
 *
 * Every method is scoped by the SESSION `userId`, and the `DELETE` is additionally scoped inside the
 * query. That second check is the important one: an endpoint is a bearer capability on the push
 * service, so a caller who knows somebody else's endpoint must not be able to unregister their
 * device — or, worse, re-register it to themselves. `POST` therefore always rebinds to the current
 * session rather than trusting anything in the body.
 */

/** Resolve the portal's plan slug to a real `Client.id`, or null when it names no plan. */
async function resolvePlanId(value: unknown): Promise<string | null> {
  if (typeof value !== "string" || !value.trim()) return null;
  const plan = await prisma.client.findFirst({
    where: planIdOrSlug(value.trim()),
    select: { id: true },
  });
  return plan?.id ?? null;
}

function readPreferences(value: unknown): PushPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const preferences: PushPreferences = {};
  let sawKnownKey = false;
  for (const [key, enabled] of Object.entries(source)) {
    if (!isPushCategory(key)) continue;
    sawKnownKey = true;
    // Only `false` is meaningful — a missing key already means enabled, and storing `true` for
    // every default would freeze today's defaults into the row.
    if (enabled === false) preferences[key] = false;
  }
  // A body of nothing but unknown keys is a client/server contract mismatch, not an empty
  // preference set; refusing it is louder than silently wiping the reader's opt-outs.
  return sawKnownKey ? preferences : null;
}

/** POST — record or refresh this browser's subscription for the signed-in user. */
export async function POST(request: NextRequest) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    const endpoint = readPushEndpoint(body?.endpoint);
    const rawKeys = body?.keys;
    const keys =
      rawKeys && typeof rawKeys === "object"
        ? (rawKeys as Record<string, unknown>)
        : null;
    const p256dh = readPushKey(keys?.p256dh);
    const auth = readPushKey(keys?.auth);
    const rawSurface = body?.surface;
    const surface = isPushSurface(rawSurface) ? rawSurface : "dashboard";

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "A push subscription needs an endpoint and both keys" },
        { status: 400 },
      );
    }

    // Only a portal opt-in carries a plan, and an unresolvable slug is not an error: the reader is
    // simply subscribed without a plan hint, which still delivers — the sender just falls back to
    // the notification's own href when it needs a destination.
    const clientId =
      surface === "portal" ? await resolvePlanId(body?.planSlug) : null;

    await savePushSubscription({
      userId: session.userId,
      endpoint,
      p256dh,
      auth,
      surface,
      clientId,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[push/subscribe] POST", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** GET — is THIS endpoint registered for the caller? The Settings toggle's initial state. */
export async function GET(request: NextRequest) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const endpoint = readPushEndpoint(
      request.nextUrl.searchParams.get("endpoint"),
    );
    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing or invalid endpoint" },
        { status: 400 },
      );
    }

    const registration = await findPushSubscriptionForEndpoint({
      userId: session.userId,
      endpoint,
    });

    return NextResponse.json({
      success: true,
      subscribed: Boolean(registration),
      surface: registration?.surface ?? null,
      // The real switch positions, so the UI does not paint every toggle "on" and then correct
      // itself a moment later.
      preferences: registration?.preferences ?? {},
    });
  } catch (error) {
    console.error("[push/subscribe] GET", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** DELETE — forget this endpoint for the caller. */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const endpoint = readPushEndpoint(body?.endpoint);
    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing or invalid endpoint" },
        { status: 400 },
      );
    }

    const removed = await removePushSubscription({
      userId: session.userId,
      endpoint,
    });
    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error("[push/subscribe] DELETE", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** PATCH — replace the caller's per-category opt-outs for this endpoint. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getOrgSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const endpoint = readPushEndpoint(body?.endpoint);
    const preferences = readPreferences(body?.preferences);
    if (!endpoint || !preferences) {
      return NextResponse.json(
        { error: "Missing endpoint or unrecognised preferences" },
        { status: 400 },
      );
    }

    const result = await prisma.pushSubscription.updateMany({
      // Scoped by userId for the same reason DELETE is: an endpoint is a capability, not an
      // identifier a stranger may act on.
      where: { endpoint, userId: session.userId },
      data: { preferences },
    });

    return NextResponse.json({ success: true, updated: result.count > 0 });
  } catch (error) {
    console.error("[push/subscribe] PATCH", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
