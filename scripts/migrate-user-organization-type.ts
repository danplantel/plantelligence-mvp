/**
 * One-off migration: rename the legacy `company` field on `User` documents to
 * `organizationType`, matching the Prisma schema.
 *
 * The User.company field has always stored the organization *type*
 * (e.g. "independent", "ria"), so the rename is purely cosmetic — no value
 * transformation is needed.
 *
 * Idempotent: only documents that still have a `company` field are touched, and
 * an existing `organizationType` value is never overwritten.
 *
 * Run with:
 *   npx tsx scripts/migrate-user-organization-type.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function countWithLegacyField(): Promise<number> {
  const raw: any = await prisma.$runCommandRaw({
    count: "User",
    query: { company: { $exists: true } },
  });
  return Number(raw?.n ?? 0);
}

async function main() {
  const before = await countWithLegacyField();
  console.log(`User documents with a legacy "company" field: ${before}`);

  if (before === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  // Aggregation-pipeline update: copy `company` into `organizationType` (only
  // when `organizationType` is absent) and then drop the legacy field.
  const result: any = await prisma.$runCommandRaw({
    update: "User",
    updates: [
      {
        q: { company: { $exists: true } },
        u: [
          {
            $set: {
              organizationType: { $ifNull: ["$organizationType", "$company"] },
            },
          },
          { $unset: "company" },
        ],
        multi: true,
      },
    ],
  });

  console.log("Migration command result:", JSON.stringify(result));

  const after = await countWithLegacyField();
  console.log(`User documents with a legacy "company" field after: ${after}`);

  if (after !== 0) {
    throw new Error(
      `Migration incomplete — ${after} User document(s) still have "company".`,
    );
  }

  console.log("✅ Migrated User.company -> User.organizationType");
}

main()
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
