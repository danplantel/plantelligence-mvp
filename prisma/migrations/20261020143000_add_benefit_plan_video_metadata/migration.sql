-- Plan-video metadata shown on the benefit hub's journey section: a short
-- content label ("Advisor Intro", "This benefit", "Our Services") and a poster
-- image (uploaded, captured from the video, or an external URL). Both nullable:
-- existing rows keep rendering exactly as before.
ALTER TABLE "Benefit" ADD COLUMN "planVideoLabel" TEXT;
ALTER TABLE "Benefit" ADD COLUMN "planVideoThumbnail" TEXT;
