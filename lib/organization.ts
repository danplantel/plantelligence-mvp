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
 * The `User` fields the Organization's identity is derived from.
 *
 * A structural type rather than a Prisma model type, so the create path and the sync agree
 * on one input shape without either importing the generated client.
 */
export interface OrganizationIdentitySource {
  name: string | null;
  organizationName: string | null;
  organizationEmail: string | null;
  organizationType: string | null;
  customOrganization: string | null;
  teamSize: string | null;
  brandColor: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  advisorLogo: string | null;
  advisorLogoUrl: string | null;
  backgroundImage: string | null;
}

/**
 * The organization's display name, resolved the same way at creation and on every sync.
 *
 * `organizationName` is what the advisor types in Branding; `user.name` is the login name
 * as a fallback; the literal keeps the column satisfied, since it is `String` and not
 * `String?`.
 */
function organizationNameFor(
  user: Pick<OrganizationIdentitySource, "organizationName" | "name">,
): string {
  return (
    (user.organizationName && user.organizationName.trim()) ||
    user.name ||
    "Untitled Organization"
  );
}

/**
 * The branding mirror stored on `Organization.branding`.
 *
 * `logo` prefers `advisorLogo` over `advisorLogoUrl` because those two columns routinely
 * hold the SAME image while the row is being normalised to R2 (`normalizeUserImagesToR2`
 * in /api/profile/update-profile), so a fixed precedence keeps the mirror from flipping
 * between the two spellings on every save.
 *
 * This snapshot currently has **no reader** — it was added for hub rendering, and hub
 * branding is read from the owner's User today. It is kept current by
 * `syncOrganizationIdentity` rather than left frozen at signup, so the value is true if a
 * consumer ever arrives; if none does, deleting the column is the cleanup, not preserving
 * a stale copy.
 */
