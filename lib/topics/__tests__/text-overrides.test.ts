import { describe, expect, it } from "vitest";

import {
  buildBodyBlocksWithAnswer,
  overridesFromTextValues,
  topicTextValuesOf,
} from "@/lib/topics/text-overrides";
import type { EffectiveTopic } from "@/types/topic";

function topic(overrides: Partial<EffectiveTopic> = {}): EffectiveTopic {
  return {
    topicId: "topic-1",
    placementId: "pl-1",
    slug: "sys.401k-loans",
    location: "retirement",
    displayMode: "quick_answers",
    title: "Can I take a loan?",
    summary: "Borrow from your own balance.",
    bodyBlocks: [
      { type: "quick_answer", text: "You can borrow up to 50%." },
      { type: "steps", steps: ["Log in", "Choose Loan"] },
    ],
    tags: [],
    isActionHub: false,
    groupId: "g-1",
    sortOrder: 0,
    ...overrides,
  };
}

describe("topicTextValuesOf", () => {
  it("reads the title, card line and quick answer", () => {
    expect(topicTextValuesOf(topic())).toEqual({
      title: "Can I take a loan?",
      summary: "Borrow from your own balance.",
      answer: "You can borrow up to 50%.",
    });
  });

  it("treats a missing summary/answer as empty", () => {
    const values = topicTextValuesOf(
      topic({ summary: undefined, bodyBlocks: [] }),
    );
    expect(values.summary).toBe("");
    expect(values.answer).toBe("");
  });
});

describe("buildBodyBlocksWithAnswer", () => {
  it("replaces the quick answer and keeps the steps", () => {
    expect(
      buildBodyBlocksWithAnswer(topic().bodyBlocks, "Borrow up to 45%."),
    ).toEqual([
      { type: "quick_answer", text: "Borrow up to 45%." },
      { type: "steps", steps: ["Log in", "Choose Loan"] },
    ]);
  });

  it("prepends an answer when the topic has none", () => {
    expect(
      buildBodyBlocksWithAnswer(
        [{ type: "steps", steps: ["Log in"] }],
        "New answer",
      ),
    ).toEqual([
      { type: "quick_answer", text: "New answer" },
      { type: "steps", steps: ["Log in"] },
    ]);
  });

  it("removes the answer when the new answer is blank", () => {
    expect(buildBodyBlocksWithAnswer(topic().bodyBlocks, "   ")).toEqual([
      { type: "steps", steps: ["Log in", "Choose Loan"] },
    ]);
  });
});

describe("overridesFromTextValues", () => {
  it("sends nothing when the text is unchanged", () => {
    expect(
      overridesFromTextValues(topic(), topicTextValuesOf(topic())),
    ).toEqual({});
  });

  it("sends only the fields that changed", () => {
    const values = {
      ...topicTextValuesOf(topic()),
      title: "How much can I borrow?",
    };
    expect(overridesFromTextValues(topic(), values)).toEqual({
      title: "How much can I borrow?",
    });
  });

  it("sends null when a field is cleared, so it falls back to the shipped copy", () => {
    const values = {
      ...topicTextValuesOf(topic()),
      summary: "  ",
      answer: "",
    };
    const overrides = overridesFromTextValues(topic(), values);
    expect(overrides.summary).toBeNull();
    // Steps survive, so the answer override is the remaining block list.
    expect(overrides.bodyBlocks).toEqual([
      { type: "steps", steps: ["Log in", "Choose Loan"] },
    ]);
  });

  it("sends null bodyBlocks when the answer is cleared and no other blocks remain", () => {
    const values = { title: "Can I take a loan?", summary: "", answer: "" };
    const overrides = overridesFromTextValues(
      topic({ bodyBlocks: [{ type: "quick_answer", text: "Answer" }] }),
      values,
    );
    expect(overrides.bodyBlocks).toBeNull();
  });
});
