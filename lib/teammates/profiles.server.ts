/**
 * profiles.server — Person Profile data access (spec T1 Part B item 1).
 *
 * "Create the person once, reuse the profile" is the guiding principle, so the
 * central helper here is `findOrCreateProfile`: an invite whose email already
 * belongs to a profile in this organization reuses that profile rather than
 * creating a duplicate (spec T4 Part B item 5).
 *
 * Server-only. Every function takes `organizationId`.
 */

import prisma from "@/lib/prisma";
// A VALUE import: `Prisma.JsonNull` below is a runtime sentinel, not a type.
import { Prisma } from "@prisma/client";
import { TeammateDataError } from "./errors";
import { recordTeammateAuditEvent } from "./audit.server";
import { getPartnerCompany } from "./companies.server";
import type {
  TeammateAssignmentRole,
  TeammatePersonType,
  TeammateProfileState,
} from "@/types/teammate";
import type { ContactFormTopic } from "@/lib/contact-form-topics";

/** Emails are stored lowercased so "Jane@ABC.com" and "jane@abc.com" match. */
export function normalizeTeammateEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

export interface CreateTeammateProfileInput {
  organizationId: string;
  /** Who is creating this profile — recorded on the audit event. */
  actorUserId: string;
  type: TeammatePersonType;
  state?: TeammateProfileState;
  /**
   * The seat's role, kept on the profile so it survives having no assignment yet — an
   * invite raised before any plan exists has nothing to attach a role to otherwise.
   */
  role?: TeammateAssignmentRole | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  designations?: string[];
  phone?: string | null;
  phoneExtension?: string | null;
  headshot?: string | null;
  benefitsSpecialty?: string[];
  companyId?: string | null;
  /**
   * Card-only fields — see the note in `prisma/schema.prisma`. Optional so every
   * existing caller is unchanged; the invite-acceptance flow is the one that sets
   * them for the invited person themself.
   */
  cardContactType?: string | null;
  displayEmail?: boolean;
  displayPhone?: boolean;
  enableContactButton?: boolean;
  ctaType?: string | null;
  schedulingUrl?: string | null;
  websiteUrl?: string | null;
  contactFormTopics?: ContactFormTopic[] | null;
  allPlans?: boolean;
  loginUserId?: string | null;
  invitedAt?: Date | null;
}

export async function getTeammateProfile(
  id: string,
  organizationId: string,
) {
  return prisma.teammateProfile.findFirst({
    where: { id, organizationId },
  });
}

