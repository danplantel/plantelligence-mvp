import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

// ── Force DATABASE_URL from .env ──────────────────────────────────────────
// Next.js webpack DefinePlugin replaces process.env.DATABASE_URL at compile
// time with a value that may not match the project's .env file (observed
// with a stale postgresql:// URL being injected).  To guarantee the Prisma
// client always uses the correct MongoDB URL from the project's .env, we
// read it directly and overwrite process.env.DATABASE_URL on every module
// load, before any PrismaClient is instantiated.
// ─────────────────────────────────────────────────────────────────────────

;(function ensureMongoUrl() {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (!fs.existsSync(envPath)) return

    const content = fs.readFileSync(envPath, 'utf-8')
    const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m)
    if (!match?.[1]) return

    const envUrl = match[1].trim()
    if (!envUrl.startsWith('mongodb')) {
      console.warn('[prisma] Skipping .env DATABASE_URL — not a MongoDB URL:', envUrl.substring(0, 40) + '...')
      return
    }

    if (process.env.DATABASE_URL !== envUrl) {
      console.log('[prisma] Forcing DATABASE_URL from .env (was:', (process.env.DATABASE_URL || 'undefined').substring(0, 30) + '...)')
      process.env.DATABASE_URL = envUrl
    }
  } catch { /* silently ignore — env file reading is best-effort */ }
})()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  databaseUrl: string | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient()
}

// Reuse a single PrismaClient across route bundles and HMR reloads. Creating a
// fresh client (and disconnecting the previous one) on every module evaluation
// in `next dev` causes connection churn: each route bundle ends up holding a
// disconnected client and the next query pays the full MongoDB handshake
// (observed as multi-second portal page loads). We still recreate the client
// only when the DATABASE_URL actually changes (e.g. after editing `.env`).
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
  globalForPrisma.prisma = createPrismaClient()
  globalForPrisma.databaseUrl = currentDatabaseUrl
}

if (!globalForPrisma.databaseUrl) {
  globalForPrisma.databaseUrl = currentDatabaseUrl
}

const prisma = globalForPrisma.prisma

export { prisma }
export default prisma
