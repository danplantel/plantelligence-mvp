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
import { sendTeamMemberInviteEmail } from "@/lib/email";
import { assertOrganizationKeepsAnOwner } from "./access.server";
import { recordTeammateAuditEvent } from "./audit.server";
import { TeammateDataError } from "./errors";
import { acceptanceUrlForProfile } from "./invite-link.server"
import {
  createTeammateProfile,
  deactivateTeammateProfile,
  deleteTeammateProfile,
  findProfileByEmail,
  getTeammateProfile,
  reactivateTeammateProfile,
  type UpdateTeammateProfileInput,
  setProfileAllPlans,
  setProfileState,
  setProfileType,
  updateTeammateProfile,
  upgradeContactToInvited,
} from "./profiles.server";
import { removeAssignment, upsertAssignment } from "./assignments.server";
import { findOrCreatePartnerCompany } from "./companies.server";
import {
  assertSeatAvailable,
  getSeatUsage,
  guessPersonTypeForEmail,
  INVITE_SEAT_HOLD_DAYS,
  type SeatUsage,
} from "./seats.server";
import {
  normalizePermissionSet,
  type TeammateAssignmentRole,
  type TeammateCategoryScope,
  type TeammatePermissionSet,
  type TeammatePersonType,
  type TeammateProfileState,
} from "@/types/teammate";

/** Spec T3 Part A item 2: This Plan / Certain Plans / All Plans. */
export type TeamPlanScope = "this_plan" | "certain_plans" | "all_plans";

/** Spec T3 Part A item 2: benefits access is All / Certain. */
export type TeamCategoryScope = "all" | "certain";

export interface AddTeamMemberInput {
  organizationId: string;
  actorUserId: string;
  /**
   * Display name; split into first/last. Kept as the fallback for callers that only hold a
   * single string, and for the verification scripts.
   */
  name?: string | null;
  /**
   * Explicit name parts, preferred over `name` when given. The People & Access form asks
   * for them separately, and splitting "Mary Jane Watson" on whitespace would file "Jane"
   * into the last name.
   */
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  /**
   * Identity the profile can carry. These are the Key Contact fields the profile can
   * already store; anything the profile has no column for is deliberately not accepted, so
   * the form cannot collect data that would be discarded on the way in.
   *
   * An ABSENT key means "not supplied, leave it alone"; an empty string means "clear it".
   * That distinction is what lets the Existing Contact slide omit all of them while New
   * Contact sends them, without a promotion blanking out data it was never asked about.
   */
  jobTitle?: string | null;
  phone?: string | null;
  phoneExtension?: string | null;
  headshot?: string | null;
  /**
   * Company / Organization, resolved to a Partner/Provider company row — the same call the
   * contact mirror makes for a Key Contact.
   *
   * Taken as a NAME rather than an id so the client cannot link a company belonging to
   * another organization, and so the resolution rule lives next to the other teammate
   * writers rather than in a route.
   */
  companyName?: string | null;
  /** Overrides the email-domain guess when the user changes it. */
  type?: TeammatePersonType;
  role?: TeammateAssignmentRole;
  /** Defaults to `all_plans` (spec: "Default: All Plans + All Categories"). */
  planScope?: TeamPlanScope;
  /** Used when `planScope` is `certain_plans`. */
  planIds?: string[];
  /**
   * Used when `planScope` is `this_plan`.
   *
   * Also the plan NAMED in the invitation email, so a caller that knows which plan it is
   * raising the invite from should send it even when the scope is All Plans — otherwise the
   * recipient is told the firm's own name instead of what they have been given, which for a
   * solo advisor is the inviter's name twice.
   */
  planId?: string | null;
  /** Defaults to `all`. */
  categoryScope?: TeamCategoryScope;
  /** Used when `categoryScope` is `certain`. */
  categories?: string[];
  /**
   * Promote an existing Contact by id instead of by email. Set by the People & Access
   * picker, so that the person the advisor chose is the person who is promoted — which is
   * the entire point of picking rather than retyping.
   */
  profileId?: string | null;
  /** Spec T3 item 3: pass true only once the upgrade confirm is accepted. */
  confirmUpgrade?: boolean;
  /**
   * Suppress the invitation email. The verification suites set this so a battery run never
   * sends real mail, mirroring `inviteCollaboratorToPlan`'s own flag.
   */
  skipEmail?: boolean;
}

