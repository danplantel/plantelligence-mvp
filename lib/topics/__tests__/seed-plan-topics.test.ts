import { describe, expect, it, vi } from "vitest";
import {
  ensureLocationSeeded,
  seedCustomStarterSet,
  seedLocationTopics,
  type TopicSeedStore,
} from "@/lib/topics/seed-plan-topics";
import {
  DEFAULT_QUICK_ANSWER_GROUPS,
  libraryTopicsForLocation,
  libraryTopicsForStarterSet,
} from "@/lib/topics/library";
import type {
  AccordionGroupRecord,
  TopicPlacementRecord,
  TopicRecord,
} from "@/types/topic";

// `seed-plan-topics` imports the Prisma client at module scope; the tests below inject
// an in-memory store, so the real client must never be constructed here.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

interface MemoryStore {
  store: TopicSeedStore;
  topics: TopicRecord[];
  groups: AccordionGroupRecord[];
  placements: TopicPlacementRecord[];
}

/** A tiny in-memory implementation of the store contract, with real uniqueness rules. */
function createMemoryStore(): MemoryStore {
  const topics: TopicRecord[] = [];
  const groups: AccordionGroupRecord[] = [];
  const placements: TopicPlacementRecord[] = [];
  let sequence = 0;

  const store: TopicSeedStore = {
    async findTopicsBySlug(slugs) {
      return topics.filter((topic) => slugs.includes(topic.slug));
    },
    async createTopic(input) {
      const row: TopicRecord = {
        id: `topic-${++sequence}`,
        scope: "system",
        organizationId: null,
        slug: input.slug,
        title: input.title,
        summary: input.summary ?? null,
        bodyBlocks: null,
        tags: input.tags ?? [],
        defaultLocations: input.defaultLocations,
        isActionHub: input.isActionHub ?? false,
        defaultCta: input.defaultCta ?? null,
        status: "active",
      };
      topics.push(row);
      return row;
    },
    async listGroups(clientId, location) {
      return groups.filter(
        (group) => group.clientId === clientId && group.location === location,
      );
    },
    async createGroup(input) {
      const row: AccordionGroupRecord = { id: `group-${++sequence}`, ...input };
      groups.push(row);
      return row;
    },
    async listPlacements(clientId, location) {
      return placements.filter(
        (placement) =>
          placement.clientId === clientId && placement.location === location,
      );
    },
    async createPlacement(input) {
      const row: TopicPlacementRecord = {
        id: `placement-${++sequence}`,
        ...input,
        groupId: input.groupId ?? null,
        overrides: null,
        actionHubLink: null,
      };
      placements.push(row);
      return row;
    },
  };

  return { store, topics, groups, placements };
}

const RETIREMENT_LIBRARY_COUNT = libraryTopicsForLocation("retirement").length;

