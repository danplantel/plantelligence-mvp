-- Image shown in the journey section when a plan has no video (upload / gallery
-- pick from the Video Source editor). Null falls back to the category's stock image.
ALTER TABLE "Benefit" ADD COLUMN "planVideoFallbackImage" TEXT;