export interface AddTeamMemberResult {
  profileId: string;
  personType: TeammatePersonType;
  /**
   * The state the call actually left the profile in: `invited` for a new or
   * just-promoted person, but `active` when the email already belonged to someone who
   * had accepted an earlier invite. Not always `invited` — that was a lie the UI
   * repeated back to the advisor.
   */
  state: TeammateProfileState;
  assignmentIds: string[];
  /** Whether the invitation email actually went out. False when suppressed or moot. */
  emailSent: boolean;
  /** Why the email failed, when it did. A mail failure never fails the add itself. */
  emailError: string | null;
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
  const providedEmail = (input.email ?? "").trim().toLowerCase();

  // Resolve the person FIRST when the caller named one, because a promotion is a decision
  // about a specific Contact rather than about whatever address happens to be in the form.
  // Resolving by id also means the email used for everything downstream comes FROM the
  // profile, so a mismatched id and email pair cannot send one person's invitation to
  // another person's mailbox.
  //
  // By email — the original path — nothing changes: the address is the identity, and an
  // existing profile is reused rather than duplicated.
  const existing = input.profileId
    ? await getTeammateProfile(input.profileId, input.organizationId)
    : await findProfileByEmail(input.organizationId, providedEmail);

  if (input.profileId && !existing) {
    // Scoped to the organization, so this is also what stops a caller promoting a profile
    // that belongs to somebody else's organization.
    throw new TeammateDataError(
      "That contact is not in this organization.",
      404,
      "profile_not_found",
    );
  }

  const email = existing?.email ?? providedEmail;
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

  // Computed HERE rather than after the assignment loop, because the profile now stores the
  // same list as `benefitsSpecialty` and so it has to exist before the profile is created.
  //
  // `benefitsSpecialty` is "the benefit categories this person covers", which is what the
  // Benefits Hub groups them under. It is deliberately the SAME list as the access scope
  // instead of a second picker: the contact mirror derives both from one source (the Key
  // Contact's own benefit categories), so two inputs would be two chances to disagree. If
  // they ever need to diverge, that is a change of meaning and needs its own input.
  const categoryScope: TeammateCategoryScope =
    categoryScopeInput === "all" ? "all" : "selected";
  const categories =
    categoryScope === "selected" ? (input.categories ?? []) : [];

  // `existing` was resolved above, by id or by email — "a second invite adds an
  // assignment, not a new profile".
  if (existing?.deactivatedAt) {
    throw new TeammateDataError(
      "A deactivated profile exists for this email. Reactivate it instead of re-adding.",
      409,
      "profile_email_deactivated",
    );
  }

  // Explicit parts win; otherwise fall back to splitting the single display name.
  const trimmedName = (input.name ?? "").trim();
  const [nameFirst, ...restName] = trimmedName.split(/\s+/).filter(Boolean);
  const firstName =
    (input.firstName ?? "").trim() || nameFirst || null;
  const lastName =
    (input.lastName ?? "").trim() ||
    (restName.length > 0 ? restName.join(" ") : null);

  // A typed company becomes a Partner/Provider row, exactly as the mirror does for a Key
  // Contact. Blank means "no company", not a company whose name is the empty string.
  const companyName = (input.companyName ?? "").trim();
  const companyId = companyName
    ? (
        await findOrCreatePartnerCompany({
          organizationId: input.organizationId,
          name: companyName,
          logo: null,
          actorUserId: input.actorUserId,
        })
      ).id
    : null;

  // Spec T1 Part B item 4: All Plans is the flag that makes a NEW plan generate an
  // assignment. Computed once, so creation and the reuse path below cannot disagree
  // about what this call asked for.
  const wantsAllPlans = personType === "team_member" && planScope === "all_plans";