describe("seedLocationTopics", () => {
  it("places every Retirement default and creates the documented groups", async () => {
    const memory = createMemoryStore();

    const result = await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });

    expect(result.seeded).toBe(true);
    expect(result.location).toBe("retirement");
    expect(result.createdPlacements).toBe(RETIREMENT_LIBRARY_COUNT);
    expect(memory.groups.map((group) => group.name)).toEqual(
      DEFAULT_QUICK_ANSWER_GROUPS.retirement,
    );
  });

  it("puts the four featured topics in card order", async () => {
    const memory = createMemoryStore();

    await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });

    const featured = memory.placements
      .filter((placement) => placement.displayMode === "featured")
      .sort((a, b) => a.sortOrder - b.sortOrder);

    expect(featured.map((placement) => placement.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it("reuses one Topic row for a topic that belongs to two locations", async () => {
    const memory = createMemoryStore();

    await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });
    await seedLocationTopics({
      clientId: "plan-a",
      category: "Group Life",
      store: memory.store,
    });

    const beneficiaries = memory.topics.filter(
      (topic) => topic.slug === "sys.beneficiaries",
    );
    expect(beneficiaries).toHaveLength(1);

    // …and it is placed once per hub.
    const placements = memory.placements.filter(
      (placement) => placement.topicId === beneficiaries[0].id,
    );
    expect(placements.map((placement) => placement.location).sort()).toEqual([
      "group_life",
      "retirement",
    ]);
  });

  it("is idempotent — a second run creates nothing", async () => {
    const memory = createMemoryStore();

    await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });
    const counts = {
      topics: memory.topics.length,
      groups: memory.groups.length,
      placements: memory.placements.length,
    };

    const second = await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });

    expect(second.createdTopics).toBe(0);
    expect(second.createdGroups).toBe(0);
    expect(second.createdPlacements).toBe(0);
    expect(memory.topics).toHaveLength(counts.topics);
    expect(memory.groups).toHaveLength(counts.groups);
    expect(memory.placements).toHaveLength(counts.placements);
  });

  it("shares the library across plans but keeps placements separate", async () => {
    const memory = createMemoryStore();

    await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });
    const topicsAfterA = memory.topics.length;

    const planB = await seedLocationTopics({
      clientId: "plan-b",
      category: "Retirement",
      store: memory.store,
    });

    // The Topic library is global: plan B adds no topics, only its own placements.
    expect(planB.createdTopics).toBe(0);
    expect(memory.topics).toHaveLength(topicsAfterA);
    expect(memory.placements).toHaveLength(RETIREMENT_LIBRARY_COUNT * 2);
  });

  it("cannot leak a plan A change into plan B", async () => {
    const memory = createMemoryStore();

    await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });
    await seedLocationTopics({
      clientId: "plan-b",
      category: "Retirement",
      store: memory.store,
    });

    const planAPlacements = memory.placements.filter(
      (placement) => placement.clientId === "plan-a",
    );
    const planBPlacements = memory.placements.filter(
      (placement) => placement.clientId === "plan-b",
    );
    const planBTitleBefore = memory.topics.find(
      (topic) => topic.id === planBPlacements[0].topicId,
    )?.title;

    // Simulate the builder hiding and re-titling a plan A topic.
    planAPlacements[0].displayMode = "hidden";
    planAPlacements[0].overrides = { title: "Plan A only" };

    expect(planBPlacements[0].displayMode).toBe("featured");
    expect(planBPlacements[0].overrides).toBeNull();
    expect(
      memory.topics.find((topic) => topic.id === planBPlacements[0].topicId)
        ?.title,
    ).toBe(planBTitleBefore);
  });

  it("seeds nothing for a location with no defaults", async () => {
    const memory = createMemoryStore();

    const result = await seedLocationTopics({
      clientId: "plan-a",
      location: "employee_resources",
      store: memory.store,
    });

    expect(result.seeded).toBe(false);
    expect(memory.placements).toEqual([]);
  });

  it("seeds nothing without a plan id", async () => {
    const memory = createMemoryStore();

    const result = await seedLocationTopics({
      clientId: "   ",
      category: "Retirement",
      store: memory.store,
    });

    expect(result.seeded).toBe(false);
    expect(memory.placements).toEqual([]);
  });
});

describe("ensureLocationSeeded", () => {
  it("fills an empty location once", async () => {
    const memory = createMemoryStore();

    await ensureLocationSeeded({
      clientId: "plan-a",
      category: "Group Health",
      store: memory.store,
    });
    expect(memory.placements).toHaveLength(
      libraryTopicsForLocation("group_health").length,
    );

    await ensureLocationSeeded({
      clientId: "plan-a",
      category: "Group Health",
      store: memory.store,
    });
    expect(memory.placements).toHaveLength(
      libraryTopicsForLocation("group_health").length,
    );
  });

  it("does not re-add a topic the advisor removed", async () => {
    const memory = createMemoryStore();

    await ensureLocationSeeded({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });
    // The advisor deletes one placement.
    memory.placements.pop();

    await ensureLocationSeeded({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });

    // Existing placements are proof the location was seeded, so nothing comes back.
    expect(memory.placements).toHaveLength(RETIREMENT_LIBRARY_COUNT - 1);
  });

  it("never seeds a location it cannot resolve", async () => {
    const memory = createMemoryStore();

    const result = await ensureLocationSeeded({
      clientId: "plan-a",
      category: "Employee Resources",
      store: memory.store,
    });

    expect(result.seeded).toBe(false);
    expect(memory.placements).toEqual([]);
  });
});

describe("seedCustomStarterSet", () => {
  it("places only the suggested Custom topics", async () => {
    const memory = createMemoryStore();

    const result = await seedCustomStarterSet({
      clientId: "plan-a",
      setId: "voluntary",
      store: memory.store,
    });

    expect(result.location).toBe("custom");
    expect(result.createdPlacements).toBe(
      libraryTopicsForStarterSet("voluntary").length,
    );
    expect(
      memory.placements.every((placement) => placement.location === "custom"),
    ).toBe(true);
  });
});
