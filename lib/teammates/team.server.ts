/**
 * team.server — Team Member management (spec T3).
 *
 * Covers Part A's data needs (the Settings → Team list, and the Add Team Member
 * form's plan/category access) and Part B's rules that are not seat-specific
 * (the email-domain guess, seat consumption only for Team Members).
 *
 * The governing idea from the spec's Core Concepts: the PERSON is created once and
 * reused, while plan and category scope live on assignments. Adding a Team Member
 * with "All Plans + All Categories" therefore materialises one assignment per plan,
 * all carrying the same grid — and re-adding an existing person adds assignments
 * instead of creating a second profile.
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";
import { TeammateDataError } from "./errors";
import {
  createTeammateProfile,
  deactivateTeammateProfile,
  findProfileByEmail,
  reactivateTeammateProfile,
  setProfileAllPlans,
  updateTeammateProfile,
} from "./profiles.server";
import { removeAssignment, upsertAssignment } from "./assignments.server";
import {
  assertSeatAvailable,
  getSeatUsage,
  guessPersonTypeForEmail,
  type SeatUsage,
} from "./seats.server";
import type {
  TeammateAssignmentRole,
  TeammateCategoryScope,
  TeammatePersonType,
  TeammateProfileState,
} from "@/types/teammate";

/** Spec T3 Part A item 2: This Plan / Certain Plans / All Plans. */
export type TeamPlanScope = "this_plan" | "certain_plans" | "all_plans";

/** Spec T3 Part A item 2: benefits access is All / Certain. */
export type TeamCategoryScope = "all" | "certain";

export interface AddTeamMemberInput {
  organizationId: string;
  actorUserId: string;
  /** Display name; split into first/last. */
  name?: string | null;
  email: string;
  /** Overrides the email-domain guess when the user changes it. */
  type?: TeammatePersonType;
  role?: TeammateAssignmentRole;
  /** Defaults to `all_plans` (spec: "Default: All Plans + All Categories"). */
  planScope?: TeamPlanScope;
  /** Used when `planScope` is `certain_plans`. */
  planIds?: string[];
  /** Used when `planScope` is `this_plan`. */
  planId?: string | null;
  /** Defaults to `all`. */
  categoryScope?: TeamCategoryScope;
  /** Used when `categoryScope` is `certain`. */
  categories?: string[];
  /** Spec T3 item 3: pass true only once the upgrade confirm is accepted. */
  confirmUpgrade?: boolean;
}

export interface AddTeamMemberResult {
  profileId: string;
  personType: TeammatePersonType;
  /** Always `invited`: adding a Team Member sends an invite. */
  state: TeammateProfileState;
  assignmentIds: string[];
  seats: SeatUsage;
}

/** Spec T3 Part A item 2 default: All Plans + All Categories. */
const DEFAULT_PLAN_SCOPE: TeamPlanScope = "all_plans";
const DEFAULT_CATEGORY_SCOPE: TeamCategoryScope = "all";

/**
 * Add a Team Member (or Collaborator) and wire up their plan/category access.
 *
 * Order matters: the domain guess runs first so the seat check knows whether a
 * seat is even involved (spec T3 item 1 — only Team Members consume seats), and
 * the seat check runs BEFORE any write so a refused add leaves nothing behind.
 */
