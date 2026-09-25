/**
 * permissions — the Team & Collaborator Access rules engine.
 *
 * Source: Team_Collaborator_Access_Developer_Spec (1).pdf, ticket T2a Part B
 * ("What the invitee type allows", "Auto-enforced rules", "Hard blocks", "Soft
 * warnings", "Save and audit"). T1 owns this module because T2a explicitly
 * states it needs no schema change — only a UI over the contract and rules that
 * live here.
 *
 * Design rules:
 *  - Pure functions only. No Prisma, no React, no session reads. The API layer
 *    calls these and persists the result.
 *  - The grid stored on an assignment is always the FULL, already-coerced grid.
 *  - Auto-enforced rules are applied silently (the user never sees the change).
 *  - Hard blocks are unrecoverable; they hold for direct API calls too.
 *  - Soft warnings do not block a save — the user confirms and proceeds.
 */

import {
  BINARY_PERMISSION_FUNCTIONS,
  COLLABORATOR_LOCKED_FUNCTIONS,
  PERMISSION_FUNCTION_LABELS,
  PERMISSION_FUNCTIONS,
  PRESET_PERMISSION_GRIDS,
  PRESET_ROLE_LABELS,
  isBinaryPermissionFunction,
  lockedValueFor,
  normalizePermissionSet,
  permissionOptionsFor,
  permissionSetsEqual,
  presetPermissionSet,
  type PermissionAccess,
  type PermissionFunction,
  type TeammateAssignmentRole,
  type TeammatePermissionSet,
  type TeammatePersonType,
  type TeammatePlanScope,
  type TeammatePresetRole,
} from "@/types/teammate";

/* ───────────────────────── Grid construction ───────────────────────── */

/** Is this a preset role (as opposed to `custom`)? */
export function isPresetRole(
  role: TeammateAssignmentRole,
): role is TeammatePresetRole {
  return role !== "custom";
}

/**
 * The grid a preset role writes. For `custom`, pass the edited grid explicitly.
 * Always returns a complete, normalized copy.
 */
export function resolveAssignmentGrid({
  role,
  personType,
  customSet,
}: {
  role: TeammateAssignmentRole;
  personType: TeammatePersonType;
  /** Required when `role` is `custom`; ignored for presets. */
  customSet?: unknown;
}): TeammatePermissionSet {
  const base = isPresetRole(role)
    ? presetPermissionSet(role)
    : normalizePermissionSet(customSet);
  return finalizePermissionSet(base, personType);
}

/**
 * The full pipeline the API layer should run before persisting:
 * auto-enforced rules, then collaborator hard blocks.
 */
export function finalizePermissionSet(
  input: unknown,
  personType: TeammatePersonType,
): TeammatePermissionSet {
  const normalized = applyAutoEnforcedRules(normalizePermissionSet(input));
  return applyHardBlocks(normalized, personType);
}

/* ───────────────────────── Auto-enforced rules ───────────────────────── */

/**
 * Spec T2a Part B item 2 — applied silently:
 *
 *  1. "Edit on a function turns on View for it."
 *     Levels are already ordered (edit ⊃ view), so this needs no rewriting. Its
 *     observable effect is on the derived checks below, which treat `edit` as
 *     satisfying `view`.
 *
 *  2. "Delete requires Edit on the same function."
 *     The Delete row is plan-wide rather than per-function, so we read it as
 *     "Delete is only meaningful for someone who can edit content": at least one
 *     content function must be at `edit`. If not, Delete is coerced down.
 *
 *  3. "Publish requires View on all categories in the plan, plus View on
 *     Disclaimers."
 *     The category half needs plan context and is reported as a violation by
 *     `validatePermissionSet` (it cannot be resolved silently). The Disclaimers
 *     half is enforced here.
 *
 * Also coerces structurally-invalid values: `benefits_hub_preview` tops out at
 * View, so an incoming `edit` is clamped to `view` rather than denied.
 */
export function applyAutoEnforcedRules(
  input: TeammatePermissionSet,
): TeammatePermissionSet {
  const set: TeammatePermissionSet = { ...input };

  // Rows whose options are narrower than the incoming value: clamp, never deny.
  for (const fn of PERMISSION_FUNCTIONS) {
    const options = permissionOptionsFor(fn);
    if (!options.includes(set[fn])) {
      set[fn] = nearestAllowedValue(fn, set[fn]);
    }
  }

  // Publish requires Disclaimers View.
  if (set.publish === "allowed" && !hasView(set.disclaimers_compliance)) {
    set.publish = "not_allowed";
  }

  // Delete requires Edit on at least one content function.
  if (set.delete === "allowed" && !hasAnyContentEdit(set)) {
    set.delete = "not_allowed";
  }

  return set;
}

