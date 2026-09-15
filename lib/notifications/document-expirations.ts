/**
 * Document expiration reminder helpers shared by the server route
 * (`app/api/documents/expiring/route.ts`) and the header Notifications menu.
 *
 * Mirrors `lib/notifications/meeting-reminders.ts`: a reminder fires on the
 * exact day-of, 2-days, and 7-days marks only, using the same urgency tiers and
 * the same calendar-day-key math (`lib/notifications/date-keys.ts`).
 */

import { formatDateKey } from "@/lib/notifications/date-keys";

export type ExpiringDocumentStatus =
  | "expiring_today"
  | "expiring_2days"
  | "expiring_week";

/** Day offsets (from today) that trigger a reminder. */
export const DOCUMENT_EXPIRATION_TIERS = [0, 2, 7] as const;

/** Widest look-ahead, in days, used for the DB query window. */
export const DOCUMENT_EXPIRATION_WINDOW_DAYS = 7;

/** Cap on returned reminders, matching the meetings endpoint. */
export const DOCUMENT_EXPIRATION_LIMIT = 20;

export const DOCUMENT_EXPIRATION_LABEL: Record<ExpiringDocumentStatus, string> =
  {
    expiring_today: "Today",
    expiring_2days: "In 2 days",
    expiring_week: "In 7 days",
  };

/** A document expiration returned by `GET /api/documents/expiring`. */
export interface ExpiringDocument {
  id: string;
  title: string;
  client: {
    id: string;
    companyName: string;
  };
  /** `yyyy-MM-dd` calendar day the document expires. */
  dateKey: string;
  /** Document category (Retirement, Group Health, …), when set. */
  category: string | null;
  /** Document type (SPD, SBC, Document). */
  type: string | null;
  daysUntilExpiration: number;
  status: ExpiringDocumentStatus;
}

/** Map a day offset onto a reminder tier, or `null` when no reminder fires. */
export function resolveDocumentExpirationStatus(
  daysUntilExpiration: number,
): ExpiringDocumentStatus | null {
  if (daysUntilExpiration === 0) return "expiring_today";
  if (daysUntilExpiration === 2) return "expiring_2days";
  if (daysUntilExpiration === 7) return "expiring_week";
  return null;
}

/**
 * Expiration label for a reminder row, e.g. `Expires today` for a same-day
 * expiration or `Expires 09/17/2026` for a future one.
 */
export function formatDocumentExpirationWhen(
  dateKey: string,
  status?: ExpiringDocumentStatus | null,
): string {
  if (status === "expiring_today") return "Expires today";
  const dayLabel = formatDateKey(dateKey);
  return dayLabel ? `Expires ${dayLabel}` : "";
}

/** Urgency order (soonest first). Stable-sort friendly for equal day offsets. */
export function compareDocumentExpirations<
  T extends { daysUntilExpiration: number },
>(a: T, b: T): number {
  return a.daysUntilExpiration - b.daysUntilExpiration;
}
