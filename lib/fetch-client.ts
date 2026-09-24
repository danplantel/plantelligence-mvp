// lib/fetch-client.ts
//
// Single-flight + short-TTL fetcher for GET /api/clients/<id>.
//
// The Create Benefits wizard reads this row from four places — Step 1's deep-link
// effect, Step 2's `planDetails`, Step 3's key-contact fallback, Step 5's disclaimer
// seed — and the publish (`lib/save-benefit.ts`) reads it once more to merge against.
// None of them shared anything, so a single wizard run issued up to five identical
// requests for the same 13.7 KB row.
//
// This helper:
//   1. Coalesces concurrent callers onto a single in-flight request.
//   2. Reuses a recently resolved row (CACHE_TTL) so a step mounting a moment later —
//      or a fallback that fires once the store rehydrates — doesn't re-hit the network.
//
// It resolves the CLIENT OBJECT (the route's `data`), or null on failure/non-2xx, so
// callers don't have to unwrap the envelope each time.
//
// IMPORTANT: the row is written by several paths (the wizard auto-save, Step 5's
// disclaimer saves, the publish). Every writer must call `invalidateClientCache(planId)`
// or a later reader can be served the pre-write row. The TTL is deliberately short and
// is a coalescing window, not a data-freshness guarantee.

const CACHE_TTL = 5_000;

interface CacheEntry {
  data: any;
  at: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<any | null>>();

export function fetchClientOnce(planId: string): Promise<any | null> {
  if (!planId) return Promise.resolve(null);

  // Serve a recently fetched row from memory — no network request.
  const cached = cache.get(planId);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return Promise.resolve(cached.data);
  }

  const existing = inFlight.get(planId);
  if (existing) return existing;

  const request = fetch(`/api/clients/${planId}`, { credentials: "same-origin" })
    .then(async (res) => {
      if (!res.ok) return null;
      const result = await res.json().catch(() => null);
      if (!result?.success || !result.data) return null;
      return result.data;
    })
    .catch(() => null)
    .then((data) => {
      inFlight.delete(planId);
      // Only successful reads are cached; a failure must be retryable immediately.
      if (data !== null) {
        cache.set(planId, { data, at: Date.now() });
      }
      return data;
    })
    .catch(() => {
      inFlight.delete(planId);
      return null;
    });

  inFlight.set(planId, request);
  return request;
}

/**
 * Drop the cached row for one plan, or every cached row when called with no argument.
 *
 * Call after ANY write to that client record (wizard auto-save, Step 5 disclaimer /
 * footer-background saves, the publish's client PUT and benefits PUT) so a reader that
 * runs straight afterwards cannot be handed the pre-write row.
 */
export function invalidateClientCache(planId?: string): void {
  if (planId) {
    cache.delete(planId);
    return;
  }
  cache.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Benefit rows — GET /api/clients/<id>/benefits
// ─────────────────────────────────────────────────────────────────────────────
//
// This is the only uncached read on the Edit Benefit page. Step 1 loads it on every
// mount, and Radix unmounts each inactive tab's content (nothing here sets
// `forceMount`), so switching tabs destroys and recreates Step 1 — and with it the
// per-mount `benefitApiLoadedPlanRef` guard. Six tabs therefore meant roughly six
// identical reads of the same handful of rows.
//
// Same contract as the client cache above: coalesce concurrent callers, reuse a
// recent result for a short window, cache only successes, and invalidate from every
// writer (step 1's debounced auto-save and the publish both write Benefit rows).

const BENEFIT_ROWS_TTL = 5_000;

interface BenefitRowsEntry {
  rows: any[];
  at: number;
}

const benefitRowsCache = new Map<string, BenefitRowsEntry>();
const benefitRowsInFlight = new Map<string, Promise<any[] | null>>();

/**
 * Resolves the `benefits` ARRAY from the route's `{ success, benefits }` envelope, or
 * null on failure/non-2xx so callers keep their existing error handling.
 */
export function fetchBenefitRowsOnce(planId: string): Promise<any[] | null> {
  if (!planId) return Promise.resolve(null);

  const cached = benefitRowsCache.get(planId);
  if (cached && Date.now() - cached.at < BENEFIT_ROWS_TTL) {
    return Promise.resolve(cached.rows);
  }

  const existing = benefitRowsInFlight.get(planId);
  if (existing) return existing;

  const request = fetch(`/api/clients/${planId}/benefits`, {
    credentials: "same-origin",
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const result = await res.json().catch(() => null);
      if (!result?.success || !Array.isArray(result.benefits)) return null;
      return result.benefits as any[];
    })
    .catch(() => null)
    .then((rows) => {
      benefitRowsInFlight.delete(planId);
      // Only successful reads are cached; a failure stays retryable immediately.
      if (rows !== null) benefitRowsCache.set(planId, { rows, at: Date.now() });
      return rows;
    })
    .catch(() => {
      benefitRowsInFlight.delete(planId);
      return null;
    });

  benefitRowsInFlight.set(planId, request);
  return request;
}

/**
 * Drop the cached Benefit rows for one plan (or all). Call after ANY write that
 * changes Benefit rows — step 1's `?updateOnly=1` auto-save and the publish's
 * benefits PUT both do.
 */
export function invalidateBenefitRowsCache(planId?: string): void {
  if (planId) {
    benefitRowsCache.delete(planId);
    return;
  }
  benefitRowsCache.clear();
}