export async function addTeamMember(
  input: AddTeamMemberInput,
): Promise<AddTeamMemberResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!email) {
    throw new TeammateDataError("An email address is required.", 400);
  }

  // Spec T3 item 4 / Core Concepts: matching domain → Team Member, else
  // Collaborator. Only a default — `input.type` overrides it.
  const personType: TeammatePersonType =
    input.type ?? (await guessPersonTypeForEmail({ organizationId: input.organizationId, email }));

  if (personType === "team_member") {
    // Throws 409 `seat_limit` (or 403 `seat_limit_owner_only`) rather than hard
    // blocking, so the UI can render the upgrade confirm.
    await assertSeatAvailable({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      confirmUpgrade: input.confirmUpgrade === true,
    });
  }

  const planScope = input.planScope ?? DEFAULT_PLAN_SCOPE;
  const categoryScopeInput = input.categoryScope ?? DEFAULT_CATEGORY_SCOPE;

  // Reuse the person if this organization already knows the email — "a second
  // invite adds an assignment, not a new profile".
  const existing = await findProfileByEmail(input.organizationId, email);
  if (existing?.deactivatedAt) {
    throw new TeammateDataError(
      "A deactivated profile exists for this email. Reactivate it instead of re-adding.",
      409,
      "profile_email_deactivated",
    );
  }

  const trimmedName = (input.name ?? "").trim();
  const [firstName, ...restName] = trimmedName.split(/\s+/).filter(Boolean);
  const lastName = restName.length > 0 ? restName.join(" ") : null;

  const profile =
    existing ??
    (await createTeammateProfile({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      type: personType,
      email,
      firstName: firstName ?? null,
      lastName,
      // Team-Member-only: makes every NEW plan generate an assignment (T1 item 4).
      allPlans: personType === "team_member" && planScope === "all_plans",
    }));

  // An invite reserves a seat (spec T3 item 2), so the state moves to Invited.
  // A Contact's profile is reused as-is — the profile never changes identity.
  if (profile.state !== "invited" && profile.state !== "active") {
    await prisma.teammateProfile.update({
      where: { id: profile.id },
      data: {
        state: "invited",
        invitedByUserId: input.actorUserId,
        invitedAt: profile.invitedAt ?? new Date(),
      },
    });
  }

  const targetPlanIds = await resolveTargetPlanIds({
    organizationId: input.organizationId,
    planScope,
    planIds: input.planIds,
    planId: input.planId,
  });

  const role: TeammateAssignmentRole =
    input.role ?? (personType === "team_member" ? "editor" : "contributor");
  const categoryScope: TeammateCategoryScope =
    categoryScopeInput === "all" ? "all" : "selected";
  const categories =
    categoryScope === "selected" ? (input.categories ?? []) : [];

  const assignmentIds: string[] = [];
  for (const clientId of targetPlanIds) {
    const assignment = await upsertAssignment({
      organizationId: input.organizationId,
      profileId: profile.id,
      clientId,
      actorUserId: input.actorUserId,
      role,
      categoryScope,
      categories,
    });
    assignmentIds.push(assignment.id);
  }

  return {
    profileId: profile.id,
    personType,
    state: "invited",
    assignmentIds,
    seats: await getSeatUsage(input.organizationId),
  };
}

export interface UpdateTeamMemberInput {
  organizationId: string;
  actorUserId: string;
  profileId: string;
  /** New display name; split into first/last. */
  name?: string | null;
  role?: TeammateAssignmentRole;
  planScope?: TeamPlanScope;
  /** Used when `planScope` is `certain_plans`. */
  planIds?: string[];
  categoryScope?: TeamCategoryScope;
  /** Used when `categoryScope` is `certain`. */
  categories?: string[];
}

export interface UpdateTeamMemberResult {
  profileId: string;
  assignmentIds: string[];
  removedAssignmentIds: string[];
  seats: SeatUsage;
}

/**
 * Edit an existing membership: a Team Member (the Edit modal behind a populated
 * seat card) or a Collaborator (the row actions in the Collaborators accordion).
 *
 * Scope is reconciled rather than replaced: the desired plan set is computed from
 * the requested scope, assignments for plans that dropped out are removed, and the
 * rest are upserted with the new role/category scope. Reusing `upsertAssignment`
 * means the permission grid, the collaborator hard blocks, and the "never remove
 * the last Owner" guard all still apply — an edit cannot bypass T2's rules. That is
 * also why widening this to Collaborators is safe: the grid itself rejects a role
 * their person type may not hold, so the old type check was redundant rather than
 * protective.
 *
 * Two rules are type-aware, both taken from the spec rather than invented here:
 *  - `allPlans` is Team-Member-only (T2a: "All Plans is shown for Team Members
 *    only. It is hidden for Collaborators."), so a Collaborator never carries the
 *    flag even when the scope happens to span every plan today;
 *  - the role written onto a NEWLY added assignment follows `addTeamMember`'s own
 *    default — Editor for a Team Member, Contributor for a Collaborator.
 */
