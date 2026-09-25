/**
 * teammate — the canonical Team & Collaborator Access contract.
 *
 * Source: Team_Collaborator_Access_Developer_Spec (1).pdf, tickets T1 and T2a.
 *
 * This module is deliberately dependency-free (no Prisma import, no React) so it
 * can be consumed by the dashboard, the API layer, and the verification script
 * alike. It is the single place that knows:
 *
 *   - what a person's `type`, `state`, and `role` can be;
 *   - the full function-level permission grid (14 functions) and its levels;
 *   - the default grid each preset role writes onto an assignment;
 *   - which functions an external collaborator can never be granted.
 *
 * Spec rule that shapes everything here (T1 Part B item 3, T2a Part B item 5):
 * an assignment stores the FULL permission set, never a reference to a preset.
 * Presets are therefore expressed as grids and copied at write time, so editing
 * a preset later cannot retroactively change a Custom user.
 */

/* ─────────────────────────────── People ─────────────────────────────── */

/**
 * Team Member: internal to the advisor's organization (assistant, paraplanner,
 * service associate, co-advisor, compliance). Uses a paid seat.
 *
 * Collaborator: external (plan sponsor HR, outside benefits advisor, TPA,
 * recordkeeper contact, provider rep). Free; counts toward a per-plan
 * collaborator cap.
 */
export type TeammatePersonType = "team_member" | "collaborator";

/**
 * Profile lifecycle. A Contact has no login and counts toward no cap; it can be
 * upgraded to Invited (which reserves a Team Member seat) and then Active on
 * acceptance. The profile itself is never replaced — only its state changes.
 */
export type TeammateProfileState = "contact" | "invited" | "active";

/**
 * Assignment role. `custom` is not a preset: it carries an edited grid.
 * See PRESET_ROLES for the six roles that have a default grid.
 */
export type TeammateAssignmentRole =
  | "owner"
  | "admin"
  | "editor"
  | "viewer"
  | "contributor"
  | "reviewer"
  | "custom";

/** The six preset roles (everything except `custom`). */
export type TeammatePresetRole = Exclude<TeammateAssignmentRole, "custom">;

export const PRESET_ROLES: readonly TeammatePresetRole[] = [
  "owner",
  "admin",
  "editor",
  "viewer",
  "contributor",
  "reviewer",
] as const;

/** Presets that only make sense for a Team Member (internal) seat. */
export const TEAM_MEMBER_PRESET_ROLES: readonly TeammatePresetRole[] = [
  "owner",
  "admin",
  "editor",
  "viewer",
] as const;

/** Presets available to a Collaborator (external). Note: no Owner/Admin. */
export const COLLABORATOR_PRESET_ROLES: readonly TeammatePresetRole[] = [
  "contributor",
  "reviewer",
  "viewer",
] as const;

/* ─────────────────────────────── Plans ─────────────────────────────── */

/**
 * Plan scope. Collaborators never get `all_plans` (spec T2a: "All Plans is
 * shown for Team Members only. It is hidden for Collaborators.").
 */
export type TeammatePlanScope = "this_plan" | "certain_plans" | "all_plans";

export const TEAM_MEMBER_PLAN_SCOPES: readonly TeammatePlanScope[] = [
  "this_plan",
  "certain_plans",
  "all_plans",
] as const;

export const COLLABORATOR_PLAN_SCOPES: readonly TeammatePlanScope[] = [
  "this_plan",
  "certain_plans",
] as const;

/** Category scope on an assignment. Mirrors the Prisma enum. */
export type TeammateCategoryScope = "all" | "selected";

/* ──────────────────────── Permission grid ──────────────────────── */

/**
 * The 14 functions in the T2a grid. The first nine are the row-by-row
 * `No Access / View / Edit` rows; Publish, Invite, and Delete are binary; Org
 * Settings and Billing come from the "what the invitee type allows" table.
 */
export type PermissionFunction =
  | "plan_details_branding"
  | "create_benefits"
  | "key_contacts"
  | "documents"
  | "meetings"
  | "marketing"
  | "video"
  | "disclaimers_compliance"
  | "benefits_hub_preview"
  | "publish"
  | "invite"
  | "delete"
  | "org_settings"
  | "billing";

/** `No Access / View / Edit` rows. */
export type TristateAccess = "no_access" | "view" | "edit";

/** `Not Allowed / Allowed` rows. */
export type BinaryAccess = "not_allowed" | "allowed";

export type PermissionAccess = TristateAccess | BinaryAccess;

/**
 * The full grid. Every assignment stores one of these; presets write their
 * default, Custom writes the edited version.
 */
export type TeammatePermissionSet = Record<PermissionFunction, PermissionAccess>;

