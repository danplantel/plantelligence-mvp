/**
 * Diagnostic — confirm the T1 collections and indexes exist in MongoDB.
 *
 *   npx tsx scripts/teammates/check-schema.ts
 *
 * Why this exists: `prisma db push` is NOT transactional across collections on
 * MongoDB, so a failure part-way through (for example on a pre-existing model
 * with duplicate data) can leave the push partially applied. This reports
 * exactly what is present for the Team & Collaborator Access collections.
 *
 * Exit code is non-zero when something T1 needs is missing.
 */
import { createPrisma } from "./shared";

/** Collection → the Prisma-generated index names T1 depends on. */
const T1_SCHEMA: Record<string, string[]> = {
  Organization: ["Organization_ownerUserId_idx"],
  TeammateCompany: [
    "TeammateCompany_organizationId_idx",
    "TeammateCompany_organizationId_name_idx",
  ],
  TeammateProfile: [
    "TeammateProfile_organizationId_idx",
    "TeammateProfile_organizationId_email_idx",
    "TeammateProfile_companyId_idx",
    "TeammateProfile_loginUserId_idx",
    "TeammateProfile_organizationId_deactivatedAt_idx",
  ],
  PlanAssignment: [
    "PlanAssignment_organizationId_idx",
    "PlanAssignment_clientId_idx",
    "PlanAssignment_profileId_idx",
    // The one-assignment-per-person-per-plan guarantee.
    "PlanAssignment_profileId_clientId_key",
  ],
  TeammateAuditEvent: [
    "TeammateAuditEvent_organizationId_createdAt_idx",
    "TeammateAuditEvent_profileId_idx",
    "TeammateAuditEvent_assignmentId_idx",
  ],
};

interface ListIndexesResult {
  cursor?: {
    firstBatch?: { name?: string; unique?: boolean }[];
  };
  ok?: number;
  errmsg?: string;
}

async function main(): Promise<void> {
  const prisma = createPrisma();
  let missing = 0;

  try {
    console.log("T1 schema check");
    console.log("");

    for (const [collection, expectedIndexes] of Object.entries(T1_SCHEMA)) {
      let names = new Set<string>();
      let collectionMissing = false;

      try {
        const result = (await prisma.$runCommandRaw({
          listIndexes: collection,
        })) as unknown as ListIndexesResult;
        const batch = result.cursor?.firstBatch ?? [];
        names = new Set(batch.map((i) => i.name ?? ""));
      } catch (error) {
        collectionMissing = true;
        console.log(`  MISSING  collection ${collection}`);
        console.log(`           ${(error as Error).message.split("\n")[0]}`);
        missing += 1;
      }

      if (collectionMissing) continue;

      const missingIndexes = expectedIndexes.filter((idx) => !names.has(idx));
      if (missingIndexes.length === 0) {
        console.log(`  OK       ${collection} (${expectedIndexes.length} indexes)`);
      } else {
        missing += missingIndexes.length;
        console.log(`  PARTIAL  ${collection}`);
        for (const idx of missingIndexes) {
          console.log(`           missing index: ${idx}`);
        }
      }
    }

    console.log("");
    if (missing === 0) {
      console.log("All T1 collections and indexes are present.");
    } else {
      console.error(
        `${missing} T1 schema item(s) missing. Re-run \`npx prisma db push\` once the blocking collection is resolved.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  if (missing > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Schema check crashed:", error);
  process.exitCode = 1;
});
