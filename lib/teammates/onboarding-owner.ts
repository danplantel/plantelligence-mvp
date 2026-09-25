/**
 * onboarding-owner — seeds the account owner into the onboarding invite step.
 *
 * Spec T3 Part A item 4: "Invite step in onboarding. The owner is pre-filled as
 * the first member; the step can be skipped."
 *
 * Two things this deliberately does NOT do:
 *
 *  - It does not create a TeammateProfile for the owner. The owner's canonical
 *    representation is the Organization's `ownerUserId`, and the Settings → Team
 *    list synthesizes their row from that. Storing a second copy in the wizard
 *    step would be a third source of truth that could drift.
 *  - It does not persist anything by itself. The prefilled row only enters the
 *    wizard step's saved state if the user edits the step, which is what keeps
 *    the step genuinely skippable.
 *
 * Pure module — no Prisma, no React — so it is safe to use in the wizard and in
 * the verification script alike.
 */

import type { TeamMember } from "@/types/wizard";

/**
 * Role value used for the owner's row. The step's role options label `admin`
 * "Full access (same as account owner)", which is the accurate description of the
 * owner, and unlike an "owner" value it exists in that option list.
 */
export const OWNER_STEP_ROLE = "admin";

export interface OwnerIdentity {
  name?: string | null;
  email?: string | null;
}

/** The owner's row for the invite step. */
export function ownerPrefillMember(owner: OwnerIdentity): TeamMember {
  return {
    name: (owner.name ?? "").trim(),
    email: (owner.email ?? "").trim().toLowerCase(),
    role: OWNER_STEP_ROLE,
    isOwner: true,
  };
}

/**
 * Return `members` with the owner as the first entry.
 *
 * Idempotent AND reference-stable: when no change is needed the original array is
 * returned, so a React effect can call this on every render without looping.
 *
 * With no owner identity available yet (the wizard's user-setup step runs later),
 * the input is returned untouched — the caller re-runs this once the identity
 * arrives.
 */
export function withOwnerPrefill(
  members: TeamMember[],
  owner: OwnerIdentity,
): TeamMember[] {
  if (!owner.email) return members;

  const desired = ownerPrefillMember(owner);
  const existingIndex = members.findIndex((member) => member.isOwner);

  if (existingIndex === 0) {
    const current = members[0];
    if (current.email === desired.email && current.name === desired.name) {
      return members;
    }
    const replaced = [...members];
    replaced[0] = { ...current, ...desired };
    return replaced;
  }

  if (existingIndex > 0) {
    // An owner row exists but is not first — move it to the front.
    const ownerRow = { ...members[existingIndex], ...desired };
    const rest = members.filter((_, index) => index !== existingIndex);
    return [ownerRow, ...rest];
  }

  return [desired, ...members];
}
