import { describe, expect, it } from "vitest";
import {
  FEATURED_CAP,
  isNoopPlan,
  planBoardApply,
  validateBoard,
  type TopicBoardInput,
} from "@/lib/topics/board";
import type { AccordionGroupRecord, TopicPlacementRecord } from "@/types/topic";

function group(overrides: Partial<AccordionGroupRecord> = {}): AccordionGroupRecord {
  return {
    id: "group-1",
    clientId: "plan-a",
    location: "retirement",
    name: "Contributions & Saving",
    sortOrder: 0,
    ...overrides,
  };
}

function placement(
  overrides: Partial<TopicPlacementRecord> = {},
): TopicPlacementRecord {
  return {
    id: "placement-1",
    clientId: "plan-a",
    topicId: "topic-1",
    location: "retirement",
    displayMode: "featured",
    groupId: null,
    sortOrder: 0,
    overrides: null,
    actionHubLink: null,
    ...overrides,
  };
}

function board(overrides: Partial<TopicBoardInput> = {}): TopicBoardInput {
  return {
    location: "retirement",
    groups: [],
    placements: [],
    ...overrides,
  };
}

describe("validateBoard", () => {
  it("accepts a well-formed board", () => {
    expect(
      validateBoard(
        board({
          groups: [{ name: "Investing" }],
          placements: [
            { topicId: "a", displayMode: "featured" },
            { topicId: "b", displayMode: "quick_answers", groupId: "Investing" },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("rejects the same topic twice in one location", () => {
    const result = validateBoard(
      board({
        placements: [
          { topicId: "a", displayMode: "featured" },
          { topicId: "a", displayMode: "hidden" },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("once in a location");
  });

  it("enforces the Featured ceiling, because Quick Answers can promote into it", () => {
    const placements = Array.from({ length: FEATURED_CAP + 1 }, (_, index) => ({
      topicId: `topic-${index}`,
      displayMode: "featured" as const,
    }));

    const result = validateBoard(board({ placements }));

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Featured holds");
  });

  it("requires a name for every group, and rejects duplicates", () => {
    expect(validateBoard(board({ groups: [{ name: "  " }] })).ok).toBe(false);
    expect(
      validateBoard(
        board({ groups: [{ name: "Investing" }, { name: "investing" }] }),
      ).ok,
    ).toBe(false);
  });

  it("rejects a placement with no topic", () => {
    expect(
      validateBoard(
        board({ placements: [{ topicId: "", displayMode: "featured" }] }),
      ).ok,
    ).toBe(false);
  });
});

describe("planBoardApply", () => {
  it("returns an empty plan when nothing changed", () => {
    const plan = planBoardApply({
      current: { groups: [group()], placements: [placement()] },
      next: board({
        groups: [{ id: "group-1", name: "Contributions & Saving", sortOrder: 0 }],
        placements: [
          { topicId: "topic-1", displayMode: "featured", sortOrder: 0 },
        ],
      }),
    });

    expect(isNoopPlan(plan)).toBe(true);
  });

  it("demotes a featured card into an existing group", () => {
    const plan = planBoardApply({
      current: { groups: [group()], placements: [placement()] },
      next: board({
        groups: [{ id: "group-1", name: "Contributions & Saving", sortOrder: 0 }],
        placements: [
          {
            topicId: "topic-1",
            displayMode: "quick_answers",
            groupId: "group-1",
            sortOrder: 3,
          },
        ],
      }),
    });

    expect(plan.placementsToUpdate).toEqual([
      {
        id: "placement-1",
        displayMode: "quick_answers",
        groupId: "group-1",
        sortOrder: 3,
      },
    ]);
  });

  it("creates a group and points a new placement at it by name", () => {
    const plan = planBoardApply({
      current: { groups: [], placements: [] },
      next: board({
        groups: [{ name: "New Group", sortOrder: 1 }],
        placements: [
          {
            topicId: "topic-9",
            displayMode: "quick_answers",
            groupId: "New Group",
            sortOrder: 0,
          },
        ],
      }),
    });

    expect(plan.groupsToCreate).toEqual([{ name: "New Group", sortOrder: 1 }]);
    expect(plan.placementsToCreate).toEqual([
      {
        topicId: "topic-9",
        displayMode: "quick_answers",
        groupId: "name:new group",
        sortOrder: 0,
        // A new placement always states its sub-link, `null` when there is none.
        actionHubLink: null,
      },
    ]);
  });

  it("renames and reorders a group matched by id", () => {
    const plan = planBoardApply({
      current: { groups: [group()], placements: [] },
      next: board({ groups: [{ id: "group-1", name: "Saving", sortOrder: 2 }] }),
    });

    expect(plan.groupsToUpdate).toEqual([
      { id: "group-1", name: "Saving", sortOrder: 2 },
    ]);
  });

  it("clears the group when a question becomes Featured or Hidden", () => {
    const plan = planBoardApply({
      current: {
        groups: [group()],
        placements: [
          placement({ displayMode: "quick_answers", groupId: "group-1" }),
        ],
      },
      next: board({
        groups: [{ id: "group-1", name: "Contributions & Saving", sortOrder: 0 }],
        placements: [
          { topicId: "topic-1", displayMode: "hidden", groupId: "group-1" },
        ],
      }),
    });

    expect(plan.placementsToUpdate[0]).toMatchObject({
      displayMode: "hidden",
      groupId: null,
    });
  });

  it("leaves placements the board does not mention alone", () => {
    // Removing a topic is Hidden, not omission — so a shorter board must never delete
    // the rows it does not mention.
    const plan = planBoardApply({
      current: {
        groups: [],
        placements: [
          placement({ id: "placement-1", topicId: "topic-1" }),
          placement({ id: "placement-2", topicId: "topic-2", sortOrder: 1 }),
        ],
      },
      next: board({
        placements: [{ topicId: "topic-1", displayMode: "featured" }],
      }),
    });

    expect(plan.placementsToUpdate).toEqual([]);
    expect(plan.placementsToCreate).toEqual([]);
  });

  it("ignores a group reference it cannot resolve", () => {
    const plan = planBoardApply({
      current: { groups: [], placements: [] },
      next: board({
        placements: [
          { topicId: "topic-1", displayMode: "quick_answers", groupId: "ghost" },
        ],
      }),
    });

    expect(plan.placementsToCreate[0].groupId).toBeNull();
  });

  it("writes an Action Hub sub-link onto the placement it belongs to", () => {
    const plan = planBoardApply({
      current: { groups: [], placements: [placement()] },
      next: board({
        placements: [
          {
            topicId: "topic-1",
            displayMode: "featured",
            actionHubLink: { label: "Voya Retirement", url: "voya.test/b" },
          },
        ],
      }),
    });

    expect(plan.placementsToUpdate).toEqual([
      {
        id: "placement-1",
        displayMode: "featured",
        groupId: null,
        sortOrder: 0,
        actionHubLink: { label: "Voya Retirement", url: "voya.test/b" },
      },
    ]);
  });

  it("leaves a stored sub-link alone when the board never mentions one", () => {
    const plan = planBoardApply({
      current: {
        groups: [],
        placements: [
          placement({ actionHubLink: { url: "https://voya.test/b" }, sortOrder: 0 }),
        ],
      },
      // Only a reorder: no `actionHubLink` key at all.
      next: board({
        placements: [{ topicId: "topic-1", displayMode: "featured", sortOrder: 1 }],
      }),
    });

    expect(plan.placementsToUpdate).toEqual([
      {
        id: "placement-1",
        displayMode: "featured",
        groupId: null,
        sortOrder: 1,
      },
    ]);
    expect(plan.placementsToUpdate[0]).not.toHaveProperty("actionHubLink");
  });

  it("clears a sub-link the advisor emptied", () => {
    const plan = planBoardApply({
      current: {
        groups: [],
        placements: [placement({ actionHubLink: { url: "https://voya.test/b" } })],
      },
      next: board({
        placements: [
          // Both fields cleared: the row falls back to the provider URL.
          { topicId: "topic-1", displayMode: "featured", actionHubLink: { url: "" } },
        ],
      }),
    });

    expect(plan.placementsToUpdate[0].actionHubLink).toBeNull();
  });

  it("does not write a sub-link that did not change", () => {
    const plan = planBoardApply({
      current: {
        groups: [],
        placements: [placement({ actionHubLink: { label: "Voya", url: "voya.test" } })],
      },
      next: board({
        placements: [
          {
            topicId: "topic-1",
            displayMode: "featured",
            actionHubLink: { label: "Voya", url: "voya.test" },
          },
        ],
      }),
    });

    expect(plan.placementsToUpdate).toEqual([]);
  });

  it("carries the sub-link onto a brand-new placement", () => {
    const plan = planBoardApply({
      current: { groups: [], placements: [] },
      next: board({
        placements: [
          {
            topicId: "topic-9",
            displayMode: "featured",
            actionHubLink: { url: "https://metlife.test/b" },
          },
        ],
      }),
    });

    expect(plan.placementsToCreate).toEqual([
      {
        topicId: "topic-9",
        displayMode: "featured",
        groupId: null,
        sortOrder: 0,
        actionHubLink: { url: "https://metlife.test/b" },
      },
    ]);
  });

  it("adds a library topic as a new placement in a group", () => {
    const plan = planBoardApply({
      current: { groups: [group()], placements: [placement()] },
      next: board({
        groups: [{ id: "group-1", name: "Contributions & Saving", sortOrder: 0 }],
        placements: [
          { topicId: "topic-1", displayMode: "featured" },
          {
            topicId: "topic-new",
            displayMode: "quick_answers",
            groupId: "group-1",
            sortOrder: 0,
          },
        ],
      }),
    });

    expect(plan.placementsToCreate).toEqual([
      {
        topicId: "topic-new",
        displayMode: "quick_answers",
        groupId: "group-1",
        sortOrder: 0,
        actionHubLink: null,
      },
    ]);
  });
});
