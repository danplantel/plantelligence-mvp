/**
 * viewer-role.server — the ONE role label to show for the signed-in account.
 *
 * The header names the viewer, and the badge above that name says what they are here as. The
 * header route resolves it once per request and hands it to the client beside the name, so every
 * surface that needs the label gets the same answer.
 *
 * The vocabulary is the PRODUCT's, not the permission model's:
 *
 *  - a **Collaborator** seat reads `Collaborator`. "Contributor" is a permission-grid preset —
 *    the invite dialog's internal word — and the UI already refuses to print it beside a person's
 *    name (`collaborator-card.tsx` falls back to their company instead). A Reviewer is still a
 *    Collaborator to a reader, so the preset is not what this badge is for.
 *  - an **internal** seat reads the role word the Settings team list uses: Owner, Admin, Editor
 *    or Viewer, as that surface already calls them.
 *  - an account with **no seat** reads `Owner`, this codebase's signature for the advisor.
 *
 * Server-only, and resolved from one place so the header, Settings and any later surface cannot
 * describe the same person differently.
 */

import prisma from "@/lib/prisma";
import {
  PERSON_TYPE_LABELS,
  PRESET_ROLE_LABELS,
  mostPrivilegedRole,
  type TeammateAssignmentRole,
  type TeammatePersonType,
} from "@/types/teammate";

/** The label every Collaborator seat reads, instead of the preset it happens to hold. */
const COLLABORATOR_LABEL = PERSON_TYPE_LABELS.collaborator;

/** One seat, as this module needs it. */
interface Seat {
  type: TeammatePersonType;
  role: TeammateAssignmentRole | null;
}

/**
 * Is this seat the INTERNAL kind?
 *
 * `type` alone answers it, read exactly as `getViewerAccess` reads it: a `team_member` profile
 * carries organization-level access, and it is the one kind whose badge speaks in role words. Its
 * `role` is NOT consulted — a Collaborator is labelled by what they are, not by the preset they
 * hold, which is the whole point of the wording above (and is why a seat with neither a role nor
 * an assignment still reads "Collaborator" rather than going blank or guessing "Team Member").
 */
function isInternalSeat(seat: Seat): boolean {
  return seat.type === "team_member";
}

export async function getViewerRoleLabel(
  userId: string,
): Promise<string | null> {
  try {
    const profiles = await prisma.teammateProfile.findMany({
      where: { loginUserId: userId },
      select: { id: true, type: true, role: true },
    });

    // No seat at all is the OWNER's signature in this codebase: an advisor's access is ownership
    // rather than a grid, and they never have a TeammateProfile — the same fact `getViewerAccess`
    // reads when it decides whether to narrow the chrome.
    if (profiles.length === 0) return PRESET_ROLE_LABELS.owner;

    // The seats DECIDE the vocabulary before anything is summarised, because a Collaborator is
    // labelled by what they are rather than by what they may do. A login can back seats in
    // several organizations; if any of them is internal, the badge speaks that language.
    if (!profiles.some(isInternalSeat)) return COLLABORATOR_LABEL;

    // An internal seat reads the role it holds. The most privileged one across every plan wins, so
    // an Editor on one plan and a Viewer on another reads "Editor" — the same summary the Settings
    // team list shows, via `mostPrivilegedRole`.
    const assignments = await prisma.planAssignment.findMany({
      where: { profileId: { in: profiles.map((profile) => profile.id) } },
      select: { role: true },
    });
    if (assignments.length > 0) {
      return PRESET_ROLE_LABELS[
        mostPrivilegedRole(assignments.map((assignment) => assignment.role))
      ];
    }

    // No assignment yet (an invite raised before any plan exists): the role the seat joins with,
    // which `TeammateProfile.role` exists to carry so an invited Viewer is not mislabelled by the
    // `contributor` assignment default.
    const storedRoles = profiles
      .map((profile) => profile.role)
      .filter((role): role is TeammateAssignmentRole => role !== null);
    if (storedRoles.length > 0) {
      return PRESET_ROLE_LABELS[mostPrivilegedRole(storedRoles)];
    }

    return PERSON_TYPE_LABELS.team_member;
  } catch (error) {
    console.error("[viewer-role] role label", error);
    return null;
  }
}
