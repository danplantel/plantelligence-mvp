-- TF-6 · Employee Resources hub
--
-- The fifth location is opt-in per plan. It is NOT a benefit category: no `Benefit` row
-- is created for it, so it cannot affect the 1–4 category limit or the Create Benefits
-- completion state. Additive only — every existing plan keeps the portal it has today.

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "employeeResourcesEnabled" BOOLEAN NOT NULL DEFAULT false;
