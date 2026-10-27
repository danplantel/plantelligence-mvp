import { describe, expect, it } from "vitest";

import {
  countMatchedTopics,
  filterTopicGroups,
  flattenTopicGroups,
  groupNameMatches,
  matchesTopicQuery,
  normalizeTopicQuery,
} from "@/lib/topics/search";
import type { EffectiveTopic, TopicGroup } from "@/types/topic";

/**
 * TF-7 · hub search.
 *
 * The acceptance case is the first test: typing "loan" has to return the 401(k) loan
 * topic. The rest pin the rule the handoff states — title, quick answer and tags — and
 * the two behaviours that make the box feel right: a group-name match keeps the whole
 * group, and an empty query restores everything instead of emptying the list.
 */

function topic(overrides: Partial<EffectiveTopic> = {}): EffectiveTopic {
  return {
    topicId: "topic-1",
    placementId: "placement-1",
    slug: "sys.401k-loans",
    location: "retirement",
    displayMode: "quick_answers",
    title: "401(k) loans",
    bodyBlocks: [{ type: "quick_answer", text: "You borrow from your own balance." }],
    tags: ["loan"],
    isActionHub: false,
    groupId: "group-1",
    sortOrder: 0,
    ...overrides,
  };
}

function group(overrides: Partial<TopicGroup> = {}): TopicGroup {
  return {
    id: "group-1",
    name: "Taking Money Out",
    sortOrder: 0,
    topics: [topic()],
    ...overrides,
  };
}

describe("matchesTopicQuery", () => {
  it("finds the 401(k) loan topic when the reader types \"loan\"", () => {
    expect(matchesTopicQuery(topic(), "loan")).toBe(true);
  });

  it("matches the title, case-insensitively and ignoring surrounding space", () => {
    expect(matchesTopicQuery(topic(), "  401(K)  ")).toBe(true);
  });

  it("matches the quick answer text", () => {
    const answerOnly = topic({
      title: "Borrowing basics",
      tags: [],
      bodyBlocks: [{ type: "quick_answer", text: "Repay through payroll." }],
    });

    expect(matchesTopicQuery(answerOnly, "payroll")).toBe(true);
  });

  it("matches a tag that appears nowhere in the copy", () => {
    const tagged = topic({
      title: "Taking money early",
      bodyBlocks: [{ type: "quick_answer", text: "Some rules apply." }],
      tags: ["hardship", "loan"],
    });

    expect(matchesTopicQuery(tagged, "hardship")).toBe(true);
  });

  it("matches a step", () => {
    const stepped = topic({
      title: "Change your contribution rate",
      tags: [],
      bodyBlocks: [
        { type: "quick_answer", text: "It takes a minute." },
        { type: "steps", steps: ["Open the portal", "Choose a new percentage"] },
      ],
    });

    expect(matchesTopicQuery(stepped, "percentage")).toBe(true);
  });

  it("does not match unrelated copy", () => {
    expect(matchesTopicQuery(topic(), "beneficiary")).toBe(false);
  });

  it("matches everything when the query is empty", () => {
    expect(matchesTopicQuery(topic(), "")).toBe(true);
    expect(matchesTopicQuery(topic(), "   ")).toBe(true);
    expect(matchesTopicQuery(topic(), null)).toBe(true);
  });
});

describe("groupNameMatches", () => {
  it("matches the group's own name", () => {
    expect(groupNameMatches(group(), "taking money")).toBe(true);
  });

  it("matches every group when the query is empty", () => {
    expect(groupNameMatches(group(), "")).toBe(true);
  });
});

describe("filterTopicGroups", () => {
  const groups: TopicGroup[] = [
    group({
      id: "money",
      name: "Taking Money Out",
      sortOrder: 0,
      topics: [
        topic({ topicId: "loans", slug: "sys.401k-loans", title: "401(k) loans" }),
        topic({
          topicId: "hardship",
          slug: "sys.hardship",
          title: "Hardship withdrawals",
          tags: [],
          bodyBlocks: [{ type: "quick_answer", text: "For a heavy financial need." }],
        }),
      ],
    }),
    group({
      id: "saving",
      name: "Contributions & Saving",
      sortOrder: 1,
      topics: [
        topic({
          topicId: "match",
          slug: "sys.employer-match",
          title: "Employer match",
          tags: ["saving"],
          bodyBlocks: [{ type: "quick_answer", text: "Free money." }],
        }),
      ],
    }),
  ];

  it("keeps only the questions that match, and drops the groups left empty", () => {
    const filtered = filterTopicGroups(groups, "loan");

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("money");
    expect(filtered[0].topics.map((entry) => entry.topicId)).toEqual(["loans"]);
  });

  it("keeps a whole group when its NAME matches", () => {
    const filtered = filterTopicGroups(groups, "contributions");

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("saving");
    expect(filtered[0].topics).toHaveLength(1);
  });

  it("restores every group when the query is cleared", () => {
    expect(filterTopicGroups(groups, "").map((entry) => entry.id)).toEqual([
      "money",
      "saving",
    ]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterTopicGroups(groups, "pet insurance")).toEqual([]);
  });
});

describe("countMatchedTopics", () => {
  it("counts the questions the reader can still see", () => {
    const filtered = filterTopicGroups(
      [group(), group({ id: "other", name: "Other", topics: [] })],
      "loan",
    );

    expect(countMatchedTopics(filtered)).toBe(1);
  });

  it("is zero for an empty result", () => {
    expect(countMatchedTopics([])).toBe(0);
  });
});

describe("normalizeTopicQuery / flattenTopicGroups", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeTopicQuery("  ROTH  ")).toBe("roth");
    expect(normalizeTopicQuery(null)).toBe("");
  });

  it("flattens the section in group order", () => {
    const flattened = flattenTopicGroups([
      group({ id: "a", topics: [topic({ topicId: "1" })] }),
      group({ id: "b", topics: [topic({ topicId: "2" }), topic({ topicId: "3" })] }),
    ]);

    expect(flattened.map((entry) => entry.topicId)).toEqual(["1", "2", "3"]);
  });
});
