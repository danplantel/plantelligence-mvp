import { beforeEach, describe, expect, it, vi } from "vitest";

// `assistant.server` reads through the shared Prisma client (directly and via
// `resolve-location`), so both reads are stubbed here. Nothing else is constructed.
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
  prisma: {
    topicPlacement: { findMany: db.placements },
    accordionGroup: { findMany: db.groups },
  },
}));

import { loadPlanAssistantTopics } from "@/lib/topics/assistant.server";

/**
 * The assistant's plan read (M2).
 *
 * Three rules are pinned here:
 *
 *  1. One pair of queries serves every published location.
 *  2. A hub the plan switched off (or hid in portal settings) is never read, so the
 *     assistant cannot claim the plan customized a page nobody can visit.
 *  3. Hidden placements come back as slugs only — the client needs them to keep the
 *     shipped library's copy of that topic out of the corpus.
 */

function topicRow(slug: string, title = slug) {
  return {
    id: `t-${slug}`,
    scope: "system",
    organizationId: null,
    slug: `sys.${slug}`,
    title,
    summary: null,
    iconKey: null,
    imageKey: null,
    bodyBlocks: [],
    tags: [],
    defaultLocations: ["retirement"],
    isActionHub: false,
    defaultCta: null,
    status: "active",
  };
}

function placementRow(input: {
  id: string;
  slug: string;
  location?: string;
  displayMode?: "featured" | "quick_answers" | "hidden";
  groupId?: string | null;
  sortOrder?: number;
  title?: string;
}) {
  return {
    id: input.id,
    clientId: "plan-1",
    topicId: `t-${input.slug}`,
    location: input.location ?? "retirement",
    displayMode: input.displayMode ?? "quick_answers",
    groupId: input.groupId ?? null,
    sortOrder: input.sortOrder ?? 0,
    overrides: null,
    actionHubLink: null,
    topic: topicRow(input.slug, input.title),
  };
}

const retirementOnly = {
  benefitHubs: [{ category: "Retirement", isEnabled: true }],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.placements.mockResolvedValue([]);
  db.groups.mockResolvedValue([]);
});

describe("loadPlanAssistantTopics", () => {
  it("returns Featured cards and grouped questions for a published hub", async () => {
    db.groups.mockResolvedValue([
      {
        id: "g-1",
        clientId: "plan-1",
        location: "retirement",
        name: "Loans & Withdrawals",
        sortOrder: 0,
      },
    ]);
    db.placements.mockResolvedValue([
      placementRow({
        id: "p-1",
        slug: "enroll-change-contributions",
        displayMode: "featured",
        sortOrder: 0,
      }),
      placementRow({
        id: "p-2",
        slug: "401k-loans",
        groupId: "g-1",
        sortOrder: 1,
      }),
    ]);

    const result = await loadPlanAssistantTopics({
      clientId: "plan-1",
      ...retirementOnly,
    });

    expect(result.topics.map((topic) => topic.slug)).toEqual([
      "sys.enroll-change-contributions",
      "sys.401k-loans",
    ]);
    expect(result.topics[0].displayMode).toBe("featured");
    expect(result.topics[1].displayMode).toBe("quick_answers");
    expect(result.topics[1].group).toBe("Loans & Withdrawals");
  });

  it("reads the shipped library copy for a system placement", async () => {
    db.placements.mockResolvedValue([
      placementRow({
        id: "p-1",
        slug: "401k-loans",
        displayMode: "featured",
        title: "Stale title stored on the row",
      }),
    ]);

    const result = await loadPlanAssistantTopics({
      clientId: "plan-1",
      ...retirementOnly,
    });

    // `resolveEffectiveTopic` treats the library as the source of truth for a
    // system topic, so a content pass reaches the assistant without a re-seed.
    expect(result.topics[0].title).toBe("Can I take a loan?");
    expect(result.topics[0].bodyBlocks?.length).toBeGreaterThan(0);
  });

  it("reads only the hubs the plan publishes", async () => {
    await loadPlanAssistantTopics({
      clientId: "plan-1",
      benefitHubs: [
        { category: "Retirement", isEnabled: true },
        { category: "Group Health", isEnabled: false },
      ],
    });

    expect(db.placements).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: "plan-1", location: { in: ["retirement"] } },
      }),
    );
    expect(db.groups).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: "plan-1", location: { in: ["retirement"] } },
      }),
    );
  });

  it("honours portal visibility and reads nothing when every hub is hidden", async () => {
    const result = await loadPlanAssistantTopics({
      clientId: "plan-1",
      categoryPortalVisibility: {
        Retirement: false,
        "Group Health": false,
        "Group Life": false,
        Other: false,
      },
      benefitHubs: [
        { category: "Retirement", isEnabled: true },
        { category: "Group Health", isEnabled: true },
        { category: "Group Life", isEnabled: true },
        { category: "Company / Plan Sponsor", isEnabled: true },
      ],
    });

    expect(result).toEqual({ topics: [], hiddenSlugs: [] });
    expect(db.placements).not.toHaveBeenCalled();
    expect(db.groups).not.toHaveBeenCalled();
  });

  it("adds Employee Resources only when the plan enabled it", async () => {
    db.placements.mockResolvedValue([
      placementRow({
        id: "p-1",
        slug: "pay-stubs-direct-deposit",
        location: "employee_resources",
        displayMode: "featured",
      }),
    ]);

    const result = await loadPlanAssistantTopics({
      clientId: "plan-1",
      benefitHubs: [],
      employeeResourcesEnabled: true,
    });

    expect(result.topics.map((topic) => topic.location)).toEqual([
      "employee_resources",
    ]);
    expect(db.placements).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId: "plan-1",
          location: { in: ["employee_resources"] },
        },
      }),
    );
  });

  it("reports hidden slugs without returning their content", async () => {
    db.placements.mockResolvedValue([
      placementRow({
        id: "p-1",
        slug: "employer-match-vesting",
        displayMode: "hidden",
      }),
      placementRow({
        id: "p-2",
        slug: "401k-loans",
        displayMode: "featured",
      }),
    ]);

    const result = await loadPlanAssistantTopics({
      clientId: "plan-1",
      ...retirementOnly,
    });

    expect(result.hiddenSlugs).toEqual(["sys.employer-match-vesting"]);
    expect(result.topics.map((topic) => topic.slug)).toEqual(["sys.401k-loans"]);
  });

  it("returns nothing, and reads nothing, without a client id", async () => {
    const result = await loadPlanAssistantTopics({
      clientId: "  ",
      ...retirementOnly,
    });

    expect(result).toEqual({ topics: [], hiddenSlugs: [] });
    expect(db.placements).not.toHaveBeenCalled();
  });
});
