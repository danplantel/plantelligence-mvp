import { TOPIC_LOCATION_LABELS, TOPIC_LOCATION_ORDER } from "@/lib/topic-locations";
import type {
  ActionHubLink,
  ActionHubPanel,
  ActionHubRow,
  TopicLocation,
} from "@/types/topic";

/**
 * Action Hubs (TF-5, handoff §6).
 *
 * An Action Hub is one topic that lives in more than one location, because the action
 * it describes exists in more than one benefit. "Update My Beneficiaries" is placed in
 * Retirement AND Group Life; opening it from either hub offers BOTH, side by side,
 * because a participant usually has beneficiaries in two places and needs to know it.
 *
 * Three rules, all enforced here so the portal, the preview and the tests cannot
 * disagree:
 *
 *  1. **Priority.** A row's destination is the placement's own sub-link if the advisor
 *     set one, else the category's provider portal, else a contact for that category.
 *     Nothing else — a row is never a link back into this portal's own pages.
 *  2. **Visibility.** A row for a category the advisor switched off in Portal
 *     Visibility never renders, and neither does a row whose three sources all came
 *     back empty. Silence beats a dead button.
 *  3. **Single row.** With one qualifying row there is nothing to choose between, so
 *     the panel collapses to a direct link (`mode: "direct"`).
 *
 * `resolveActionHubRows` is PURE: it takes plain candidate objects, so the panel can
 * be tested (and previewed) without a database. `action-hub.server.ts` is the reader
 * that assembles the candidates for one plan.
 */

/** A location that might produce a row, with every link source already looked up. */
export interface ActionHubCandidate {
  location: TopicLocation;
  /** The advisor's explicit sub-link for THIS location's placement. */
  link?: ActionHubLink | null;
  /** The plan's provider portal for that location's category. */
  providerUrl?: string | null;
  /** A contact for that category: an address, a `mailto:` or a phone URL. */
  contactUrl?: string | null;
  /**
   * `false` when the location's category is hidden in the portal. `undefined` means
   * "unknown", which is treated as visible — the same default the portal uses.
   */
  visible?: boolean;
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Turn whatever the advisor typed into something an anchor can use.
 *
 * Stored links are hand-entered, so "voya.com/beneficiaries" and "beneficiaries@
 * voya.com" both occur. A bare address becomes `mailto:`, a bare host becomes
 * `https://`, and anything already absolute (including `tel:`) is left alone.
 */
export function normalizeActionHubHref(value: string | null | undefined): string {
  const raw = trimmed(value);
  if (!raw) return "";
  if (
    raw.startsWith("/") ||
    raw.startsWith("#") ||
    raw.startsWith("mailto:") ||
    raw.startsWith("tel:")
  ) {
    return raw;
  }
  // Any explicit scheme (`https:`, `http:`, `sms:`, …) is already usable.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;
  if (raw.includes("@")) return `mailto:${raw}`;
  return `https://${raw}`;
}

/** Does this destination leave the portal? `mailto:`/`tel:`/`#` stay in the tab. */
function leavesPortal(href: string): boolean {
  if (href.startsWith("//")) return true;
  if (href.startsWith("/") || href.startsWith("#")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  return true;
}

/** Canonical hub order, so Retirement always sorts before Group Life. */
function locationRank(location: TopicLocation): number {
  const index = (TOPIC_LOCATION_ORDER as readonly string[]).indexOf(location);
  return index === -1 ? TOPIC_LOCATION_ORDER.length : index;
}

/**
 * One candidate → one row, or `null` when it must not render.
 *
 * The label comes from the advisor's sub-link when they wrote one (they may want
 * "Voya Retirement" rather than "Retirement"), and from the hub's own name otherwise.
 */
export function resolveActionHubRow(
  candidate: ActionHubCandidate,
): ActionHubRow | null {
  if (candidate.visible === false) return null;

  const placementUrl = normalizeActionHubHref(candidate.link?.url);
  const providerUrl = normalizeActionHubHref(candidate.providerUrl);
  const contactUrl = normalizeActionHubHref(candidate.contactUrl);

  const picked = placementUrl
    ? { href: placementUrl, source: "placement" as const }
    : providerUrl
      ? { href: providerUrl, source: "provider" as const }
      : contactUrl
        ? { href: contactUrl, source: "contact" as const }
        : null;

  if (!picked) return null;

  const customLabel = trimmed(candidate.link?.label);
  return {
    location: candidate.location,
    label: customLabel || TOPIC_LOCATION_LABELS[candidate.location],
    href: picked.href,
    external: leavesPortal(picked.href),
    source: picked.source,
  };
}

/**
 * Every row that should render, in canonical hub order.
 *
 * One row per location: a plan can only hold one placement of a topic per location,
 * but a caller may hand over a duplicate (two queries, a stale list), and two rows
 * for "Retirement" would read as two different retirement plans.
 */
export function resolveActionHubRows(
  candidates: readonly ActionHubCandidate[],
): ActionHubRow[] {
  const rows: ActionHubRow[] = [];
  const seen = new Set<TopicLocation>();

  for (const candidate of candidates) {
    if (seen.has(candidate.location)) continue;
    const row = resolveActionHubRow(candidate);
    if (!row) continue;
    seen.add(candidate.location);
    rows.push(row);
  }

  return rows.sort(
    (a, b) =>
      locationRank(a.location) - locationRank(b.location) ||
      a.label.localeCompare(b.label),
  );
}

/**
 * What to draw: nothing, a direct link, or a choice of rows.
 *
 * The single-row shortcut is the handoff's acceptance case — a plan with only a
 * retirement benefit must not open a one-item panel to say so.
 */
export function resolveActionHubPanel(
  rows: readonly ActionHubRow[],
): ActionHubPanel {
  if (rows.length === 0) return { mode: "none" };
  if (rows.length === 1) return { mode: "direct", row: rows[0] };
  return { mode: "panel", rows: [...rows] };
}
