-- Per-user "library" of files the advisor brought in with a .zip, so the same
-- archive never has to be dragged into another upload section again.
--
-- `kind` is "image" or "document": the image uploaders only ever see the former
-- and the documents uploader only the latter, so a PDF is never offered as a
-- logo (or a logo as a plan document).
--
-- The bytes live in R2 (`org/{userId}/library/…`); this table is the index. The
-- `userId` foreign key cascades, so deleting a User takes their library with it.
CREATE TABLE "UserAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "sourceZipName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAsset_userId_kind_idx" ON "UserAsset"("userId", "kind");
CREATE INDEX "UserAsset_userId_createdAt_idx" ON "UserAsset"("userId", "createdAt");
-- The de-duplication read: re-dropping the same archive must not clone its files.
CREATE INDEX "UserAsset_userId_fileName_size_idx" ON "UserAsset"("userId", "fileName", "size");

ALTER TABLE "UserAsset"
  ADD CONSTRAINT "UserAsset_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
