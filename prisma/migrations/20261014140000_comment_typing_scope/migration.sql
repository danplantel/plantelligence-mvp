-- Comment typing gains a SURFACE scope, for the rail's persistent composer.
--
-- The composer at the bottom of the panel composes a NEW thread, so there is no thread id to
-- attribute a typing signal to. Rather than bolt on a second nullable column and a second unique
-- index, both kinds of scope collapse into one always-present `scopeKey`:
--
--   `thread:{threadId}`                          — a reply to an existing thread
--   `surface:{clientId}:{targetType}:{category}` — the persistent composer
--
-- One non-null unique index then covers both, with no reliance on PostgreSQL treating NULLs as
-- distinct. `threadId` stays only for the cascade, and becomes nullable because a surface row has
-- no thread to point at.
--
-- The three steps (add nullable, backfill, set NOT NULL) are what make this safe on a table that
-- might already hold rows from before this migration.

ALTER TABLE "CommentTyping" ADD COLUMN "scopeKey" TEXT;

UPDATE "CommentTyping"
SET "scopeKey" = 'thread:' || "threadId"
WHERE "scopeKey" IS NULL;

ALTER TABLE "CommentTyping" ALTER COLUMN "scopeKey" SET NOT NULL;

-- A surface row has no thread, so the column must accept NULL.
ALTER TABLE "CommentTyping" ALTER COLUMN "threadId" DROP NOT NULL;

DROP INDEX "CommentTyping_threadId_userId_key";
DROP INDEX "CommentTyping_threadId_pingedAt_idx";

-- ONE unique for both scopes, on a column that is never NULL.
CREATE UNIQUE INDEX "CommentTyping_scopeKey_userId_key" ON "CommentTyping"("scopeKey", "userId");

-- The read is "these scopes, pinged since the cutoff".
CREATE INDEX "CommentTyping_scopeKey_pingedAt_idx" ON "CommentTyping"("scopeKey", "pingedAt");
