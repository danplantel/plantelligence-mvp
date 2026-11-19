/**
 * Default body copy for the landing page "Benefits at a Glance" card.
 *
 * These are DISPLAY defaults, not persisted content: the card uses them only
 * when the advisor has left `Benefit.landingCardBody` empty. Keeping them out
 * of the saved row means the wording can be improved later without rewriting
 * benefits the advisor never customised — and clearing the field restores the
 * default instead of leaving the card blank.
 */

/**
 * Employee Resources' card copy.
 *
 * The fifth hub has no Benefit row, so there is no `landingCardBody` column to
 * fall back from: the plan stores its own copy in `employeePortalPreview` and this
 * string is the default while that is empty. Exported so the card and the panel
 * that edits it can never disagree.
 */
export const EMPLOYEE_RESOURCES_LANDING_CARD_BODY =
  "Forms, guides and helpful tools to support you through life's big moments.";

const DEFAULT_LANDING_CARD_BODY: Record<string, string> = {
  retirement:
    "Enrollment guidance, investment options, and retirement resources.",
  health:
    "Health, dental, and vision benefits to keep you and your family protected.",
  "health insurance":
    "Health, dental, and vision benefits to keep you and your family protected.",
  "group health":
    "Health, dental, and vision benefits to keep you and your family protected.",
  "group life":
    "Life and disability insurance to protect your income and your family.",
  "life insurance":
    "Life and disability insurance to protect your income and your family.",
  life: "Life and disability insurance to protect your income and your family.",
  "company / plan sponsor":
    "Programs that support your health, mind, and financial well-being.",
  custom: "Programs that support your health, mind, and financial well-being.",
  wellness: "Programs that support your health, mind, and financial well-being.",
  other: "Additional benefits and resources to support your well-being.",
  "employee resources": EMPLOYEE_RESOURCES_LANDING_CARD_BODY,
};

/** The card body to show for a category when no custom copy is saved. */
export function getDefaultLandingCardBody(
  category: string | null | undefined,
): string {
  const key = (category || "").toLowerCase().trim().replace(/\s+/g, " ");
  return DEFAULT_LANDING_CARD_BODY[key] || "";
}
