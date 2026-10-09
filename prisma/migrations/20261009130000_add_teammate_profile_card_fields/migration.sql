-- Card-only fields for TeammateProfile: the "Show on contact card" toggles and the
-- call-to-action group, plus the card's own contact-type choice.
--
-- Historically these lived only on `Client.keyContacts` / `Benefit.supportContacts[]`
-- because a teammate had no card surface of their own. They are copied onto the seat so
-- an invited teammate can configure their card when they accept an invitation, and
-- `buildHubContacts` reads them back onto the portal card.
--
-- Boolean columns carry a FALSE default so every existing profile keeps the historical
-- "nothing displayed" behaviour (the portal cards already treat a missing flag as
-- hidden). Nullable text/json columns stay NULL for profiles that never set them.
ALTER TABLE "TeammateProfile"
  ADD COLUMN "cardContactType"     TEXT,
  ADD COLUMN "displayEmail"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "displayPhone"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "enableContactButton" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ctaType"             TEXT,
  ADD COLUMN "schedulingUrl"       TEXT,
  ADD COLUMN "websiteUrl"          TEXT,
  ADD COLUMN "contactFormTopics"   JSONB;
