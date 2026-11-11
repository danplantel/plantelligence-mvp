import {
  DEFAULT_QUICK_ANSWER_GROUPS,
  libraryTopicsForLocation,
} from "@/lib/topics/library";
import type {
  AccordionGroupRecord,
  TopicLocation,
  TopicPlacementRecord,
  TopicRecord,
} from "@/types/topic";

/**
 * Reconcile a plan's Quick Answers groups with the shipped library.
 *
 * A plan seeded by an older revision keeps that revision's group names
 * ("Contributions & Saving", "Taking Money Out", …) while a later content pass
 * adds the current groups ("Saving & Contributions", "Loans & Withdrawals", …).
 * The participant then sees the same section twice — "Contribution limits"
 * lands in the new group, under a heading the plan already has a copy of.
 *
 * This planner moves a system topic's placement to the group the library now
 * ships it in, puts canonical groups into the documented order, and reports the
 * groups the plan empties so the caller can delete them. It is a one-off
 * migration, NOT part of seeding: an advisor may deliberately regroup a topic in
 * the builder, and a save must not snap their layout back.
 *
 * A theme can also move ZONE: Social Security and Plan materials were feature
 * cards in the older revision and are answers now, so a plan still holding them
 * as featured adopts the shipped answer group. A hidden placement is left alone —
 * an advisor's hide is a decision, not drift.
 *
 * What it never touches:
 *  - advisor-authored (org) topics;
 *  - placements outside `quick_answers` whose topic the library does not ship as
 *    an answer (the current feature cards, and retired cards);
 *  - hidden placements, and groups that are not canonical but still hold content.
 *
 * A system answer the library no longer ships is hidden rather than deleted: the
 * row (and any plan-level override) survives in the builder's Hidden zone.
 */
export interface PlacementRealignment {
  placementId: string;
  groupId: string | null;
  displayMode: TopicPlacementRecord["displayMode"];
  sortOrder: number;
}

export interface GroupRealignmentPlan {
  /** Placements whose group, display mode or order changes. */
  placements: PlacementRealignment[];
  /** Canonical groups to move into the documented order. */
  groupOrders: { id: string; sortOrder: number }[];
  /**
   * Groups the plan empties. The caller deletes them; every placement that was
   * in them has either moved to a canonical group or been hidden.
   */
  emptiedGroups: string[];
}

function unprefixed(slug: string): string {
  return (slug || "").trim().replace(/^sys\./, "");
}

/**
 * The group row a canonical name should use when the plan has more than one
 * row with that name (a stale seed created a second). The oldest row wins, which
 * is the one the participant has been reading.
 */
function keeperGroups(groups: AccordionGroupRecord[]): {
  byName: Map<string, AccordionGroupRecord>;
  duplicates: Set<string>;
} {
  const byName = new Map<string, AccordionGroupRecord>();
  const duplicates = new Set<string>();

  for (const group of groups) {
    const name = group.name.trim();
    const current = byName.get(name);
    if (!current) {
      byName.set(name, group);
      continue;
    }
    const [keeper, extra] =
      group.sortOrder < current.sortOrder ? [group, current] : [current, group];
    byName.set(name, keeper);
    duplicates.add(extra.id);
  }

  return { byName, duplicates };
}

