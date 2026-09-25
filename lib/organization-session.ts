/**
 * organization-session — session-aware tenancy helpers.
 *
 * Split out of `lib/organization.ts` on purpose: that module is imported by
 * `lib/auth-options.ts`, so it must not import next-auth back. This module may
 * freely use both.
 *
 * Server-only. Do not import from a client component.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveOrganizationId } from "@/lib/organization";

export interface OrgSession {
  /** The logged-in User id (also the legacy tenancy anchor). */
  userId: string;
  /** The Organization id all teammate reads/writes must be scoped by. */
  organizationId: string;
}

/**
 * Resolve `{ userId, organizationId }` for the current session, or null when
 * there is no session. Backfills the Organization when the session predates T1.
 */
export async function getOrgSession(): Promise<OrgSession | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  // The JWT carries organizationId from T1.4 onward; treat it as a hint and let
  // resolveOrganizationId confirm/backfill, so a stale token can never scope a
  // request to the wrong org.
  const organizationId = await resolveOrganizationId(userId);
  return { userId, organizationId };
}

/** Thrown by `requireOrgSession` so callers can map it to a 401/403. */
export class OrgAccessError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "OrgAccessError";
    this.status = status;
  }
}

/**
 * Like `getOrgSession` but throws instead of returning null. Prefer this in
 * teammate routes; it makes the "no session" branch impossible to forget.
 */
export async function requireOrgSession(): Promise<OrgSession> {
  const orgSession = await getOrgSession();
  if (!orgSession) {
    throw new OrgAccessError("Unauthorized", 401);
  }
  return orgSession;
}
