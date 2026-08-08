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
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient()
}

let prisma: PrismaClient

// Always create a fresh client in development to avoid stale connection URLs
// that may have been baked into a cached instance during webpack compilation.
if (process.env.NODE_ENV !== 'production') {
  // Invalidate any previously cached client that may have the wrong URL
  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {})
    globalForPrisma.prisma = undefined
  }
  prisma = createPrismaClient()
  globalForPrisma.prisma = prisma
} else {
  prisma = globalForPrisma.prisma ?? createPrismaClient()
}

export { prisma }
export default prisma