export function planGroupRealignment(params: {
  location: TopicLocation;
  groups: AccordionGroupRecord[];
  placements: TopicPlacementRecord[];
  topics: TopicRecord[];
}): GroupRealignmentPlan {
  const { location, groups, placements, topics } = params;
  const canonical = DEFAULT_QUICK_ANSWER_GROUPS[location] ?? [];
  const canonicalIndex = new Map(canonical.map((name, index) => [name, index]));

  const { byName: groupByName, duplicates } = keeperGroups(groups);

  // First declaration wins, exactly like `seedLocationTopics`, so a topic that
  // belongs to two locations takes the group of the entry that claims this one.
  const seedIndex = new Map<string, number>();
  const seedGroup = new Map<string, string>();
  for (const [index, seed] of libraryTopicsForLocation(location).entries()) {
    if (seedIndex.has(seed.slug)) continue;
    seedIndex.set(seed.slug, index);
    if (seed.displayByDefault === "quick_answers" && seed.group) {
      seedGroup.set(seed.slug, seed.group.trim());
    }
  }

  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const changes = new Map<string, PlacementRealignment>();
  /** placementId → the group it lives in once this plan is applied. */
  const targetGroup = new Map<string, string | null>();

  for (const placement of placements) {
    const topic = topicById.get(placement.topicId);
    if (!topic) continue;
    // Advisor-authored answers and anything not shipped by the library keep the
    // placement their advisor gave them.
    if (topic.scope !== "system") continue;
    // An advisor's hide is a decision, not drift — never undo it.
    if (placement.displayMode === "hidden") continue;

    const slug = unprefixed(topic.slug);
    const groupName = seedGroup.get(slug);

    if (!groupName) {
      // Not shipped as an answer. A retired ANSWER is hidden — never delete it,
      // it may carry a plan-level override. A featured card the library no longer
      // ships is left for the advisor: the grid renders from the catalog anyway.
      if (placement.displayMode !== "quick_answers") continue;
      targetGroup.set(placement.id, null);
      changes.set(placement.id, {
        placementId: placement.id,
        groupId: null,
        displayMode: "hidden",
        sortOrder: placement.sortOrder,
      });
      continue;
    }

    const target = groupByName.get(groupName);
    // The caller creates canonical groups before planning, so a miss here means
    // the plan cannot hold this answer yet — leave the placement alone.
    if (!target) continue;

    targetGroup.set(placement.id, target.id);
    // A featured placement of a shipped answer is the older revision's card
    // (Social Security, Plan materials). Adopt the shipped zone so the answer is
    // where a reader looks for it.
    if (
      placement.groupId !== target.id ||
      placement.displayMode !== "quick_answers"
    ) {
      changes.set(placement.id, {
        placementId: placement.id,
        groupId: target.id,
        displayMode: "quick_answers",
        sortOrder: placement.sortOrder,
      });
    }
  }

  /** The display mode and group a placement holds once this plan is applied. */
  const answersAfter = (placement: TopicPlacementRecord): boolean =>
    (changes.get(placement.id)?.displayMode ?? placement.displayMode) ===
    "quick_answers";
  const groupAfter = (placement: TopicPlacementRecord): string | null =>
    targetGroup.has(placement.id)
      ? targetGroup.get(placement.id) ?? null
      : placement.groupId ?? null;

  // Renumber each group in library order, so a merged group reads the way a
  // freshly seeded one would. Oracle for a system topic is its library index;
  // an org answer keeps its place after the shipped ones.
  const buckets = new Map<string, { placement: TopicPlacementRecord; order: number }[]>();
  for (const placement of placements) {
    if (!answersAfter(placement)) continue;
    const groupId = groupAfter(placement);
    if (!groupId) continue;

    const topic = topicById.get(placement.topicId);
    const order =
      topic && topic.scope === "system"
        ? seedIndex.get(unprefixed(topic.slug)) ?? Number.MAX_SAFE_INTEGER
        : Number.MAX_SAFE_INTEGER;

    const bucket = buckets.get(groupId) ?? [];
    bucket.push({ placement, order });
    buckets.set(groupId, bucket);
  }

  for (const [groupId, bucket] of buckets) {
    bucket.sort(
      (a, b) => a.order - b.order || a.placement.sortOrder - b.placement.sortOrder,
    );
    bucket.forEach((entry, index) => {
      const planned = changes.get(entry.placement.id);
      if (planned) {
        planned.sortOrder = index;
        return;
      }
      if (entry.placement.sortOrder === index) return;
      changes.set(entry.placement.id, {
        placementId: entry.placement.id,
        groupId,
        displayMode: "quick_answers",
        sortOrder: index,
      });
    });
  }

  const groupOrders = groups
    .filter((group) => {
      const index = canonicalIndex.get(group.name.trim());
      return index !== undefined && group.sortOrder !== index;
    })
    .map((group) => ({
      id: group.id,
      sortOrder: canonicalIndex.get(group.name.trim()) as number,
    }));

  const before = new Map<string, number>();
  for (const placement of placements) {
    if (placement.displayMode !== "quick_answers" || !placement.groupId) continue;
    before.set(placement.groupId, (before.get(placement.groupId) ?? 0) + 1);
  }
  const after = new Map<string, number>();
  for (const placement of placements) {
    if (!answersAfter(placement)) continue;
    const groupId = groupAfter(placement);
    if (!groupId) continue;
    after.set(groupId, (after.get(groupId) ?? 0) + 1);
  }

  const emptiedGroups = groups
    .filter((group) => {
      if (canonicalIndex.has(group.name.trim())) return false;
      // Only a group this plan actually emptied, never one that was already
      // empty (an advisor may be setting it up in the builder).
      return (before.get(group.id) ?? 0) > 0 && (after.get(group.id) ?? 0) === 0;
    })
    .map((group) => group.id);

  // A duplicate of a canonical name loses its placements to the keeper row, so
  // it empties exactly like a legacy group and is safe to drop.
  for (const id of duplicates) {
    if ((after.get(id) ?? 0) === 0 && !emptiedGroups.includes(id)) {
      emptiedGroups.push(id);
    }
  }

  return {
    placements: [...changes.values()],
    groupOrders,
    emptiedGroups,
  };
}
