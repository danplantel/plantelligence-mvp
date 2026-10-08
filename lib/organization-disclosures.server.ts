/**
 * organization-disclosures.server — the Organization's disclosures-review status
 * and the confirmation audit trail.
 *
 * Server-only. The status lives on `Organization` (org-wide, not per-user)
 * because the dashboard alert applies to the whole organization; every
 * confirmation also writes a `DisclosureAttestation` row recording who/when,
 * which template + attestation versions, and the context it came from.
 */

import prisma from "@/lib/prisma";
import { resolveOrganizationId } from "@/lib/organization";
import { isOwnerOrAdminOfOrganization } from "@/lib/teammates/access.server";
import {
  ATTESTATION_VERSION,
  DISCLOSURE_TEMPLATE_VERSION,
} from "@/config/onboarding/disclosures";

/** Roles that may review/confirm the organization's disclosures. */
const REVIEWER_ROLES = ["owner", "admin", "editor"] as const;

/** Where a confirmation was made. */
export type DisclosureAttestationContext = "onboarding" | "settings" | "plan";

const VALID_CONTEXTS: readonly DisclosureAttestationContext[] = [
  "onboarding",
  "settings",
  "plan",
];

export function isDisclosureAttestationContext(
  value: unknown,
): value is DisclosureAttestationContext {
  return (
    typeof value === "string" &&
    (VALID_CONTEXTS as readonly string[]).includes(value)
  );
}

/**
 * May this viewer review the organization's disclosures? True for the Owner or an
 * Admin (via the shared helper), or a teammate holding an assignment at Editor
 * rank or above.
 */
export async function canReviewOrganizationDisclosures(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  if (await isOwnerOrAdminOfOrganization({ userId, organizationId })) return true;

  const profiles = await prisma.teammateProfile.findMany({
    where: { loginUserId: userId },
    select: { id: true },
  });
  if (profiles.length === 0) return false;

  const assignment = await prisma.planAssignment.findFirst({
    where: {
      profileId: { in: profiles.map((profile) => profile.id) },
      role: { in: [...REVIEWER_ROLES] },
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

export interface OrganizationDisclosuresReview {
  organizationId: string;
  /** Has the organization's disclosure set been reviewed/confirmed? */
  reviewed: boolean;
  /** When it was last confirmed, if ever. */
  reviewedAt: string | null;
  /** May the current viewer review it? (Owner / Admin / Editor) */
  canReview: boolean;
}

/** Read the current review status and the viewer's eligibility. */
export async function getOrganizationDisclosuresReview(
  userId: string,
): Promise<OrganizationDisclosuresReview> {
  const organizationId = await resolveOrganizationId(userId);
  const [organization, canReview] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { disclosuresReviewed: true, disclosuresReviewedAt: true },
    }),
    canReviewOrganizationDisclosures(userId, organizationId),
  ]);
  return {
    organizationId,
    reviewed: Boolean(organization?.disclosuresReviewed),
    reviewedAt: organization?.disclosuresReviewedAt?.toISOString() ?? null,
    canReview,
  };
}

/**
 * Record a confirmation (attestation).
 *
 * When `disclosures` is supplied, a NEW `DisclosureVersion` (the revision being
 * confirmed) is written FIRST, then the organization is marked reviewed against
 * that revision. Without `disclosures`, the current revision is re-attested
 * (e.g. a plan-level reconfirmation).
 *
 * Returns false when the viewer may not review.
 */
export async function markOrganizationDisclosuresReviewed(
  userId: string,
  opts: {
    context: DisclosureAttestationContext;
    planId?: string | null;
    disclosures?: unknown;
  },
): Promise<boolean> {
  const organizationId = await resolveOrganizationId(userId);
  if (!(await canReviewOrganizationDisclosures(userId, organizationId))) {
    return false;
  }

  let version = await currentDisclosureVersion(organizationId);
  if (opts.disclosures !== undefined) {
    version = await writeDisclosureVersion(userId, organizationId, {
      disclosures: opts.disclosures,
      context: opts.context,
      planId: opts.planId ?? null,
    });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: { disclosuresReviewed: true, disclosuresReviewedAt: now },
    }),
    prisma.disclosureAttestation.create({
      data: {
        organizationId,
        userId,
        context: opts.context,
        planId: opts.planId ?? null,
        // The disclosure REVISION confirmed (see `DisclosureVersion`).
        disclosureVersion: version,
        attestationVersion: ATTESTATION_VERSION,
      },
    }),
  ]);
  return true;
}

/**
 * Record a disclosure EDIT as a new immutable revision and clear the reviewed
 * flag (re-attestation required). Returns the new version number, or null when
 * the viewer may not edit.
 */
export async function recordDisclosureVersion(
  userId: string,
  opts: {
    disclosures: unknown;
    context: DisclosureAttestationContext;
    planId?: string | null;
  },
): Promise<number | null> {
  const organizationId = await resolveOrganizationId(userId);
  if (!(await canReviewOrganizationDisclosures(userId, organizationId))) {
    return null;
  }
  return writeDisclosureVersion(userId, organizationId, {
    disclosures: opts.disclosures,
    context: opts.context,
    planId: opts.planId ?? null,
  });
}

async function currentDisclosureVersion(organizationId: string): Promise<number> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { disclosuresCurrentVersion: true },
  });
  return organization?.disclosuresCurrentVersion ?? 0;
}

/** Write the next immutable revision and clear the reviewed flag. */
async function writeDisclosureVersion(
  userId: string,
  organizationId: string,
  opts: {
    disclosures: unknown;
    context: DisclosureAttestationContext;
    planId: string | null;
  },
): Promise<number> {
  const next = (await currentDisclosureVersion(organizationId)) + 1;
  await prisma.$transaction([
    prisma.disclosureVersion.create({
      data: {
        organizationId,
        version: next,
        disclosures: opts.disclosures as any,
        templateVersion: DISCLOSURE_TEMPLATE_VERSION,
        createdByUserId: userId,
        context: opts.context,
        planId: opts.planId,
      },
    }),
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        disclosuresCurrentVersion: next,
        // An edit invalidates the previous confirmation until re-attested.
        disclosuresReviewed: false,
        disclosuresReviewedAt: null,
      },
    }),
  ]);
  return next;
}

/**
 * Clear the reviewed flag (skip / an edit that needs re-attestation). Returns
 * false when the viewer may not review.
 */
export async function clearOrganizationDisclosuresReviewed(
  userId: string,
): Promise<boolean> {
  const organizationId = await resolveOrganizationId(userId);
  if (!(await canReviewOrganizationDisclosures(userId, organizationId))) {
    return false;
  }
  await prisma.organization.update({
    where: { id: organizationId },
    data: { disclosuresReviewed: false, disclosuresReviewedAt: null },
  });
  return true;
}