/** Display labels, in grid order (spec T2a Step 3). */
export const PERMISSION_FUNCTION_LABELS: Record<PermissionFunction, string> = {
  plan_details_branding: "Plan Details & Branding",
  create_benefits: "Create Benefits",
  key_contacts: "Key Contacts",
  documents: "Documents",
  meetings: "Meetings",
  marketing: "Marketing",
  video: "Video",
  disclaimers_compliance: "Disclaimers / Compliance",
  benefits_hub_preview: "Benefits Hub Preview",
  publish: "Publish",
  invite: "Invite Team or Collaborators",
  delete: "Delete",
  org_settings: "Org Settings",
  billing: "Billing",
};

/** Grid order, top to bottom (spec T2a Step 3 table). */
export const PERMISSION_FUNCTIONS: readonly PermissionFunction[] = [
  "plan_details_branding",
  "create_benefits",
  "key_contacts",
  "documents",
  "meetings",
  "marketing",
  "video",
  "disclaimers_compliance",
  "benefits_hub_preview",
  "publish",
  "invite",
  "delete",
  "org_settings",
  "billing",
] as const;

/** Binary rows render `Not Allowed / Allowed`; everything else is tristate. */
export const BINARY_PERMISSION_FUNCTIONS: readonly PermissionFunction[] = [
  "publish",
  "invite",
  "delete",
] as const;

export function isBinaryPermissionFunction(
  fn: PermissionFunction,
): boolean {
  return BINARY_PERMISSION_FUNCTIONS.includes(fn);
}

/** Selectable options for a row, in the order the radio group renders them. */
export function permissionOptionsFor(
  fn: PermissionFunction,
): readonly PermissionAccess[] {
  if (isBinaryPermissionFunction(fn)) return ["not_allowed", "allowed"];
  if (fn === "benefits_hub_preview") return ["no_access", "view"];
  return ["no_access", "view", "edit"];
}

/**
 * Functions an external collaborator can NEVER be granted, including by direct
 * API call (spec T2a Part B item 3: hard blocks, cannot be overridden).
 * `benefits_hub_preview` is not listed: it already tops out at View.
 */
export const COLLABORATOR_LOCKED_FUNCTIONS: readonly PermissionFunction[] = [
  "publish",
  "invite",
  "delete",
  "org_settings",
  "billing",
] as const;

/** The value a locked function is forced to when the person is a collaborator. */
export function lockedValueFor(fn: PermissionFunction): PermissionAccess {
  return isBinaryPermissionFunction(fn) ? "not_allowed" : "no_access";
}

/** Text shown beside a locked row in the Custom grid. */
export const COLLABORATOR_LOCK_REASON =
  "Not available for external collaborators.";

/* ─────────────────────────── Preset grids ─────────────────────────── */

/**
 * Grids are built from a base so the differences between presets stay readable
 * and auditable against the spec's role table.
 */
const NO_ACCESS_GRID: TeammatePermissionSet = {
  plan_details_branding: "no_access",
  create_benefits: "no_access",
  key_contacts: "no_access",
  documents: "no_access",
  meetings: "no_access",
  marketing: "no_access",
  video: "no_access",
  disclaimers_compliance: "no_access",
  benefits_hub_preview: "no_access",
  publish: "not_allowed",
  invite: "not_allowed",
  delete: "not_allowed",
  org_settings: "no_access",
  billing: "no_access",
};

/** Read-only grid: View on every content row, viewable preview, nothing else. */
const READ_ONLY_GRID: TeammatePermissionSet = {
  ...NO_ACCESS_GRID,
  plan_details_branding: "view",
  create_benefits: "view",
  key_contacts: "view",
  documents: "view",
  meetings: "view",
  marketing: "view",
  video: "view",
  disclaimers_compliance: "view",
  benefits_hub_preview: "view",
};

/**
 * Default grids per preset.
 *
 * Spec role summaries these encode:
 * - Owner: everything, including billing and ownership transfer.
 * - Admin: everything except billing; can publish and invite.
 * - Editor: create and edit within scope; cannot publish, delete plans, or see billing.
 * - Contributor (collaborator): edit assigned categories only.
 * - Viewer / Reviewer: read-only.
 *
 * The collaborator presets intentionally leave the locked functions at their
 * denied value; T2a's hard-block pass enforces the same outcome regardless.
 */
export const PRESET_PERMISSION_GRIDS: Record<
  TeammatePresetRole,
  TeammatePermissionSet