  const profile =
    existing ??
    (await createTeammateProfile({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      type: personType,
      email,
      firstName,
      lastName,
      jobTitle: input.jobTitle ?? null,
      phone: input.phone ?? null,
      phoneExtension: input.phoneExtension ?? null,
      headshot: input.headshot ?? null,
      benefitsSpecialty: categories,
      companyId,
      allPlans: wantsAllPlans,
    }));

  // ── Reuse can be a promotion, not just a no-op ───────────────────────────────
  //
  // `type` decides both the seat count and the list the person appears in: `getSeatUsage`
  // counts only `type: "team_member"` profiles and `listOrgPeople` filters the same way.
  // Reuse previously kept whatever type the profile was created with, so promoting a
  // Contact whose stored type was `collaborator` reserved a seat via `assertSeatAvailable`
  // above that the meter then never counted — and the person kept rendering under
  // Collaborators instead of appearing on the team.
  //
  // Order matters: `setProfileAllPlans` refuses All Plans for a collaborator, reading the
  // type it finds rather than the one being requested, so the type must be settled first.
  // `reused` tracks the post-change row so the All Plans check below compares against what
  // the profile is, not against the stale snapshot read before the type change.
  let reused = existing;
  if (existing && existing.type !== personType) {
    reused = await setProfileType({
      id: existing.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      type: personType,
    });
  }

  if (reused && reused.allPlans !== wantsAllPlans) {
    await setProfileAllPlans({
      id: reused.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      allPlans: wantsAllPlans,
    });
  }

  // ── Identity on reuse ─────────────────────────────────────────────────────────
  //
  // Only the keys the caller actually sent are written. "Existing Contact" omits all of
  // them, because the person already has them from the Key Contact they were mirrored from;
  // "New Contact" sends them. Without that distinction a promotion from the picker would
  // blank out a contact's job title, phone and company simply because the slide it came
  // from has no fields for them.
  //
  // `benefitsSpecialty` is written ONLY when the advisor named specific categories. With
  // "All categories" the list legitimately arrives empty, and treating that as a value
  // would wipe the specialty of every contact promoted with the default scope.
  const identityPatch: UpdateTeammateProfileInput = {
    ...(input.firstName !== undefined && firstName ? { firstName } : {}),
    ...(input.lastName !== undefined && lastName ? { lastName } : {}),
    ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle || null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
    ...(input.phoneExtension !== undefined
      ? { phoneExtension: input.phoneExtension || null }
      : {}),
    ...(input.headshot !== undefined ? { headshot: input.headshot || null } : {}),
    ...(input.companyName !== undefined ? { companyId } : {}),
    ...(categoryScope === "selected" ? { benefitsSpecialty: categories } : {}),
  };

  if (reused && Object.keys(identityPatch).length > 0) {
    await updateTeammateProfile({
      id: reused.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      data: identityPatch,
    });
  }

  // An invite reserves a seat (spec T3 item 2), so the state moves to Invited.
  // A Contact's profile is reused as-is — the profile never changes identity.
  //
  // Routed through `upgradeContactToInvited` rather than an inline update so this shares
  // ONE state transition with the collaborator invite path. Three things came from the
  // inline write being replaced:
  //
  //   1. `invitedAt` is refreshed instead of inherited from `profile.invitedAt`, which
  //      on a re-invite after a lapse handed the T9 token an already-expired window and
  //      made the emailed acceptance link land on "expired" (see `setProfileState`).
  //   2. The `active` → `contact` guard lives in `setProfileState`, so it cannot be
  //      bypassed here.
  //   3. A `profile_state_changed` audit row is written. The inline update recorded
  //      nothing, so a promotion left no trace beyond the assignment rows.
  // Captured rather than recomputed later: this is exactly the condition under which the
  // transition runs, and the email below must agree with it (see the note on the return).
  const startedInviteWindow =
    profile.state !== "invited" && profile.state !== "active";

