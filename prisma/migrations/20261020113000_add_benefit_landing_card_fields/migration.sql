-- Dedicated copy for the landing page "Benefits at a Glance" card. The card used
-- to borrow the hub's inner-header image and intro message; these columns let it
-- be edited independently, while readers fall back to the old fields when empty.
ALTER TABLE "Benefit" ADD COLUMN "landingCardImage" TEXT;
ALTER TABLE "Benefit" ADD COLUMN "landingCardBody" TEXT;
