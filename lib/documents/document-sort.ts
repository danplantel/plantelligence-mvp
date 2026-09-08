/**
 * Deterministic document ordering shared by the advisor Documents page and the
 * client portal hub pages.
 *
 * Documents can carry an optional advisor-set `sortOrder`. Rows without one
 * (legacy rows or freshly uploaded files) sort last. Within the same
 * `sortOrder` (or when none is set) we fall back to most-recently-uploaded
 * first, matching the previous default behavior.
 */

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (v instanceof Date) return v.getTime();
  return 0;
}

function uploadedAtMs(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" || typeof v === "number") {
    const t = new Date(v as string | number).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

export function compareDocumentsByCustomOrder<T extends object>(
  a: T,
  b: T,
): number {
  const ao =
    (a as Record<string, unknown>).sortOrder == null
      ? Number.MAX_SAFE_INTEGER
      : toNumber((a as Record<string, unknown>).sortOrder);
  const bo =
    (b as Record<string, unknown>).sortOrder == null
      ? Number.MAX_SAFE_INTEGER
      : toNumber((b as Record<string, unknown>).sortOrder);
  if (ao !== bo) return ao - bo;

  const at = uploadedAtMs((a as Record<string, unknown>).uploadedAt);
  const bt = uploadedAtMs((b as Record<string, unknown>).uploadedAt);
  return bt - at;
}

/** Returns a new array sorted by advisor order (nulls last), then newest first. */
export function sortDocumentRowsByCustomOrder<T extends object>(rows: T[]): T[] {
  return [...rows].sort(compareDocumentsByCustomOrder);
}
