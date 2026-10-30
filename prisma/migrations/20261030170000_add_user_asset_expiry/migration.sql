-- The advisor's .zip library is a 24-hour convenience, not permanent storage.
--
-- `expiresAt` is filled by the database (creation + 24 hours) so the window holds
-- even if a future caller forgets to set it. Reads and writes delete rows whose
-- time has passed before they touch the library, so an expired file is never
-- offered; the sweep also removes the R2 object (see the route).
ALTER TABLE "UserAsset"
  ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL
  DEFAULT (now() + interval '24 hours');

CREATE INDEX "UserAsset_userId_expiresAt_idx" ON "UserAsset"("userId", "expiresAt");
