import { describe, expect, it, vi } from "vitest";

// `board.server` imports the Prisma client at module scope; the helper under test
// is pure, so the client is never constructed here.
vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));

import { mapPlacementTopicIds } from "@/lib/topics/board.server";

const placement = (topicId: string) => ({
  topicId,
  displayMode: "quick_answers" as const,
  groupId: "group-1",
  sortOrder: 0,
});

/**
 * "Add from the library" sends a library SLUG because a topic the plan has never
 * placed has no Topic row yet. Writing that into `TopicPlacement.topicId` violated
 * the foreign key, so the whole save failed — the topic appeared and then vanished
 * seconds later, which is what made Quick Access edits feel slow and unreliable.
 */
describe("mapPlacementTopicIds", () => {
  it("swaps a library slug for the Topic id the server resolved", () => {
    const mapped = mapPlacementTopicIds(
      [placement("contribution-limits")],
      new Map([["contribution-limits", "topic-123"]]),
    );

    expect(mapped).toEqual([
      {
        topicId: "topic-123",
        displayMode: "quick_answers",
        groupId: "group-1",
        sortOrder: 0,
      },
    ]);
  });

  it("leaves a real Topic id and any unknown value alone", () => {
    const placements = [placement("cmw2k09is0003lhtxm26l36di"), placement("not-a-topic")];
    const mapped = mapPlacementTopicIds(
      placements,
      new Map([["contribution-limits", "topic-123"]]),
    );

    expect(mapped).toEqual(placements);
  });

  it("is a no-op when nothing was resolved", () => {
    const placements = [placement("contribution-limits")];

    expect(mapPlacementTopicIds(placements, new Map())).toBe(placements);
  });
});