/** Does this level grant at least View? (`edit` implies `view`.) */
export function hasView(access: PermissionAccess): boolean {
  return access === "view" || access === "edit";
}

/** Does this level grant Edit? */
export function hasEdit(access: PermissionAccess): boolean {
  return access === "edit";
}

/** Content functions whose Edit satisfies the Delete precondition. */
export const CONTENT_FUNCTIONS: readonly PermissionFunction[] = [
  "plan_details_branding",
  "create_benefits",
  "key_contacts",
  "documents",
  "meetings",
  "marketing",
  "video",
  "disclaimers_compliance",
] as const;

function hasAnyContentEdit(set: TeammatePermissionSet): boolean {
  return CONTENT_FUNCTIONS.some((fn) => hasEdit(set[fn]));
}

/**
 * Clamp a value into the row's allowed options, preferring the closest lower
 * level so a user never silently loses more access than necessary.
 */
function nearestAllowedValue(
  fn: PermissionFunction,
  value: PermissionAccess,
): PermissionAccess {
  const options = permissionOptionsFor(fn);
  if (options.includes(value)) return value;
  // Binary rows: anything that isn't Allowed is Not Allowed.
  if (isBinaryPermissionFunction(fn)) return "not_allowed";
  // Tristate rows: Edit → View; anything unrecognised → No Access.
  if (value === "edit" && options.includes("view")) return "view";
  return "no_access";
}

/* ─────────────────────────── Hard blocks ─────────────────────────── */

/**
 * Spec T2a Part B item 3. Collaborators can never hold Publish, Invite, Delete,
 * Org Settings, or Billing. This is NOT overridable — not by the UI, not by a
 * direct API call. The API layer must call this immediately before persisting,
 * so a tampered request body cannot smuggle a locked permission through.
 */
export function applyHardBlocks(
  input: TeammatePermissionSet,
  personType: TeammatePersonType,
): TeammatePermissionSet {
  if (personType !== "collaborator") return { ...input };

  const set: TeammatePermissionSet = { ...input };
  for (const fn of COLLABORATOR_LOCKED_FUNCTIONS) {
    set[fn] = lockedValueFor(fn);
  }
  return set;
}

/** Which locked functions, if any, an incoming grid tries to grant? */
export function lockedFunctionViolations(
  input: TeammatePermissionSet,
  personType: TeammatePersonType,
): PermissionFunction[] {
  if (personType !== "collaborator") return [];
  return COLLABORATOR_LOCKED_FUNCTIONS.filter(
    (fn) => input[fn] !== lockedValueFor(fn),
  );
}

/**
 * Collaborators may not be granted All Plans (spec Open Decisions: default is
 * No). Team Members may.
 */
export function isPlanScopeAllowed(
  scope: TeammatePlanScope,
  personType: TeammatePersonType,
): boolean {
  if (scope === "all_plans") return personType === "team_member";
  return true;
}

/* ──────────────────────────── Validation ──────────────────────────── */

export interface PermissionViolation {
  code:
    | "collaborator_locked_function"
    | "collaborator_all_plans"
    | "publish_requires_disclaimers_view"
    | "publish_missing_category_view"
    | "delete_requires_content_edit"
    | "invalid_level";
  message: string;
  function?: PermissionFunction;
}

/**
 * Structural validation. A grid that passes `finalizePermissionSet` should
 * produce no violations; this exists to catch anything that bypassed the
 * pipeline (and to give the API a 400 it can act on).
 *
 * `publishCategoryCoverage` is optional plan context: pass the categories the
 * assignment covers and the categories that are active on the plan to have the
 * "View on all categories" half of the Publish rule checked.
 */
export function validatePermissionSet(
  input: unknown,
  personType: TeammatePersonType,
  options?: {
    planScope?: TeammatePlanScope;
    publishCategoryCoverage?: {
      coveredCategories: string[];
      activeCategories: string[];
      hiddenCategories?: string[];
    };
  },
): PermissionViolation[] {
  const violations: PermissionViolation[] = [];
  const set = normalizePermissionSet(input);

  for (const fn of PERMISSION_FUNCTIONS) {
    if (!permissionOptionsFor(fn).includes(set[fn])) {
      violations.push({
        code: "invalid_level",
        function: fn,
        message: `${PERMISSION_FUNCTION_LABELS[fn]} has an invalid access level.`,
      });
    }
  }

  // Collaborator hard blocks.
  for (const fn of lockedFunctionViolations(set, personType)) {
    violations.push({
      code: "collaborator_locked_function",
      function: fn,
      message: `${PERMISSION_FUNCTION_LABELS[fn]} is not available for external collaborators.`,
    });
  }

  if (options?.planScope && !isPlanScopeAllowed(options.planScope, personType)) {
    violations.push({
      code: "collaborator_all_plans",
      message: "All Plans is not available for external collaborators.",
    });
  }

  // Auto-enforced preconditions, reported so callers can see why a value was
  // (or would be) coerced.
  if (set.publish === "allowed" && !hasView(set.disclaimers_compliance)) {
    violations.push({
      code: "publish_requires_disclaimers_view",
      function: "publish",
      message:
        "Publish requires View on Disclaimers / Compliance.",
    });
  }

  if (set.publish === "allowed" && options?.publishCategoryCoverage) {
    const { coveredCategories, activeCategories } =
      options.publishCategoryCoverage;
    const active = activeCategories.map(normalizeCategory);
    const covered = coveredCategories.map(normalizeCategory);
    const missing = active.filter((c) => !covered.includes(c));
    if (missing.length > 0) {
      violations.push({
        code: "publish_missing_category_view",
        function: "publish",
        message:
          "Publish requires View on every category in the plan.",
      });
    }
  }

  if (set.delete === "allowed" && !hasAnyContentEdit(set)) {
    violations.push({
      code: "delete_requires_content_edit",
      function: "delete",
      message: "Delete requires Edit on at least one content function.",
    });
  }

  return violations;
}

