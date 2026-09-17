/**
 * `Client.status` is persisted with inconsistent casing across the codebase: the Prisma
 * schema default and `new-client-wizard/complete-v2` write `"Active"`, while
 * `clients/create` and `new-client-wizard/complete` write `"active"`. Anything else —
 * `"Draft"`, `"Archived"` — is not an active plan.
 *
 * Treat this module as the single source of truth for "active". The dashboard's Active
 * Plans count and the list it expands into both read from here, so they can never
 * disagree about which records qualify.
 */
export const ACTIVE_CLIENT_STATUSES = ["Active", "active"] as const;

/** Prisma `where` fragment matching the clients that count as active plans. */
export const ACTIVE_CLIENT_STATUS_FILTER = {
  in: [...ACTIVE_CLIENT_STATUSES],
};
