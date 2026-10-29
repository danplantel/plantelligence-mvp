-- Web push subscriptions.
--
-- One row per BROWSER, not per installed app: the dashboard and every plan portal share one origin
-- and one service worker, so a device holds a single subscription no matter how many "apps" it
-- installed. `surface` records where the reader opted in for AUDIENCE filtering; there is only one
-- delivery channel. See plans/web-push-notifications.md.
--
-- `endpoint` is UNIQUE because it IS the device. A browser that re-subscribes presents the same
-- endpoint, so the API upserts rather than accumulating duplicate rows that would each be pushed to.
--
-- `userId` cascades: the account-deletion paths must not have to know this table exists, exactly as
-- with Notification.
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surface" TEXT NOT NULL DEFAULT 'dashboard',
    "clientId" TEXT,
    "preferences" JSONB,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- The send path's read: "every live endpoint for these users".
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
-- Audience reads, and the prune of a plan's stale portal subscriptions.
CREATE INDEX "PushSubscription_surface_clientId_idx" ON "PushSubscription"("surface", "clientId");

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
