/**
 * Apply the T1 indexes directly to MongoDB.
 *
 *   npx tsx scripts/teammates/apply-indexes.ts
 *
 * Why this exists: `prisma db push` aborts part-way through when it hits an
 * unrelated model it cannot reconcile (see the note below), and MongoDB pushes
 * are not transactional — so the T1 collections get created but their indexes do
 * not. This applies exactly the indexes Prisma declares for the T1 models, using
 * Prisma's own index names so the schema stays consistent.
 *
 * It only touches the five Team & Collaborator Access collections. Safe to
 * re-run: an index that already exists is reported and skipped.
 *
 * NOTE: the pre-existing blocker is the `WizardClientProfile` collection holding
 * duplicate `sessionId` values, which stops Prisma building that model's unique
 * index. Resolving it means either de-duplicating those rows or dropping the
 * `@unique` from the schema — a product decision, tracked separately.
 */
import { createPrisma } from "./shared";

interface IndexSpec {
  key: Record<string, 1>;
  name: string;
  unique?: boolean;
}

const T1_INDEXES: Record<string, IndexSpec[]> = {
  Organization: [{ key: { ownerUserId: 1 }, name: "Organization_ownerUserId_idx" }],
  TeammateCompany: [
    { key: { organizationId: 1 }, name: "TeammateCompany_organizationId_idx" },
    {
      key: { organizationId: 1, name: 1 },
      name: "TeammateCompany_organizationId_name_idx",
    },
  ],
  TeammateProfile: [
    {
      key: { organizationId: 1 },
      name: "TeammateProfile_organizationId_idx",
    },
    {
      key: { organizationId: 1, email: 1 },
      name: "TeammateProfile_organizationId_email_idx",
    },
    { key: { companyId: 1 }, name: "TeammateProfile_companyId_idx" },
    { key: { loginUserId: 1 }, name: "TeammateProfile_loginUserId_idx" },
    {
      key: { organizationId: 1, deactivatedAt: 1 },
      name: "TeammateProfile_organizationId_deactivatedAt_idx",
    },
  ],
  PlanAssignment: [
    {
      key: { organizationId: 1 },
      name: "PlanAssignment_organizationId_idx",
    },
    { key: { clientId: 1 }, name: "PlanAssignment_clientId_idx" },
    { key: { profileId: 1 }, name: "PlanAssignment_profileId_idx" },
    {
      // The "one record per person per plan" guarantee (spec T1 Part B item 3).
      key: { profileId: 1, clientId: 1 },
      name: "PlanAssignment_profileId_clientId_key",
      unique: true,
    },
  ],
  TeammateAuditEvent: [
    {
      key: { organizationId: 1, createdAt: 1 },
      name: "TeammateAuditEvent_organizationId_createdAt_idx",
    },
    { key: { profileId: 1 }, name: "TeammateAuditEvent_profileId_idx" },
    { key: { assignmentId: 1 }, name: "TeammateAuditEvent_assignmentId_idx" },
  ],
};

async function main(): Promise<void> {
  const prisma = createPrisma();
  let created = 0;
  let skipped = 0;
  let failed = 0;

  try {
    console.log("Applying T1 indexes");
    console.log("");

    for (const [collection, indexes] of Object.entries(T1_INDEXES)) {
      for (const index of indexes) {
        try {
          await prisma.$runCommandRaw({
            createIndexes: collection,
            indexes: [
              {
                key: index.key,
                name: index.name,
                ...(index.unique ? { unique: true } : {}),
              },
            ],
          });
          created += 1;
          console.log(`  created  ${index.name}`);
        } catch (error) {
          const message = (error as Error).message ?? "";
          if (
            message.includes("already exists") ||
            message.includes("IndexOptionsConflict") ||
            message.includes("IndexKeySpecsConflict")
          ) {
            skipped += 1;
            console.log(`  exists   ${index.name}`);
          } else {
            failed += 1;
            console.error(`  FAILED   ${index.name}`);
            console.error(`           ${message.split("\n")[0]}`);
          }
        }
      }
    }

    console.log("");
    console.log(`created: ${created}  already present: ${skipped}  failed: ${failed}`);
  } finally {
    await prisma.$disconnect();
  }

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Index application crashed:", error);
  process.exitCode = 1;
});
