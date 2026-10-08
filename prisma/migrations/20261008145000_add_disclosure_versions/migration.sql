-- Disclosure revision history.
--
-- Each committed disclosure save writes a NEW immutable `DisclosureVersion`
-- row (never overwritten, so the revision tied to published content survives),
-- and bumps `Organization.disclosuresCurrentVersion`. An edit clears the
-- reviewed flag until the new revision is re-attested.
ALTER TABLE "Organization"
  ADD COLUMN "disclosuresCurrentVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "DisclosureVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "disclosures" JSONB NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "planId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisclosureVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DisclosureVersion_organizationId_version_key" ON "DisclosureVersion"("organizationId", "version");
CREATE INDEX "DisclosureVersion_organizationId_idx" ON "DisclosureVersion"("organizationId");
