-- Where an organization's org-level R2 objects were written, when that is no longer its owner.
--
-- `resolveObjectAccess` (lib/teammates/access.server.ts) authorizes an org-level key —
-- `org/{segment}/uploads/{subPath}/…`, which is where the advisor headshot and the advisor logo
-- live — by resolving the SEGMENT back to an organization:
--
--   findFirst({ where: { ownerUserId: orgSegment } })
--
-- The segment is a user id, written at upload time. It therefore names the owner as of the upload,
-- and it can never be migrated when ownership changes without re-keying every stored object. On an
-- ownership handover that lookup would match nothing, and every pre-existing org-level file would
-- 403 for everyone including the new owner.
--
-- This column records the segment instead, so it keeps resolving. Nullable and additive: every
-- existing organization has never been handed over, so NULL is both the correct value and the
-- value that means "the owner's own id is still the segment".

ALTER TABLE "Organization" ADD COLUMN "storageAnchorUserId" TEXT;
