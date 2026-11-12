import { describe, expect, it, vi } from "vitest";

// `board.server` imports the Prisma client at module scope, so the two reads the
// board needs are stubbed here; nothing else on the client is constructed.
const db = vi.hoisted(() => ({
  placements: vi.fn(async (): Promise<unknown[]> => []),
  groups: vi.fn(async (): Promise<unknown[]> => []),
}));

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    topicPlacement: { findMany: db.placements },
    accordionGroup: { findMany: db.groups },
  },
}));

import { loadTopicBoard, mapPlacementTopicIds } from "@/lib/topics/board.server";
import { UNGROUPED_TOPIC_GROUP_ID } from "@/lib/topics/ungrouped";

function topicRow(id: string, slug: string) {
  return {
    id,
    scope: "system",
    organizationId: null,
    slug: `sys.${slug}`,
    title: slug,
    summary: null,
    iconKey: null,
    imageKey: null,
    bodyBlocks: [],
    tags: [],
    defaultLocations: ["retirement"],
    isActionHub: false,
    defaultCta: null,
    status: "published",
  };
}

function placementRow(input: {
  id: string;
  topicId: string;
  groupId: string | null;
  displayMode?: "featured" | "quick_answers" | "hidden";
  sortOrder?: number;
}) {
  return {
    id: input.id,
    clientId: "plan-1",
    topicId: input.topicId,
    location: "retirement",
    displayMode: input.displayMode ?? "quick_answers",
    groupId: input.groupId,
    sortOrder: input.sortOrder ?? 0,
    overrides: null,
    actionHubLink: null,
    topic: topicRow(input.topicId, `topic-${input.topicId}`),
  };
}

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

/**
 * A question with no section (or one whose group was deleted) still belongs to the
 * board. It has to come back with the read, or the builder drops it on the next
 * reload AND the "Add from the library" drawer offers it again as unplaced.
 */
describe("loadTopicBoard", () => {
  it("returns section-less questions in the board's virtual group", async () => {
    db.groups.mockResolvedValue([
      { id: "group-1", name: "Saving & Contributions", sortOrder: 0 },
    ]);
    db.placements.mockResolvedValue([
      placementRow({ id: "p-1", topicId: "t-1", groupId: "group-1" }),
      placementRow({ id: "p-2", topicId: "t-2", groupId: null, sortOrder: 1 }),
      placementRow({ id: "p-3", topicId: "t-3", groupId: "gone", sortOrder: 2 }),
      placementRow({
        id: "p-4",
        topicId: "t-4",
        groupId: null,
        displayMode: "featured",
        sortOrder: 0,
      }),
    ]);

    const board = await loadTopicBoard("plan-1", "retirement");

    expect(board.featured.map((topic) => topic.topicId)).toEqual(["t-4"]);
    expect(board.groups.map((group) => group.id)).toEqual([
      "group-1",
      UNGROUPED_TOPIC_GROUP_ID,
    ]);
    // Both the group-less question and the one whose group vanished land here.
    expect(
      board.groups[1].topics.map((topic) => topic.topicId),
    ).toEqual(["t-2", "t-3"]);
  });

  it("adds no virtual group when every question has a section", async () => {
    db.groups.mockResolvedValue([{ id: "group-1", name: "Saving", sortOrder: 0 }]);
    db.placements.mockResolvedValue([
      placementRow({ id: "p-1", topicId: "t-1", groupId: "group-1" }),
    ]);

    const board = await loadTopicBoard("plan-1", "retirement");

    expect(board.groups.map((group) => group.id)).toEqual(["group-1"]);
  });
});
