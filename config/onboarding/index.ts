/**
 * Single entry point for the onboarding option configuration.
 *
 * These lists are keyed by STABLE IDS (enums, or the designation ids in
 * `designations.ts`). Components read their labels from here, and answers are
 * stored as ids — so labels/descriptions/copy can change without code edits
 * leaking into stored data or requiring a migration.
 */
export * from "./organization-types";
export * from "./team-sizes";
export * from "./designations";
export * from "./disclosures";
export * from "./service-categories";
