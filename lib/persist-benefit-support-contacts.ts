/**
 * persist-benefit-support-contacts — write ONE benefit's support-contacts
 * selection to its `Benefit.supportContacts` column, immediately.
 *
 * Two surfaces read two different lists, and they must not disagree:
 *
 *  - My Benefits Team reads the plan roster (`Client.keyContacts`);
 *  - the hub's "Have Questions?" reads `Benefit.supportContacts`, resolved
 *    against that roster (see `lib/faq-support-contacts.ts`).
 *
 * The plan roster is written the moment a contact is created, edited or
 * deleted, but the benefit's own selection used to wait for the page's Save.
 * Creating a contact for a benefit therefore showed the person on My Benefits
 * Team and left them off the benefit page until the advisor saved again — and
 * a save from a step whose local list predated the creation wrote the old list
 * back. This writer removes that dependency.
 *
 * `?updateOnly=1` is load-bearing: the endpoint never CREATES a Benefit row, so
 * a category the advisor has not published yet simply skips the write — the
 * same rule the wizard's own autosaves follow.
 *
 * Non-throwing by design: the page's Save persists the same list, so this is a
 * fast path, never the only path. Browser-only (it invalidates client caches).
 */

import { toApiBenefitCategory } from "@/lib/benefit-draft";
import { invalidateBenefitRowsCache, invalidateClientCache } from "@/lib/fetch-client";

export interface PersistBenefitSupportContactsInput {
  planId?: string | null;
  /** The wizard's category key ("Custom" is mapped to "Company / Plan Sponsor"). */
  category?: string | null;
  /** The full selection for this benefit; an empty list clears the cards. */
  supportContacts: unknown[];
}

/**
 * @returns true when the write went through, false when there was nothing to
 * write to or the request failed.
 */
export async function persistBenefitSupportContacts({
  planId,
  category,
  supportContacts,
}: PersistBenefitSupportContactsInput): Promise<boolean> {
  if (!planId || !category) return false;

  try {
    const res = await fetch(
      `/api/clients/${planId}/benefits/${encodeURIComponent(
        toApiBenefitCategory(category),
      )}?updateOnly=1`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // An empty selection is stored as null, matching what `saveBenefit`
          // writes; both mean "no cards" to the hub.
          supportContacts: supportContacts.length > 0 ? supportContacts : null,
        }),
      },
    );
    if (!res.ok) return false;

    // The hub reads the Benefit row through a cached fetch.
    invalidateBenefitRowsCache(planId);
    invalidateClientCache(planId);
    return true;
  } catch {
    return false;
  }
}
