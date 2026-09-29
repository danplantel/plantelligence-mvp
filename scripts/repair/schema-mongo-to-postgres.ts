/**
 * Repair — transform `prisma/schema.prisma` from MongoDB to PostgreSQL.
 *
 *   npx tsx scripts/repair/schema-mongo-to-postgres.ts [--apply]
 *
 * One-off, for the MongoDB → PostgreSQL migration (plans/postgres-migration.md §P3). It is
 * kept in the repo rather than applied as a 1,300-line diff because the transform is far
 * easier to review as code — and because it checks its own work: it fails loudly if any
 * MongoDB-specific attribute survives, and prints how many of each it changed.
 *
 * What it changes, and nothing else — every relation, index, default, enum and `Json` field
 * is left exactly as it was:
 *
 *   @default(auto()) @map("_id") @db.ObjectId   →  @default(cuid())
 *   <anywhere> @db.ObjectId                     →  (removed)
 *   <anywhere> @map("_id")                      →  (removed)
 *   @@index([<scalar list>])                    →  @@index([<scalar list>], type: Gin)
 *
 * `String @id @default(cuid())` still declares the primary key. `@map("_id")` and
 * `@db.ObjectId` existed only because MongoDB names its key `_id` and types it as a BSON
 * ObjectId; neither has a PostgreSQL equivalent because neither is needed. Note that ids
 * become 25-character cuids, which is why the app-side "looks like a Mongo id" guards had to
 * go — see plan §5.
 *
 * The GIN part is not cosmetic: PostgreSQL cannot build a B-tree index on `text[]`, so a
 * plain `@@index` on a scalar list fails the migration outright.
 *
 * The `datasource db` block (`provider`, `directUrl`) is edited by hand, not here.
 *
 * DRY RUN by default; `--apply` to write.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const APPLY = process.argv.includes("--apply");

const SCHEMA_PATH = path.join(__dirname, "..", "..", "prisma", "schema.prisma");

/** Scalar-list (`String[]`) fields this schema indexes. PostgreSQL needs GIN for these. */
const GIN_INDEX_FIELDS = [
  "services",
  "licenseTypes",
  "statesLicensed",
  "benefitTypes",
];

interface TransformCounts {
  primaryKeys: number;
  objectIds: number;
  mappedIds: number;
  ginIndexes: number;
}

function transform(schema: string): { next: string; counts: TransformCounts } {
  const counts: TransformCounts = {
    primaryKeys: 0,
    objectIds: 0,
    mappedIds: 0,
    ginIndexes: 0,
  };
  let next = schema;

  // 1. The primary-key triple. The three attributes are always written in this order; `\s+`
  //    keeps the match tolerant of any alignment the formatter leaves behind.
  next = next.replace(
    /@default\(auto\(\)\)\s+@map\("_id"\)\s+@db\.ObjectId/g,
    () => {
      counts.primaryKeys += 1;
      return "@default(cuid())";
    },
  );

  // 2. Every remaining BSON-typed field: foreign-key-ish scalars, `@unique` session links,
  //    and anything else that pointed at an ObjectId.
  next = next.replace(/\s+@db\.ObjectId/g, () => {
    counts.objectIds += 1;
    return "";
  });

  // 3. Any `@map("_id")` the first pass did not consume.
  next = next.replace(/\s+@map\("_id"\)/g, () => {
    counts.mappedIds += 1;
    return "";
  });

  // 4. Give the scalar-list indexes an operator class.
  for (const field of GIN_INDEX_FIELDS) {
    const from = `@@index([${field}])`;
    const to = `@@index([${field}], type: Gin)`;
    if (next.includes(from)) {
      next = next.replace(from, to);
      counts.ginIndexes += 1;
    }
  }

  return { next, counts };
}

/** Anything MongoDB-specific that must NOT survive the transform. */
const LEFTOVERS: ReadonlyArray<readonly [string, RegExp]> = [
  ["@db.ObjectId", /@db\.ObjectId/],
  ['@map("_id")', /@map\("_id"\)/],
  ["@default(auto())", /@default\(auto\(\)\)/],
  ['provider = "mongodb"', /provider\s*=\s*"mongodb"/],
  [
    "a scalar-list @@index without type: Gin",
    new RegExp(`@@index\\(\\[(${GIN_INDEX_FIELDS.join("|")})\\]\\)`),
  ],
];

/**
 * Drop whole-line `//` comments, so the self-check judges the *schema* rather than the prose.
 *
 * This matters because the file's own documentation names these attributes on purpose — the
 * datasource block explains that `@db.ObjectId` and `@map("_id")` were removed — and a naive
 * scan reports that explanation as a failure. Prisma ignores comments entirely, and so must
 * this check. Trailing comments (`… @db.ObjectId // note`) are NOT stripped: those lines
 * still carry real code and stay in scope.
 */
function codeOnly(schema: string): string {
  return schema
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

function main(): void {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`Schema not found: ${SCHEMA_PATH}`);
  }

  const original = fs.readFileSync(SCHEMA_PATH, "utf-8");
  const { next, counts } = transform(original);

  const code = codeOnly(next);
  const surviving = LEFTOVERS.filter(([, pattern]) => pattern.test(code)).map(
    ([label]) => label,
  );

  console.log(`Schema transform — ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`  ${SCHEMA_PATH}`);
  console.log("");
  console.log(`  primary keys → @default(cuid()) : ${counts.primaryKeys}`);
  console.log(`  @db.ObjectId removed            : ${counts.objectIds}`);
  console.log(`  @map("_id") removed             : ${counts.mappedIds}`);
  console.log(`  scalar-list indexes → GIN       : ${counts.ginIndexes}`);
  console.log("");

  if (surviving.length > 0) {
    console.error(`  FAIL  MongoDB attributes survive: ${surviving.join(", ")}`);
    // Name the lines. A count alone is useless when something unexpected matches, and the
    // usual causes are an attribute written in an unanticipated shape — unusual spacing, two
    // attributes on one line, or a commented-out model Prisma never compiles. Line numbers
    // are those of the real file, so comments are skipped rather than filtered out first.
    next.split(/\r?\n/).forEach((line, index) => {
      if (line.trimStart().startsWith("//")) return;
      if (LEFTOVERS.some(([, pattern]) => pattern.test(line))) {
        console.error(`        ${index + 1}: ${line.trim()}`);
      }
    });
    process.exitCode = 1;
    return;
  }
  console.log("  OK    no MongoDB-specific attributes remain");

  if (!APPLY) {
    console.log("");
    console.log("Dry run only — re-run with --apply to write the file.");
    return;
  }

  if (next === original) {
    console.log("");
    console.log("Nothing to write — the schema is already transformed.");
    return;
  }

  fs.writeFileSync(SCHEMA_PATH, next, "utf-8");
  console.log("");
  console.log("Written.");
}

main();
