import prisma from "@/lib/prisma";

/**
 * Generate a URL-friendly slug from a company name.
 *
 * - Lowercases
 * - Replaces spaces, underscores, and special chars with hyphens
 * - Collapses consecutive hyphens
 * - Strips leading/trailing hyphens
 *
 * @example "Acme Corp!" → "acme-corp"
 * @example "Smith & Wesson, LLC" → "smith-wesson-llc"
 */
export function generatePlanSlug(companyName: string): string {
  if (!companyName) return "";

  let slug = companyName
    .toLowerCase()
    .trim()
    // Replace ampersand with "and"
    .replace(/&/g, "and")
    // Replace any non-alphanumeric characters (except hyphens) with hyphens
    .replace(/[^a-z0-9-]/g, "-")
    // Collapse consecutive hyphens
    .replace(/-+/g, "-")
    // Strip leading/trailing hyphens
    .replace(/^-+|-+$/g, "");

  // Ensure non-empty
  if (!slug) slug = "plan";

  return slug;
}

/**
 * Whether a slug is already occupied in the global namespace.
 *
 * Checks BOTH the current-slug column (`Client.slug`, for legacy rows that
 * predate the registry) AND the `PortalSlug` registry — which also contains
 * retired aliases, so a previously-used-but-retired slug still counts as taken.
 */
async function slugExists(slug: string): Promise<boolean> {
  const client = await prisma.client.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (client) return true;

  const registered = await prisma.portalSlug.findUnique({
    where: { slug },
    select: { id: true },
  });
  return !!registered;
}

/**
 * Generate a unique slug for a plan, ensuring no collision in the database
 * (including retired aliases).
 *
 * If the base slug already exists, appends "-2", "-3", etc.
 *
 * @param companyName - The company/plan name to derive the slug from
 * @returns A unique slug
 */
export async function generateUniquePlanSlug(
  companyName: string,
): Promise<string> {
  const baseSlug = generatePlanSlug(companyName);
  if (!baseSlug) return "plan";

  return ensureUniqueSlug(baseSlug);
}

/**
 * Ensure a pre-sanitized slug is unique by checking the database.
 * If the given slug already exists, appends "-2", "-3", etc.
 *
 * @param rawSlug - A pre-sanitized slug (lowercase, alphanumeric + hyphens)
 */
export async function ensureUniqueSlug(rawSlug: string): Promise<string> {
  if (!rawSlug) return "plan";

  if (!(await slugExists(rawSlug))) return rawSlug;

  // Collision detected — append numeric suffix
  let suffix = 2;
  let candidate = `${rawSlug}-${suffix}`;

  while (await slugExists(candidate)) {
    suffix++;
    candidate = `${rawSlug}-${suffix}`;

    if (suffix > 999) {
      return `${rawSlug}-${Date.now().toString(36)}`;
    }
  }

  return candidate;
}