export async function updateTeamMember(
  input: UpdateTeamMemberInput,
): Promise<UpdateTeamMemberResult> {
  const profile = await prisma.teammateProfile.findFirst({
    where: { id: input.profileId, organizationId: input.organizationId },
  });
  if (!profile) {
    throw new TeammateDataError("Team Member not found.", 404);
  }

  if (input.name !== undefined) {
    const trimmed = (input.name ?? "").trim();
    const [firstName, ...restName] = trimmed.split(/\s+/).filter(Boolean);
    await updateTeammateProfile({
      id: profile.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      data: {
        firstName: firstName ?? null,
        lastName: restName.length > 0 ? restName.join(" ") : null,
      },
    });
  }

  const existingAssignments = await prisma.planAssignment.findMany({
    where: { profileId: profile.id, organizationId: input.organizationId },
    select: { id: true, clientId: true, role: true },
  });
  const existingByClient = new Map(
    existingAssignments.map((assignment) => [assignment.clientId, assignment]),
  );

  // Without a scope change, keep exactly the current plan set.
  const desiredPlanIds = input.planScope
    ? await resolveTargetPlanIds({
        organizationId: input.organizationId,
        planScope: input.planScope,
        planIds: input.planIds,
      })
    : existingAssignments.map((assignment) => assignment.clientId);

  if (input.planScope) {
    // Keep the All-Plans flag in step with the scope, so plans created later are
    // covered (or not) consistently with what the member sees today — but only for
    // a Team Member: `allPlans` is not a Collaborator concept, so their
    // assignments are materialised without the follow-on flag.
    await setProfileAllPlans({
      id: profile.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      allPlans:
        profile.type === "team_member" && input.planScope === "all_plans",
    });
  }

  const desiredSet = new Set(desiredPlanIds);
  const removedAssignmentIds: string[] = [];
  for (const assignment of existingAssignments) {
    if (desiredSet.has(assignment.clientId)) continue;
    // Goes through the shared writer, so the last-Owner guard applies here too.
    await removeAssignment({
      assignmentId: assignment.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
    });
    removedAssignmentIds.push(assignment.id);
  }

  const categoryScope: TeammateCategoryScope =
    (input.categoryScope ?? "all") === "all" ? "all" : "selected";
  const categories =
    categoryScope === "selected" ? (input.categories ?? []) : [];

  const assignmentIds: string[] = [];
  for (const clientId of desiredPlanIds) {
    const assignment = await upsertAssignment({
      organizationId: input.organizationId,
      profileId: profile.id,
      clientId,
      actorUserId: input.actorUserId,
      role:
        input.role ??
        existingByClient.get(clientId)?.role ??
        (profile.type === "team_member" ? "editor" : "contributor"),
      categoryScope,
      categories,
    });
    assignmentIds.push(assignment.id);
  }

  return {
    profileId: profile.id,
    assignmentIds,
    removedAssignmentIds,
    seats: await getSeatUsage(input.organizationId),
  };
}

