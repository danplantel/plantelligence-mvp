-- "How Can We Help You Today?" — how many cards share a row, chosen per benefit in
-- the Card Layout section of the editor.
--
-- 3 is the classic three-column grid (the Primary card takes two of the three
-- columns); 4 is the denser grid, where no card may be wider than two of the four
-- columns. NULL means the shipped default (3), so every existing Benefit row keeps
-- the layout it has today.
ALTER TABLE "Benefit"
  ADD COLUMN "helpCardColumns" INTEGER;
