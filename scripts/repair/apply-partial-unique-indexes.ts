/**
 * Repair — make `Client.slug` uniquely constrained without breaking on nulls.
 *
 *   npx tsx scripts/repair/apply-partial-unique-indexes.ts
 *
 * Problem: `Client.slug` is declared `slug String? @unique`, so Prisma wants a
 * plain unique index. On MongoDB a unique index treats every missing/`null` value
 * as a real key, so the moment TWO clients have no slug the index build fails
 * with `dup key: { slug: null }` — which is what aborts `prisma db push`.
 *
 * A null slug means "this plan has no custom portal URL yet", not "these plans
 * are duplicates", so the correct constraint is a PARTIAL unique index that only
 * applies where `slug` is a string. That matches the app's existing semantics:
 * uniqueness only matters for slugs that exist, and `lib/slug-registry.ts`
 * already reserves them globally.
 *
 * Prisma cannot express a partial index declaratively, so it is created here with
 * Prisma's own index name (`Client_slug_key`) so `prisma db push` recognises it.
 * Re-runnable.
 *
 * Implemented against the raw driver rather than `$runCommandRaw`: Prisma cannot
 * deserialize `partialFilterExpression` when reading `listIndexes` back, which
 * fails with "Unknown tagged value".
 */
import { MongoClient } from "mongodb";
import { loadEnv } from "../teammates/shared";

const INDEX_NAME = "Client_slug_key";
const COLLECTION = "Client";

async function main(): Promise<void> {
  loadEnv();
  const uri = process.env.DATABASE_URL;
  if (!uri || !uri.startsWith("mongodb")) {
    throw new Error("DATABASE_URL is missing or is not a MongoDB URL.");
  }

  const client = new MongoClient(uri);
  let failed = false;

  try {
    await client.connect();
    const collection = client.db().collection(COLLECTION);

    const total = await collection.countDocuments();
    const withSlug = await collection.countDocuments({
      slug: { $type: "string" },
    });
    const withoutSlug = total - withSlug;

    console.log("Client.slug partial unique index");
    console.log("");
    console.log(`  clients total          : ${total}`);
    console.log(`  with a slug            : ${withSlug}`);
    console.log(`  without a slug (null)  : ${withoutSlug}`);
    console.log("");

    if (withoutSlug > 1) {
      console.log(
        `  ${withoutSlug} clients share the null slug, so a plain unique index cannot be built.`,
      );
      console.log(
        "  Applying a partial unique index that only constrains real slugs.",
      );
    }

    // Drop whatever exists under this name so the options can be corrected.
    try {
      await collection.dropIndex(INDEX_NAME);
      console.log(`  Dropped existing index ${INDEX_NAME}.`);
    } catch {
      console.log(`  No existing ${INDEX_NAME} to drop.`);
    }

    const name = await collection.createIndex(
      { slug: 1 },
      {
        name: INDEX_NAME,
        unique: true,
        partialFilterExpression: { slug: { $type: "string" } },
      },
    );
    console.log(`  Created ${name} (unique, partial on slug being a string).`);

    const indexes = await collection.indexes();
    const created = indexes.find((index) => index.name === INDEX_NAME);
    if (created?.unique && created.partialFilterExpression) {
      console.log("  Verified: index is unique and partial.");
    } else {
      console.error("  WARNING: index is not unique+partial as expected.");
      failed = true;
    }

    // A partial unique index must still reject a genuine duplicate slug.
    const slugs = await collection
      .aggregate([
        { $match: { slug: { $type: "string" } } },
        { $group: { _id: "$slug", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();
    if (slugs.length === 0) {
      console.log(`  Verified: all ${withSlug} real slugs are unique.`);
    } else {
      console.error(
        `  WARNING: ${slugs.length} duplicate slug value(s) exist among real slugs.`,
      );
      failed = true;
    }
  } catch (error) {
    console.error("Failed to apply partial unique index:", error);
    failed = true;
  } finally {
    await client.close();
  }

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Partial unique index repair crashed:", error);
  process.exitCode = 1;
});
