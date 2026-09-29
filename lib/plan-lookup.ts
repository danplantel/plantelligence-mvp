/**
 * Plan lookup by primary key **or** slug — one predicate, no shape guessing.
 *
 * Before the move to PostgreSQL, every caller had to work out which of the two a value was:
 *
 *   const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
 *   where: isObjectId ? { OR: [{ id: value }, { slug: value }] } : { slug: value }
 *
 * That branch existed for two reasons, both now gone:
 *
 *  1. MongoDB raised `P2023 Malformed ObjectID` when an id-typed filter received a slug, so
 *     the shape had to be tested *before* querying.
 *  2. Plan ids were BSON ObjectIds, recognisable by their 24-hex form.
 *
 * Ids are now cuid strings and a `text` primary key accepts any string, so the shape test is
 * not only unnecessary but actively wrong: a cuid fails a 24-hex test, every by-id lookup
 * silently takes the slug path, and the caller gets `null` — which surfaces to the user as
 * "You don't have access to this plan/section" rather than as an error. See
 * plans/postgres-migration.md §5.
 *
 * Prisma ANDs this with whatever else the caller scopes by, so a guarded lookup stays
 * guarded:
 *
 *   where: { ...planIdOrSlug(clientIdOrSlug), userId }
 *
 * Note this is an `OR` over two columns, which `findUnique` cannot express — use
 * `findFirst` (or `findMany`) with it.
 */
import type { Prisma } from "@prisma/client";

/** Match a plan by its primary key **or** its slug, without asking which one it is. */
export function planIdOrSlug(idOrSlug: string): Prisma.ClientWhereInput {
  return { OR: [{ id: idOrSlug }, { slug: idOrSlug }] };
}
