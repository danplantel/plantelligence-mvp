import { describe, expect, it } from "vitest";

import {
  DOCUMENT_EXPIRATION_LABEL,
  DOCUMENT_EXPIRATION_LIMIT,
  DOCUMENT_EXPIRATION_TIERS,
  DOCUMENT_EXPIRATION_WINDOW_DAYS,
  compareDocumentExpirations,
  formatDocumentExpirationWhen,
  resolveDocumentExpirationStatus,
} from "@/lib/notifications/document-expirations";

describe("document expiration tiers", () => {
  it("only fires on the day-of, 2-day, and 7-day marks", () => {
    expect(DOCUMENT_EXPIRATION_TIERS).toEqual([0, 2, 7]);
    expect(resolveDocumentExpirationStatus(0)).toBe("expiring_today");
    expect(resolveDocumentExpirationStatus(2)).toBe("expiring_2days");
    expect(resolveDocumentExpirationStatus(7)).toBe("expiring_week");
  });

  it("returns null for every other offset", () => {
    for (const offset of [-1, 1, 3, 6, 8, 30]) {
      expect(resolveDocumentExpirationStatus(offset)).toBeNull();
    }
  });

  it("exposes the reminder window and cap", () => {
    expect(DOCUMENT_EXPIRATION_WINDOW_DAYS).toBe(7);
    expect(DOCUMENT_EXPIRATION_LIMIT).toBe(20);
  });

  it("labels each tier", () => {
    expect(DOCUMENT_EXPIRATION_LABEL).toEqual({
      expiring_today: "Today",
      expiring_2days: "In 2 days",
      expiring_week: "In 7 days",
    });
  });
});

describe("formatDocumentExpirationWhen", () => {
  it("uses the same-day copy", () => {
    expect(formatDocumentExpirationWhen("2026-01-01", "expiring_today")).toBe(
      "Expires today",
    );
  });

  it("formats a future date key", () => {
    expect(formatDocumentExpirationWhen("2026-03-05")).toBe("Expires 03/05/2026");
    expect(formatDocumentExpirationWhen("2026-03-05", "expiring_week")).toBe(
      "Expires 03/05/2026",
    );
  });

  it("returns an empty string for an invalid key", () => {
    expect(formatDocumentExpirationWhen("not-a-date")).toBe("");
  });
});

describe("compareDocumentExpirations", () => {
  it("sorts soonest first and is stable for equal offsets", () => {
    const rows = [
      { id: "week", daysUntilExpiration: 7 },
      { id: "today-a", daysUntilExpiration: 0 },
      { id: "today-b", daysUntilExpiration: 0 },
      { id: "two", daysUntilExpiration: 2 },
    ];

    expect([...rows].sort(compareDocumentExpirations).map((row) => row.id)).toEqual(
      ["today-a", "today-b", "two", "week"],
    );
  });
});
