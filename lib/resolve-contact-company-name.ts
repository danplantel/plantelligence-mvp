/**
 * Resolves the "Company Name" to display on a contact card.
 *
 * For most contacts this is simply the contact's own company name. But when the
 * contact matches the currently logged-in user, the user's Organization Name is
 * shown instead — e.g. an advisor's own pre-seeded contact card should read the
 * advisor's Organization Name rather than the raw `company` value stored on the
 * contact ("independent", etc.).
 *
 * Matching uses the user's email(s): pass the login email and/or the
 * organization email. Seeded advisor contacts store the *organization* email,
 * so matching only the login email would miss them.
 */
export function resolveContactCompanyName(
  contact: { email?: string | null; companyName?: string | null },
  currentUserEmails?: string | string[] | null,
  currentUserOrgName?: string | null,
): string {
  const contactEmail = (contact.email || "").trim().toLowerCase();

  const userEmails = (
    Array.isArray(currentUserEmails)
      ? currentUserEmails
      : [currentUserEmails]
  )
    .map((email) => (email || "").trim().toLowerCase())
    .filter(Boolean);

  if (contactEmail && userEmails.includes(contactEmail)) {
    return (currentUserOrgName || "").trim() || (contact.companyName || "").trim();
  }

  return (contact.companyName || "").trim();
}
