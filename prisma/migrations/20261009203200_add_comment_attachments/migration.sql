-- Files attached to a comment message, stored as JSON:
--   [{ key, name, type, size }]
--
-- `key` is the R2 object key, under `org/{ownerUserId}/plans/{clientId}/comments/…`,
-- so /api/r2/object already authorizes reads against the caller's plan assignment.
ALTER TABLE "CommentMessage" ADD COLUMN "attachments" JSONB;
