-- "Currently typing" on a comment thread: one row per (thread, person).
--
-- A table rather than two columns on the thread because a comment thread has NO fixed pair of
-- participants — anyone who can comment on the surface can take part, so the set of potential
-- typers is unbounded and cannot be laid out as `a`/`b` the way `DirectThread` does it.
--
-- Expiry is by TIMESTAMP, not by an event: the reader applies a TTL to `pingedAt`, so the signal
-- decays on its own and nothing has to send a "stopped typing" message. Stale rows are pruned when
-- the surface is read, so the table tracks who is typing now rather than everyone who ever did.
--
-- `userId` is a plain scalar with no FK on purpose, matching `CommentMessage.authorUserId`: a
-- comment thread survives a deleted login, so a typing row must be able to vanish with nothing
-- trailing it. The FK that does exist is on the thread, so deleting a plan takes these with it.
CREATE TABLE "CommentTyping" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pingedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentTyping_pkey" PRIMARY KEY ("id")
);

-- One row per person per thread, so a repeated ping is an upsert rather than a new row.
CREATE UNIQUE INDEX "CommentTyping_threadId_userId_key" ON "CommentTyping"("threadId", "userId");

-- The surface read is "these threads, pinged since the cutoff".
CREATE INDEX "CommentTyping_threadId_pingedAt_idx" ON "CommentTyping"("threadId", "pingedAt");

ALTER TABLE "CommentTyping"
  ADD CONSTRAINT "CommentTyping_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "CommentThread"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
