/**
 * permission-levels — the pure, client-safe half of the T2 permission model.
 *
 * Deliberately separate from `access.server.ts`: that module imports Prisma, so
 * importing it from a client component would pull the database client into the
 * browser bundle. The UI needs to answer "does this grid allow X?" in order to
 * hide or disable controls (spec T2 Part A item 1), and it must answer it with
 * exactly the same rule the API enforces — hence one shared implementation
 * rather than a second copy in the UI.
 *
 * No imports beyond the type contract.
 */

import { hasEdit, hasView } from "./permissions";
import type { PermissionFunction, TeammatePermissionSet } from "@/types/teammate";

/**
 * What a caller needs from a function row.
 *  - `view`    — tristate View or anything stronger. A binary `allowed` also
 *                satisfies it: someone permitted to publish may certainly look.
 *  - `edit`    — tristate Edit only.
 *  - `allowed` — binary rows only (Publish / Invite / Delete).
 */
export type RequiredLevel = "view" | "edit" | "allowed";

/**
 * Does a stored grid allow this function at this level?
 *
 * Callers must pass a grid that has already had collaborator hard blocks applied
 * (`applyHardBlocks` / `effectivePermissionSet`); this is a pure read.
 */
export function permissionAllows(
  set: TeammatePermissionSet,
  fn: PermissionFunction,
  required: RequiredLevel,
): boolean {
  const granted = set[fn];
  if (required === "allowed") return granted === "allowed";
  if (required === "edit") return hasEdit(granted);
  // "view": tristate view/edit, or a binary "allowed".
  return hasView(granted) || granted === "allowed";
}

/**
 * Bind `permissionAllows` to one grid. Owners have no grid — pass `null` and
 * every check passes, which is exactly the owner rule.
 */
export function createPermissionChecker(
  set: TeammatePermissionSet | null | undefined,
): (fn: PermissionFunction, required?: RequiredLevel) => boolean {
  if (!set) return () => true;
  return (fn, required = "view") => permissionAllows(set, fn, required);
}
