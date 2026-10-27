-- TF-1 · Topic + Placement foundation.
--
-- Additive by design. `Benefit.helpCards` and `Benefit.faqs` remain the live source
-- for every plan until the read path is switched per plan, so this migration can
-- ship dark and be rolled back by flipping that switch rather than restoring data.
--
--   Topic          the content, written once, shared across plans
--   TopicPlacement one topic on one plan in one location (display mode, order,
--                  overrides). The clientId/topicId/location unique is what makes
--                  seeding idempotent.
--   AccordionGroup a named Quick Answers group for one plan + location.

-- CreateEnum
CREATE TYPE "TopicScope" AS ENUM ('system', 'org');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "TopicDisplayMode" AS ENUM ('featured', 'quick_answers', 'hidden');

-- CreateEnum
CREATE TYPE "TopicLocation" AS ENUM ('retirement', 'group_health', 'group_life', 'custom', 'employee_resources');

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "scope" "TopicScope" NOT NULL DEFAULT 'system',
    "organizationId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "iconKey" TEXT,
    "imageKey" TEXT,
    "bodyBlocks" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultLocations" "TopicLocation"[] DEFAULT ARRAY[]::"TopicLocation"[],
    "isActionHub" BOOLEAN NOT NULL DEFAULT false,
    "defaultCta" JSONB,
    "status" "TopicStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccordionGroup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "location" "TopicLocation" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccordionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicPlacement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "location" "TopicLocation" NOT NULL,
    "displayMode" "TopicDisplayMode" NOT NULL DEFAULT 'featured',
    "groupId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "overrides" JSONB,
    "actionHubLink" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_scope_idx" ON "Topic"("scope");

-- CreateIndex
CREATE INDEX "Topic_organizationId_idx" ON "Topic"("organizationId");

-- CreateIndex
CREATE INDEX "Topic_status_idx" ON "Topic"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AccordionGroup_clientId_location_name_key" ON "AccordionGroup"("clientId", "location", "name");

-- CreateIndex
CREATE INDEX "AccordionGroup_clientId_location_sortOrder_idx" ON "AccordionGroup"("clientId", "location", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TopicPlacement_clientId_topicId_location_key" ON "TopicPlacement"("clientId", "topicId", "location");

-- CreateIndex
CREATE INDEX "TopicPlacement_clientId_location_sortOrder_idx" ON "TopicPlacement"("clientId", "location", "sortOrder");

-- CreateIndex
CREATE INDEX "TopicPlacement_topicId_idx" ON "TopicPlacement"("topicId");

-- CreateIndex
CREATE INDEX "TopicPlacement_groupId_idx" ON "TopicPlacement"("groupId");

-- AddForeignKey
ALTER TABLE "AccordionGroup"
  ADD CONSTRAINT "AccordionGroup_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicPlacement"
  ADD CONSTRAINT "TopicPlacement_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicPlacement"
  ADD CONSTRAINT "TopicPlacement_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicPlacement"
  ADD CONSTRAINT "TopicPlacement_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "AccordionGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
