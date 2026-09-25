/**
 * teammates — barrel for the Team & Collaborator Access data layer (T1).
 *
 * Import surface:
 *   - `lib/teammates`            — server-only data access
 *   - `@/types/teammate`         — the pure permission-grid contract
 *   - `lib/teammates/permissions` — the pure rules engine
 *
 * The data-access modules are `*.server.ts` on purpose: they import Prisma and
 * must never be pulled into a client bundle.
 */

export * from "./errors";
export * from "./company-scope";
export * from "./audit.server";
export * from "./companies.server";
export * from "./profiles.server";
export * from "./assignments.server";
export * from "./access.server";
