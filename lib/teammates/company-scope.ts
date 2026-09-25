/**
 * company-scope — which company-picker sources each scope may surface, plus the
 * Partner Company exclusion rule.
 *
 * Spec T1 acceptance: "Partner companies never appear in Plan Sponsor search."
 *
 * Pure module (no Prisma, no React) so the rule can be asserted directly by
 * scripts/teammates/verify-t1.ts instead of only through HTTP.
 */

export type CompanySuggestionSource =
  | "client"
  | "plan"
  | "provider"
  | "recordkeeper"
  | "draft";

/**
 * - `plan_sponsor`: employers only. Partner Companies never appear.
 * - `provider`: providers, recordkeepers, and plan-level companies.
 * - `all`: legacy behaviour, kept so existing callers are unaffected.
 */
export type CompanySearchScope = "plan_sponsor" | "provider" | "all";

export const DEFAULT_COMPANY_SEARCH_SCOPE: CompanySearchScope = "all";

/** Sources a Plan Sponsor picker may show. */
export const PLAN_SPONSOR_SOURCES: readonly CompanySuggestionSource[] = [
  "client",
  "plan",
  "draft",
] as const;

/** Sources a Provider picker may show. */
export const PROVIDER_SOURCES: readonly CompanySuggestionSource[] = [
  "provider",
  "recordkeeper",
  "client",
  "plan",
] as const;

export function parseCompanySearchScope(
  raw: string | null | undefined,
): CompanySearchScope {
  return raw === "plan_sponsor" || raw === "provider" || raw === "all"
    ? raw
    : DEFAULT_COMPANY_SEARCH_SCOPE;
}

/** The sources a scope may surface, or null when the scope is unrestricted. */
export function allowedSourcesForScope(
  scope: CompanySearchScope,
): readonly CompanySuggestionSource[] | null {
  if (scope === "plan_sponsor") return PLAN_SPONSOR_SOURCES;
  if (scope === "provider") return PROVIDER_SOURCES;
  return null;
}

/** Comparison key for company names (trimmed, case-insensitive). */
export function normalizeCompanyKey(name: string): string {
  return (name ?? "").trim().toLowerCase();
}

/**
 * Should a suggestion be withheld from a Plan Sponsor picker?
 *
 * True when the name belongs to a Partner Company in this organization. An empty
 * name is also withheld (it can never be a valid sponsor).
 */
export function isExcludedFromPlanSponsor(
  name: string,
  partnerCompanyNames: Iterable<string>,
): boolean {
  const key = normalizeCompanyKey(name);
  if (!key) return true;
  for (const partner of partnerCompanyNames) {
    if (normalizeCompanyKey(partner) === key) return true;
  }
  return false;
}