> = {
  owner: {
    plan_details_branding: "edit",
    create_benefits: "edit",
    key_contacts: "edit",
    documents: "edit",
    meetings: "edit",
    marketing: "edit",
    video: "edit",
    disclaimers_compliance: "edit",
    benefits_hub_preview: "view",
    publish: "allowed",
    invite: "allowed",
    delete: "allowed",
    org_settings: "edit",
    billing: "edit",
  },
  admin: {
    plan_details_branding: "edit",
    create_benefits: "edit",
    key_contacts: "edit",
    documents: "edit",
    meetings: "edit",
    marketing: "edit",
    video: "edit",
    disclaimers_compliance: "edit",
    benefits_hub_preview: "view",
    publish: "allowed",
    invite: "allowed",
    delete: "allowed",
    org_settings: "edit",
    billing: "no_access",
  },
  editor: {
    ...READ_ONLY_GRID,
    plan_details_branding: "edit",
    create_benefits: "edit",
    key_contacts: "edit",
    documents: "edit",
    meetings: "edit",
    marketing: "edit",
    video: "edit",
    disclaimers_compliance: "edit",
  },
  contributor: {
    ...READ_ONLY_GRID,
    plan_details_branding: "view",
    create_benefits: "edit",
    key_contacts: "edit",
    documents: "edit",
    meetings: "edit",
  },
  viewer: { ...READ_ONLY_GRID },
  reviewer: { ...READ_ONLY_GRID },
};

/** Human labels for role dropdowns and summaries. */
export const PRESET_ROLE_LABELS: Record<TeammateAssignmentRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  contributor: "Contributor",
  reviewer: "Reviewer",
  custom: "Custom",
};

export const PERSON_TYPE_LABELS: Record<TeammatePersonType, string> = {
  team_member: "Team Member",
  collaborator: "Collaborator",
};

export const PROFILE_STATE_LABELS: Record<TeammateProfileState, string> = {
  contact: "Contact",
  invited: "Invited",
  active: "Active",
};

/* ─────────────────────────── Constructors ─────────────────────────── */

/** A fresh, fully-denied grid. Never renders as a blank Custom screen (T2a). */
export function emptyPermissionSet(): TeammatePermissionSet {
  return { ...NO_ACCESS_GRID };
}

/**
 * The grid a preset writes at assignment-creation time. Returns a copy so
 * callers can mutate freely without touching the shared preset table.
 */
export function presetPermissionSet(
  role: TeammatePresetRole,
): TeammatePermissionSet {
  return { ...PRESET_PERMISSION_GRIDS[role] };
}

/** Are two grids identical? Used by the "matches a preset exactly" warning. */
export function permissionSetsEqual(
  a: TeammatePermissionSet,
  b: TeammatePermissionSet,
): boolean {
  return PERMISSION_FUNCTIONS.every((fn) => a[fn] === b[fn]);
}

/** Coerce unknown JSON (e.g. a stored value) into a complete grid. */
export function normalizePermissionSet(
  raw: unknown,
): TeammatePermissionSet {
  const grid = emptyPermissionSet();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return grid;
  const source = raw as Record<string, unknown>;
  for (const fn of PERMISSION_FUNCTIONS) {
    const value = source[fn];
    if (typeof value !== "string") continue;
    if ((permissionOptionsFor(fn) as readonly string[]).includes(value)) {
      grid[fn] = value as PermissionAccess;
    }
  }
  return grid;
}

/* ──────────────────────── Assignment records ──────────────────────── */

/**
 * The category scope of an assignment as the spec describes it: every category
 * on the plan, or a picked list.
 */
export interface TeammateAssignmentScope {
  categoryScope: TeammateCategoryScope;
  /** Only meaningful when `categoryScope` is `selected`. */
  categories: string[];
}

/** Convenience: does this assignment cover the given category? */
export function assignmentCoversCategory(
  scope: TeammateAssignmentScope,
  category: string,
): boolean {
  if (scope.categoryScope === "all") return true;
  const target = category.trim().toLowerCase();
  return scope.categories.some((c) => c.trim().toLowerCase() === target);
}

/**
 * The "Who is this?" answers offered when inviting a collaborator (spec T4).
 * Kept here so the invite dialog and the preset mapping cannot drift.
 */
export type CollaboratorInviteReason =
  | "plan_sponsor_hr"
  | "outside_advisor_specialist"
  | "provider_rep"
  | "reviewer_only";

export const COLLABORATOR_INVITE_REASON_LABELS: Record<
  CollaboratorInviteReason,
  string
> = {
  plan_sponsor_hr: "Plan Sponsor HR",
  outside_advisor_specialist: "Outside Advisor / Specialist",
  provider_rep: "Provider Rep",
  reviewer_only: "Reviewer only",
};

/**
 * Spec T4 Part B item 1: "Who is this?" maps to presets. The first three map to
 * Contributor (category-scoped edit); "Reviewer only" maps to Reviewer.
 *
 * Note: this is the default role — the user can still open "Customize access".
 */
export const INVITE_REASON_TO_ROLE: Record<
  CollaboratorInviteReason,
  TeammatePresetRole
> = {
  plan_sponsor_hr: "contributor",
  outside_advisor_specialist: "contributor",
  provider_rep: "contributor",
  reviewer_only: "reviewer",
};
