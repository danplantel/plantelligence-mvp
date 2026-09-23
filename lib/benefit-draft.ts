/**
 * Helpers for the Create Benefits "Cancel" flow.
 *
 * Cancelling discards the benefit the advisor was creating. It must never touch a
 * benefit that already existed, because this wizard is also opened for categories
 * that are already configured — Step 1 pre-fills those rows and the advisor may be
 * part-way through changing one.
 *
 * The signal used to tell the two apart is the wizard's own read-once snapshot of
 * the plan's Benefit rows (`step1.categoryBenefitByApi`). It is filled from
 * `GET /api/clients/{id}/benefits`, which applies no `isEnabled` filter, and the
 * only other writer of that map patches EXISTING entries. So:
 *
 *   - the map has not loaded yet → we cannot tell; treat as "not ours"
 *   - the category is present    → it pre-existed; not ours
 *   - the category is absent     → this session created it; ours to delete
 *
 * Which creation can actually be ours: the Step 1 and Step 2 auto-saves pass
 * `?updateOnly=1` and therefore never insert a row. A row appears mid-wizard only
 * through an explicit save (Step 3's "Save FAQs", the editor save, or the
 * publish/hide toggle), which is exactly the case this guard exists for.
 */

/** Same normalization the wizard and the Benefit API use for category keys. */
export function normalizeBenefitCategoryKey(
  cat: string | null | undefined,
): string {
  return (cat || "").toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Wizard label → the category the API stores under
 * ("Custom" is persisted as "Company / Plan Sponsor").
 */
export function toApiBenefitCategory(cat: string): string {
  return cat === "Custom" ? "Company / Plan Sponsor" : cat;
}

/**
 * Did THIS wizard session create the Benefit row for the current category?
 *
 * Returns false whenever the answer is uncertain, so a Cancel can never delete a
 * pre-existing benefit.
 */
export function sessionCreatedBenefitRow(
  step1Data:
    | {
        benefitCategory?: string | null;
        categoryBenefitByApi?: Record<string, unknown> | null;
      }
    | null
    | undefined,
  category?: string | null,
): boolean {
  const rows = step1Data?.categoryBenefitByApi;
  // Snapshot not loaded → "unknown" means "not ours" (never delete).
  if (!rows) return false;

  const rawCategory = (category ?? step1Data?.benefitCategory ?? "").trim();
  if (!rawCategory) return false;

  const target = normalizeBenefitCategoryKey(
    toApiBenefitCategory(rawCategory),
  );
  return rows[target] == null;
}

/**
 * Hard-delete the category's Benefit row and drop it from the legacy
 * `employeePortalPreview` mirror.
 *
 * Only call this after {@link sessionCreatedBenefitRow} has returned true. The
 * server's default DELETE is a soft-disable (`isEnabled: false`) that the Portal
 * Visibility toggle relies on, so the hard delete is opt-in via `?purge=1`.
 */
export async function purgeDraftBenefit(
  planId: string,
  category: string,
): Promise<void> {
  const res = await fetch(
    `/api/clients/${planId}/benefits/${encodeURIComponent(
      toApiBenefitCategory(category),
    )}?purge=1`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error(`Failed to discard benefit (${res.status})`);
  }
}
