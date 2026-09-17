import {
  daysBetweenScheduleDays,
  scheduleDayKeyToDate,
  toScheduleDayKey,
  todayScheduleDayKey,
} from "@/lib/date";

/**
 * Shared shape for the dashboard's Recent Activity feed.
 *
 * The feed is a union of several unrelated records — plans, documents, meetings, marketing
 * assets — so each source is mapped into this one item type and the merged list is sorted by
 * `at`. Types and the day grouping live here so the API route and the component agree on the
 * contract without the component importing anything server-only.
 */

export type ActivityKind =
  | "plan-created"
  | "plan-published"
  | "plan-renamed"
  | "portal-url-changed"
  | "document-uploaded"
  | "meeting-added"
  | "marketing-asset-created";

export interface ActivityItem {
  /** Stable across sources — each source prefixes its own record id. */
  id: string;
  kind: ActivityKind;
  /** Event headline, e.g. "Document uploaded". */
  title: string;
  /**
   * Plan the event belongs to. Rendered inline after the headline so the row reads as one
   * statement of what happened and to whom. Omitted when the record has no plan.
   */
  planName?: string;
  /** The specific artifact — document title, meeting name, asset headline. Shown beneath. */
  subject?: string;
  /** ISO timestamp, used for ordering and for the day grouping. */
  at: string;
  /** Page for the item's subject, when one exists. */
  href?: string;
}

export interface ActivityGroup {
  /** Scheduling day key, or "" when the timestamp could not be resolved. */
  key: string;
  /** "Today", "Yesterday", or a formatted date. */
  label: string;
  items: ActivityItem[];
}

/** Day key → label. Dates from a previous year keep the year to stay unambiguous. */
function dayLabel(key: string, todayKey: string): string {
  if (!key) return "Earlier";
  if (!todayKey) return key;

  const daysAgo = daysBetweenScheduleDays(key, todayKey);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  // A future-dated activity (clock skew) reads better than "in 1 day".
  if (daysAgo < 0) return "Today";

  const day = scheduleDayKeyToDate(key);
  if (Number.isNaN(day.getTime())) return key;

  const sameYear = key.slice(0, 4) === todayKey.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(day);
}

/**
 * Buckets a newest-first list into day groups, preserving that order.
 *
 * Days are resolved through the scheduling helpers so a group never depends on the viewer's
 * timezone, matching how the rest of the app treats stored dates.
 */
export function groupActivityByDay(items: ActivityItem[]): ActivityGroup[] {
  const todayKey = todayScheduleDayKey();
  const groups = new Map<string, ActivityGroup>();

  for (const item of items) {
    const key = toScheduleDayKey(item.at);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(key, todayKey), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  return Array.from(groups.values());
}