  if (startedInviteWindow) {
    await upgradeContactToInvited({
      id: profile.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
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

  // The state this call actually produced. `startedInviteWindow` above is exactly the
  // condition under which the transition ran, so the two cannot disagree — this used to be
  // the hardcoded string "invited", which was untrue for somebody who was already `active`.
  const state: TeammateProfileState = startedInviteWindow
    ? "invited"
    : (profile.state as TeammateProfileState);

  // ── The invitation email ────────────────────────────────────────────────────────
  //
  // Sent only when this call actually began an invite window. Promoting somebody who is
  // already `active` grants them more access; it does not re-invite them, and mailing a
  // "choose a password" link to a person who already has one would be wrong.
  //
  // Best-effort, like the collaborator invite: a mail failure must not roll back a grant
  // the advisor asked for, so it is reported in the result rather than thrown.
  let emailSent = false;
  let emailError: string | null = null;

  if (startedInviteWindow && !input.skipEmail) {
    // The plan to NAME in the invitation: the one this call was raised from, or the only
    // plan it scopes the person to. Never the whole list — "added you to 3 plans" is a worse
    // subject than the firm — and never the caller's own wording, because the name is
    // resolved from an id scoped to this organization rather than accepted as a string.
    const contextPlanId =
      input.planId ?? (targetPlanIds.length === 1 ? targetPlanIds[0] : null);

    // Resolved here rather than passed in: this layer holds ids, and the email needs human
    // names to open with.
    const [organization, actor, invitePlan] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: input.actorUserId },
        select: { name: true },
      }),
      contextPlanId
        ? prisma.client.findFirst({
            where: { id: contextPlanId, organizationId: input.organizationId },
            select: { companyName: true },
          })
        : Promise.resolve(null),
    ]);

    try {
      const link = await acceptanceUrlForProfile({
        id: profile.id,
        organizationId: input.organizationId,
        email,
      });
      if (!link) {
        // Without a window to encode, the link would be rejected the moment it was
        // opened. Sending it anyway would deliver a broken invitation, so it is reported.
        emailError = "The profile has no invite window to mint a link from.";
      } else {
        await sendTeamMemberInviteEmail({
          to: email,
          memberName:
            [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
            trimmedName ||
            null,
          inviterName: actor?.name ?? null,
          organizationName: organization?.name ?? null,
          planName: invitePlan?.companyName ?? null,
          acceptUrl: link.url,
          expiresInDays: INVITE_SEAT_HOLD_DAYS,
        });
        emailSent = true;
      }
    } catch (error) {
      emailError =
        error instanceof Error ? error.message : "Unknown email error";
      console.error("[teammates/team] invitation email failed", error);
    }
  }

  return {
    profileId: profile.id,
    personType,
    state,
    assignmentIds,
    emailSent,
    emailError,
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

/** Which write a "remove from seat" actually performed. */
export type RemoveFromSeatOutcome = "returned_to_contact" | "deactivated";

export interface RemoveFromSeatResult {
  profileId: string;
  outcome: RemoveFromSeatOutcome;
  /** The state the profile ended in, so the caller need not re-read it. */
  state: TeammateProfileState;
  /** How many seats the meter gave back — 0 when this person held none. */
  releasedSeats: number;
  /** The fresh meter, so the header can show the freed seat without a second read. */
  seats: SeatUsage;
}

/**
 * Take someone out of the seat they occupy without deleting them.
 *
 * This is one *user* action but not one write, because the state machine only allows
 * one of them per person: `setProfileState` refuses `active → contact` ("An Active
 * profile cannot be reverted to Contact. Deactivate it instead."), so "put them back
 * as a Contact" is genuinely unavailable to anyone who has accepted.
 *
 *  - **`invited`** — no acceptance yet, so the promotion is fully reversible: the state
 *    returns to `contact`, exactly as `expireStaleInvites` does when a 14-day hold
 *    lapses. `getSeatUsage` counts only `active` and unexpired `invited` profiles, so the
 *    seat is released; the profile and everything on it survive, and they can be Promoted
 *    again unchanged.
 *  - **`active`** — accepted, and therefore un-revertable. Deactivation is the spec's own
 *    answer (T6: "all access to the organization ends; the profile is kept"), and
 *    `getSeatUsage` skips any profile carrying a `deactivatedAt`, so the seat is released
 *    exactly as it is on the invite path.
 *
 * **`type` is never touched.** It is the org-boundary axis, and moving a profile to
 * `collaborator` is precisely what makes it appear in the Collaborators list — a list the
 * settings accordion describes as "external people — free, no seat" who need "access to a
 * plan". Someone who has just given up their seat is neither: they are a **Contact**, on
 * the roster with no seat and no access, and they belong in neither list. Leaving the type
 * alone also matches what `expireStaleInvites` already does, so the two ways a seat can
 * lapse produce the same shape — and it keeps Reactivate able to hand an accepted member
 * their seat back.
 *
 * All Plans is cleared when it was set. That flag is what makes `listAllPlansTeamMembers`
 * hand out an assignment for every NEW plan, so without clearing it a person who just gave
 * up their seat would keep silently accruing access to plans created next week. Re-Promoting
 * re-applies it from the Plan scope the access step asks for.
 *
 * The Owner is refused, through the shared guard below: their seat is reserved and they
 * are synthesized from the Organization + User rather than stored as a profile
 * (`listOrgPeople` gives them `id: "owner:<userId>"` and `profileId: null`), so there is
 * nothing to release.
 */
export async function removeTeamMemberFromSeat({
  organizationId,
  actorUserId,
  profileId,
}: {
  organizationId: string;
  actorUserId: string;
  profileId: string;
}): Promise<RemoveFromSeatResult> {
  const profile = await getTeammateProfile(profileId, organizationId);
  if (!profile) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }

  await assertProfileIsNotOrganizationOwner({ profile, organizationId });

  // Measured, not re-derived: `getSeatUsage` owns the metering rules (the 14-day hold,
  // deactivated profiles, Team Members only), so diffing its own number stays correct
  // even if those rules change.
  const before = await getSeatUsage(organizationId);

  let outcome: RemoveFromSeatOutcome;

  if (profile.deactivatedAt) {
    // Already deactivated: no access, no seat, nothing to free. Deliberately a no-op.
    outcome = "deactivated";
  } else if (profile.state === "active") {
    await deactivateTeammateProfile({
      id: profileId,
      organizationId,
      actorUserId,
    });
    outcome = "deactivated";
  } else if (profile.state === "invited") {
    await setProfileState({
      id: profileId,
      organizationId,
      actorUserId,
      state: "contact",
    });
    outcome = "returned_to_contact";
  } else {
    // Already a Contact: no seat to give back, and no state to change.
    outcome = "returned_to_contact";
  }

  // A seat and All Plans go together — see the note on the function.
  if (profile.allPlans) {
    await setProfileAllPlans({
      id: profileId,
      organizationId,
      actorUserId,
      allPlans: false,
    });
  }

  const seats = await getSeatUsage(organizationId);
  const releasedSeats = Math.max(before.seatsUsed - seats.seatsUsed, 0);

  // The state/type writers above audit their own step; this records the intent, so the
  // log reads as "someone gave this seat up" rather than two unrelated transitions.
  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_removed_from_seat",
    profileId,
    details: {
      outcome,
      from: profile.state,
      releasedSeats,
      clearedAllPlans: profile.allPlans,
    },
  });

  return {
    profileId,
    outcome,
    state: outcome === "deactivated" ? "active" : "contact",
    releasedSeats,
    seats,
  };
}

