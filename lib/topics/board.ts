import type {
  AccordionGroupRecord,
  TopicDisplayMode,
  TopicLocation,
  TopicPlacementRecord,
} from "@/types/topic";

/**
 * The admin board (TF-3): the Quick Answers zone for one location.
 *
 * The builder always sends the COMPLETE board (groups + placements), and the server
 * reconciles it. That makes "move this question to another group, rename the group,
 * reorder the questions" one request instead of a burst of reorders, and it makes the
 * operation idempotent: sending the same board twice changes nothing.
 *
 * Reconciliation is pure (`planBoardApply`) so every grouping and ordering rule is
 * testable without a database; `applyTopicBoard` in `board.server.ts` is the only
 * thing that writes.
 */

/**
 * Quick Answers has no cap of its own (the handoff caps only Featured, at 3 rows), but
 * Featured is still the other half of the same placement table — so promoting a
 * question has to respect that ceiling from here too.
 */
export const FEATURED_CAP = 12;

export interface BoardGroupInput {
  /** An existing group's id. Omitted for a group the advisor just created. */
  id?: string | null;
  name: string;
  sortOrder?: number;
}

export interface BoardPlacementInput {
  topicId: string;
  displayMode: TopicDisplayMode;
  /**
   * A group's id, or a group's NAME when the group is being created in the same
   * request. `null` for a Featured or Hidden placement.
   */
  groupId?: string | null;
  sortOrder?: number;
}

export interface TopicBoardInput {
  location: TopicLocation;
  groups: BoardGroupInput[];
  placements: BoardPlacementInput[];
}

export interface BoardValidation {
  ok: boolean;
  /** Human-readable reason shown in the builder. */
  error?: string;
}

export interface BoardPlan {
  groupsToCreate: { name: string; sortOrder: number }[];
  groupsToUpdate: { id: string; name: string; sortOrder: number }[];
  placementsToCreate: {
    topicId: string;
    displayMode: TopicDisplayMode;
    groupId: string | null;
    sortOrder: number;
  }[];
  placementsToUpdate: {
    id: string;
    displayMode: TopicDisplayMode;
    groupId: string | null;
    sortOrder: number;
  }[];
}

/** Case/whitespace-insensitive key for group matching. */
function groupKey(name: string): string {
  return (name || "").trim().toLowerCase();
}

/**
 * Reject a board the framework cannot render. The builder warns before sending, but
 * the server is what makes the rule true.
 */
export function validateBoard(board: TopicBoardInput): BoardValidation {
  if (!board || !Array.isArray(board.placements)) {
    return { ok: false, error: "A board needs a placements list." };
  }

  const seen = new Set<string>();
  for (const placement of board.placements) {
    if (!placement.topicId) {
      return { ok: false, error: "Every placement needs a topic." };
    }
    if (seen.has(placement.topicId)) {
      // One topic, one placement per location — enforced by the DB too, but a clear
      // message beats a constraint error.
      return { ok: false, error: "A topic can only appear once in a location." };
    }
    seen.add(placement.topicId);
  }

  const featured = board.placements.filter(
    (placement) => placement.displayMode === "featured",
  ).length;
  if (featured > FEATURED_CAP) {
    return {
      ok: false,
      error: `Featured holds ${FEATURED_CAP} cards (3 rows of 4). Move one down to Quick Answers first.`,
    };
  }

  const groupNames = new Set<string>();
  for (const group of board.groups ?? []) {
    const key = groupKey(group.name);
    if (!key) {
      return { ok: false, error: "A group needs a name." };
    }
    if (groupNames.has(key)) {
      return { ok: false, error: "Two groups cannot share a name." };
    }
    groupNames.add(key);
  }

  return { ok: true };
}

/**
 * Turn the submitted board into the writes that make storage match it.
 *
 * Matching rules:
 *  - a group is matched by id, then by name, so renaming in the drawer is an update;
 *  - a placement is matched by `topicId`, which is stable across zones;
 *  - a placement the board does NOT mention is left alone. Hidden is how an advisor
 *    takes something off the page, so a missing row is never read as a delete.
 */
export function planBoardApply(params: {
  current: {
    groups: AccordionGroupRecord[];
    placements: TopicPlacementRecord[];
  };
  next: TopicBoardInput;
}): BoardPlan {
  const { current, next } = params;

  const byId = new Map(current.groups.map((group) => [group.id, group]));
  const byName = new Map(current.groups.map((group) => [groupKey(group.name), group]));

  const groupsToUpdate: BoardPlan["groupsToUpdate"] = [];
  const groupsToCreate: BoardPlan["groupsToCreate"] = [];
  /** Final id-or-name → the key a placement can refer to. */
  const resolvedGroupKeys = new Map<string, string>();

  (next.groups ?? []).forEach((group, index) => {
    const sortOrder = group.sortOrder ?? index;
    const name = group.name.trim();
    const existing =
      (group.id ? byId.get(group.id) : undefined) ?? byName.get(groupKey(name));

    if (existing) {
      resolvedGroupKeys.set(existing.id, existing.id);
      resolvedGroupKeys.set(groupKey(name), existing.id);
      if (existing.name !== name || existing.sortOrder !== sortOrder) {
        groupsToUpdate.push({ id: existing.id, name, sortOrder });
      }
      return;
    }

    groupsToCreate.push({ name, sortOrder });
    // A brand-new group has no id yet; placements reference it by name.
    resolvedGroupKeys.set(groupKey(name), `name:${groupKey(name)}`);
    if (group.id) resolvedGroupKeys.set(group.id, `name:${groupKey(name)}`);
  });

  const resolveGroup = (value: string | null | undefined): string | null => {
    const raw = (value || "").trim();
    if (!raw) return null;
    const direct = resolvedGroupKeys.get(raw);
    if (direct) return direct;
    return resolvedGroupKeys.get(groupKey(raw)) ?? null;
  };

  const placementByTopic = new Map(
    current.placements.map((placement) => [placement.topicId, placement]),
  );

  const placementsToCreate: BoardPlan["placementsToCreate"] = [];
  const placementsToUpdate: BoardPlan["placementsToUpdate"] = [];

  next.placements.forEach((placement, index) => {
    const sortOrder = placement.sortOrder ?? index;
    const groupId =
      placement.displayMode === "quick_answers"
        ? resolveGroup(placement.groupId)
        : null;
    const existing = placementByTopic.get(placement.topicId);

    if (existing) {
      if (
        existing.displayMode !== placement.displayMode ||
        (existing.groupId ?? null) !== groupId ||
        existing.sortOrder !== sortOrder
      ) {
        placementsToUpdate.push({
          id: existing.id,
          displayMode: placement.displayMode,
          groupId,
          sortOrder,
        });
      }
      return;
    }

    placementsToCreate.push({
      topicId: placement.topicId,
      displayMode: placement.displayMode,
      groupId,
      sortOrder,
    });
  });

  return {
    groupsToCreate,
    groupsToUpdate,
    placementsToCreate,
    placementsToUpdate,
  };
}

/** True when the plan produced no writes — used to skip a transaction entirely. */
export function isNoopPlan(plan: BoardPlan): boolean {
  return (
    plan.groupsToCreate.length === 0 &&
    plan.groupsToUpdate.length === 0 &&
    plan.placementsToCreate.length === 0 &&
    plan.placementsToUpdate.length === 0
  );
}
