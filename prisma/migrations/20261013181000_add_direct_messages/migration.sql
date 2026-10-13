-- Direct messages: a private 1:1 conversation between two logins in one organization.
-- See plans/direct-messages.md.
--
-- `organizationId` is a plain scalar, like every teammate row (this layer's FKs stop at
-- `User`), so PostgreSQL enforces NOTHING for the organization and
-- lib/teammates/organization-cleanup.server.ts sweeps it explicitly. That sweep is not
-- optional: two COLLABORATORS can hold a thread in an organization whose owner then deletes
-- their account, and neither collaborator's `User` row is removed by that — so without the
-- sweep the thread survives pointing at a deleted organization, which is exactly the orphan
-- `verify-backfill` exists to catch.
--
-- The participants, by contrast, DO have real foreign keys with ON DELETE CASCADE —
-- deliberately the opposite of `CommentMessage.authorUserId`, which is a plain scalar so a
-- comment survives its author and plan history stays readable. A private conversation must not
-- outlive either participant, and deleting the second one must take the messages with it
-- (which the `DirectMessage` FK does in turn).
--
-- `userAId`/`userBId` are stored in a canonical order (sorted at write time), so the compound
-- unique means "one thread per pair per organization" and opening a conversation is an upsert.
CREATE TABLE "DirectThread" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "aReadAt" TIMESTAMP(3),
    "bReadAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- The conversation list is "my threads, newest activity first", which is exactly these two.
CREATE INDEX "DirectThread_userAId_lastMessageAt_idx" ON "DirectThread"("userAId", "lastMessageAt");
CREATE INDEX "DirectThread_userBId_lastMessageAt_idx" ON "DirectThread"("userBId", "lastMessageAt");
CREATE UNIQUE INDEX "DirectThread_organizationId_userAId_userBId_key" ON "DirectThread"("organizationId", "userAId", "userBId");
CREATE INDEX "DirectMessage_threadId_createdAt_idx" ON "DirectMessage"("threadId", "createdAt");

ALTER TABLE "DirectThread"
  ADD CONSTRAINT "DirectThread_userAId_fkey"
  FOREIGN KEY ("userAId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectThread"
  ADD CONSTRAINT "DirectThread_userBId_fkey"
  FOREIGN KEY ("userBId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectMessage"
  ADD CONSTRAINT "DirectMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "DirectThread"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
