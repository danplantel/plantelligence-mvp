-- Direct messages: make the canonical participant order an ENFORCED invariant.
--
-- The compound unique on (organizationId, userAId, userBId) only means "one thread per pair" if
-- every writer sorts the two ids the same way. A swapped insert is a DIFFERENT tuple, and
-- PostgreSQL accepts it without complaint — a twin conversation nobody would ever notice, because
-- each participant's list would show one of the two. This was measured, not assumed: the phase-1
-- probe inserted `(org, B, A)` beside `(org, A, B)` and the database allowed it.
--
-- So the order becomes a CHECK. Prisma's schema language cannot express a CHECK constraint, which
-- is why this lives in SQL only — the same situation as the partial unique index on `Client.slug`
-- (see `npm run repair:partial-indexes`), and the reason the schema comment points here.
--
-- The comparison is pinned to the "C" collation so it does not depend on the database's default
-- collation. Every id in play is a cuid — lowercase ASCII alphanumerics — and for those, "C"
-- order, byte order and the JavaScript `.sort()` the writers use all agree, so a row the app
-- considers canonical can never be refused here.
ALTER TABLE "DirectThread"
  ADD CONSTRAINT "DirectThread_pair_order_check"
  CHECK ("userAId" COLLATE "C" < "userBId" COLLATE "C");