/**
 * The Owner is not a teammate, so no writer here may remove them.
 *
 * `listOrgPeople` synthesizes the owner's row from `Organization.ownerUserId` rather than
 * storing a `TeammateProfile` for them (see `onboarding-owner.ts`), which is why the seat
 * grid's owner card carries `profileId: null`. They can still have a *profile* though — the
 * T7 mirror creates one for any plan Contact, and a plan's contact list often holds the
 * advisor's own address — so both links have to be checked: a profile carrying
 * `loginUserId`, or a mirrored Contact matched by email.
 */
async function assertProfileIsNotOrganizationOwner({
  profile,
  organizationId,
}: {
  profile: { loginUserId: string | null; email: string };
  organizationId: string;
}): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerUserId: true },
  });
  if (!organization?.ownerUserId) return;

  const owner = await prisma.user.findUnique({
    where: { id: organization.ownerUserId },
    select: { email: true },
  });

  const isOwner =
    profile.loginUserId === organization.ownerUserId ||
    (owner?.email ?? "").toLowerCase() === profile.email.toLowerCase();

  if (isOwner) {
    throw new TeammateDataError(
      "The Owner's seat is reserved and cannot be removed. Transfer ownership first.",
      409,
      "owner_reserved_seat",
    );
  }
}

/**
 * Remove a person from the organization outright: their assignments first, then the
 * profile itself.
 *
 * Spec T6 item 3 allows deletion "only when the person has no remaining assignments", and
 * `deleteTeammateProfile` enforces exactly that with a 409. In the UI that made deletion a
 * dead end rather than a rule: the T6 screen disables its Delete button while assignments
 * exist, and the Collaborators list offers no way to drop one — so a Collaborator on any
 * plan could not be removed at all.
 *
 * The two writes belong to a single user decision ("remove this person"), so they happen
 * together here rather than being left to the advisor to perform one row at a time. The
 * guard is not bypassed: assignments go through `removeAssignment`, which keeps the
 * never-remove-the-last-Owner rule and audits each removal, and the profile then deletes
 * through the same writer the strict path uses.
 *
 * One caveat worth knowing: a Contact mirrored from a plan's Key Contacts can be recreated
 * by the T7 mirror the next time that plan's contacts are saved, because the mirror
 * reconciles `Client.keyContacts` onto profiles and has no way to know the profile was
 * deliberately removed. It comes back as a Contact with no access, never as a Collaborator
 * with access.
 */