/** Find a profile in this organization by email (case-insensitive). */
export async function findProfileByEmail(
  organizationId: string,
  email: string,
) {
  const normalized = normalizeTeammateEmail(email);
  if (!normalized) return null;
  return prisma.teammateProfile.findFirst({
    where: { organizationId, email: normalized },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * All profiles for an organization. Deactivated profiles are excluded unless
 * explicitly requested (spec T6 keeps them around after deactivation).
 */
export async function listTeammateProfiles(
  organizationId: string,
  options?: {
    includeDeactivated?: boolean;
    search?: string;
    type?: TeammatePersonType;
    limit?: number;
  },
) {
  const search = options?.search?.trim();

  // Filters are composed as an AND list rather than spread onto one object,
  // because both the deactivation filter and the search filter need their own
  // `OR` key and would otherwise collide.
  const filters: Prisma.TeammateProfileWhereInput[] = [{ organizationId }];

  if (options?.type) {
    filters.push({ type: options.type });
  }

  if (!options?.includeDeactivated) {
    // A live profile is either an explicit null or a row written before the
    // field existed (MongoDB stores it as an absent field). Matching only `null`
    // silently hides those rows, so both shapes are accepted.
    // One predicate: on PostgreSQL an absent field and an explicit null are the same NULL.
    filters.push({ deactivatedAt: null });
  }

  if (search) {
    filters.push({
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  return prisma.teammateProfile.findMany({
    where: { AND: filters },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { createdAt: "asc" }],
    take: Math.min(Math.max(options?.limit ?? 200, 1), 500),
  });
}

export async function createTeammateProfile(
  input: CreateTeammateProfileInput,
) {
  const email = normalizeTeammateEmail(input.email);
  if (!email) {
    throw new TeammateDataError("An email address is required.", 400);
  }

  // The module's core rule — create the person once — has to hold at the only
  // writer, not just in `findOrCreateProfile`. `(organizationId, email)` carries
  // no unique constraint in the schema, so without this guard a caller that
  // bypasses `findOrCreateProfile` can silently create the duplicate profile the
  // spec forbids (T4: "reuse it instead of creating a duplicate").
  const existingForEmail = await findProfileByEmail(
    input.organizationId,
    email,
  );
  if (existingForEmail) {
    if (existingForEmail.deactivatedAt) {
      throw new TeammateDataError(
        "A deactivated profile already exists for this email. Reactivate it instead of creating a new one.",
        409,
        "profile_email_deactivated",
      );
    }
    throw new TeammateDataError(
      "A profile already exists for this email. Reuse it instead of creating a duplicate.",
      409,
      "profile_email_exists",
    );
  }

  // Spec T2a: All Plans is a Team Member privilege. Enforced at the data layer
  // so a direct API call cannot bypass the UI's hidden control.
  if (input.type === "collaborator" && input.allPlans) {
    throw new TeammateDataError(
      "All Plans is not available for external collaborators.",
      400,
      "collaborator_all_plans",
    );
  }

  if (input.companyId) {
    await assertCompanyInOrganization(input.companyId, input.organizationId);
  }

  const profile = await prisma.teammateProfile.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      state: input.state ?? "contact",
      role: input.role ?? null,
      email,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      jobTitle: input.jobTitle ?? null,
      designations: input.designations ?? [],
      phone: input.phone ?? null,
      phoneExtension: input.phoneExtension ?? null,
      headshot: input.headshot ?? null,
      benefitsSpecialty: input.benefitsSpecialty ?? [],
      companyId: input.companyId ?? null,
      cardContactType: input.cardContactType ?? null,
      // NULL, not FALSE: an unconfigured seat must not hide the card's email/phone.
      displayEmail: input.displayEmail ?? null,
      displayPhone: input.displayPhone ?? null,
      enableContactButton: input.enableContactButton ?? null,
      ctaType: input.ctaType ?? null,
      schedulingUrl: input.schedulingUrl ?? null,
      websiteUrl: input.websiteUrl ?? null,
      contactFormTopics:
        input.contactFormTopics == null
          ? undefined
          : (input.contactFormTopics as unknown as Prisma.InputJsonValue),
      allPlans: input.type === "team_member" ? (input.allPlans ?? false) : false,
      loginUserId: input.loginUserId ?? null,
      invitedByUserId: input.actorUserId,
      invitedAt: input.invitedAt ?? null,
      // Written explicitly so a live profile is an observable null rather than an
      // absent field (see the deactivation filter in listTeammateProfiles).
      deactivatedAt: null,
    },
  });

  await recordTeammateAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "profile_created",
    profileId: profile.id,
    details: { type: profile.type, state: profile.state },
  });

  return profile;
}

/**
 * Reuse-or-create by email. This is the entry point invite flows should use so
 * "a second invite to Jane on another plan adds an assignment, not a new
 * profile" (spec T4 acceptance) holds by construction.
 */
export async function findOrCreateProfile(
  input: CreateTeammateProfileInput,
) {
  const existing = await findProfileByEmail(input.organizationId, input.email);
  if (existing) return existing;
  return createTeammateProfile(input);
}

export interface UpdateTeammateProfileInput {
  /** The seat's role — see `CreateTeammateProfileInput.role`. */
  role?: TeammateAssignmentRole | null;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  designations?: string[];
  phone?: string | null;
  phoneExtension?: string | null;
  headshot?: string | null;
  benefitsSpecialty?: string[];
  companyId?: string | null;
  /** Card-only fields — see the note in `prisma/schema.prisma`. */
  cardContactType?: string | null;
  displayEmail?: boolean;
  displayPhone?: boolean;
  enableContactButton?: boolean;
  ctaType?: string | null;
  schedulingUrl?: string | null;
  websiteUrl?: string | null;
  contactFormTopics?: ContactFormTopic[] | null;
}

