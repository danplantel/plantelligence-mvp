import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";

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

/**
 * Forget everything the wizard draft remembers about one plan + benefit category.
 *
 * The wizard store is a MODULE SINGLETON: unlike the page components around it, it
 * survives a client-side route change (`router.push`). Deleting a Benefit removes the row
 * and the legacy mirror entry on the server, but the DRAFT the advisor was just editing
 * stayed in memory — so re-entering the create flow for that category resumed the deleted
 * benefit. Two things went wrong there:
 *
 *   1. Step 1's existing-category guard still found the row in its read-once
 *      `categoryBenefitByApi` snapshot, so it raised "… benefits already exist".
 *   2. Step 1's pre-fill returns early for a category it has already loaded
 *      (`benefitFieldsLoadedCategories`), so the old title / description / logo / header
 *      were never re-derived from the (now row-less) snapshot.
 *
 * This makes the category look untouched again:
 *
 *   - `categoryBenefitByApi` loses the key, so the guard sees no row. The map is KEPT as
 *     an object — `undefined` means "the Benefit-row snapshot has not loaded yet", which
 *     would suspend the Step 1 / Step 3 pre-fill instead of letting it re-derive.
 *   - the per-category "already loaded / edited here" flags are dropped, so Step 1's
 *     pre-fill runs its no-row branch (the one that clears stale content) and Step 3
 *     re-resolves this category's contacts and FAQs from the snapshot.
 *   - when the draft IS for this plan + category, the benefit-scoped fields are blanked
 *     too. That closes the window between mounting Step 1 and its pre-fill landing (which
 *     has to wait for the Benefit-rows and profile requests) in which the deleted benefit
 *     would otherwise still render.
 *   - Step 3 loses this category's FAQs / support contacts plus the plan+category stamp
 *     that would otherwise stop it re-resolving them.
 *
 * A draft for another category — or another plan — is left alone.
 */
export function forgetDraftBenefit(planId: string, category: string): void {
  const label = (category || "").trim();
  if (!planId || !label) return;

  const apiCategory = toApiBenefitCategory(label);
  const key = normalizeBenefitCategoryKey(apiCategory);
  /** Same category under any of its spellings (label, API name, "Custom"). */
  const isThisCategory = (raw: string | null | undefined): boolean =>
    normalizeBenefitCategoryKey(toApiBenefitCategory((raw ?? "").trim())) === key;

  const store = useBenefitsWizardStore.getState();

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  const step1 = store.stepData.step1;
  if (step1) {
    const rows = step1.categoryBenefitByApi;
    // Only rebuild when the snapshot actually loaded; keeping `undefined` as
    // `undefined` preserves "not loaded yet" for a plan whose rows never arrived.
    const nextRows: Record<string, any | null> | undefined = rows
      ? Object.fromEntries(
          Object.entries(rows).filter(([k]) => !isThisCategory(k)),
        )
      : undefined;

    const isSameBenefit =
      step1.planId === planId && isThisCategory(step1.benefitCategory);

    store.saveStepData(1, {
      ...step1,
      categoryBenefitByApi: nextRows,
      benefitFieldsLoadedCategories: (
        step1.benefitFieldsLoadedCategories ?? []
      ).filter((c) => !isThisCategory(c)),
      benefitLogoEditedCategories: (
        step1.benefitLogoEditedCategories ?? []
      ).filter((c) => !isThisCategory(c)),
      // The same "no Benefit row" defaults Step 1 applies when a category is entered
      // for the first time (see handleCategoryChange), so nothing here is a state the
      // create flow could not reach on its own.
      ...(isSameBenefit
        ? {
            benefitTitle: apiCategory === "Company / Plan Sponsor" ? "" : apiCategory,
            shortDescription: "",
            companyLogo: null,
            innerHeaderImage: null,
            brandImages: {
              header: null,
              thumbnail: null,
              secondaryBanner: null,
              favicon: null,
            },
            planVideo: undefined,
            planVideoFileName: undefined,
            planVideoRemoved: false,
            providerContact: null,
            journeyHeader: undefined,
            journeySubtitle: undefined,
            journeyBodyText: undefined,
            helpCards: undefined,
            insurancePlanId: "",
            insuranceLoginUrl: "",
            insuranceBackgroundImage: "",
            insuranceContainerBlockOpacity: 0.8,
            signatureMode: "user" as const,
            customClosing: "",
            customSignatureName: "",
            customSignatureCompany: "",
            customClosingBold: true,
            customClosingItalic: false,
            customSignatureNameBold: false,
            customSignatureNameItalic: false,
            customSignatureCompanyBold: false,
            customSignatureCompanyItalic: true,
            heroBackgroundOpacity: 1.0,
            heroContainerBlockOpacity: 0.67,
            heroContainerInverted: false,
            heroBackgroundInverted: false,
            heroUseGradient: false,
            // Managed by the contact pre-fill, which re-derives it for the category.
            contactId: "",
          }
        : {}),
    });
  }

  // ── Step 3: this category's FAQs + support contacts, and its stamp ──────────
  const step3 = store.stepData.step3;
  if (step3) {
    const stampedHere =
      step3.supportContactsPlanId === planId &&
      isThisCategory(step3.supportContactsCategory);

    store.saveStepData(3, {
      ...step3,
      faqs: [],
      faqsByCategory: Object.fromEntries(
        Object.entries(step3.faqsByCategory ?? {}).filter(
          ([k]) => !isThisCategory(k),
        ),
      ),
      supportContacts: [],
      supportContactsLoadedCategories: (
        step3.supportContactsLoadedCategories ?? []
      ).filter((c) => !isThisCategory(c)),
      ...(stampedHere
        ? { supportContactsPlanId: undefined, supportContactsCategory: undefined }
        : {}),
    });
  }
}
