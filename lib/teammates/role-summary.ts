/**
 * role-summary — human-readable descriptions of each preset role, DERIVED from
 * the grids that are actually enforced.
 *
 * Why derived rather than written out: the UI explaining "Editor can do X" is
 * worthless if it drifts from `PRESET_PERMISSION_GRIDS`, which is what the API
 * checks. Every capability list below is computed from that table, so a change to
 * a preset updates the explainer automatically. Only the one-line summaries are
 * authored, because no grid can express things like "and ownership transfer".
 *
 * Pure module — no Prisma, no React — so the Settings UI and the verification
 * script share one implementation.
 */

import {
  COLLABORATOR_PRESET_ROLES,
  PERMISSION_FUNCTIONS,
  PERMISSION_FUNCTION_LABELS,
  PRESET_PERMISSION_GRIDS,
  PRESET_ROLE_LABELS,
  TEAM_MEMBER_PRESET_ROLES,
  isBinaryPermissionFunction,
  type PermissionFunction,
  type TeammatePresetRole,
} from "@/types/teammate";

export interface RoleCapability {
  role: TeammatePresetRole;
  label: string;
  /** One-line description, from the spec's role table. */
  summary: string;
  /** Who the preset is for. `both` = Viewer, which exists for each. */
  audience: "team_member" | "collaborator" | "both";
  /** Function labels the role may edit. */
  edit: string[];
  /** Function labels the role may read but not change. */
  view: string[];
  /** Function labels the role has No Access to. */
  none: string[];
  /** Binary rows (Publish / Invite / Delete) the role is Allowed. */
  allowed: string[];
  /** Binary rows the role is Not Allowed. */
  notAllowed: string[];
  /** True when the role holds no editing power at all. */
  isReadOnly: boolean;
}

/**
 * Summaries come from the spec's role table (page 3), which is the one thing the
 * permission grids cannot express — they say nothing about ownership transfer.
 */
const ROLE_SUMMARIES: Record<TeammatePresetRole, string> = {
  owner: "Everything, including billing and ownership transfer.",
  admin: "Everything except billing. Can publish and invite.",
  editor:
    "Create and edit within scope. Cannot publish, delete plans, or see billing.",
  contributor:
    "Edit the assigned categories only — typically an external specialist.",
  reviewer: "Read-only. Can review and approve a section.",
  viewer: "Read-only across everything they are assigned to.",
};

const ROLE_AUDIENCE: Record<
  TeammatePresetRole,
  RoleCapability["audience"]
> = {
  owner: "team_member",
  admin: "team_member",
  editor: "team_member",
  contributor: "collaborator",
  reviewer: "collaborator",
  viewer: "both",
};

/** Build the capability list for one preset straight from its grid. */
export function describeRole(role: TeammatePresetRole): RoleCapability {
  const grid = PRESET_PERMISSION_GRIDS[role];

  const edit: string[] = [];
  const view: string[] = [];
  const none: string[] = [];
  const allowed: string[] = [];
  const notAllowed: string[] = [];

  for (const fn of PERMISSION_FUNCTIONS as readonly PermissionFunction[]) {
    const label = PERMISSION_FUNCTION_LABELS[fn];
    const granted = grid[fn];

    if (isBinaryPermissionFunction(fn)) {
      (granted === "allowed" ? allowed : notAllowed).push(label);
      continue;
    }

    if (granted === "edit") edit.push(label);
    else if (granted === "view") view.push(label);
    else none.push(label);
  }

  return {
    role,
    label: PRESET_ROLE_LABELS[role],
    summary: ROLE_SUMMARIES[role],
    audience: ROLE_AUDIENCE[role],
    edit,
    view,
    none,
    allowed,
    notAllowed,
    isReadOnly: edit.length === 0,
  };
}

/** Every preset, grouped by who it is for. */
export function describeAllRoles(): {
  teamMembers: RoleCapability[];
  collaborators: RoleCapability[];
} {
  return {
    teamMembers: TEAM_MEMBER_PRESET_ROLES.map(describeRole),
    collaborators: COLLABORATOR_PRESET_ROLES.map(describeRole),
  };
}
