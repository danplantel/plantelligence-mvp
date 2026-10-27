import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNGROUPED_TOPIC_GROUP_ID,
  loadLocationTopics,
  resolveLocationTopics,
} from "@/lib/topics/resolve-location";
import type {
  AccordionGroupRecord,
  TopicPlacementRecord,
  TopicRecord,
} from "@/types/topic";

const mocks = vi.hoisted(() => ({
  placementFindMany: vi.fn(),
  groupFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    topicPlacement: { findMany: mocks.placementFindMany },
    accordionGroup: { findMany: mocks.groupFindMany },
  },
}));

function topic(overrides: Partial<TopicRecord> = {}): TopicRecord {
  return {
    id: "topic-1",
    scope: "system",
    organizationId: null,
    slug: "sys.one",
    title: "Topic One",
    summary: null,
    bodyBlocks: [],
    tags: [],
    defaultLocations: ["retirement"],
    isActionHub: false,
    defaultCta: null,
    status: "active",
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

function group(
  overrides: Partial<AccordionGroupRecord> = {},
): AccordionGroupRecord {
  return {
    id: "group-1",
    clientId: "plan-a",
    location: "retirement",
    name: "Contributions & Saving",
    sortOrder: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.placementFindMany.mockReset();
  mocks.groupFindMany.mockReset();
});

describe("resolveLocationTopics", () => {
  it("orders featured cards by sortOrder", () => {
    const resolved = resolveLocationTopics({
      location: "retirement",
      topics: [
        topic({ id: "a", slug: "a", title: "A" }),
        topic({ id: "b", slug: "b", title: "B" }),
      ],
      placements: [
        placement({ id: "pa", topicId: "a", sortOrder: 2 }),
        placement({ id: "pb", topicId: "b", sortOrder: 1 }),
      ],
      groups: [],
    });

    expect(resolved.featured.map((entry) => entry.title)).toEqual(["B", "A"]);
    expect(resolved.groups).toEqual([]);
  });

  it("counts hidden placements without returning them", () => {
    const resolved = resolveLocationTopics({
      location: "retirement",
      topics: [
        topic({ id: "a", title: "A" }),
        topic({ id: "b", title: "B" }),
      ],
      placements: [
        placement({ id: "pa", topicId: "a", displayMode: "hidden" }),
        placement({ id: "pb", topicId: "b" }),
      ],
      groups: [],
    });

    expect(resolved.hiddenCount).toBe(1);
    expect(resolved.featured.map((entry) => entry.topicId)).toEqual(["b"]);
  });

  it("groups quick answers in group order, with questions in placement order", () => {
    const resolved = resolveLocationTopics({
      location: "retirement",
      topics: [
        topic({ id: "a", title: "A" }),
        topic({ id: "b", title: "B" }),
        topic({ id: "c", title: "C" }),
      ],
      placements: [
        placement({
          id: "pa",
          topicId: "a",
          displayMode: "quick_answers",
          groupId: "g1",
          sortOrder: 1,
        }),
        placement({
          id: "pb",
          topicId: "b",
          displayMode: "quick_answers",
          groupId: "g1",
          sortOrder: 0,
        }),
        placement({
          id: "pc",
          topicId: "c",
          displayMode: "quick_answers",
          groupId: "g2",
          sortOrder: 0,
        }),
      ],
      groups: [
        group({ id: "g2", name: "Investing", sortOrder: 1 }),
        group({ id: "g1", name: "Contributions & Saving", sortOrder: 0 }),
      ],
    });

    expect(resolved.groups.map((entry) => entry.name)).toEqual([
      "Contributions & Saving",
      "Investing",
    ]);
    expect(resolved.groups[0].topics.map((entry) => entry.title)).toEqual([
      "B",
      "A",
    ]);
  });

  it("keeps an orphaned quick answer in the trailing Questions group", () => {
    const resolved = resolveLocationTopics({
      location: "retirement",
      topics: [topic({ id: "a", title: "A" })],
      placements: [
        placement({
          topicId: "a",
          displayMode: "quick_answers",
          // Points at a group the advisor deleted.
          groupId: "group-gone",
        }),
      ],
      groups: [],
    });

    expect(resolved.groups).toHaveLength(1);
    expect(resolved.groups[0].id).toBe(UNGROUPED_TOPIC_GROUP_ID);
    expect(resolved.groups[0].name).toBe("Questions");
    expect(resolved.groups[0].topics).toHaveLength(1);
  });

  it("skips a placement whose topic is missing", () => {
    const resolved = resolveLocationTopics({
      location: "retirement",
      topics: [],
      placements: [placement({ topicId: "missing" })],
      groups: [],
    });

    expect(resolved.featured).toEqual([]);
  });

  it("ignores placements belonging to another location", () => {
    const resolved = resolveLocationTopics({
      location: "retirement",
      topics: [topic()],
      placements: [placement({ location: "group_health" })],
      groups: [],
    });

    expect(resolved.featured).toEqual([]);
  });

  it("still renders an archived topic a placement points at", () => {
    // Archiving flags a topic in the builder; it never pulls live content off a hub
    // without the advisor acting.
    const resolved = resolveLocationTopics({
      location: "retirement",
      topics: [topic({ status: "archived" })],
      placements: [placement()],
      groups: [],
    });

    expect(resolved.featured).toHaveLength(1);
  });
});

describe("loadLocationTopics", () => {
  it("scopes both queries by plan and location", async () => {
    mocks.placementFindMany.mockResolvedValue([]);
    mocks.groupFindMany.mockResolvedValue([]);

    await loadLocationTopics("plan-a", "group_life");

    expect(mocks.placementFindMany).toHaveBeenCalledWith({
      where: { clientId: "plan-a", location: "group_life" },
      include: { topic: true },
      orderBy: [{ sortOrder: "asc" }],
    });
    expect(mocks.groupFindMany).toHaveBeenCalledWith({
      where: { clientId: "plan-a", location: "group_life" },
      orderBy: [{ sortOrder: "asc" }],
    });
  });

  it("returns nothing and queries nothing for a blank plan id", async () => {
    const resolved = await loadLocationTopics("  ", "retirement");

    expect(resolved).toEqual({
      location: "retirement",
      featured: [],
      groups: [],
      hiddenCount: 0,
    });
    expect(mocks.placementFindMany).not.toHaveBeenCalled();
  });

  it("maps the joined rows into the resolved location", async () => {
    mocks.placementFindMany.mockResolvedValue([
      {
        id: "placement-1",
        clientId: "plan-a",
        topicId: "topic-1",
        location: "retirement",
        displayMode: "featured",
        groupId: null,
        sortOrder: 0,
        overrides: null,
        actionHubLink: null,
        topic: {
          id: "topic-1",
          scope: "system",
          organizationId: null,
          slug: "sys.one",
          title: "Topic One",
          summary: null,
          iconKey: null,
          imageKey: null,
          bodyBlocks: [{ type: "quick_answer", text: "Answer" }],
          tags: [],
          defaultLocations: ["retirement"],
          isActionHub: false,
          defaultCta: null,
          status: "active",
        },
      },
    ]);
    mocks.groupFindMany.mockResolvedValue([]);

    const resolved = await loadLocationTopics("plan-a", "retirement");

    expect(resolved.featured).toHaveLength(1);
    expect(resolved.featured[0].title).toBe("Topic One");
    expect(resolved.featured[0].bodyBlocks).toEqual([
      { type: "quick_answer", text: "Answer" },
    ]);
  });
});
