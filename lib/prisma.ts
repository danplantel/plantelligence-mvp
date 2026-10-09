import { PrismaClient } from '@prisma/client'

/**
 * A single PrismaClient, reused across route bundles and HMR reloads.
 *
 * Creating a fresh client on every module evaluation in `next dev` churns connections: each
 * route bundle ends up holding a disconnected client and the next query pays a full
 * handshake — previously observed as multi-second portal page loads. We therefore only
 * recreate the client when the connection URL actually changes (e.g. after editing `.env`).
 *
 * ── Removed by the MongoDB → PostgreSQL migration (plans/postgres-migration.md §P2) ──
 * This module used to carry an IIFE that read `.env` by regex, "forced" `DATABASE_URL` from
 * it, and **discarded any URL that did not start with `mongodb://` — logging a warning and
 * then keeping the previous, wrong value.** That was a workaround for Next.js inlining a
 * stale URL at build time, and on Postgres it silently pointed the app at the wrong
 * database. The datasource in `prisma/schema.prisma` is now the only thing that decides the
 * default connection, and it reads both URLs it needs:
 *
 *   DATABASE_URL — the pooled Neon endpoint (carries `pgbouncer=true`).
 *   DIRECT_URL   — the unpooled endpoint, used by `prisma migrate`.
 *
 * ── `PRISMA_USE_DIRECT_URL` (development escape hatch) ────────────────────────────────
 * The pooled endpoint is right for a serverless deployment — PgBouncer absorbs the
 * connection churn — but it is a separate Neon service, and when it is unreachable every
 * query fails with `P1001` while the unpooled `DIRECT_URL` keeps answering (`prisma migrate
 * deploy` proves it, since it uses that host). Setting
 *
 *   PRISMA_USE_DIRECT_URL=true
 *
 * in `.env` points ordinary queries at `DIRECT_URL` so work can continue. It is opt-in and
 * off by default, so production keeps using the pooler.
 *
 * ── Transient-connection retry ────────────────────────────────────────────────────────
 * Even a healthy endpoint occasionally refuses a connection. Purely connection-level
 * failures (`P1001`/`P1002`/`P1017`, or a matching message) are replayed a couple of times,
 * because the query never reached the database. Real errors — a constraint violation, a
 * validation refusal — propagate on the first throw, unchanged.
 */

/** Prisma codes and messages that mean "the database was not reachable", not "it said no". */
const TRANSIENT_CODES = new Set(['P1001', 'P1002', 'P1017'])
const TRANSIENT_MESSAGE =
  /can't reach database server|timed out fetching a new connection|connection (?:to the database server )?(?:was )?closed|server has closed the connection/i

/** Total attempts per operation, including the first. */
const MAX_ATTEMPTS = 3
/** Base backoff; attempt N waits BASE_DELAY_MS * N. */
const BASE_DELAY_MS = 150

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as { code?: unknown; errorCode?: unknown }
  if (typeof candidate.code === 'string') return candidate.code
  if (typeof candidate.errorCode === 'string') return candidate.errorCode
  return undefined
}

function isTransientConnectionError(error: unknown): boolean {
  const code = errorCode(error)
  if (code && TRANSIENT_CODES.has(code)) return true
  const message = error instanceof Error ? error.message : ''
  return TRANSIENT_MESSAGE.test(message)
}

async function withConnectionRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (attempt === MAX_ATTEMPTS || !isTransientConnectionError(error)) {
        throw error
      }
      await new Promise((resolve) =>
        setTimeout(resolve, BASE_DELAY_MS * attempt),
      )
    }
  }
  throw lastError
}

/**
 * The URL ordinary queries use: the pooler by default, the direct endpoint when
 * `PRISMA_USE_DIRECT_URL=true`. See the note above.
 */
function resolveQueryUrl(): string | undefined {
  const direct = process.env.DIRECT_URL
  if (process.env.PRISMA_USE_DIRECT_URL === 'true' && direct) return direct
  return process.env.DATABASE_URL
}

/**
 * Build the client with the chosen URL and the retry extension.
 *
 * `$extends` returns a structurally different (extended) type, so the result is cast back to
 * `PrismaClient`: the extension is a runtime query hook, and every call site keeps the
 * ordinary generated types. Casting hides the hook from the type system only.
 */
function createPrismaClient(url: string | undefined): PrismaClient {
  const base = new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
  })
  return base.$extends({
    query: {
      $allOperations({ args, query }) {
        return withConnectionRetry(() => query(args))
      },
    },
  }) as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  connectionUrl: string | undefined
}

const currentConnectionUrl = resolveQueryUrl()

if (
  globalForPrisma.prisma &&
  globalForPrisma.connectionUrl !== currentConnectionUrl
) {
  globalForPrisma.prisma.$disconnect().catch(() => {})
  globalForPrisma.prisma = undefined
  globalForPrisma.connectionUrl = undefined
}

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient(currentConnectionUrl)
  globalForPrisma.connectionUrl = currentConnectionUrl
}

const prisma = globalForPrisma.prisma

export { prisma }
export default prisma