/** Identity fields only — plan-scoped data is never stored on the profile. */
export async function updateTeammateProfile({
  id,
  organizationId,
  actorUserId,
  data,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
  data: UpdateTeammateProfileInput;
}) {
  const existing = await getTeammateProfile(id, organizationId);
  if (!existing) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }

  if (data.companyId) {
    await assertCompanyInOrganization(data.companyId, organizationId);
  }

  const updated = await prisma.teammateProfile.update({
    where: { id },
    data: {
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
      ...(data.designations !== undefined
        ? { designations: data.designations }
        : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.phoneExtension !== undefined
        ? { phoneExtension: data.phoneExtension }
        : {}),
      ...(data.headshot !== undefined ? { headshot: data.headshot } : {}),
      ...(data.benefitsSpecialty !== undefined
        ? { benefitsSpecialty: data.benefitsSpecialty }
        : {}),
      ...(data.companyId !== undefined ? { companyId: data.companyId } : {}),
      ...(data.cardContactType !== undefined
        ? { cardContactType: data.cardContactType }
        : {}),
      ...(data.displayEmail !== undefined
        ? { displayEmail: data.displayEmail }
        : {}),
      ...(data.displayPhone !== undefined
        ? { displayPhone: data.displayPhone }
        : {}),
      ...(data.enableContactButton !== undefined
        ? { enableContactButton: data.enableContactButton }
        : {}),
      ...(data.ctaType !== undefined ? { ctaType: data.ctaType } : {}),
      ...(data.schedulingUrl !== undefined
        ? { schedulingUrl: data.schedulingUrl }
        : {}),
      ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl } : {}),
      ...(data.contactFormTopics !== undefined
        ? {
            contactFormTopics:
              data.contactFormTopics === null
                ? Prisma.JsonNull
                : (data.contactFormTopics as unknown as Prisma.InputJsonValue),
          }
        : {}),
    },
  });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_updated",
    profileId: id,
    details: { fields: Object.keys(data) },
  });

  return updated;
}

/**
 * State transitions. A Contact can be upgraded to Invited at any time; Invited
 * becomes Active on acceptance. Active never silently reverts to Contact.
 */
export async function setProfileState({
  id,
  organizationId,
  actorUserId,
  state,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
  state: TeammateProfileState;
}) {
  const existing = await getTeammateProfile(id, organizationId);
  if (!existing) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }
  if (existing.state === "active" && state === "contact") {
    throw new TeammateDataError(
      "An Active profile cannot be reverted to Contact. Deactivate it instead.",
      409,
    );
  }
  if (existing.state === state) return existing;

  const updated = await prisma.teammateProfile.update({
    where: { id },
    data: {
      state,
      // Transitioning INTO `invited` always starts a fresh invite window.
      //
      // The `existing.state === state` return above means the previous state was never
      // `invited`, so this is unconditionally a new invitation and must not inherit the
      // old timestamp. This previously read `!existing.invitedAt`, which preserved a
      // stale date: `expireStaleInvites` moves a lapsed profile back to `contact`
      // WITHOUT clearing `invitedAt`, so re-inviting after a lapse kept the original
      // date. The T9 acceptance token is minted from that window
      // (invites.server.ts → `signInviteToken({ invitedAt })`), so the emailed link was
      // already expired on arrival and `loadInvitation` reported "expired".
      //
      // A still-live invite never reaches this line, so "a second invite adds an
      // assignment rather than a new profile" is unaffected: it neither resets the
      // 14-day hold nor double-counts a pending seat.
      ...(state === "invited"
        ? { invitedAt: new Date(), invitedByUserId: actorUserId }
        : {}),
    },
  });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_state_changed",
    profileId: id,
    details: { from: existing.state, to: state },
  });

  return updated;
}

/**
 * Spec T5 Part B item 1: inviting a Contact upgrades it to Invited without
 * replacing the profile.
 */
export async function upgradeContactToInvited({
  id,
  organizationId,
  actorUserId,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
}) {
  return setProfileState({ id, organizationId, actorUserId, state: "invited" });
}

/** Acceptance of an invite. Links the global login when supplied. */
export async function activateProfile({
  id,
  organizationId,
  actorUserId,
  loginUserId,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
  loginUserId?: string | null;
}) {
  const updated = await setProfileState({
    id,
    organizationId,
    actorUserId,
    state: "active",
  });
  if (loginUserId) {
    return linkLoginUserId({ id, organizationId, actorUserId, loginUserId });
  }
  return updated;
}

/**
 * Spec T1 Part B item 5: email links a profile to one global login. The login is
 * shared across organizations; the profile is not.
 */
