/**
 * organization — server-only tenancy helpers for Team & Collaborator Access.
 *
 * T1 introduces a real `Organization` entity as the forward-looking tenancy
 * anchor. `User.id` remains the anchor for every pre-existing query (plans,
 * documents, meetings, R2 keys, …), so this module is deliberately additive:
 *
 *   - `resolveOrganizationId(userId)` returns the org for an owning User,
 *     creating and backfilling it on first use.
 *   - Every teammate read/write in lib/teammates/* takes an `organizationId`
 *     and never touches the session, so it stays testable and cannot be called
 *     without an explicit scope.
 *
 * This file intentionally does NOT import next-auth. `lib/organization-session.ts`
 * owns the session-aware helpers; keeping them apart stops a circular import
 * with `lib/auth-options.ts` (which needs `getOrCreateOrganizationForUser`).
 *
 * See plans/teammates-t1-data-model.md for the full T1 design.
 */

import { prisma } from "@/lib/prisma";

/**
 * Branding snapshot copied onto an Organization at creation time.
 *
 * The index signature makes the object structurally assignable to Prisma's
 * `InputJsonObject`; every value is explicitly `string | null` (never
 * `undefined`) so the JSON round-trips without dropping keys.
 */
export interface OrganizationBranding {
  [key: string]: string | null;
  brandColor: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  logo: string | null;
  backgroundImage: string | null;
}

/**
 * Resolve the Organization id that owns this User, creating one if the user
 * predates the T1 migration and stamping `User.organizationId` plus every
 * `Client.organizationId` for their plans.
 *
 * Idempotent: safe to call on every request that lacks an org on the session.
 */
export async function getOrCreateOrganizationForUser(
  userId: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      organizationName: true,
      organizationEmail: true,
      brandColor: true,
      primaryColor: true,
      secondaryColor: true,
      advisorLogo: true,
      advisorLogoUrl: true,
      backgroundImage: true,
    },
  });

  if (!user) {
    throw new Error(`[organization] User not found: ${userId}`);
  }

  // Already linked — make sure the plans caught up, then return.
  if (user.organizationId) {
    await stampPlansWithOrganization(userId, user.organizationId);
    return user.organizationId;
  }

  const existing = await prisma.organization.findFirst({
    where: { ownerUserId: userId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const branding: OrganizationBranding = {
    brandColor: user.brandColor ?? null,
    primaryColor: user.primaryColor ?? null,
    secondaryColor: user.secondaryColor ?? null,
    logo: user.advisorLogo ?? user.advisorLogoUrl ?? null,
    backgroundImage: user.backgroundImage ?? null,
  };

  const organization =
    existing ??
    (await prisma.organization.create({
      data: {
        name:
          (user.organizationName && user.organizationName.trim()) ||
          user.name ||
          "Untitled Organization",
        ownerUserId: userId,
        organizationEmail: user.organizationEmail ?? null,
        branding,
      },
      select: { id: true },
    }));

  await prisma.user.update({
    where: { id: userId },
    data: { organizationId: organization.id },
  });

  await stampPlansWithOrganization(userId, organization.id);

  return organization.id;
}

/**
 * Read the organization for a User, backfilling when absent. Never returns null
 * for an existing User — the T1 invariant is that every User has an Organization.
 */
export async function resolveOrganizationId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (user?.organizationId) return user.organizationId;
  return getOrCreateOrganizationForUser(userId);
}

/**
 * Backfill `Client.organizationId` for a user's plans.
 *
 * The filter must accept BOTH an explicit null and an absent field. With this
 * Prisma/MongoDB combination `null` matches only explicit nulls, so a plain
 * `organizationId: null` silently skips every plan that never had the field set
 * — which is all of them before the first backfill.
 *
 * Safe to run repeatedly: only plans missing an org are touched.
 */
async function stampPlansWithOrganization(
  userId: string,
  organizationId: string,
): Promise<void> {
  await prisma.client.updateMany({
    where: {
      userId,
      OR: [{ organizationId: null }, { organizationId: { isSet: false } }],
    },
    data: { organizationId },
  });
}

/**
 * Every plan id in an organization. Used by T1 verification and by the T2
 * enforcement layer to answer "may this person see this plan at all?".
 */
export async function listOrganizationPlanIds(
  organizationId: string,
): Promise<string[]> {
  const plans = await prisma.client.findMany({
    where: { organizationId },
    select: { id: true },
  });
  return plans.map((p) => p.id);
}

/**
 * The organization that owns a plan. Prefers the T1 anchor and falls back to the
 * legacy owner so callers work before a plan has been stamped.
 */
export async function resolveOrganizationIdForClient(
  clientId: string,
): Promise<string | null> {
  const client = await prisma.client.findFirst({
    where: { OR: [{ id: clientId }, { slug: clientId }] },
    select: { organizationId: true, userId: true },
  });
  if (!client) return null;
  if (client.organizationId) return client.organizationId;
  if (!client.userId) return null;
  return getOrCreateOrganizationForUser(client.userId);
}
