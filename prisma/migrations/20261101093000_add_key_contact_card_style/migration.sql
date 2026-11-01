-- "Have Questions?" — the key contact's card style, chosen per benefit in Section 8
-- of the editor.
--
-- "default" is the neutral card every hub has always drawn; "highlighted" fills the
-- card with the plan's primary colour and inverts its contents, the same treatment
-- the primary card in "How Can We Help You Today?" uses. The column is NOT NULL with
-- a default so every existing Benefit row keeps its current look.
ALTER TABLE "Benefit"
  ADD COLUMN "keyContactCardStyle" TEXT NOT NULL DEFAULT 'default';
