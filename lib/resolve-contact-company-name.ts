/**
 * Resolves the "Company Name" to display on a contact card.
 *
 * If the contact IS the currently logged-in user (matched by email), the
 * logged-in user's Organization Name is used instead of the contact's own
 * company name. Otherwise, the contact's company name is shown.
 */
export function resolveContactCompanyName(
  contact: { email?: string | null; companyName?: string | null },
  currentUserEmail?: string | null,
  currentUserOrgName?: string | null,
): string {
  const contactEmail = (contact.email || "").trim().toLowerCase();
  const userEmail = (currentUserEmail || "").trim().toLowerCase();

  if (contactEmail && userEmail && contactEmail === userEmail) {
    return (currentUserOrgName || "").trim() || (contact.companyName || "").trim();
  }

  return (contact.companyName || "").trim();
}
