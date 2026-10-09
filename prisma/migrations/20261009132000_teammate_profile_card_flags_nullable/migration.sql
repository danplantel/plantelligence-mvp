-- Make the card display flags tri-state.
--
-- The first version defaulted them to FALSE, but the portal reads `displayEmail ===
-- false` as "hide this", so a FALSE default would have hidden every existing card's
-- email and phone. NULL instead means "never configured" and the cards keep showing
-- the contact details as they always have; TRUE/FALSE are explicit choices.
--
-- The columns are brand new and nothing has written a real value yet, so any FALSE
-- they carry is a default, not a decision — normalize it to NULL.
ALTER TABLE "TeammateProfile"
  ALTER COLUMN "displayEmail"        DROP NOT NULL,
  ALTER COLUMN "displayEmail"        DROP DEFAULT,
  ALTER COLUMN "displayPhone"        DROP NOT NULL,
  ALTER COLUMN "displayPhone"        DROP DEFAULT,
  ALTER COLUMN "enableContactButton" DROP NOT NULL,
  ALTER COLUMN "enableContactButton" DROP DEFAULT;

UPDATE "TeammateProfile"
  SET "displayEmail"        = NULL,
      "displayPhone"        = NULL,
      "enableContactButton" = NULL;
