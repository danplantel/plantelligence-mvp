-- Organization disclosures review status + confirmation audit trail.
--
-- `Organization.disclosuresReviewed` / `disclosuresReviewedAt` drive the
-- dashboard "Disclosures not reviewed" alert (Owner/Admin/Editor while false).
-- `DisclosureAttestation` records every confirmation (who, org, when, template
-- version, attestation version, and context: onboarding / settings / plan).
ALTER TABLE "Organization"
  ADD COLUMN "disclosuresReviewed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "disclosuresReviewedAt" TIMESTAMP(3);

CREATE TABLE "DisclosureAttestation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "planId" TEXT,
  "disclosureVersion" INTEGER NOT NULL,
  "attestationVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisclosureAttestation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DisclosureAttestation_organizationId_idx" ON "DisclosureAttestation"("organizationId");
CREATE INDEX "DisclosureAttestation_userId_idx" ON "DisclosureAttestation"("userId");