/* ───────────────────────── Soft warnings ───────────────────────── */

export type SoftWarningCode =
  | "collaborator_multi_plan_edit"
  | "collaborator_three_plus_plans"
  | "collaborator_all_categories_edit"
  | "category_not_active"
  | "per_plan_permissions_differ"
  | "team_member_billing_non_admin"
  | "marketing_edit_without_meetings_view"
  | "publish_without_documents_or_marketing_view"
  | "edit_on_hidden_category"
  | "matches_preset_exactly";

export interface SoftWarning {
  code: SoftWarningCode;
  message: string;
  /** The plan a per-plan warning fired for, when applicable. */
  planId?: string;
}

/** One assignment as the warning checks see it. */
export interface SoftWarningAssignment {
  planId: string;
  planName: string;
  /** Categories currently active (set up) on the plan. */
  activeCategories: string[];
  /** Categories hidden on the Benefits Hub. */
  hiddenCategories?: string[];
  /** Categories this assignment grants access to. */
  coveredCategories: string[];
  permissionSet: TeammatePermissionSet;
}

export interface SoftWarningContext {
  personType: TeammatePersonType;
  role: TeammateAssignmentRole;
  assignments: SoftWarningAssignment[];
}

/**
 * Spec T2a Part B item 4: soft warnings are checked per plan. They never block a
 * save — the caller surfaces them inline, and again on Save as a single confirm,
 * then records the confirmed codes on the audit event.
 */
export function evaluateSoftWarnings(
  context: SoftWarningContext,
): SoftWarning[] {
  const warnings: SoftWarning[] = [];
  const { personType, role, assignments } = context;

  if (assignments.length === 0) {
    // Role-level checks still apply to a single-plan invite.
    for (const w of roleLevelWarnings(personType, role, assignments)) {
      warnings.push(w);
    }
    return warnings;
  }

  warnings.push(...roleLevelWarnings(personType, role, assignments));

  // Per-plan checks.
  for (const assignment of assignments) {
    const { planName, planId, permissionSet } = assignment;
    const active = assignment.activeCategories.map(normalizeCategory);
    const covered = assignment.coveredCategories.map(normalizeCategory);
    const hidden = (assignment.hiddenCategories ?? []).map(normalizeCategory);

    // "Selected category isn't active on an added plan"
    for (const category of assignment.coveredCategories) {
      if (active.length > 0 && !active.includes(normalizeCategory(category))) {
        warnings.push({
          code: "category_not_active",
          planId,
          message: `${category} isn't set up on ${planName} yet. Access will apply once it's added.`,
        });
      }
    }

    // "Marketing Edit without Meetings View"
    if (hasEdit(permissionSet.marketing) && !hasView(permissionSet.meetings)) {
      warnings.push({
        code: "marketing_edit_without_meetings_view",
        planId,
        message:
          "Marketing assets pull meeting details. This user won't see them.",
      });
    }

    // "Publish Allowed with No Access on Documents or Marketing"
    if (
      permissionSet.publish === "allowed" &&
      (permissionSet.documents === "no_access" ||
        permissionSet.marketing === "no_access")
    ) {
      warnings.push({
        code: "publish_without_documents_or_marketing_view",
        planId,
        message: "This user can publish content they can't review.",
      });
    }

    // "Edit assigned to a hidden category"
    if (hasEdit(permissionSet.create_benefits)) {
      for (const category of covered) {
        if (hidden.includes(category)) {
          warnings.push({
            code: "edit_on_hidden_category",
            planId,
            message: "This category is hidden on the Benefits Hub.",
          });
          break;
        }
      }
    }

    // "Collaborator with Edit on all categories in a plan"
    if (
      personType === "collaborator" &&
      active.length > 0 &&
      active.every((c) => covered.includes(c)) &&
      hasEdit(permissionSet.create_benefits)
    ) {
      warnings.push({
        code: "collaborator_all_categories_edit",
        planId,
        message:
          "This collaborator can edit every benefits category. Most are limited to their specialty.",
      });
    }
  }

  return warnings;
}

