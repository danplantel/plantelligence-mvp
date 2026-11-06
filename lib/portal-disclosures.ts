/**
 * The plan's FOOTER DISCLOSURE — read and written in one place.
 *
 * A plan stores its disclosures on `Client.disclaimers` as an envelope:
 *
 * ```
 * {
 *   disclaimers: [{ id, text, locations: ["Home Page"], ... }],
 *   byCategory: { Retirement: {...}, "Group Health": {...}, … },
 *   footerBackground: { mode, customColor }
 * }
 * ```
 *
 * The four NON-hub portal pages — the Landing Page, My Benefits Team, News &
 * Events and Employee Resources — all render the SAME footer, and
 * [`app/(portal)/[id]/layout.tsx`](<../../app/(portal)/[id]/layout.tsx:332>) picks
 * their text with one rule: the first row whose location is "Home Page" or
 * "Global", or that applies to every benefit category. This module mirrors that
 * rule exactly, so the panel that edits it cannot write a row the layout would
 * not read — and cannot miss the row the layout is already showing.
 *
 * The benefit hubs are NOT covered by this row: each benefit keeps its own
 * disclosure in `byCategory` (set in the benefit editor), which is why writing
 * here never touches them.
 */

/** One stored disclosure. The fields the portal reads, and nothing else. */
export interface PortalDisclosureRow {
  id?: string;
  text?: string;
  /** Portal page labels this row was targeted at ("Home Page", "Global", …). */
  locations?: string[];
  customLocation?: string;
  scope?: string;
  apply_all_benefits_categories?: boolean;
  [key: string]: unknown;
}

/** The stored envelope. Extra keys are preserved on every write. */
export type PortalDisclaimersEnvelope = Record<string, unknown> & {
  disclaimers?: PortalDisclosureRow[];
  byCategory?: Record<string, unknown>;
  footerBackground?: { mode?: string; customColor?: string };
};

/** The location label the non-hub footers look for. */
export const LANDING_DISCLOSURE_LOCATION = "Home Page";

/**
 * Read the envelope out of whatever `Client.disclaimers` holds.
 *
 * Returns `null` for a legacy plain-text value (which carries no envelope), for a
 * missing value, and for an unparseable JSON string — the callers then fall back to
 * the text the footer is showing rather than pretending there is none.
 */
export function parseDisclaimersEnvelope(
  raw: unknown,
): PortalDisclaimersEnvelope | null {
  let value: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as PortalDisclaimersEnvelope;
}

function storedRows(envelope: PortalDisclaimersEnvelope | null): PortalDisclosureRow[] {
  if (!envelope) return [];
  const rows = envelope.disclaimers;
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row): row is PortalDisclosureRow => !!row && typeof row === "object",
  );
}

/**
 * True when a row is one the non-hub footer would render. This is the layout's
 * filter verbatim: a row that applies to every benefit category counts, because
 * the landing footer prefers one when no Home Page row was written.
 */
function isLandingRow(row: PortalDisclosureRow): boolean {
  if (!row || typeof row !== "object") return false;
  const locations = Array.isArray(row.locations) ? row.locations : [];
  return (
    locations.includes(LANDING_DISCLOSURE_LOCATION) ||
    locations.includes("Global") ||
    row.apply_all_benefits_categories === true
  );
}

/**
 * The row the four non-hub footers show, in the layout's order of preference, with
 * its position in the stored array.
 */
export function findLandingDisclosure(
  raw: unknown,
): { row: PortalDisclosureRow; index: number } | null {
  const envelope = parseDisclaimersEnvelope(raw);
  const rows = storedRows(envelope);

  // A row with no text is not shown by the layout, so it is not "the" row either.
  let index = rows.findIndex((row) => !!row.text && isLandingRow(row));
  if (index === -1) index = rows.findIndex((row) => isLandingRow(row));
  if (index === -1) return null;

  return { row: rows[index], index };
}

/** The disclosure text the four non-hub footers are showing, or null when none is stored. */
export function readLandingDisclosureText(raw: unknown): string | null {
  const found = findLandingDisclosure(raw);
  const text = found?.row?.text;
  return typeof text === "string" && text.trim() ? text : null;
}

/**
 * Write a new disclosure text for the four non-hub footers.
 *
 * Updates the row the layout already reads (keeping its id, its scope and any
 * targeting it carries), or appends a Home Page row when the plan has none. Every
 * other key — `byCategory`, `footerBackground`, a legacy `disclosuresText` — is
 * preserved, so saving the footer disclosure can never wipe a benefit's own.
 */
