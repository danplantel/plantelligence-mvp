/**
 * Per-module sticky plan selection + global MRU recents (Dev Notes — Plan Selector UX).
 *
 * Storage keys:
 * - `lastPlanId_<module>` — last selected plan for that surface (documents, meetings, …)
 * - `planRecents` — JSON array of up to 5 plan ids, most-recent-first (shared across modules)
 */

export type PlanSelectorModule =
  | "documents"
  | "meetings"
  | "marketing"
  | "video"
  | "benefits";

/** Show search inside plan dropdown when plan count >= this */
export const PLAN_SELECTOR_SEARCH_THRESHOLD = 25;

/** Require typing to reveal non-recent plans when count >= this */
export const PLAN_SELECTOR_MANDATORY_SEARCH_THRESHOLD = 100;

export const PLAN_RECENTS_STORAGE_KEY = "planRecents";

export function lastPlanStorageKey(module: PlanSelectorModule): string {
  return `lastPlanId_${module}`;
}

function safeParseRecents(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

export function getRecentPlanIds(): string[] {
  if (typeof window === "undefined") return [];
  return safeParseRecents(localStorage.getItem(PLAN_RECENTS_STORAGE_KEY));
}

const MAX_RECENTS = 5;

/** Move planId to front; dedupe; trim to 5 */
export function touchRecentPlan(planId: string): void {
  if (typeof window === "undefined" || !planId) return;
  const prev = getRecentPlanIds();
  const next = [planId, ...prev.filter((id) => id !== planId)].slice(
    0,
    MAX_RECENTS,
  );
  try {
    localStorage.setItem(PLAN_RECENTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function getLastPlanId(module: PlanSelectorModule): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(lastPlanStorageKey(module));
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function setLastPlanId(
  module: PlanSelectorModule,
  planId: string,
): void {
  if (typeof window === "undefined" || !planId) return;
  try {
    localStorage.setItem(lastPlanStorageKey(module), planId);
  } catch {
    /* quota */
  }
}

/** Persist last selection for module + update global recents */
export function persistPlanSelection(
  module: PlanSelectorModule,
  planId: string,
): void {
  setLastPlanId(module, planId);
  touchRecentPlan(planId);
}

export function resolveStickyPlanId(
  plans: readonly { id: string }[],
  module: PlanSelectorModule,
  urlPlanId: string | null | undefined,
): string | null {
  if (plans.length === 0) return null;
  const valid = new Set(plans.map((p) => p.id));
  const fromUrl = urlPlanId?.trim();
  if (fromUrl && valid.has(fromUrl)) return fromUrl;
  const last = getLastPlanId(module);
  if (last && valid.has(last)) return last;
  return plans[0]?.id ?? null;
}

/** Remove all per-module sticky plan selections + global recents from localStorage.
 *  Call on logout so the user starts fresh when they sign back in. */
export function clearAllPlanSelections(): void {
  if (typeof window === "undefined") return;
  const modules: PlanSelectorModule[] = [
    "documents",
    "meetings",
    "marketing",
    "video",
    "benefits",
  ];
  for (const mod of modules) {
    try {
      localStorage.removeItem(lastPlanStorageKey(mod));
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(PLAN_RECENTS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
