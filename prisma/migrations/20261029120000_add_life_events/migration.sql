-- TF-8 · Life Events
--
-- A Life Event is a view over placements, not new content: `LifeEventStep.placementId`
-- is what makes that true, so a step can never point at a topic the plan does not have.
-- Additive only; no existing table changes shape.

CREATE TABLE IF NOT EXISTS "LifeEvent" (
  "id"           TEXT NOT NULL,
  "clientId"     TEXT NOT NULL,
  "key"          TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "deadlineDays" INTEGER,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LifeEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LifeEventStep" (
  "id"            TEXT NOT NULL,
  "lifeEventId"   TEXT NOT NULL,
  "placementId"   TEXT,
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "labelOverride" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LifeEventStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LifeEvent_clientId_key_key"
  ON "LifeEvent"("clientId", "key");
CREATE INDEX IF NOT EXISTS "LifeEvent_clientId_sortOrder_idx"
  ON "LifeEvent"("clientId", "sortOrder");
CREATE INDEX IF NOT EXISTS "LifeEventStep_lifeEventId_sortOrder_idx"
  ON "LifeEventStep"("lifeEventId", "sortOrder");
CREATE INDEX IF NOT EXISTS "LifeEventStep_placementId_idx"
  ON "LifeEventStep"("placementId");

ALTER TABLE "LifeEvent"
  ADD CONSTRAINT "LifeEvent_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LifeEventStep"
  ADD CONSTRAINT "LifeEventStep_lifeEventId_fkey"
  FOREIGN KEY ("lifeEventId") REFERENCES "LifeEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LifeEventStep"
  ADD CONSTRAINT "LifeEventStep_placementId_fkey"
  FOREIGN KEY ("placementId") REFERENCES "TopicPlacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