export function withLandingDisclosureText(
  raw: unknown,
  text: string,
): PortalDisclaimersEnvelope {
  const envelope = parseDisclaimersEnvelope(raw) ?? {};
  const rows = [...storedRows(envelope)];
  const found = findLandingDisclosure(raw);

  if (found) {
    rows[found.index] = {
      ...rows[found.index],
      text,
      // A row that only qualified through apply-all still belongs to this footer
      // once it is edited here, so it is made explicit rather than left implicit.
      locations: Array.isArray(rows[found.index].locations) &&
        rows[found.index].locations!.length > 0
        ? rows[found.index].locations
        : [LANDING_DISCLOSURE_LOCATION],
    };
  } else {
    rows.push({
      id: Date.now().toString(),
      text,
      locations: [LANDING_DISCLOSURE_LOCATION],
      customLocation: "",
      scope: "plan",
      apply_all_benefits_categories: false,
    });
  }

  return { ...envelope, disclaimers: rows };
}

/** Write the footer background preference, leaving every other key alone. */
export function withFooterBackground(
  raw: unknown,
  preference: { mode: string; customColor: string },
): PortalDisclaimersEnvelope {
  const envelope = parseDisclaimersEnvelope(raw) ?? {};
  return { ...envelope, footerBackground: preference };
}

/**
 * The text a plan with no stored disclosure would show — the advisor's own
 * disclaimer when the portal resolved one, otherwise nothing. Used to prefill the
 * panel's textarea so the advisor edits what participants actually see.
 */
export function landingDisclosureSeed(
  raw: unknown,
  advisorDisclaimer?: string | null,
): string {
  const stored = readLandingDisclosureText(raw);
  if (stored) return stored;

  if (typeof raw === "string" && raw.trim() && !raw.trim().startsWith("{")) {
    return raw.trim();
  }

  return (advisorDisclaimer || "").trim();
}

/**
 * A benefit's own disclosure, stored in `byCategory`.
 *
 * These are the four keys the benefit editor writes and
 * [`layout.tsx`](<../../app/(portal)/[id]/layout.tsx:310>) reads FIRST on a hub
 * page — before the landing row, the advisor's text and the universal default — so
 * a benefit page's footer is its own record, not the portal-wide one.
 */
export type BenefitDisclosureCategory =
  | "Retirement"
  | "Group Health"
  | "Group Life"
  | "Other";

/** The `byCategory` row for one benefit, with its text. */
export function findBenefitDisclosure(
  raw: unknown,
  category: BenefitDisclosureCategory,
): { row: PortalDisclosureRow; text: string } | null {
  const envelope = parseDisclaimersEnvelope(raw);
  const byCategory = envelope?.byCategory;
  if (!byCategory || typeof byCategory !== "object") return null;

  const row = (byCategory as Record<string, unknown>)[category];
  if (!row || typeof row !== "object") return null;

  const entry = row as PortalDisclosureRow;
  return { row: entry, text: typeof entry.text === "string" ? entry.text : "" };
}

/** The disclosure text this benefit's page shows, or null when it has none of its own. */
export function readBenefitDisclosureText(
  raw: unknown,
  category: BenefitDisclosureCategory,
): string | null {
  const found = findBenefitDisclosure(raw, category);
  if (!found || !found.text.trim()) return null;
  return found.text;
}

/**
 * Write one benefit's disclosure text.
 *
 * Only that category's entry is touched: the other benefits keep theirs, the
 * landing row is left alone, and `footerBackground` — which is plan-wide — is
 * preserved. Fields the benefit editor already put on the row (`id`, `locations`,
 * `scope`) are kept, so this writes the same record from a second place.
 */
export function withBenefitDisclosureText(
  raw: unknown,
  category: BenefitDisclosureCategory,
  text: string,
): PortalDisclaimersEnvelope {
  const envelope = parseDisclaimersEnvelope(raw) ?? {};
  const byCategory =
    envelope.byCategory && typeof envelope.byCategory === "object"
      ? { ...(envelope.byCategory as Record<string, unknown>) }
      : {};

  const existing = byCategory[category];
  byCategory[category] = {
    ...(existing && typeof existing === "object"
      ? (existing as Record<string, unknown>)
      : {
          id: Date.now().toString(),
          locations: [category],
          customLocation: "",
          scope: "plan",
          apply_all_benefits_categories: false,
        }),
    text,
  };

  return { ...envelope, byCategory };
}
