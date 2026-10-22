-- Editor's "Show on page" toggle for the Benefit Hub video section.
-- Existing rows keep their video: the column defaults to true.
ALTER TABLE "Benefit"
  ADD COLUMN IF NOT EXISTS "planVideoVisible" BOOLEAN NOT NULL DEFAULT true;
