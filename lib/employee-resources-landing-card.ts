import { EMPLOYEE_RESOURCES_LANDING_CARD_BODY } from "@/lib/landing-card-defaults";

/**
 * The Employee Resources card on "Your Benefits at a Glance".
 *
 * The fifth hub has no Benefit row, so its card is the only landing card without
 * columns of its own. Its image and copy live on the PLAN's
 * `employeePortalPreview` envelope — the same JSON the hub's header image already
 * uses — under these two keys, and the card falls back to the bundled defaults
 * while they are empty. Read through one helper so the card and the Editing Panel
 * cannot disagree about what is stored.
 */
export const EMPLOYEE_RESOURCES_LANDING_CARD_IMAGE_KEY =
  "employeeResourcesLandingCardImage";
export const EMPLOYEE_RESOURCES_LANDING_CARD_BODY_KEY =
  "employeeResourcesLandingCardBody";

export interface EmployeeResourcesLandingCard {
  /** Stored image URL/R2 key, or "" for the bundled default. */
  image: string;
  /** Stored copy, or "" for `EMPLOYEE_RESOURCES_LANDING_CARD_BODY`. */
  body: string;
}

function readString(envelope: Record<string, unknown>, key: string): string {
  const value = envelope[key];
  return typeof value === "string" ? value.trim() : "";
}

export function readEmployeeResourcesLandingCard(
  employeePortalPreview: unknown,
): EmployeeResourcesLandingCard {
  const envelope =
    employeePortalPreview && typeof employeePortalPreview === "object"
      ? (employeePortalPreview as Record<string, unknown>)
      : {};
  return {
    image: readString(envelope, EMPLOYEE_RESOURCES_LANDING_CARD_IMAGE_KEY),
    body: readString(envelope, EMPLOYEE_RESOURCES_LANDING_CARD_BODY_KEY),
  };
}

/** The copy the card prints: the plan's own, else the shipped default. */
export function employeeResourcesLandingCardBody(
  employeePortalPreview: unknown,
): string {
  return (
    readEmployeeResourcesLandingCard(employeePortalPreview).body ||
    EMPLOYEE_RESOURCES_LANDING_CARD_BODY
  );
}