/** Which plans the new member's assignments should be created for. */
async function resolveTargetPlanIds({
  organizationId,
  planScope,
  planIds,
  planId,
}: {
  organizationId: string;
  planScope: TeamPlanScope;
  planIds?: string[];
  planId?: string | null;
}): Promise<string[]> {
  if (planScope === "this_plan") {
    if (!planId) {
      throw new TeammateDataError(
        'A plan is required when plan access is "This Plan".',
        400,
        "plan_required",
      );
    }
    return [planId];
  }

  if (planScope === "certain_plans") {
    const ids = [...new Set((planIds ?? []).map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) {
      throw new TeammateDataError(
        'Select at least one plan, or set plan access to "All Plans".',
        400,
        "plan_required",
      );
    }
    return ids;
  }

  // all_plans — every plan in the organization today. Future plans are covered by
  // the profile's `allPlans` flag (spec T1 Part B item 4).
  const plans = await prisma.client.findMany({
    where: { organizationId },
    select: { id: true },
  });
  return plans.map((plan) => plan.id);
}

/* ───────────────────── Settings → Team list (Part A item 1) ───────────────────── */

export interface TeamMemberPlanSummary {
  scope: "all" | "certain" | "none";
  planIds: string[];
  planNames: string[];
}

export interface TeamMemberCategorySummary {
  scope: "all" | "certain" | "none";
  categories: string[];
}

export interface TeamMemberRow {
  /** `owner:<userId>` for the synthesized owner row, else the profile id. */
  id: string;
  isOwner: boolean;
  profileId: string | null;
  /** Login link, when the person has signed in. */
  userId: string | null;
  name: string;
  email: string;
  /**
   * Headshot as STORED — an R2 object key (`org/…`) or an absolute/data URL, never
   * a signed URL (those expire). The client resolves it through <Headshot>, which
   * already handles the R2 proxy, the retry and the monogram fallback.
   */
  headshot: string | null;
  role: TeammateAssignmentRole;
  status: TeammateProfileState;
  personType: TeammatePersonType;
  /** Partner/Provider company (T1) the person belongs to; null for the owner. */
  companyName: string | null;
  planAccess: TeamMemberPlanSummary;
  categoryAccess: TeamMemberCategorySummary;
  allPlans: boolean;
  invitedAt: Date | null;
  deactivatedAt: Date | null;
}

/** Most-privileged-first, for summarising a person's role across assignments. */
const ROLE_RANK: Record<TeammateAssignmentRole, number> = {
  owner: 6,
  admin: 5,
  editor: 4,
  custom: 3,
  contributor: 2,
  reviewer: 1,
  viewer: 0,
};

/**
 * The Settings → Team Team-Member list.
 *
 * The owner is SYNTHESIZED from the Organization + owning User rather than
 * materialised as a TeammateProfile: that keeps one source of truth for the
 * owner's identity and guarantees the spec's "the owner appears as the first
 * Team Member" without a row that could drift from the User record.
 */
export function listTeamMembers(
  organizationId: string,
): Promise<TeamMemberRow[]> {
  return listOrgPeople(organizationId, "team_member");
}

/**
 * The Settings → Team "Collaborators" list.
 *
 * A separate reader from `listTeamMembers`, for two reasons:
 *  - no owner row is synthesized, because the owner is always a Team Member and
 *    the Owner preset is not available to a Collaborator at all
 *    (`COLLABORATOR_PRESET_ROLES` in types/teammate.ts);
 *  - the `type` filter is what keeps the two lists disjoint, so someone who is
 *    both an employee and an external partner is represented once per
 *    organization — by the profile whose type matches the list being read.
 *
 * Deactivated profiles are included (with `deactivatedAt`) so the UI can offer
 * the spec's reactivate path; a caller wanting only live people filters.
 */
export function listCollaborators(
  organizationId: string,
): Promise<TeamMemberRow[]> {
  return listOrgPeople(organizationId, "collaborator");
}

/** Shared row builder behind the two lists above. */
async function listOrgPeople(
  organizationId: string,
  type: TeammatePersonType,
): Promise<TeamMemberRow[]> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerUserId: true },
  });

  const [owner, profiles, plans, companies] = await Promise.all([
    // The owner only ever belongs to the Team Member list.
    type === "team_member" && organization?.ownerUserId
      ? prisma.user.findUnique({
          where: { id: organization.ownerUserId },
          select: {
            id: true,
            name: true,
            email: true,
            headshot: true,
            // The owner is synthesized from the User, so the card has to reach the
            // same two sources the rest of the app reads: the latest wizard
            // session's `userSetup.headshot` (what /api/profile prefers) and the
            // Branding `aiAvatar` (what /api/profile/header falls back to).
            wizardSessions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                userSetup: { select: { headshot: true } },
                branding: { select: { aiAvatar: true } },
              },
            },
          },
        })
      : Promise.resolve(null),
    prisma.teammateProfile.findMany({
      where: { organizationId, type },
      orderBy: { createdAt: "asc" },
    }),
    prisma.client.findMany({
      where: { organizationId },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    // Partner/Provider companies (T1) — a Collaborator is usually attached to one,
    // which is how several people from the same partner are grouped.
    prisma.teammateCompany.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
  ]);

  const planNameById = new Map(plans.map((plan) => [plan.id, plan.companyName]));
  const companyNameById = new Map(
    companies.map((company) => [company.id, company.name]),
  );

  const profileIds = profiles.map((profile) => profile.id);
  const assignments =
    profileIds.length > 0
      ? await prisma.planAssignment.findMany({
          where: { profileId: { in: profileIds }, organizationId },
          select: {
            profileId: true,
            clientId: true,
            role: true,
            categoryScope: true,
            categories: true,
          },
        })
      : [];

  const byProfile = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const bucket = byProfile.get(assignment.profileId) ?? [];
    bucket.push(assignment);
    byProfile.set(assignment.profileId, bucket);
  }

  const rows: TeamMemberRow[] = [];

  // Owner first — spec acceptance: "the owner appears as the first Team Member".
  if (owner) {
    const ownerSession = owner.wizardSessions?.[0];

    rows.push({
      id: `owner:${owner.id}`,
      isOwner: true,
      profileId: null,
      userId: owner.id,
      name: owner.name || owner.email,
      email: owner.email,
      // Real headshot first, AI avatar only as a last resort — mirroring the
      // precedence in /api/profile and /api/profile/header.
      headshot:
        ownerSession?.userSetup?.headshot ||
        owner.headshot ||
        ownerSession?.branding?.aiAvatar ||
        null,
      role: "owner",
      status: "active",
      personType: "team_member",
      // The owner is a User, not a partner company.
      companyName: null,
      // The owner implicitly reaches every plan in their organization.
      planAccess: {
        scope: "all",
        planIds: plans.map((plan) => plan.id),
        planNames: plans.map((plan) => plan.companyName),
      },
      categoryAccess: { scope: "all", categories: [] },
      allPlans: true,
      invitedAt: null,
      deactivatedAt: null,
    });
  }

  for (const profile of profiles) {
    const memberAssignments = byProfile.get(profile.id) ?? [];

    const planIds = [
      ...new Set(memberAssignments.map((assignment) => assignment.clientId)),
    ];
    const planScope: TeamMemberPlanSummary["scope"] = profile.allPlans
      ? "all"
      : planIds.length > 0
        ? "certain"
        : "none";

    const allCategories = memberAssignments.some(
      (assignment) => assignment.categoryScope === "all",
    );
    const selected = [
      ...new Set(
        memberAssignments.flatMap((assignment) => assignment.categories ?? []),
      ),
    ];

    rows.push({
      id: profile.id,
      isOwner: false,
      profileId: profile.id,
      userId: profile.loginUserId ?? null,
      name:
        [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        profile.email,
      email: profile.email,
      headshot: profile.headshot ?? null,
      role: mostPrivilegedRole(memberAssignments.map((a) => a.role)),
      status: profile.state,
      personType: profile.type,
      companyName: profile.companyId
        ? (companyNameById.get(profile.companyId) ?? null)
        : null,
      planAccess: {
        scope: planScope,
        planIds,
        planNames: planIds.map((id) => planNameById.get(id) ?? id),
      },
      categoryAccess:
        allCategories || memberAssignments.length === 0
          ? { scope: "all", categories: [] }
          : { scope: "certain", categories: selected },
      allPlans: profile.allPlans,
      invitedAt: profile.invitedAt ?? null,
      deactivatedAt: profile.deactivatedAt ?? null,
    });
  }

  return rows;
}

