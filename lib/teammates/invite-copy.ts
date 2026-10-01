/**
 * Wording shared by the two things an invited person sees: the invitation email and the
 * acceptance page.
 *
 * Pure string logic, client-safe: the accept page is a client component, so nothing here
 * may reach for Prisma.
 *
 * Why it is shared rather than written twice: both surfaces introduce the same two people
 * ("who invited you" and "which firm"), and both get the same awkward case wrong on their
 * own. `Organization.name` is a mirror of the owner's `User` row (see
 * [`lib/organization.ts`](lib/organization.ts)), so a solo advisor's organization is called
 * whatever they are — and any sentence naming both reads as a stutter:
 *
 *   "Eddie Taliaferro invited you on behalf of Eddie Taliaferro to help with …"
 *   "Eddie Taliaferro added you to Eddie Taliaferro on PlanTelligence"
 *
 * One rule, applied in both places, is what stops the email and the page from describing the
 * same invitation differently.
 */

/**
 * The organization name to show beside an inviter, or `""` when it adds nothing.
 *
 * Empty when the firm is missing, or when it is the inviter's own name — in both cases the
 * recipient learns nothing from it. Note the comparison uses the *effective* inviter
 * (`inviterName` falling back to the firm), so a caller with no inviter name does not end up
 * printing the same string twice by a different route.
 */
export function inviterFirmLabel(
  inviterName: string | null | undefined,
  organizationName: string | null | undefined,
): string {
  const firm = (organizationName || "").trim();
  if (!firm) return "";
  const inviter = (inviterName || "").trim() || firm;
  return firm.toLowerCase() === inviter.toLowerCase() ? "" : firm;
}