export async function removePersonFromOrganization({
  organizationId,
  actorUserId,
  profileId,
}: {
  organizationId: string;
  actorUserId: string;
  profileId: string;
}): Promise<{
  profileId: string;
  removedAssignments: number;
  seats: SeatUsage;
}> {
  const profile = await getTeammateProfile(profileId, organizationId);
  if (!profile) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }

  await assertProfileIsNotOrganizationOwner({ profile, organizationId });

  const assignments = await prisma.planAssignment.findMany({
    where: { profileId, organizationId },
    select: { id: true, role: true },
  });

  // Validate the whole set BEFORE mutating anything. `removeAssignment` refuses to remove
  // the last Owner (spec T2 Part B item 4), and tripping that guard mid-loop would leave the
  // person half-removed — some access gone, the profile still there — behind an error that
  // talks about Owners rather than about this screen.
  const ownerAssignments = assignments.filter((row) => row.role === "owner");
  if (ownerAssignments.length > 0) {
    await assertOrganizationKeepsAnOwner({
      organizationId,
      excludingAssignmentIds: ownerAssignments.map((row) => row.id),
    });
  }

  for (const assignment of assignments) {
    await removeAssignment({
      assignmentId: assignment.id,
      organizationId,
      actorUserId,
    });
  }

  await deleteTeammateProfile({ id: profileId, organizationId, actorUserId });

  // A Team Member's profile was carrying a seat; the caller needs the new meter so the
  // header stops claiming a seat nobody holds.
  return {
    profileId,
    removedAssignments: assignments.length,
    seats: await getSeatUsage(organizationId),
  };
}

/* ─────────────── T6: the Assignment Management screen's reader ─────────────── */

/** One plan a person is attached to, as the T6 screen renders it. */
export interface MembershipAssignmentDetail {
  id: string;
  clientId: string;
  planName: string;
  role: TeammateAssignmentRole;
  /** `all` | `selected` — the screen labels these All / Certain. */
  categoryScope: TeammateCategoryScope;
  categories: string[];
  showOnBenefitsHub: boolean;
  /**
   * T2a: the stored grid, so the plan-first screen can start from what this person
   * actually has instead of from a preset guess.
   */
  permissionSet: TeammatePermissionSet;
  inviteNote: string | null;
  inviteDueDate: string | null;
  invitedAt: string | null;
  lastChangedAt: string | null;
}