export function brandingSnapshotFromUser(
  user: OrganizationIdentitySource,
): OrganizationBranding {
  return {
    brandColor: user.brandColor ?? null,
    primaryColor: user.primaryColor ?? null,
    secondaryColor: user.secondaryColor ?? null,
    logo: user.advisorLogo ?? user.advisorLogoUrl ?? null,
    backgroundImage: user.backgroundImage ?? null,
  };
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
      organizationType: true,
      customOrganization: true,
      teamSize: true,
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

  const organization =
    existing ??
    (await prisma.organization.create({
      data: {
        name: organizationNameFor(user),
        ownerUserId: userId,
        organizationEmail: user.organizationEmail ?? null,
        organizationType: user.organizationType ?? null,
        customOrganization: user.customOrganization ?? null,
        teamSize: user.teamSize ?? null,
        branding: brandingSnapshotFromUser(user),
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
 * The organization a User is a **teammate of**: the one whose `TeammateProfile` carries this
 * login. Null when they are nobody's teammate.
 *
 * The counterpart to `getOrCreateOrganizationForUser`, which answers "which organization does
 * this User OWN". For an invited person those are two different questions, and conflating
 * them is what made accepting a Team Member seat mint a second, empty organization owned by
 * the invitee instead of joining the one that invited them.
 */
export async function findTeammateOrganizationId(
  userId: string,
): Promise<string | null> {
  const profile = await prisma.teammateProfile.findFirst({
    where: { loginUserId: userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  return profile?.organizationId ?? null;
}

/**
 * Anchor an invited teammate to the organization that invited them.
 *
 * Writes `User.organizationId` — the value `resolveOrganizationId` reads, and therefore what
 * `getOrgSession()` scopes every teammate read by — to the inviting organization, and creates
 * nothing. Returns false when there is nothing to anchor — the user is nobody's teammate, or
 * they already run an organization of their own — so a caller that has to honour "every User
 * has an `organizationId`" can fall back to `getOrCreateOrganizationForUser`.
 *
 * The teammate link must already exist when this is called: `activateProfile` is what writes
 * `TeammateProfile.loginUserId`.
 */
export async function anchorTeammateUserToInvitingOrganization(
  userId: string,
): Promise<boolean> {
  const organizationId = await findTeammateOrganizationId(userId);
  if (!organizationId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  // A dual-role account keeps its own workspace.
  //
  // Somebody who already RUNS an organization with plans and also holds a seat elsewhere is
  // not the case this function exists for: `getOrCreateOrganizationForUser` never minted
  // anything for them (it answers with the organization they own), so they were never broken
  // by the bug this fixes. Moving them would hide a workspace that was always theirs — their
  // own plans would disappear from the session `getOrgSession()` scopes by this very value.
  //
  // Returning false sends the caller to `getOrCreateOrganizationForUser`, which is exactly
  // where they landed before. `scripts/repair/reanchor-teammate-organizations.ts` reports the
  // same accounts and skips them unless `--include-dual-role` is passed, so the repair and the
  // runtime cannot disagree about who is a teammate-only account.
  if (user?.organizationId && user.organizationId !== organizationId) {
    const current = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { ownerUserId: true },
    });
    if (current?.ownerUserId === userId) {
      const plans = await prisma.client.count({
        where: { organizationId: user.organizationId },
      });
      if (plans > 0) return false;
    }
  }

  if (user?.organizationId !== organizationId) {
    await prisma.user.update({
      where: { id: userId },
      data: { organizationId },
    });
  }
  return true;
}

export interface OrganizationSyncResult {
  organizationId: string;
  /** Which mirror fields actually changed. Empty when the organization was current. */
  changed: string[];
}

/**
 * Re-derive the Organization's identity from its owner's current User row.
 *
 * ## Why this exists
 *
 * `Organization` is created once, from whatever the User looked like at that moment, and
 * nothing used to update it. Two live reads made that a bug rather than a tidy snapshot:
 *
 *  - **`name`** is the `organizationName` every invitation email greets the recipient with
 *    (`team.server.ts`, `invites.server.ts`, `invite-acceptance.server.ts`). Renaming the
 *    organization in Settings → Branding wrote `User.organizationName` and left the
 *    Organization row saying whatever it said at signup, so invites kept using the old name.
 *  - **`organizationEmail`** is read first by the T3 Team-Member domain guess
 *    (`getOrganizationDomains` in `seats.server.ts`). Note this one did NOT turn out to be a
 *    live defect: the guess unions every source into one list — this mirror, then the
 *    owner's own row — so it already saw a changed address through the fallback. The mirror
 *    is kept in step because it is the organization-level copy of that address, and because
 *    writing `null` here would otherwise narrow the list the guess checks.
 *  - **the firm profile** (`organizationType`, `customOrganization`, `teamSize`) was written
 *    by Settings → Organization into `wizardSessions[0].clientProfile` / `.teamSize`. Those
 *    tables are the onboarding wizard's own draft storage and are scoped to ONE advisor, so
 *    an organization-level setting saved there was invisible to the organization (and to a
 *    second admin) and left the canonical `User` columns stale. Settings now writes the
 *    `User` row and this mirrors it here.
 *
 * So this is a sync, not an API: the User row stays the single source, and the Organization
 * row is a derived mirror that callers refresh wherever they write the User fields it is
 * derived from. Nothing here needs a route — every reader is already server-side and scopes
 * itself by `organizationId` from the session.
 *
 * ## Behaviour
 *
 * Only fields that actually differ are written, so an ordinary profile save does not bump
 * `updatedAt` or hand out a needless `organization.update`. Idempotent. Callers should treat
 * a failure as non-fatal (log it): a stale mirror must never fail the edit the user just made.
 */
export async function syncOrganizationIdentity(
  userId: string,
): Promise<OrganizationSyncResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      organizationName: true,
      organizationEmail: true,
      organizationType: true,
      customOrganization: true,
      teamSize: true,
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

  // Resolves, creating and backfilling when the user predates T1. A freshly created
  // organization was written from these same values, so it has nothing left to sync.
  const organizationId = await resolveOrganizationId(userId);

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      ownerUserId: true,
      name: true,
      organizationEmail: true,
      branding: true,
      organizationType: true,
      customOrganization: true,
      teamSize: true,
    },
  });
  if (!organization) return { organizationId, changed: [] };

  // Only the OWNER's row is the source for this mirror — that is what the function is for.
  //
  // Without this guard an invited teammate is dangerous: they are anchored to the inviting
  // organization (`anchorTeammateUserToInvitingOrganization`), so a teammate saving their
  // own profile would re-derive the firm's name, organization email and branding from THEIR
  // User row and write them onto the organization that invited them.
  if (organization.ownerUserId !== userId) {
    return { organizationId, changed: [] };
  }

  const name = organizationNameFor(user);
  const organizationEmail = user.organizationEmail ?? null;
  const branding = brandingSnapshotFromUser(user);

  const changed: string[] = [];
  const data: {
    name?: string;
    organizationEmail?: string | null;
    branding?: OrganizationBranding;
    organizationType?: string | null;
    customOrganization?: string | null;
    teamSize?: string | null;
  } = {};

  if (organization.name !== name) {
    data.name = name;
    changed.push("name");
  }
  if ((organization.organizationEmail ?? null) !== organizationEmail) {
    data.organizationEmail = organizationEmail;
    changed.push("organizationEmail");
  }

  // The firm profile. Kept on the organization so a future second admin reads it from the
  // organization rather than from whichever advisor happened to save it last.
  const firmProfile: Array<
    ["organizationType" | "customOrganization" | "teamSize", string | null]
  > = [
    ["organizationType", user.organizationType ?? null],
    ["customOrganization", user.customOrganization ?? null],
    ["teamSize", user.teamSize ?? null],
  ];
  for (const [field, value] of firmProfile) {
    if ((organization[field] ?? null) !== value) {
      data[field] = value;
      changed.push(field);
    }
  }

  // Compared key by key rather than as a stringified blob: key ORDER is not guaranteed for
  // a JSON column, so a blob comparison would report a change on every save for some rows.
  const existingBranding = (organization.branding ?? null) as Record<
    string,
    unknown
  > | null;
  const brandingDiffers =
    !existingBranding ||
    (Object.keys(branding) as Array<keyof OrganizationBranding>).some(
      (key) => (existingBranding[key] ?? null) !== branding[key],
    );
  if (brandingDiffers) {
    data.branding = branding;
    changed.push("branding");
  }

  if (changed.length === 0) return { organizationId, changed };

  await prisma.organization.update({ where: { id: organizationId }, data });
  return { organizationId, changed };
}

/**
 * Backfill `Client.organizationId` for a user's plans.
 *
 * `organizationId IS NULL` is the whole test: PostgreSQL has no "absent vs explicitly null"
 * distinction, so one predicate covers a field that was never written as well as one that
 * was cleared. Before the move to PostgreSQL this needed a two-branch
 * `OR: [{ organizationId: null }, { organizationId: { isSet: false } }]`, because on MongoDB
 * `null` matched only explicit nulls and skipped every plan that never had the field at all
 * (the trap recorded in docs/teammates-module.md §7.3).
 *
 * Safe to run repeatedly: only plans missing an org are touched.
 */
async function stampPlansWithOrganization(
  userId: string,
  organizationId: string,
): Promise<void> {
  await prisma.client.updateMany({
    where: { userId, organizationId: null },
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
