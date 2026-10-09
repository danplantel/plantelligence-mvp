-- Figma-style comments: a thread anchored to a section (or a selected text range)
-- of a Plan (Client) or a Benefit (Client + category), plus its messages.
--
-- `clientId` cascades, so deleting a plan removes its threads and messages with it.
-- The author ids are plain scalars on purpose: deleting a login must NOT erase the
-- comment history, so the UI can still render it with a "Removed user" fallback.
CREATE TABLE "CommentThread" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "benefitCategory" TEXT,
    "anchorKind" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "fieldKey" TEXT,
    "rangeStart" INTEGER,
    "rangeEnd" INTEGER,
    "quote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommentMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommentThread_organizationId_clientId_idx" ON "CommentThread"("organizationId", "clientId");
CREATE INDEX "CommentThread_clientId_benefitCategory_idx" ON "CommentThread"("clientId", "benefitCategory");
CREATE INDEX "CommentThread_clientId_resolvedAt_idx" ON "CommentThread"("clientId", "resolvedAt");
CREATE INDEX "CommentMessage_threadId_createdAt_idx" ON "CommentMessage"("threadId", "createdAt");

ALTER TABLE "CommentThread"
  ADD CONSTRAINT "CommentThread_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommentMessage"
  ADD CONSTRAINT "CommentMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "CommentThread"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
