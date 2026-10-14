-- Assignment provenance for dashboard tasks, and the comment message that announces one.
--
-- An assignment is the one dashboard task that is genuinely stored for somebody OTHER than the
-- reader who created it (see plans/comment-task-assignment.md): work an Owner or Admin hands to a
-- person from inside a comment thread. Derived ("system") tasks stay derived — the assigned row
-- carries the derived task's kind and category, so it can stand in for the derived row on the
-- assignee's dashboard rather than sitting beside it.
--
-- Every column is nullable and additive, so this is safe on a table that already holds rows: an
-- existing task simply has no provenance, which is exactly what a self-authored task is.

ALTER TABLE "Task"
  ADD COLUMN "assignedByUserId" TEXT,
  ADD COLUMN "sourceThreadId"    TEXT,
  ADD COLUMN "sourceMessageId"   TEXT,
  ADD COLUMN "derivedKind"       TEXT,
  ADD COLUMN "benefitCategory"   TEXT,
  ADD COLUMN "dueAt"             TIMESTAMP(3);

CREATE INDEX "Task_assignedByUserId_idx" ON "Task"("assignedByUserId");
CREATE INDEX "Task_sourceThreadId_idx" ON "Task"("sourceThreadId");
-- The de-duplication read: "does this reader hold an assignment covering this derived row?"
CREATE INDEX "Task_userId_clientId_derivedKind_idx" ON "Task"("userId", "clientId", "derivedKind");

-- The message kind. `kind` is added with a DEFAULT, so existing rows become comments in the same
-- statement and no backfill UPDATE is needed — which is also what the default asserts.
ALTER TABLE "CommentMessage"
  ADD COLUMN "kind"   TEXT NOT NULL DEFAULT 'comment',
  ADD COLUMN "taskId" TEXT;

-- "Which card reports on this task?" — read when a task is completed or withdrawn, so the thread
-- can show the state rather than going quiet about work it asked for.
CREATE INDEX "CommentMessage_taskId_idx" ON "CommentMessage"("taskId");