/** Warnings that depend only on the person, not on a specific plan. */
function roleLevelWarnings(
  personType: TeammatePersonType,
  role: TeammateAssignmentRole,
  assignments: SoftWarningAssignment[],
): SoftWarning[] {
  const warnings: SoftWarning[] = [];

  const editsOnSomePlan = assignments.filter((a) =>
    PERMISSION_FUNCTIONS.some((fn) => hasEdit(a.permissionSet[fn])),
  ).length;

  // "Collaborator with Edit on 2+ plans"
  if (personType === "collaborator" && editsOnSomePlan >= 2) {
    warnings.push({
      code: "collaborator_multi_plan_edit",
      message:
        "This external collaborator can edit multiple plans. Collaborators usually work on one plan.",
    });
  }

  // "Collaborator added to 3+ plans"
  if (personType === "collaborator" && assignments.length >= 3) {
    warnings.push({
      code: "collaborator_three_plus_plans",
      message:
        "This collaborator is assigned to 3+ plans. Consider a Team Member seat if they work with you regularly.",
    });
  }

  // "Team Member with Billing but not Owner/Admin"
  const anyBilling = assignments.some(
    (a) => a.permissionSet.billing !== "no_access",
  );
  if (
    personType === "team_member" &&
    anyBilling &&
    role !== "owner" &&
    role !== "admin"
  ) {
    warnings.push({
      code: "team_member_billing_non_admin",
      message: "Billing access is usually limited to Owners.",
    });
  }

  // "Per-plan permissions differ widely"
  if (assignments.length >= 2) {
    const distinct = new Set(
      assignments.map((a) => JSON.stringify(sortSet(a.permissionSet))),
    );
    if (distinct.size >= 2 && assignments.length >= 3) {
      warnings.push({
        code: "per_plan_permissions_differ",
        message: "Access varies significantly between plans. Review before saving.",
      });
    }
  }

  // "Custom settings match a preset exactly"
  if (role === "custom" && assignments.length > 0) {
    const match = matchPreset(assignments[0].permissionSet);
    if (match) {
      warnings.push({
        code: "matches_preset_exactly",
        message: `This matches ${PRESET_ROLE_LABELS[match]}. Use the preset instead?`,
      });
    }
  }

  return warnings;
}

/** Which preset, if any, does this grid exactly reproduce? */
export function matchPreset(
  set: TeammatePermissionSet,
): TeammatePresetRole | null {
  for (const role of Object.keys(
    PRESET_PERMISSION_GRIDS,
  ) as TeammatePresetRole[]) {
    if (permissionSetsEqual(set, PRESET_PERMISSION_GRIDS[role])) return role;
  }
  return null;
}

/* ──────────────────────────── Summaries ──────────────────────────── */

/** Edit priority used to pick the headline capability in a summary clause. */
const SUMMARY_EDIT_PRIORITY: readonly PermissionFunction[] = [
  "documents",
  "create_benefits",
  "key_contacts",
  "meetings",
  "marketing",
  "video",
  "disclaimers_compliance",
  "plan_details_branding",
] as const;

/**
 * Spec T2a Step 3 item 5: a plan-aware summary line under the name, e.g.
 * "Custom · Edits Documents on Ayres · Views Precision Optical".
 *
 * Only the first two clauses are rendered by convention; the caller can join the
 * whole list if it has room.
 */
export function summarizePermissionSet(context: SoftWarningContext): string {
  const prefix = PRESET_ROLE_LABELS[context.role] ?? "Custom";
  const clauses = context.assignments.map((assignment) => {
    const editFn = SUMMARY_EDIT_PRIORITY.find((fn) =>
      hasEdit(assignment.permissionSet[fn]),
    );
    if (editFn) {
      return `Edits ${PERMISSION_FUNCTION_LABELS[editFn]} on ${assignment.planName}`;
    }
    return `Views ${assignment.planName}`;
  });
  return [prefix, ...clauses].join(" · ");
}

/* ───────────────────────────── Helpers ───────────────────────────── */

function normalizeCategory(category: string): string {
  return (category || "").trim().toLowerCase();
}

function sortSet(set: TeammatePermissionSet): TeammatePermissionSet {
  const out = {} as TeammatePermissionSet;
  for (const fn of PERMISSION_FUNCTIONS) out[fn] = set[fn];
  return out;
}

/** Binary rows, re-exported for the grid UI in T2a. */
export { BINARY_PERMISSION_FUNCTIONS };
