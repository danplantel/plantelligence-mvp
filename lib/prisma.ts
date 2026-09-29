import { PrismaClient } from '@prisma/client'

/**
 * A single PrismaClient, reused across route bundles and HMR reloads.
 *
 * Creating a fresh client on every module evaluation in `next dev` churns connections: each
 * route bundle ends up holding a disconnected client and the next query pays a full
 * handshake — previously observed as multi-second portal page loads. We therefore only
 * recreate the client when `DATABASE_URL` actually changes (e.g. after editing `.env`).
 *
 * ── Removed by the MongoDB → PostgreSQL migration (plans/postgres-migration.md §P2) ──
 * This module used to carry an IIFE that read `.env` by regex, "forced" `DATABASE_URL` from
 * it, and **discarded any URL that did not start with `mongodb://` — logging a warning and
 * then keeping the previous, wrong value.** That was a workaround for Next.js inlining a
 * stale URL at build time, and on Postgres it silently pointed the app at the wrong
 * database. The datasource in `prisma/schema.prisma` is now the only thing that decides the
 * connection, and it reads both URLs it needs:
 *
 *   DATABASE_URL — the pooled Neon endpoint (carries `pgbouncer=true`).
 *   DIRECT_URL   — the unpooled endpoint, used only by `prisma migrate`.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  databaseUrl: string | undefined
}

const currentDatabaseUrl = process.env.DATABASE_URL

if (
  globalForPrisma.prisma &&
  globalForPrisma.databaseUrl &&
  globalForPrisma.databaseUrl !== currentDatabaseUrl
) {
  globalForPrisma.prisma.$disconnect().catch(() => {})
  globalForPrisma.prisma = undefined
  globalForPrisma.databaseUrl = undefined
}

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient()
  globalForPrisma.databaseUrl = currentDatabaseUrl
}

if (!globalForPrisma.databaseUrl) {
  globalForPrisma.databaseUrl = currentDatabaseUrl
}

const prisma = globalForPrisma.prisma

export { prisma }
export default prisma
