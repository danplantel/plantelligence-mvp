import { describe, expect, it } from "vitest";
import { DEFAULT_QUICK_ANSWER_GROUPS } from "@/lib/topics/library";
import { planGroupRealignment } from "@/lib/topics/group-realign";
import type {
  AccordionGroupRecord,
  TopicPlacementRecord,
  TopicRecord,
} from "@/types/topic";

function group(id: string, name: string, sortOrder: number): AccordionGroupRecord {
  return { id, clientId: "plan-a", location: "retirement", name, sortOrder };
}

function topic(overrides: Partial<TopicRecord> = {}): TopicRecord {
  return {
    id: "topic-1",
    scope: "system",
    organizationId: null,
    slug: "sys.contribution-limits",
    title: "Contribution limits",
    summary: null,
    iconKey: null,
    imageKey: null,
    bodyBlocks: null,
    tags: [],
    defaultLocations: ["retirement"],
    isActionHub: false,
    defaultCta: null,
    status: "active",
    ...overrides,
  };
}

function placement(
  id: string,
  topicId: string,
  groupId: string | null,
  sortOrder = 0,
  displayMode: TopicPlacementRecord["displayMode"] = "quick_answers",
): TopicPlacementRecord {
  return {
    id,
    clientId: "plan-a",
    topicId,
    location: "retirement",
    displayMode,
    groupId,
    sortOrder,
    overrides: null,
    actionHubLink: null,
  };
}

describe("planGroupRealignment", () => {
  it("moves a legacy answer into the group the library ships it in", () => {
    const groups = [
      group("g-legacy", "Contributions & Saving", 0),
      group("g-save", "Saving & Contributions", 4),
    ];
    const topics = [
      topic({ id: "t-save", slug: "sys.how-much-should-i-save" }),
      topic({ id: "t-limit", slug: "sys.contribution-limits" }),
    ];
    const placements = [
      placement("p-save", "t-save", "g-legacy", 0),
      placement("p-limit", "t-limit", "g-save", 0),
    ];

    const plan = planGroupRealignment({
      location: "retirement",
      groups,
      placements,
      topics,
    });

    const moved = plan.placements.find((entry) => entry.placementId === "p-save");
    expect(moved).toMatchObject({
      groupId: "g-save",
      displayMode: "quick_answers",
    });
    // Library order decides the position: the older answer comes first.
    expect(moved?.sortOrder).toBe(0);
    expect(
      plan.placements.find((entry) => entry.placementId === "p-limit")?.sortOrder,
    ).toBe(1);
    expect(plan.emptiedGroups).toContain("g-legacy");
  });

  it("hides a topic the library retired and reports its emptied group", () => {
    const groups = [group("g-legacy", "Contributions & Saving", 0)];
    const topics = [topic({ id: "t-old", slug: "sys.employer-match" })];
    const placements = [placement("p-old", "t-old", "g-legacy", 0)];

    const plan = planGroupRealignment({
      location: "retirement",
      groups,
      placements,
      topics,
    });

    expect(plan.placements).toEqual([
      {
        placementId: "p-old",
        groupId: null,
        displayMode: "hidden",
        sortOrder: 0,
      },
    ]);
    expect(plan.emptiedGroups).toEqual(["g-legacy"]);
  });

  it("leaves an advisor-authored answer and its group alone", () => {
    const groups = [group("g-mine", "Our Questions", 0)];
    const topics = [
      topic({
        id: "t-org",
        scope: "org",
        organizationId: "org-1",
        slug: "org.org-1.faq",
      }),
    ];
    const placements = [placement("p-org", "t-org", "g-mine", 0)];

    const plan = planGroupRealignment({
      location: "retirement",
      groups,
      placements,
      topics,
    });

    expect(plan.placements).toEqual([]);
    expect(plan.emptiedGroups).toEqual([]);
  });

  it("never touches a placement that is not an answer", () => {
    const groups = [group("g-save", "Saving & Contributions", 0)];
    const topics = [topic({ id: "t-featured", slug: "sys.enroll-change-contributions" })];
    const placements = [
      placement("p-featured", "t-featured", null, 0, "featured"),
    ];

    const plan = planGroupRealignment({
      location: "retirement",
      groups,
      placements,
      topics,
    });

    expect(plan.placements).toEqual([]);
    expect(plan.emptiedGroups).toEqual([]);
  });

  it("adopts an answer an older revision shipped as a feature card", () => {
    const groups = [group("g-leaving", "Leaving / Retirement", 4)];
    const topics = [
      topic({ id: "t-ss", slug: "sys.social-security", title: "Social Security" }),
    ];
    const placements = [placement("p-ss", "t-ss", null, 0, "featured")];

    const plan = planGroupRealignment({
      location: "retirement",
      groups,
      placements,
      topics,
    });

    expect(plan.placements).toEqual([
      {
        placementId: "p-ss",
        groupId: "g-leaving",
        displayMode: "quick_answers",
        sortOrder: 0,
      },
    ]);
  });

  it("never undoes an advisor's hide", () => {
    const groups = [group("g-leaving", "Leaving / Retirement", 4)];
    const topics = [topic({ id: "t-ss", slug: "sys.social-security" })];
    const placements = [placement("p-ss", "t-ss", null, 0, "hidden")];

    const plan = planGroupRealignment({
      location: "retirement",
      groups,
      placements,
      topics,
    });

    expect(plan.placements).toEqual([]);
    expect(plan.emptiedGroups).toEqual([]);
  });

  it("puts the canonical groups into the documented order", () => {
    const canonical = DEFAULT_QUICK_ANSWER_GROUPS.retirement ?? [];
    const groups = canonical.map((name, index) => group(`g-${index}`, name, index + 4));
    const topics = [topic({ id: "t-save", slug: "sys.how-much-should-i-save" })];
    const placements = [placement("p-save", "t-save", "g-0", 0)];

    const plan = planGroupRealignment({
      location: "retirement",
      groups,
      placements,
      topics,
    });

    expect(plan.groupOrders).toEqual(
      canonical.map((_, index) => ({ id: `g-${index}`, sortOrder: index })),
    );
  });

  it("merges a duplicate canonical group into the older row", () => {
    const groups = [
      group("g-old", "Saving & Contributions", 0),
      group("g-new", "Saving & Contributions", 4),
    ];
    const topics = [topic({ id: "t-limit", slug: "sys.contribution-limits" })];
    const placements = [placement("p-limit", "t-limit", "g-new", 0)];

    const plan = planGroupRealignment({
      location: "retirement",
      groups,
      placements,
      topics,
    });

    expect(plan.placements).toEqual([
      {
        placementId: "p-limit",
        groupId: "g-old",
        displayMode: "quick_answers",
        sortOrder: 0,
      },
    ]);
    expect(plan.emptiedGroups).toEqual(["g-new"]);
  });

  it("is a no-op for a plan that already matches the library", () => {
    const groups = [group("g-save", "Saving & Contributions", 0)];
    const topics = [topic({ id: "t-limit", slug: "sys.contribution-limits" })];
    const placements = [placement("p-limit", "t-limit", "g-save", 0)];

    const plan = planGroupRealignment({
      location: "retirement",
      groups,
      placements,
      topics,
    });

    expect(plan.placements).toEqual([]);
    expect(plan.groupOrders).toEqual([]);
    expect(plan.emptiedGroups).toEqual([]);
  });
});
