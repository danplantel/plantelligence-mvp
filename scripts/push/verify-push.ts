/**
 * Web push verification — the subscription table and its rules.
 *
 *   npx tsx scripts/push/verify-push.ts [--keep]
 *
 * Exercises the REAL data layer (`lib/push/subscriptions.server.ts`) against the configured database:
 *
 *   1. a save inserts one row, and a second save UPSERTS instead of duplicating the device;
 *   2. the unique index on `endpoint` is actually enforced;
 *   3. a save rebinds the endpoint to the current user and clears the failure streak;
 *   4. a subscription belongs to one user — another user cannot read or delete it by endpoint;
 *   5. a portal save resolves and stores a plan id; a dashboard save clears it;
 *   6. preferences round-trip and govern the category filter;
 *   7. deleting the User cascades the subscription away;
 *   8. the dashboard→portal href resolver produces portal routes.
 *
 * Fixtures are `push-verify-*` and are cleaned up unless `--keep` is passed.
 */
import {
  check,
  createPrisma,
  failureCount,
  summary,
} from "../teammates/shared";
import {
  deletePushSubscriptions,
  findPushSubscriptionForEndpoint,
  isPushCategoryEnabled,
  listPushSubscriptionsForUsers,
  readPushEndpoint,
  removePushSubscription,
  savePushSubscription,
} from "../../lib/push/subscriptions.server";
import {
  planIdFromNotificationHref,
  portalHrefForNotification,
} from "../../lib/push/portal-href";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();
const prisma = createPrisma();

const P256DH =
  "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
const AUTH = "tBHItJI5svbpez7KI4CCXg";

const userA = `push-verify-a-${STAMP}@example.test`;
const userB = `push-verify-b-${STAMP}@example.test`;
const endpointA = `https://push.example.test/device-a-${STAMP}`;
const endpointB = `https://push.example.test/device-b-${STAMP}`;

async function createFixtureUser(email: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      name: `Push Verify ${email}`,
      email,
      primaryServiceCategories: [],
    },
    select: { id: true },
  });
  return user.id;
}

