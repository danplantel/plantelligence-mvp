import { describe, expect, it } from "vitest";
import {
  readTopicBodyBlocks,
  readTopicCta,
  readTopicOverrides,
  resolveEffectiveTopic,
  topicQuickAnswer,
} from "@/lib/topics/effective-topic";
import type { TopicPlacementRecord, TopicRecord } from "@/types/topic";

function topic(overrides: Partial<TopicRecord> = {}): TopicRecord {
  return {
    id: "topic-1",
    scope: "system",
    organizationId: null,
    slug: "sys.rollovers-distributions",
    title: "Rollovers & Distributions",
    summary: "Compare your options.",
    bodyBlocks: [
      { type: "quick_answer", text: "You have four options." },
      { type: "steps", steps: ["Ask for a direct rollover", " ", "Update beneficiaries"] },
    ],
    tags: ["rollover", " "],
    defaultLocations: ["retirement"],
    isActionHub: false,
    defaultCta: { label: "Talk through my options", actionType: "external_url" },
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

describe("resolveEffectiveTopic", () => {
  it("renders the topic as stored when a placement has no overrides", () => {
    const effective = resolveEffectiveTopic(topic(), placement());

    expect(effective.title).toBe("Rollovers & Distributions");
    expect(effective.summary).toBe("Compare your options.");
    expect(effective.cta).toEqual({
      label: "Talk through my options",
      actionType: "external_url",
    });
    expect(effective.displayMode).toBe("featured");
    expect(effective.location).toBe("retirement");
  });

  it("takes the placement's title, summary and location", () => {
    const effective = resolveEffectiveTopic(
      topic(),
      placement({
        location: "group_life",
        overrides: { title: "Your Old 401(k)", summary: "This plan's wording." },
      }),
    );

    expect(effective.title).toBe("Your Old 401(k)");
    expect(effective.summary).toBe("This plan's wording.");
    expect(effective.location).toBe("group_life");
  });

  it("inherits the default CTA when overrides do not mention one", () => {
    const effective = resolveEffectiveTopic(
      topic(),
      placement({ overrides: { summary: "Only the summary changed." } }),
    );

    expect(effective.cta?.label).toBe("Talk through my options");
  });

  it("removes the CTA when a placement sets it to null", () => {
    const effective = resolveEffectiveTopic(
      topic(),
      placement({ overrides: { cta: null } }),
    );

    expect(effective.cta).toBeUndefined();
  });

  it("replaces the body blocks when the placement supplies its own", () => {
    const effective = resolveEffectiveTopic(
      topic(),
      placement({
        overrides: { bodyBlocks: [{ type: "quick_answer", text: "Plan-specific." }] },
      }),
    );

    expect(effective.bodyBlocks).toHaveLength(1);
    expect(effective.bodyBlocks[0]).toEqual({
      type: "quick_answer",
      text: "Plan-specific.",
    });
  });

  it("carries the placement's group and order", () => {
    const effective = resolveEffectiveTopic(
      topic(),
      placement({ displayMode: "quick_answers", groupId: "group-1", sortOrder: 3 }),
    );

    expect(effective.displayMode).toBe("quick_answers");
    expect(effective.groupId).toBe("group-1");
    expect(effective.sortOrder).toBe(3);
  });

  it("never lets one plan's overrides reach another plan's record", () => {
    const shared = topic();
    const planA = resolveEffectiveTopic(
      shared,
      placement({ clientId: "plan-a", overrides: { title: "Plan A only" } }),
    );
    const planB = resolveEffectiveTopic(
      shared,
      placement({ id: "placement-2", clientId: "plan-b" }),
    );

    expect(planA.title).toBe("Plan A only");
    expect(planB.title).toBe("Rollovers & Distributions");
    // The shared Topic itself is untouched.
    expect(shared.title).toBe("Rollovers & Distributions");
  });
});

describe("readTopicBodyBlocks", () => {
  it("drops unknown types and empty content", () => {
    const blocks = readTopicBodyBlocks([
      { type: "quick_answer", text: "  " },
      { type: "quick_answer", text: "Kept." },
      { type: "steps", steps: [] },
      { type: "nonsense", text: "Ignored" },
      null,
      "string",
    ]);

    expect(blocks).toEqual([{ type: "quick_answer", text: "Kept." }]);
  });

  it("trims step text and removes blank steps", () => {
    const blocks = readTopicBodyBlocks([
      { type: "steps", steps: [" one ", "", "two"] },
    ]);

    expect(blocks).toEqual([{ type: "steps", steps: ["one", "two"] }]);
  });

  it("keeps an empty documents block — it means the whole category", () => {
    expect(readTopicBodyBlocks([{ type: "documents" }])).toEqual([
      { type: "documents" },
    ]);
  });

  it("returns nothing for a non-array value", () => {
    expect(readTopicBodyBlocks(null)).toEqual([]);
    expect(readTopicBodyBlocks({ type: "steps" })).toEqual([]);
  });
});

describe("readTopicCta", () => {
  it("accepts a complete CTA", () => {
    expect(
      readTopicCta({
        label: "Schedule",
        actionType: "external_url",
        destination: "https://example.com",
      }),
    ).toEqual({
      label: "Schedule",
      actionType: "external_url",
      destination: "https://example.com",
    });
  });

  it("rejects a CTA with no label or an unknown action type", () => {
    expect(readTopicCta({ label: "", actionType: "external_url" })).toBeUndefined();
    expect(readTopicCta({ label: "Go", actionType: "teleport" })).toBeUndefined();
    expect(readTopicCta(null)).toBeUndefined();
  });
});

describe("readTopicOverrides", () => {
  it("distinguishes an absent CTA from an explicit removal", () => {
    expect(readTopicOverrides({}).cta).toBeUndefined();
    expect(readTopicOverrides({ cta: null }).cta).toBeNull();
  });

  it("ignores values of the wrong type", () => {
    expect(readTopicOverrides("nope")).toEqual({});
    expect(readTopicOverrides({ title: 42, bodyBlocks: "nope" })).toEqual({});
  });
});

describe("topicQuickAnswer", () => {
  it("returns the first quick answer", () => {
    const effective = resolveEffectiveTopic(topic(), placement());
    expect(topicQuickAnswer(effective)).toBe("You have four options.");
  });

  it("returns an empty string when there is none", () => {
    const effective = resolveEffectiveTopic(
      topic({ bodyBlocks: [] }),
      placement(),
    );
    expect(topicQuickAnswer(effective)).toBe("");
  });
});