export interface MembershipDetail {
  profile: {
    id: string;
    name: string;
    email: string;
    headshot: string | null;
    companyName: string | null;
    personType: TeammatePersonType;
    state: TeammateProfileState;
    /** Spec T1 Part B item 4 — Team Members only. */
    allPlans: boolean;
    deactivatedAt: string | null;
  };
  /** Spec T6 Part A item 1: "assignments listed below by plan". */
  assignments: MembershipAssignmentDetail[];
  /** The organization's plans, for the "Certain Plans" searchable checklist. */
  plans: { id: string; companyName: string }[];
  seats: SeatUsage;
  /**
   * Spec T6 Part B item 3: "Delete Profile: allowed only when the person has no
   * remaining assignments." Mirrored to the client so the action can be disabled
   * with an explanation instead of failing on click; the guard itself still lives in
   * `deleteTeammateProfile`, so a direct API call cannot bypass it.
   */
  canDeleteProfile: boolean;
}

/**
 * Everything the T6 per-person screen needs, in one read.
 *
 * A single reader rather than three calls from the client, so the header, the plan
 * list and the assignment list cannot disagree with each other while the screen is
 * open — which matters because the screen's whole job is showing a person's access
 * accurately.
 */
export async function getMembershipDetail({
  organizationId,
  profileId,
}: {
  organizationId: string;
  profileId: string;
}): Promise<MembershipDetail> {
  const profile = await prisma.teammateProfile.findFirst({
    where: { id: profileId, organizationId },
  });
  if (!profile) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }

  const [assignments, company, plans, seats] = await Promise.all([
    prisma.planAssignment.findMany({
      where: { profileId, organizationId },
      orderBy: { createdAt: "asc" },
    }),
    profile.companyId
      ? prisma.teammateCompany.findFirst({
          where: { id: profile.companyId, organizationId },
          select: { name: true },
        })
      : Promise.resolve(null),
    // Scoped the same way `resolveTargetPlanIds` scopes All Plans, so the checklist
    // and the write path agree on what "every plan" means.
    prisma.client.findMany({
      where: { organizationId },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    getSeatUsage(organizationId),
  ]);

  const planIds = [...new Set(assignments.map((row) => row.clientId))];
  const planRows =
    planIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: planIds } },
          select: { id: true, companyName: true },
        })
      : [];
  const planNameById = new Map(
    planRows.map((row) => [row.id, row.companyName ?? "Untitled plan"]),
  );

  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
    profile.email;

  return {
    profile: {
      id: profile.id,
      name,
      email: profile.email,
      headshot: profile.headshot ?? null,
      companyName: company?.name ?? null,
      personType: profile.type as TeammatePersonType,
      state: profile.state as TeammateProfileState,
      allPlans: Boolean(profile.allPlans),
      deactivatedAt: profile.deactivatedAt
        ? profile.deactivatedAt.toISOString()
        : null,
    },
    assignments: assignments.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      planName: planNameById.get(row.clientId) ?? "Unknown plan",
      role: row.role as TeammateAssignmentRole,
      categoryScope: row.categoryScope as TeammateCategoryScope,
      categories: Array.isArray(row.categories)
        ? (row.categories as string[])
        : [],
      showOnBenefitsHub: Boolean(row.showOnBenefitsHub),
      permissionSet: normalizePermissionSet(row.permissionSet),
      inviteNote: row.inviteNote ?? null,
      inviteDueDate: row.inviteDueDate
        ? row.inviteDueDate.toISOString()
        : null,
      invitedAt: row.invitedAt ? row.invitedAt.toISOString() : null,
      lastChangedAt: row.lastChangedAt
        ? row.lastChangedAt.toISOString()
        : null,
    })),
    plans: plans.map((plan) => ({
      id: plan.id,
      companyName: plan.companyName ?? "Untitled plan",
    })),
    seats,
    canDeleteProfile: assignments.length === 0,
  };
}

function mostPrivilegedRole(
  roles: TeammateAssignmentRole[],
): TeammateAssignmentRole {
  if (roles.length === 0) return "contributor";
  return roles.reduce((best, role) =>
    ROLE_RANK[role] > ROLE_RANK[best] ? role : best,
  );
}
