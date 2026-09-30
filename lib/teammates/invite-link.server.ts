/**
 * invite-link.server — minting the T9 acceptance link.
 *
 * Extracted so the two paths that invite somebody cannot disagree about what the link
 * contains: `inviteCollaboratorToPlan` (an external collaborator asked to complete a
 * benefit section) and `addTeamMember` (a Contact promoted to a Team Member, who needs a
 * login before they can do anything at all). Both send an email whose primary action is
 * this URL, and the token's claims have to match the profile exactly or `loadInvitation`
 * refuses it — so the minting belongs in one place rather than two.
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";
import { inviteAcceptUrl, signInviteToken } from "./invite-token.server";

/** Same precedence as the rest of the mailers (see lib/email.ts). */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    ""
  ).replace(/\/$/, "");
}

/**
 * The acceptance link for a profile, or null when it has no invite window.
 *
 * Re-reads `invitedAt` from the profile rather than accepting it as an argument, and that
 * is the point of this function. The token's expiry is derived from `invitedAt`
 * (`inviteTokenExpiry`), so a caller that passed a stale value would mint a link that
 * `loadInvitation` rejects as `expired` the moment it arrives — which is exactly the bug
 * that made re-invites unusable before `setProfileState` refreshed the field. Reading it
 * here means the link can only ever encode the window the profile actually has.
 */
export async function acceptanceUrlForProfile(profile: {
  id: string;
  organizationId: string;
  email: string;
}): Promise<{ url: string; invitedAt: Date } | null> {
  const row = await prisma.teammateProfile.findUnique({
    where: { id: profile.id },
    select: { invitedAt: true },
  });
  if (!row?.invitedAt) return null;

  const token = signInviteToken({
    profileId: profile.id,
    organizationId: profile.organizationId,
    email: profile.email,
    invitedAt: row.invitedAt,
  });

  return { url: inviteAcceptUrl(appBaseUrl(), token), invitedAt: row.invitedAt };
}
