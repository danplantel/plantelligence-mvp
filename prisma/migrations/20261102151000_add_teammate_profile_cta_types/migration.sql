-- Every call-to-action on a Team Seat's own contact card, in the person's order.
--
-- `ctaType` (added with the rest of the card group) holds ONE action. The card now
-- supports two, side by side, and the same rule is enforced by `lib/contact-cta` in
-- every contact editor. The single value stays as the FIRST choice so readers that
-- predate the array keep working.
--
-- Existing seats start with an empty array: their `ctaType` is still read as the
-- one-entry fallback, so no card loses the button it already had.
ALTER TABLE "TeammateProfile"
  ADD COLUMN "ctaTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
