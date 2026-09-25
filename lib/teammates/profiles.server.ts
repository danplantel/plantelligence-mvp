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
import type { Prisma } from "@prisma/client";
import { TeammateDataError } from "./errors";
import { recordTeammateAuditEvent } from "./audit.server";
import { getPartnerCompany } from "./companies.server";
import type {
  TeammatePersonType,
  TeammateProfileState,
} from "@/types/teammate";

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
    filters.push({
      OR: [{ deactivatedAt: null }, { deactivatedAt: { isSet: false } }],
    });
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
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  designations?: string[];
  phone?: string | null;
  phoneExtension?: string | null;
  headshot?: string | null;
  benefitsSpecialty?: string[];
  companyId?: string | null;
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
      ...(state === "invited" && !existing.invitedAt
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
      OR: [{ deactivatedAt: null }, { deactivatedAt: { isSet: false } }],
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
