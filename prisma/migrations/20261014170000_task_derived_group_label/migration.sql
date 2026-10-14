-- The needs-attention heading a derived assignment came from.
--
-- An offer in the assign dialog is an INNER task — "No support contact assigned" — underneath a
-- heading like "Incomplete benefit: Group Life". The heading cannot be rebuilt from the columns the
-- task already keeps: `derivedKind` is the KIND ("incomplete-benefit") and the heading carries the
-- category, the count, or a different phrase entirely for other kinds ("No disclaimers configured").
-- So it is stored, and travels to the card and the dashboard row.
--
-- Nullable and additive: every existing task simply has none, which is exactly what a self-authored
-- or manually-titled assignment is.

ALTER TABLE "Task" ADD COLUMN "derivedGroupLabel" TEXT;
