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
import { organizationDisplayName } from "@/lib/organization";
import {
  sendCollaboratorInviteEmail,
  sendTeamMemberInviteEmail,
} from "@/lib/email";
import { assertOrganizationKeepsAnOwner } from "./access.server";
import { recordTeammateAuditEvent } from "./audit.server";
import { TeammateDataError } from "./errors";
import { acceptanceUrlForProfile, appBaseUrl } from "./invite-link.server";
import { inviteTokenExpiry } from "./invite-token.server";
import {
  createTeammateProfile,
  deactivateTeammateProfile,
  deleteTeammateProfile,
  findProfileByEmail,
  getTeammateProfile,
  reactivateTeammateProfile,
  reviveSelfDeletedProfile,
  type UpdateTeammateProfileInput,
  setProfileAllPlans,
  setProfileState,
  setProfileType,
  updateTeammateProfile,
  upgradeContactToInvited,
} from "./profiles.server";
import { removeAssignment, upsertAssignment } from "./assignments.server";
import { listPlanCustomBenefits } from "./benefit-categories.server";
import { findOrCreatePartnerCompany } from "./companies.server";
import { categoryToSlug } from "@/lib/benefit-category-slug";
import { BENEFIT_CONTACT_CATEGORIES } from "@/lib/benefit-contacts";
import {
  assertSeatAvailable,
  getSeatUsage,
  guessPersonTypeForEmail,
  INVITE_SEAT_HOLD_DAYS,
  isInviteExpired,
  type SeatUsage,
} from "./seats.server";
import {
  mostPrivilegedRole,
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
  let existing = input.profileId
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

  // A profile whose login deleted itself is revived BEFORE anything else looks at it. The
  // old login is gone, so this is a fresh add, not a no-op on an `active` member:
  // `reviveSelfDeletedProfile` clears the marker and the dangling link and returns the
  // profile to Contact, which is what lets the invite window open again below. Without
  // this, re-adding the person would reuse an `active` profile, skip the invitation and
  // leave them unable to sign in.
  if (existing?.selfDeletedAt) {
    existing = await reviveSelfDeletedProfile({
      id: existing.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
    });
  }

  const email = existing?.email ?? providedEmail;
  if (!email) {
    throw new TeammateDataError("An email address is required.", 400);
  }

  // Spec T3 item 4 / Core Concepts: matching domain → Team Member, else
  // Collaborator. Only a default — `input.type` overrides it.
  const personType: TeammatePersonType =
    input.type ?? (await guessPersonTypeForEmail({ organizationId: input.organizationId, email }));

  // Resolved ONCE, before the profile is written: the same role goes onto the profile (so a
  // seat with no plan yet still knows its role) and onto every assignment below.
  const role: TeammateAssignmentRole =
    input.role ?? (personType === "team_member" ? "editor" : "contributor");

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
      // The seat's role, so a membership with no plan yet still reports what it is.
      role,
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
    ...(input.role !== undefined ? { role: input.role } : {}),
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

  const assignmentIds: string[] = [];
  /**
   * The grid the assignments actually STORE, kept so the invitation can name the access that
   * was granted.
   *
   * Every assignment this loop writes carries the same grid (`upsertAssignment` settles it from
   * the role, applying the auto-enforced rules and the collaborator hard blocks), so the first
   * one is the whole story for the invitation. Captured from the written row rather than
   * restated from the role's preset because that same row is where a Custom grid lives — and
   * the email is a promise about access, not about a role name.
   */
  let grantedPermissions: TeammatePermissionSet | null = null;
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
    if (!grantedPermissions) {
      grantedPermissions = normalizePermissionSet(assignment.permissionSet);
    }
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

    /**
     * Names for the plans a NARROWED invitation covers, so the email can list what the person
     * is being given instead of only naming the firm.
     *
     * Not resolved for All Plans: enumerating every plan in the organization would be a wall of
     * names where "All plans" is both shorter and more accurate — it is exactly the `allPlans`
     * flag the profile now carries. The email shows that label only when a caller says so
     * explicitly (`null`), which is why this resolves to an empty array rather than to nothing.
     */
    const scopedPlanNamesPromise =
      planScope === "all_plans" || targetPlanIds.length === 0
        ? Promise.resolve([] as { companyName: string }[])
        : prisma.client.findMany({
            where: {
              id: { in: targetPlanIds },
              organizationId: input.organizationId,
            },
            select: { companyName: true },
            orderBy: { companyName: "asc" },
          });

    // Resolved here rather than passed in: this layer holds ids, and the email needs human
    // names to open with.
    const [organizationName, actor, invitePlan, scopedPlans] = await Promise.all([
      // The firm's NAME, resolved from the owner's row rather than from `Organization.name` —
      // that column is a mirror created at signup, so it holds the advisor's own name until it
      // is synced. See `organizationDisplayName`.
      organizationDisplayName(input.organizationId),
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
      scopedPlanNamesPromise,
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
          organizationName,
          planName: invitePlan?.companyName ?? null,
          acceptUrl: link.url,
          expiresInDays: INVITE_SEAT_HOLD_DAYS,
          // ── What the recipient is being given ──────────────────────────────────────
          // Described from what was WRITTEN a few lines up rather than from the request: the
          // role the assignment holds, the grid it stores, and the scope it covers. A mail that
          // repeated the request could promise access the finalise step changed.
          role,
          permissions: grantedPermissions,
          // `null` = "every plan", which is the honest label for an org-wide invite. A narrowed
          // scope lists its plans; if a name cannot be resolved the list is empty and the email
          // omits the row rather than claiming either.
          planNames:
            planScope === "all_plans"
              ? null
              : scopedPlans.map((plan) => plan.companyName),
          // Omitted (not "all") unless the caller scoped the person to named categories: an
          // empty list means "all categories", which is a claim only the caller can make.
          categories: categoryScope === "selected" ? categories : null,
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

/**
 * How long one invitation must wait between resends — SIXTY SECONDS, and the number is the whole
 * decision, so here is the reasoning rather than just the digit.
 *
 * The action is deliberate and manual, and it has exactly one legitimate reason to be repeated:
 * "the first one never arrived". The two ways to get this wrong pull in opposite directions.
 * Shorter — 5 or 10 seconds — does not stop the thing a cooldown exists to stop: an advisor
 * clicks, finds nothing in the inbox a beat later, and clicks again, which is how one recipient
 * ends up with three copies of one invitation inside a minute (and how a sending domain starts
 * looking like a spammer to a provider). Longer — five minutes or more — starts refusing requests
 * that are reasonable by then: the only lever a cooldown has is the reader's patience, and asking
 * for minutes of it to re-send an email is a poor trade for a button an advisor presses on
 * purpose.
 *
 * A minute is also what people have already been taught elsewhere: verification-email resends
 * (Firebase Auth, and most products that copy it) lock for exactly 60 seconds, so a disabled
 * button with a countdown reads as normal rather than as a limit this product invented.
 *
 * Enforced from the audit trail rather than a new column: every attempt is already recorded as
 * `invite_resent`, so the rule needs no schema change, works across instances (unlike the
 * in-process throttle on the accept endpoint), and cannot drift from the record of what actually
 * happened.
 */
export const INVITE_RESEND_COOLDOWN_SECONDS = 60;

export interface ResendInviteResult {
  profileId: string;
  /** Always `invited` when this returns — the call refuses anything else. */
  state: TeammateProfileState;
  /**
   * True when the previous window had LAPSED and this call opened a fresh one, so the emailed
   * link is new. False for a straight redelivery, which carries the link and the window the
   * person already had.
   */
  refreshedWindow: boolean;
  /** Days the emailed link has left. What the email states, so the two cannot disagree. */
  expiresInDays: number;
  emailSent: boolean;
  emailError: string | null;
  /**
   * How long this profile must now wait before another resend is allowed.
   *
   * Reported rather than duplicated on the client: the UI shows a countdown from this number, so
   * the lock it displays is the same one the server enforces.
   */
  cooldownSeconds: number;
  seats: SeatUsage;
}

/**
 * Re-send an invitation that is still open.
 *
 * A resend is a DELIVERY retry, not a new grant. The link is minted from `invitedAt`
 * (`invite-token.server.ts`), so an open invitation goes out again with the same link and the
 * SAME window — the advisor is chasing an email, not extending a seat hold. The email is told
 * the days that are actually left, because "expires in 14 days" on a twelve-day-old invite would
 * be a lie.
 *
 * The one case that does start a new window is a LAPSED hold, and it has to: until a manager's
 * next read sweeps it, the profile is still `invited` in the database while its link is already
 * dead, so redelivering the old token would deliver a link that is refused on arrival.
 * `expireStaleInvites`' own two steps are replayed for this one person — release to `contact`,
 * then invite again — which refreshes `invitedAt`, re-takes the seat through the same
 * `assertSeatAvailable` check the add flow uses, and leaves two audited transitions behind.
 *
 * The three refusals are the states a resend cannot mean anything in: deactivated (there is no
 * access to invite them to), already accepted (they have an account — sign in, not another
 * email), and a Contact (no open invitation to re-send; inviting them is `addTeamMember`, which
 * also decides the seat and the access).
 */
export async function resendTeamMemberInvite(input: {
  organizationId: string;
  actorUserId: string;
  profileId: string;
}): Promise<ResendInviteResult> {
  const profile = await getTeammateProfile(input.profileId, input.organizationId);
  if (!profile) {
    throw new TeammateDataError(
      "Teammate profile not found in this organization.",
      404,
    );
  }
  if (profile.deactivatedAt) {
    throw new TeammateDataError(
      "This person is deactivated. Reactivate them before sending an invitation.",
      409,
      "profile_deactivated",
    );
  }
  if (profile.state === "active") {
    throw new TeammateDataError(
      "They have already accepted their invitation, so there is nothing to resend. They can sign in.",
      409,
      "invite_already_accepted",
    );
  }
  if (profile.state !== "invited") {
    throw new TeammateDataError(
      "This person has no open invitation. Add them again to invite them.",
      409,
      "no_open_invitation",
    );
  }

  // ── The resend cooldown ────────────────────────────────────────────────────────
  //
  // Checked BEFORE the lapsed-hold branch below, which mutates state: a refusal must never leave
  // a released-then-reopened window behind. A previous attempt that FAILED to send does not start
  // the cooldown — the rule protects the recipient's inbox, and a send that failed never reached
  // it — so a broken mail server cannot also lock the advisor out of retrying.
  const lastResend = await prisma.teammateAuditEvent.findFirst({
    where: { profileId: profile.id, action: "invite_resent" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, details: true },
  });
  if (
    lastResend &&
    (lastResend.details as { emailSent?: boolean } | null)?.emailSent !== false
  ) {
    const remainingMs =
      INVITE_RESEND_COOLDOWN_SECONDS * 1000 -
      (Date.now() - lastResend.createdAt.getTime());
    if (remainingMs > 0) {
      const retryAfterSeconds = Math.ceil(remainingMs / 1000);
      throw new TeammateDataError(
        `This invitation was re-sent less than a minute ago. Try again in ${retryAfterSeconds} second${
          retryAfterSeconds === 1 ? "" : "s"
        }.`,
        429,
        "invite_resend_cooldown",
        retryAfterSeconds,
      );
    }
  }

  let refreshedWindow = false;
  if (isInviteExpired(profile.invitedAt)) {
    // Only a Team Member holds a seat (spec T3 item 1), so only a Team Member's refreshed invite
    // has to fit in the allowance. The released hold is what pays for it: `getSeatUsage`
    // discounts a stale pending invite, so this is a re-take rather than a second seat.
    if (profile.type === "team_member") {
      await assertSeatAvailable({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        confirmUpgrade: false,
      });
    }
    await setProfileState({
      id: profile.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      state: "contact",
    });
    await upgradeContactToInvited({
      id: profile.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
    });
    refreshedWindow = true;
  }

  // Re-read either way: `invitedAt` is what the link and the reported window derive from.
  const current =
    (await getTeammateProfile(input.profileId, input.organizationId)) ?? profile;

  const email = current.email.trim();
  const link = await acceptanceUrlForProfile({
    id: current.id,
    organizationId: input.organizationId,
    email,
  });
  if (!link) {
    // Without a window there is nothing to encode, and the link would be refused on arrival, so
    // this is reported instead of emailed.
    throw new TeammateDataError(
      "This profile has no invite window to mint a link from.",
      409,
      "no_invite_window",
    );
  }

  // The same context the first invitation carried, re-derived rather than stored. See
  // `addTeamMember`: the email describes what was WRITTEN, so the role and the permissions are
  // read back off the assignments instead of off the role's preset.
  const [organizationName, actor, assignments] = await Promise.all([
    // Same resolution as the first invitation — see `organizationDisplayName`.
    organizationDisplayName(input.organizationId),
    prisma.user.findUnique({
      where: { id: input.actorUserId },
      select: { name: true },
    }),
    prisma.planAssignment.findMany({
      where: { profileId: current.id, organizationId: input.organizationId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const clientIds = [
    ...new Set(assignments.map((assignment) => assignment.clientId)),
  ];
  const clients = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds }, organizationId: input.organizationId },
        select: { id: true, companyName: true },
      })
    : [];
  const companyNameById = new Map(
    clients.map((client) => [client.id, client.companyName]),
  );

  /**
   * Role and permissions are reported only while the assignments AGREE.
   *
   * One add writes one grid across every assignment, so agreement is the normal case; a per-plan
   * edit can make them differ, and naming one grid as "your permissions" would then describe
   * access the person does not hold everywhere. Reporting nothing is the honest option — the
   * email simply leaves those lines out (see `permissionLines` in lib/email.ts).
   */
  const grids = assignments.map((assignment) =>
    normalizePermissionSet(assignment.permissionSet),
  );
  const singleRole =
    assignments.length > 0 &&
    assignments.every((assignment) => assignment.role === assignments[0].role);
  const singleGrid =
    grids.length > 0 &&
    grids.every((grid) => JSON.stringify(grid) === JSON.stringify(grids[0]));

  const planNames = assignments
    .map((assignment) => companyNameById.get(assignment.clientId))
    .filter((name): name is string => Boolean(name));

  // "All categories" is claimed only when EVERY assignment covers them; otherwise the union of
  // the named ones, which can understate a scope but never overstate one.
  const allCategories = assignments.every(
    (assignment) => assignment.categoryScope === "all",
  );
  const categoryNames = [
    ...new Set(
      assignments.flatMap((assignment) =>
        Array.isArray(assignment.categories)
          ? (assignment.categories as string[])
          : [],
      ),
    ),
  ];

  const windowEnd = inviteTokenExpiry(current.invitedAt ?? new Date());
  const expiresInDays = Math.max(
    1,
    Math.ceil((windowEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  let emailSent = false;
  let emailError: string | null = null;
  try {
    if (current.type === "collaborator") {
      // A collaborator holds no seat and was invited to complete a benefit section, not to
      // join a team. Resending must use the SAME template the first invitation used, or the
      // recipient is told they were "added as a Team Member" — the very thing this section
      // is not about.
      const assignment = assignments[0] ?? null;
      const assignedCategories =
        assignment?.categoryScope === "all"
          ? [...BENEFIT_CONTACT_CATEGORIES]
          : Array.isArray(assignment?.categories)
            ? (assignment.categories as string[])
            : [];
      const planName = assignment
        ? companyNameById.get(assignment.clientId) ?? null
        : null;
      // The "Who is this?" label the first invite recorded — the audit row keeps it — so a
      // resend reads exactly like the invitation it repeats.
      const invited = await prisma.teammateAuditEvent.findFirst({
        where: { profileId: current.id, action: "collaborator_invited" },
        orderBy: { createdAt: "desc" },
        select: { details: true },
      });
      const inviteContext =
        (invited?.details as { whoIsThisLabel?: string } | null)?.whoIsThisLabel ||
        "a collaborator";

      await sendCollaboratorInviteEmail({
        to: email,
        collaboratorName:
          [current.firstName, current.lastName].filter(Boolean).join(" ") || null,
        inviterName: actor?.name ?? null,
        organizationName,
        planName: planName || organizationName || "your plan",
        category: assignedCategories[0] ?? "Company / Plan Sponsor",
        // Fewer than two reads as "the <category> section"; several are named.
        categories:
          assignedCategories.length > 1 ? assignedCategories : undefined,
        inviteContext,
        // One category deep-links at its section; several land on the benefit list — the
        // same choice the first invitation made.
        sectionUrl:
          assignment && assignedCategories.length === 1
            ? `${appBaseUrl()}/edit-benefit/${assignment.clientId}/${categoryToSlug(
                assignedCategories[0],
              )}`
            : `${appBaseUrl()}/benefits`,
        acceptUrl: link.url,
        // The completeness list is rebuilt from live data on the first invite; a resend is a
        // nudge, so it omits the list rather than risk showing a stale one.
        missingFields: [],
        note: assignment?.inviteNote ?? null,
        dueDate: assignment?.inviteDueDate ?? null,
      });
    } else {
      await sendTeamMemberInviteEmail({
        to: email,
        memberName:
          [current.firstName, current.lastName].filter(Boolean).join(" ") || null,
        inviterName: actor?.name ?? null,
        organizationName,
        // Named only when there is exactly ONE plan, for the same reason the add path names one:
        // the subject reads "…added you to Acme Corp", and a list there is worse than the firm.
        planName:
          assignments.length === 1
            ? companyNameById.get(assignments[0].clientId) ?? null
            : null,
        acceptUrl: link.url,
        expiresInDays,
        role: singleRole ? (assignments[0].role as TeammateAssignmentRole) : null,
        permissions: singleGrid ? grids[0] : null,
        planNames: current.allPlans ? null : planNames,
        categories: allCategories ? null : categoryNames,
      });
    }
    emailSent = true;
  } catch (error) {
    emailError = error instanceof Error ? error.message : "Unknown email error";
    console.error("[teammates/team] invitation resend failed", error);
  }

  // Logged whether or not the mail left: "we chased this person" and "the chase failed" are both
  // worth answering later, and the details say which happened.
  await recordTeammateAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "invite_resent",
    profileId: current.id,
    details: { emailSent, refreshedWindow, expiresInDays, to: email },
  });

  return {
    profileId: current.id,
    state: current.state as TeammateProfileState,
    refreshedWindow,
    expiresInDays,
    emailSent,
    emailError,
    cooldownSeconds: INVITE_RESEND_COOLDOWN_SECONDS,
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

  // Record the role on the profile as well, so a membership that has no assignments yet
  // still reports the role it was set to.
  if (input.role !== undefined) {
    await updateTeammateProfile({
      id: profile.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      data: { role: input.role },
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
  /**
   * Whether the selected plans cover EVERY plan in the organisation.
   *
   * Distinct from `scope: "all"` on purpose: `scope` is the stored `allPlans` flag, which also
   * auto-assigns future plans. Someone set up plan-by-plan (scope "certain") whose ticks happen
   * to be every plan *today* has the same reach right now but is not the same setting, so this is
   * reported separately and used only for display — the roster says "All Plans" without silently
   * turning on the flag that would sweep in plans created later.
   */
  coversAll: boolean;
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
  /**
   * True when this profile is linked to a plan's Key Contacts — i.e. it existed as a
   * Contact before any invite, because the row is derived from an assignment carrying a
   * `contactId`. It is what makes "remove from seat" revert a pending invite to a Contact
   * instead of deleting a person your plans already know.
   */
  fromContact: boolean;
  /** Partner/Provider company (T1) the person belongs to; null for the owner. */
  companyName: string | null;
  planAccess: TeamMemberPlanSummary;
  categoryAccess: TeamMemberCategorySummary;
  allPlans: boolean;
  invitedAt: Date | null;
  deactivatedAt: Date | null;
  /**
   * Set when the person deleted their OWN login. The profile and its seat are deliberately
   * retained until an Owner/Admin confirms (`confirmSelfDeletedProfile`), so the seat card
   * can surface the state and offer that confirmation.
   */
  selfDeletedAt: Date | null;
}

// `ROLE_RANK` and `mostPrivilegedRole` moved to `@/types/teammate`: the profile route now
// summarises the reader's own role too, and both callers must apply one definition.

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
            contactId: true,
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
      // The owner is synthesized from their User row, never mirrored from a contact.
      fromContact: false,
      // The owner is a User, not a partner company.
      companyName: null,
      // The owner implicitly reaches every plan in their organization.
      planAccess: {
        scope: "all",
        planIds: plans.map((plan) => plan.id),
        planNames: plans.map((plan) => plan.companyName),
        coversAll: true,
      },
      categoryAccess: { scope: "all", categories: [] },
      allPlans: true,
      invitedAt: null,
      deactivatedAt: null,
      // The owner is synthesized from their User row, so they can never be self-deleted.
      selfDeletedAt: null,
    });
  }

  for (const profile of profiles) {
    const memberAssignments = byProfile.get(profile.id) ?? [];
    // "Was already a Contact": the mirror links a profile to the Key Contact it came from
    // through the assignment's `contactId`, so an assignment carrying one is the record that
    // this person was known to the organization before the invite.
    const fromContact = memberAssignments.some(
      (assignment) => assignment.contactId,
    );

    const planIds = [
      ...new Set(memberAssignments.map((assignment) => assignment.clientId)),
    ];
    const planScope: TeamMemberPlanSummary["scope"] = profile.allPlans
      ? "all"
      : planIds.length > 0
        ? "certain"
        : "none";

    // Every plan in the organisation ticked individually is "certain" in the stored sense but
    // reads as all-plans access, so the roster can say so without flipping the `allPlans` flag.
    const coversAllPlans =
      plans.length > 0 && plans.every((plan) => planIds.includes(plan.id));

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
      // Assignment roles win. A membership with no assignment yet — an invite raised before
      // any plan exists — falls back to the role stored on the profile, then to the default
      // for its type, so a Team Member is never summarised as the collaborator default.
      role:
        memberAssignments.length > 0
          ? mostPrivilegedRole(memberAssignments.map((a) => a.role))
          : (profile.role ??
            (profile.type === "team_member" ? "editor" : "contributor")),
      status: profile.state,
      personType: profile.type,
      fromContact,
      companyName: profile.companyId
        ? (companyNameById.get(profile.companyId) ?? null)
        : null,
      planAccess: {
        scope: planScope,
        planIds,
        planNames: planIds.map((id) => planNameById.get(id) ?? id),
        coversAll: profile.allPlans || coversAllPlans,
      },
      categoryAccess:
        allCategories || memberAssignments.length === 0
          ? { scope: "all", categories: [] }
          : { scope: "certain", categories: selected },
      allPlans: profile.allPlans,
      invitedAt: profile.invitedAt ?? null,
      deactivatedAt: profile.deactivatedAt ?? null,
      selfDeletedAt: profile.selfDeletedAt ?? null,
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
export type RemoveFromSeatOutcome =
  | "returned_to_contact"
  | "deactivated"
  | "profile_deleted";

export interface RemoveFromSeatResult {
  profileId: string;
  outcome: RemoveFromSeatOutcome;
  /**
   * The state the profile ended in, so the caller need not re-read it. NULL when the
   * profile was deleted — the outcome for a pending invite.
   */
  state: TeammateProfileState | null;
  /** How many seats the meter gave back — 0 when this person held none. */
  releasedSeats: number;
  /** The fresh meter, so the header can show the freed seat without a second read. */
  seats: SeatUsage;
}

/**
 * Take someone out of the seat they occupy.
 *
 * One *user* action but not one write, because the state machine only allows one of them
 * per person: `setProfileState` refuses `active → contact` ("An Active profile cannot be
 * reverted to Contact. Deactivate it instead."), so "put them back as a Contact" is
 * genuinely unavailable to anyone who has accepted.
 *
 *  - **`invited`** — no acceptance yet, so what happens depends on where the profile came
 *    from. If it already existed as a Contact (an assignment linked to a plan's Key
 *    Contacts by `contactId`), the promotion is fully reversible: the state returns to
 *    `contact`, exactly as `expireStaleInvites` does when a hold lapses — the person was
 *    known to your plans before the invite, and deleting the profile would delete that link
 *    too. If the invite CREATED the profile, there is nothing to keep: nobody has signed in,
 *    so it holds no authored content, and it is DELETED (its assignments first).
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
    // Only a profile the invite CREATED is deleted. If it was already a Contact — an
    // assignment linked to a plan's Key Contacts by `contactId` — the invite is reverted
    // instead, because that link is the record of a person your plans already know.
    const cameFromContact =
      (await prisma.planAssignment.count({
        where: { profileId, organizationId, contactId: { not: null } },
      })) > 0;

    if (cameFromContact) {
      await setProfileState({
        id: profileId,
        organizationId,
        actorUserId,
        state: "contact",
      });
      outcome = "returned_to_contact";
    } else {
      // Delete the invite-created profile. Assignments go first
      // (`removePersonFromOrganization` audits each one and keeps the
      // never-remove-the-last-Owner guard), then the profile, so the seat is released by
      // the row that held it disappearing.
      const removed = await removePersonFromOrganization({
        organizationId,
        actorUserId,
        profileId,
      });
      const releasedSeats = Math.max(before.seatsUsed - removed.seats.seatsUsed, 0);

      await recordTeammateAuditEvent({
        organizationId,
        actorUserId,
        action: "profile_removed_from_seat",
        profileId,
        details: {
          outcome: "profile_deleted",
          from: "invited",
          releasedSeats,
          removedAssignments: removed.removedAssignments,
        },
      });

      return {
        profileId,
        outcome: "profile_deleted",
        state: null,
        releasedSeats,
        seats: removed.seats,
      };
    }
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

/**
 * Finalise a self-service account deletion.
 *
 * A Team Member who deletes their own login leaves their `TeammateProfile` behind with
 * `selfDeletedAt` set (see `markProfilesSelfDeletedByLogin`) so the seat they occupied is
 * not handed back silently. This is the Owner/Admin's side of that: confirming the deletion
 * removes the person and their assignments and releases the seat.
 *
 * Refuses anything that was not self-deleted, so this cannot be used as a second, quieter
 * route to `remove_from_organization` — the marker is the whole precondition. The removal
 * itself reuses `removePersonFromOrganization`, so the last-Owner guard and the
 * per-assignment audit rows still apply.
 */
export async function confirmSelfDeletedProfile({
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
  releasedSeats: number;
  seats: SeatUsage;
}> {
  const profile = await getTeammateProfile(profileId, organizationId);
  if (!profile) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }
  if (!profile.selfDeletedAt) {
    throw new TeammateDataError(
      "This profile has not been deleted by its owner, so there is nothing to confirm.",
      409,
      "profile_not_self_deleted",
    );
  }

  // Measured, not assumed: `getSeatUsage` owns the metering rules, so diffing its own
  // number stays correct even if those rules change.
  const before = await getSeatUsage(organizationId);
  const removed = await removePersonFromOrganization({
    organizationId,
    actorUserId,
    profileId,
  });
  const releasedSeats = Math.max(before.seatsUsed - removed.seats.seatsUsed, 0);

  // The underlying writers audit the removals they perform; this records the intent, so the
  // trail reads as "an admin confirmed a self-deletion" rather than as a bare delete.
  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_deletion_confirmed",
    profileId,
    details: {
      email: profile.email,
      removedAssignments: removed.removedAssignments,
      releasedSeats,
    },
  });

  return {
    profileId: removed.profileId,
    removedAssignments: removed.removedAssignments,
    releasedSeats,
    seats: removed.seats,
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

/**
 * Add ONE plan assignment to an existing membership.
 *
 * This backs the Manage Access screen's "instant add": ticking a plan pill under Certain Plans
 * creates that plan's assignment straight away, so its per-plan role and Show on Benefits Hub
 * controls work without waiting for Save access.
 *
 * Deliberately narrow. `updateTeamMember` reconciles the WHOLE plan set and re-applies the
 * requested category scope to every survivor, which would clobber the category scope of the
 * other assignments; this writes exactly one plan and leaves the rest untouched.
 *
 * The default role follows the person's type — Editor for a Team Member, Contributor for a
 * Collaborator — matching `addTeamMember`. The category scope starts at All; the normal Save
 * access (or the row's own controls) adjusts it afterwards.
 */
export async function addPlanAssignment({
  organizationId,
  actorUserId,
  profileId,
  clientId,
}: {
  organizationId: string;
  actorUserId: string;
  profileId: string;
  clientId: string;
}) {
  const profile = await prisma.teammateProfile.findFirst({
    where: { id: profileId, organizationId },
    select: { id: true, type: true },
  });
  if (!profile) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }

  const role: TeammateAssignmentRole =
    profile.type === "team_member" ? "editor" : "contributor";

  return upsertAssignment({
    organizationId,
    actorUserId,
    profileId,
    clientId,
    role,
    categoryScope: "all",
  });
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
  /**
   * The organization's plans, for the "Certain Plans" checklist, each with the
   * Custom benefit titles created on it (stored as `Benefit` rows under the
   * Custom category — see `benefit-categories.server`). The access screen lists
   * them alongside the canonical categories so a Custom benefit can be granted by
   * name, and so ticking one can pin the plan it lives on.
   */
  plans: { id: string; companyName: string; customBenefits: string[] }[];
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
    // The organisation's plans, each with the Custom benefit titles authored on it —
    // scoped the same way `resolveTargetPlanIds` scopes All Plans, so the checklist and
    // the write path agree on what "every plan" means. Shared with the People & Access
    // roster (see `listPlanCustomBenefits`), so the two pickers cannot disagree about the
    // Custom benefits a plan offers.
    listPlanCustomBenefits(organizationId),
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
    plans,
    seats,
    canDeleteProfile: assignments.length === 0,
  };
}