export async function linkLoginUserId({
  id,
  organizationId,
  actorUserId,
  loginUserId,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
  loginUserId: string;
}) {
  const existing = await getTeammateProfile(id, organizationId);
  if (!existing) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }

  const updated = await prisma.teammateProfile.update({
    where: { id },
    data: { loginUserId },
  });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_login_linked",
    profileId: id,
    details: { loginUserId },
  });

  return updated;
}

/**
 * The org-boundary axis (spec T1 Part B item 1, T3 item 1): a Team Member is inside the
 * organization and consumes a seat; a Collaborator is outside it and never does.
 *
 * Kept separate from `updateTeammateProfile` because it is not an identity edit — it
 * changes seat accounting and which list the person appears in. Both `getSeatUsage` and
 * `listOrgPeople` filter on `type`, so a silent change here is a silent change to the
 * seat meter, which is why it gets its own audit entry.
 */
export async function setProfileType({
  id,
  organizationId,
  actorUserId,
  type,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
  type: TeammatePersonType;
}) {
  const existing = await getTeammateProfile(id, organizationId);
  if (!existing) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }
  if (existing.type === type) return existing;

  // Moving a profile to the external side has to clear All Plans in the same write:
  // `setProfileAllPlans` and `createTeammateProfile` both refuse All Plans for a
  // collaborator, so leaving the flag set would leave a state those guards would never
  // have created — and one that would start generating assignments for new plans again
  // the moment the profile was ever promoted back.
  const updated = await prisma.teammateProfile.update({
    where: { id },
    data: {
      type,
      ...(type === "collaborator" ? { allPlans: false } : {}),
    },
  });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_type_changed",
    profileId: id,
    details: { from: existing.type, to: type },
  });

  return updated;
}

/**
 * Spec T1 Part B item 4: the org-level All Plans flag on Team Member profiles.
 * Setting it is what makes an assignment get generated for every new plan.
 */
export async function setProfileAllPlans({
  id,
  organizationId,
  actorUserId,
  allPlans,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
  allPlans: boolean;
}) {
  const existing = await getTeammateProfile(id, organizationId);
  if (!existing) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }
  if (allPlans && existing.type === "collaborator") {
    throw new TeammateDataError(
      "All Plans is not available for external collaborators.",
      400,
      "collaborator_all_plans",
    );
  }

  const updated = await prisma.teammateProfile.update({
    where: { id },
    data: { allPlans },
  });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_all_plans_changed",
    profileId: id,
    details: { allPlans },
  });

  return updated;
}

/**
 * Spec T6: Deactivate ends all access to the organization but keeps the profile
 * (and everything the person created).
 */
export async function deactivateTeammateProfile({
  id,
  organizationId,
  actorUserId,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
}) {
  const existing = await getTeammateProfile(id, organizationId);
  if (!existing) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }

  const updated = await prisma.teammateProfile.update({
    where: { id },
    data: { deactivatedAt: new Date() },
  });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_deactivated",
    profileId: id,
  });

  return updated;
}

export async function reactivateTeammateProfile({
  id,
  organizationId,
  actorUserId,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
}) {
  const existing = await getTeammateProfile(id, organizationId);
  if (!existing) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }

  const updated = await prisma.teammateProfile.update({
    where: { id },
    data: { deactivatedAt: null },
  });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_reactivated",
    profileId: id,
  });

  return updated;
}

/**
 * Flag every profile linked to a login that is being deleted by its own owner.
 *
 * This is the data half of "a Team Member deleted their own profile". The profile is
 * deliberately KEPT — and so is the seat it holds — because `getSeatUsage` counts every
 * `state: "active"` profile that is not deactivated. Without this flag the organization
 * would be left with an Active-looking seat whose login no longer exists, and nothing on
 * screen would explain it; with it, the seat card can ask an Owner or Admin to confirm.
 *
 * Called from `DELETE /api/profile/delete` BEFORE the `User` row is removed, so the link
 * is still resolvable when the profiles are found. The flag is the only thing written —
 * the `loginUserId` link is left in place as the record of whose login it was, and clearing
 * it here would make a re-add indistinguishable from any other profile.
 *
 * Only profiles that actually HOLD a seat are flagged: a Team Member, not deactivated, and
 * `active` (or inside a pending invite window). A deactivated or Contact profile consumes no
 * seat, so flagging it would leave a "seat still held" notice pointing at a seat nobody is
 * holding.
 *
 * Returns the number of profiles flagged and the organizations they belong to, so the
 * caller can report what survived the deletion.
 */