async function main(): Promise<void> {
  console.log("\n▶ Web push verification\n");

  // ── Deployment configuration (informational, NOT an assertion) ─────────────
  // Missing keys mean push is silently disabled at runtime, which looks like "nothing happens" in
  // the browser — worth saying out loud rather than discovering it during a demo.
  //
  // Deliberately not a `check()`: the data-layer rules below do not need VAPID keys, so failing the
  // script over an unconfigured environment would make a genuinely healthy database look broken.
  // It is printed as a plain INFO line instead, because a PASS here was previously unconditional and
  // therefore meaningless.
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const configured = Boolean(publicKey && process.env.VAPID_PRIVATE_KEY);

  if (configured) {
    console.log("  INFO  VAPID keys are configured — real sends will work.");
  } else {
    console.log(
      "  INFO  VAPID keys are NOT configured — push is DISABLED in this environment.",
    );
    console.log("        Set VAPID_PUBLIC_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY,");
    console.log("        VAPID_PRIVATE_KEY and VAPID_SUBJECT (see docs/testing/push-tests.md).");
    console.log("        The assertions below still verify the data layer.");
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    console.log(
      "        NOTE: NEXT_PUBLIC_VAPID_PUBLIC_KEY is unset, so the BROWSER cannot subscribe.",
    );
  }

  const userId = await createFixtureUser(userA);
  const otherUserId = await createFixtureUser(userB);

  try {
    // ── 1. Save, then upsert ─────────────────────────────────────────────────
    await savePushSubscription({
      userId,
      endpoint: endpointA,
      p256dh: P256DH,
      auth: AUTH,
      surface: "portal",
      clientId: null,
      userAgent: "verify-push/1",
    });

    const first = await prisma.pushSubscription.findMany({
      where: { endpoint: endpointA },
    });
    check("a save inserts exactly one row", first.length === 1);
    check("the row records the surface", first[0]?.surface === "portal");
    check(
      "the row records the user agent",
      first[0]?.userAgent === "verify-push/1",
    );

    await savePushSubscription({
      userId,
      endpoint: endpointA,
      p256dh: P256DH,
      auth: AUTH,
      surface: "portal",
      clientId: null,
    });

    const afterResave = await prisma.pushSubscription.findMany({
      where: { endpoint: endpointA },
    });
    check(
      "a re-subscribe upserts instead of duplicating the device",
      afterResave.length === 1,
    );

    // ── 2. The unique index ──────────────────────────────────────────────────
    let duplicateRejected = false;
    try {
      await prisma.pushSubscription.create({
        data: {
          endpoint: endpointA,
          p256dh: P256DH,
          auth: AUTH,
          userId,
          surface: "dashboard",
        },
      });
    } catch (error) {
      duplicateRejected =
        (error as { code?: string }).code === "P2002" ||
        String(error).includes("Unique constraint");
    }
    check("the endpoint unique index is enforced", duplicateRejected);

    // ── 3. Rebind + failure reset ────────────────────────────────────────────
    await prisma.pushSubscription.updateMany({
      where: { endpoint: endpointA },
      data: { failureCount: 4 },
    });
    await savePushSubscription({
      userId: otherUserId,
      endpoint: endpointA,
      p256dh: P256DH,
      auth: AUTH,
      surface: "dashboard",
    });

    const rebound = await prisma.pushSubscription.findFirst({
      where: { endpoint: endpointA },
      select: { userId: true, failureCount: true, surface: true },
    });
    check(
      "a save rebinds the endpoint to the current user",
      rebound?.userId === otherUserId,
    );
    check("a save clears the failure streak", rebound?.failureCount === 0);
    check("a dashboard save switches the surface", rebound?.surface === "dashboard");

    // Put it back with the original owner for the remaining checks.
    await savePushSubscription({
      userId,
      endpoint: endpointA,
      p256dh: P256DH,
      auth: AUTH,
      surface: "portal",
    });

    // ── 4. Ownership ─────────────────────────────────────────────────────────
    const asOther = await findPushSubscriptionForEndpoint({
      userId: otherUserId,
      endpoint: endpointA,
    });
    check(
      "another user cannot read this endpoint",
      asOther === null,
      "a row is only visible to the user it is bound to",
    );

    const deletedByOther = await removePushSubscription({
      userId: otherUserId,
      endpoint: endpointA,
    });
    check("another user cannot delete this endpoint", deletedByOther === false);

    const stillThere = await prisma.pushSubscription.findFirst({
      where: { endpoint: endpointA },
    });
    check("the row survives a foreign delete attempt", Boolean(stillThere));

    // ── 5. Portal plan resolution ────────────────────────────────────────────
    const plan = await prisma.client.findFirst({
      where: { slug: { not: null } },
      select: { id: true, slug: true },
    });
    if (plan?.slug) {
      await savePushSubscription({
        userId,
        endpoint: endpointB,
        p256dh: P256DH,
        auth: AUTH,
        surface: "portal",
        clientId: plan.id,
      });
      const portalRow = await findPushSubscriptionForEndpoint({
        userId,
        endpoint: endpointB,
      });
      check(
        "a portal save stores the plan id",
        portalRow?.clientId === plan.id,
      );

      const href = `/edit-benefit/${plan.id}/group-health?comment=thread_x`;
      const mapped = portalHrefForNotification({
        href,
        planSlug: plan.slug,
      });
      check(
        "a benefit comment maps to the portal benefit route",
        mapped === `/${plan.slug}/health-insurance?comment=thread_x`,
        `got ${mapped}`,
      );
      check(
        "the plan is read back out of the notification href",
        planIdFromNotificationHref(href) === plan.id,
      );
    } else {
      console.log("  · no plan with a slug — skipping the plan-href checks");
    }

    // ── 6. Preferences ───────────────────────────────────────────────────────
    await prisma.pushSubscription.updateMany({
      where: { endpoint: endpointA },
      data: { preferences: { comment: false } },
    });
    const withPreferences = await findPushSubscriptionForEndpoint({
      userId,
      endpoint: endpointA,
    });
    check(
      "preferences round-trip",
      withPreferences?.preferences?.comment === false,
    );
    check(
      "an opted-out category is filtered out",
      !isPushCategoryEnabled(withPreferences ?? { preferences: null }, "comment"),
    );
    check(
      "a category that was never switched off still sends",
      isPushCategoryEnabled(
        withPreferences ?? { preferences: null },
        "direct_message",
      ),
    );

    // ── 7. Listing and pruning ───────────────────────────────────────────────
    const listed = await listPushSubscriptionsForUsers([userId, otherUserId]);
    check(
      "the sender's read returns this user's devices",
      listed.some((row) => row.endpoint === endpointA),
    );

    await deletePushSubscriptions([endpointB]);
    const pruned = await prisma.pushSubscription.findFirst({
      where: { endpoint: endpointB },
    });
    check("a pruned endpoint is gone", pruned === null);

    // ── 8. Cascade ───────────────────────────────────────────────────────────
    await prisma.user.delete({ where: { id: userId } });
    const afterCascade = await prisma.pushSubscription.findFirst({
      where: { userId },
    });
    check("deleting the user removes their subscriptions", afterCascade === null);

    // ── 9. Validators ────────────────────────────────────────────────────────
    check(
      "an https endpoint is accepted",
      readPushEndpoint(endpointA) === endpointA,
    );
    check(
      "a non-https endpoint is refused",
      readPushEndpoint("http://example.test/x") === null,
    );
    check(
      "a plan id is not read out of a direct-message link",
      planIdFromNotificationHref("/?messages=t1") === null,
    );
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.pushSubscription
        .deleteMany({ where: { endpoint: { in: [endpointA, endpointB] } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { email: { in: [userA, userB] } } })
        .catch(() => undefined);
    } else {
      console.log(`\n  (--keep) fixtures left in place for ${userA} / ${userB}`);
    }
    await prisma.$disconnect();
  }

  summary("Web push");
  process.exit(failureCount() > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error("[push/verify] unexpected failure", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
