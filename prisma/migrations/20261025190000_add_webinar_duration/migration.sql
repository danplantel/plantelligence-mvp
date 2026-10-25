-- The runtime shown on a webinar card's bottom-right badge. Null on rows saved
-- before this column existed; those are backfilled from the stored MP4 metadata.
ALTER TABLE "Webinar" ADD COLUMN "duration" TEXT;