/**
 * Deactivate / reactivate a profile (spec T6: "Deactivate: all access to the
 * organization ends; the profile is kept.").
 *
 * A thin pass-through so the route never has to import `profiles.server`
 * directly, and both directions stay audited — the writers there record
 * `profile_deactivated` / `profile_reactivated`.
 *
 * Deactivating also FREES a Team Member's seat: `getSeatUsage` skips any profile
 * carrying a `deactivatedAt`. The fresh meter is returned so the caller can show
 * the released seat without a second round trip.
 */
export async function setTeamMemberActive({
  organizationId,
  actorUserId,
  profileId,
  active,
}: {
  organizationId: string;
  actorUserId: string;
  profileId: string;
  active: boolean;
}): Promise<{ profileId: string; seats: SeatUsage }> {
  if (active) {
    await reactivateTeammateProfile({
      id: profileId,
      organizationId,
      actorUserId,
    });
  } else {
    await deactivateTeammateProfile({
      id: profileId,
      organizationId,
      actorUserId,
    });
  }

  return { profileId, seats: await getSeatUsage(organizationId) };
}

function mostPrivilegedRole(
  roles: TeammateAssignmentRole[],
): TeammateAssignmentRole {
  if (roles.length === 0) return "contributor";
  return roles.reduce((best, role) =>
    ROLE_RANK[role] > ROLE_RANK[best] ? role : best,
  );
}