export async function markProfilesSelfDeletedByLogin(
  loginUserId: string,
): Promise<{ profiles: number; organizations: string[] }> {
  const profiles = await prisma.teammateProfile.findMany({
    where: {
      loginUserId,
      selfDeletedAt: null,
      deactivatedAt: null,
      type: "team_member",
      state: { in: ["active", "invited"] },
    },
    select: { id: true, organizationId: true },
  });
  if (profiles.length === 0) return { profiles: 0, organizations: [] };

  const now = new Date();
  await prisma.teammateProfile.updateMany({
    where: { id: { in: profiles.map((profile) => profile.id) } },
    data: { selfDeletedAt: now },
  });

  for (const profile of profiles) {
    await recordTeammateAuditEvent({
      organizationId: profile.organizationId,
      actorUserId: loginUserId,
      action: "profile_self_deleted",
      profileId: profile.id,
      details: {
        reason: "account_deleted_by_owner",
        // The profile and its seat were intentionally retained; the confirmation that
        // releases them is a separate, audited action.
        seatRetained: true,
      },
    });
  }

  return {
    profiles: profiles.length,
    organizations: [...new Set(profiles.map((profile) => profile.organizationId))],
  };
}

/**
 * Undo the self-deleted marker when the person is added back.
 *
 * A self-deleted profile is `active` with a `loginUserId` that no longer resolves to a
 * `User`, so it cannot simply be reused: `upgradeContactToInvited` would treat it as an
 * already-accepted member, skip the invite window and send nothing. Re-adding them is
 * really a new invitation, so this resets the profile to a Contact with no login link —
 * the same shape a brand-new person starts from — and clears the flag so the seat card
 * stops reading "Profile deleted" for somebody who is being added back.
 *
 * The `active → contact` reset is written directly rather than through `setProfileState`,
 * whose guard exists to stop a live member being demoted. That guard assumes the login
 * still exists; here it deliberately does not.
 */
export async function reviveSelfDeletedProfile({
  id,
  organizationId,
  actorUserId,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
}) {
  const existing = await getTeammateProfile(id, organizationId);
  if (!existing) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }

  const updated = await prisma.teammateProfile.update({
    where: { id },
    data: {
      selfDeletedAt: null,
      loginUserId: null,
      state: "contact",
    },
  });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_self_deletion_reverted",
    profileId: id,
    details: { from: existing.state, to: "contact" },
  });

  return updated;
}

/**
 * Spec T6 item 3: "Delete Profile: allowed only when the person has no remaining
 * assignments." The guard lives here so it cannot be skipped by a caller.
 */
export async function deleteTeammateProfile({
  id,
  organizationId,
  actorUserId,
}: {
  id: string;
  organizationId: string;
  actorUserId: string;
}) {
  const existing = await getTeammateProfile(id, organizationId);
  if (!existing) {
    throw new TeammateDataError("Teammate profile not found.", 404);
  }

  const remaining = await prisma.planAssignment.count({
    where: { profileId: id, organizationId },
  });
  if (remaining > 0) {
    throw new TeammateDataError(
      "Remove every assignment before deleting this profile.",
      409,
      "profile_has_assignments",
    );
  }

  await prisma.teammateProfile.delete({ where: { id } });

  await recordTeammateAuditEvent({
    organizationId,
    actorUserId,
    action: "profile_deleted",
    profileId: id,
    details: { email: existing.email },
  });

  return { id };
}

/**
 * Spec T1 Part B item 4 support: every Team Member with All Plans gets a fresh
 * assignment when a plan is created. Returns the profiles needing one.
 *
 * The deactivation filter must match BOTH an explicit null and an absent field —
 * `deactivatedAt: null` alone silently drops every row that never had the field
 * written, which would quietly exclude those members from new-plan assignment
 * generation. Same rule as `listTeammateProfiles`.
 */
export async function listAllPlansTeamMembers(organizationId: string) {
  return prisma.teammateProfile.findMany({
    where: {
      organizationId,
      type: "team_member",
      allPlans: true,
      deactivatedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });
}

async function assertCompanyInOrganization(
  companyId: string,
  organizationId: string,
): Promise<void> {
  const company = await getPartnerCompany(companyId, organizationId);
  if (!company) {
    throw new TeammateDataError(
      "Partner company not found in this organization.",
      404,
    );
  }
}
