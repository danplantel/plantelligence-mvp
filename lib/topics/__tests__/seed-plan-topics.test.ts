import { describe, expect, it, vi } from "vitest";
import {
  ensureLocationSeeded,
  seedCustomStarterSet,
  seedLocationTopics,
  syncNewLibraryTopics,
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
        bodyBlocks: input.bodyBlocks ?? null,
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

  it("puts the five visible featured topics in card order", async () => {
    const memory = createMemoryStore();

    await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });

    const featured = memory.placements
      .filter((placement) => placement.displayMode === "featured")
      .sort((a, b) => a.sortOrder - b.sortOrder);

    expect(featured.map((placement) => placement.sortOrder)).toEqual([
      0, 1, 2, 3, 4,
    ]);

    // Employer Match & Vesting is gated on the plan's match setting, so it is
    // seeded hidden instead of taking a featured slot.
    const matchTopic = memory.topics.find(
      (topic) => topic.slug === "sys.employer-match-vesting",
    );
    const matchPlacement = memory.placements.find(
      (placement) => placement.topicId === matchTopic?.id,
    );
    expect(matchPlacement?.displayMode).toBe("hidden");
  });

  it("seeds the featured card line and the answer blocks as separate copy", async () => {
    const memory = createMemoryStore();

    await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });

    const enroll = memory.topics.find(
      (topic) => topic.slug === "sys.enroll-change-contributions",
    );
    expect(enroll?.title).toBe("Enroll / Change My Contributions");
    // The card line is the summary; the panel's answer is a body block.
    expect(enroll?.summary).toBe(
      "Enroll in your plan or adjust how much you're saving.",
    );
    const blocks = enroll?.bodyBlocks as
      | { type: string; text?: string; steps?: string[] }[]
      | undefined;
    expect(blocks?.[0]?.type).toBe("quick_answer");
    expect(blocks?.[0]?.text).toContain("Once you're eligible");
    expect(blocks?.[1]?.type).toBe("steps");
    expect(blocks?.[1]?.steps).toHaveLength(5);
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

  it("seeds the Employee Resources hub's own defaults (TF-6)", async () => {
    const memory = createMemoryStore();

    const result = await seedLocationTopics({
      clientId: "plan-a",
      location: "employee_resources",
      store: memory.store,
    });

    expect(result.seeded).toBe(true);
    expect(result.location).toBe("employee_resources");
    // Four groups from the handoff's §8 builder example.
    expect(result.createdGroups).toBe(4);
    // Four Featured cards plus fifteen Quick Answers.
    expect(result.createdPlacements).toBe(19);
    // Every placement belongs to this plan and this location — never a benefit hub.
    expect(
      memory.placements.every(
        (placement: any) =>
          placement.clientId === "plan-a" &&
          placement.location === "employee_resources",
      ),
    ).toBe(true);
    // The two ↔ topics HR actually acts on.
    expect(
      memory.topics
        .filter((topic: any) => topic.isActionHub)
        .map((topic: any) => topic.title)
        .sort(),
    ).toEqual(["Change My Address", "Change my name"]);
  });

  it("seeds nothing when handed no seeds at all", async () => {
    const memory = createMemoryStore();

    const result = await seedLocationTopics({
      clientId: "plan-a",
      location: "custom",
      seeds: [],
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

describe("syncNewLibraryTopics", () => {
  it("adds topics the library gained after the plan was seeded", async () => {
    const memory = createMemoryStore();
    // A partial seed stands in for a plan seeded before the content pass: it has
    // a featured card and one answer, and lacks the rest of the library.
    const oldSeeds = libraryTopicsForLocation("retirement").filter(
      (seed) =>
        seed.slug === "enroll-change-contributions" ||
        seed.slug === "how-much-should-i-save",
    );
    await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      seeds: oldSeeds,
      store: memory.store,
    });

    const before = memory.topics.length;
    const result = await syncNewLibraryTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });

    expect(result.createdTopics).toBe(
      libraryTopicsForLocation("retirement").length - oldSeeds.length,
    );
    expect(memory.topics.length).toBeGreaterThan(before);

    const contributionLimits = memory.topics.find(
      (topic) => topic.slug === "sys.contribution-limits",
    );
    expect(contributionLimits).toBeDefined();
    const placement = memory.placements.find(
      (row) => row.topicId === contributionLimits?.id,
    );
    expect(placement?.displayMode).toBe("quick_answers");

    // Running again changes nothing.
    const again = await syncNewLibraryTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });
    expect(again.createdTopics).toBe(0);
    expect(again.createdPlacements).toBe(0);
  });

  it("places a shared Topic row this plan never received", async () => {
    const memory = createMemoryStore();
    // Plan B was seeded before the content pass: it holds placements, but none of
    // the answers the pass added.
    const oldSeeds = libraryTopicsForLocation("retirement").filter(
      (seed) =>
        seed.slug !== "contribution-limits" && seed.slug !== "auto-escalation",
    );
    await seedLocationTopics({
      clientId: "plan-b",
      category: "Retirement",
      seeds: oldSeeds,
      store: memory.store,
    });
    // Plan A seeds after the pass, so it creates the shared Topic rows.
    await seedLocationTopics({
      clientId: "plan-a",
      category: "Retirement",
      store: memory.store,
    });

    const sharedRow = memory.topics.find(
      (topic) => topic.slug === "sys.contribution-limits",
    );
    expect(sharedRow).toBeDefined();
    expect(
      memory.placements.some(
        (row) => row.clientId === "plan-b" && row.topicId === sharedRow?.id,
      ),
    ).toBe(false);

    const topicCountBefore = memory.topics.length;
    const result = await syncNewLibraryTopics({
      clientId: "plan-b",
      category: "Retirement",
      store: memory.store,
    });

    // The row already exists, so only the missing placement is written — a row
    // check would wrongly report "up to date" and leave the answer invisible.
    expect(result.createdTopics).toBe(0);
    expect(result.createdPlacements).toBeGreaterThan(0);
    expect(memory.topics.length).toBe(topicCountBefore);

    const placement = memory.placements.find(
      (row) => row.clientId === "plan-b" && row.topicId === sharedRow?.id,
    );
    expect(placement?.displayMode).toBe("quick_answers");
    const group = memory.groups.find((row) => row.id === placement?.groupId);
    expect(group?.name).toBe("Saving & Contributions");
    expect(group?.clientId).toBe("plan-b");

    // Plan A keeps exactly its own placement for the shared row.
    expect(
      memory.placements.filter(
        (row) => row.clientId === "plan-a" && row.topicId === sharedRow?.id,
      ),
    ).toHaveLength(1);
  });

  it("never touches a legacy plan with no placements", async () => {
    const memory = createMemoryStore();

    const result = await syncNewLibraryTopics({
      clientId: "legacy-plan",
      category: "Retirement",
      store: memory.store,
    });

    expect(result.seeded).toBe(false);
    expect(memory.topics).toHaveLength(0);
    expect(memory.placements).toHaveLength(0);
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
