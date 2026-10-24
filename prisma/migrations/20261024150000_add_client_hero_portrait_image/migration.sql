-- The welcome banner's circular portrait: the image the advisor chose to show
-- instead of the category's key contact headshot. Null keeps the headshot.
ALTER TABLE "Client" ADD COLUMN "heroPortraitImage" TEXT;
