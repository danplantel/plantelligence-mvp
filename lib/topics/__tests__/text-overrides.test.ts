import { describe, expect, it } from "vitest";

import {
  applyStepsToBodyBlocks,
  buildBodyBlocksWithAnswer,
  overridesFromTextValues,
  previewTopicFromValues,
  replaceTopicInBoard,
  topicStepsOf,
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
  it("reads the title, card line, quick answer and steps", () => {
    expect(topicTextValuesOf(topic())).toEqual({
      title: "Can I take a loan?",
      summary: "Borrow from your own balance.",
      answer: "You can borrow up to 50%.",
      steps: ["Log in", "Choose Loan"],
    });
  });

  it("treats a missing summary/answer/steps as empty", () => {
    const values = topicTextValuesOf(
      topic({ summary: undefined, bodyBlocks: [] }),
    );
    expect(values.summary).toBe("");
    expect(values.answer).toBe("");
    expect(values.steps).toEqual([]);
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
    const values = {
      title: "Can I take a loan?",
      summary: "",
      answer: "",
      steps: [],
    };
    const overrides = overridesFromTextValues(
      topic({ bodyBlocks: [{ type: "quick_answer", text: "Answer" }] }),
      values,
    );
    expect(overrides.bodyBlocks).toBeNull();
  });
});

describe("steps", () => {
  it("reads the first steps block, trimmed, capped at four", () => {
    expect(
      topicStepsOf(
        topic({
          bodyBlocks: [
            { type: "steps", steps: [" One ", "Two", "", "Three", "Four", "Five"] },
          ],
        }),
      ),
    ).toEqual(["One", "Two", "Three", "Four"]);
  });

  it("adds a steps block when the topic has none", () => {
    expect(
      applyStepsToBodyBlocks(
        [{ type: "quick_answer", text: "Answer" }],
        ["First", "Second"],
      ),
    ).toEqual([
      { type: "quick_answer", text: "Answer" },
      { type: "steps", steps: ["First", "Second"] },
    ]);
  });

  it("clamps added steps to the maximum of four", () => {
    const blocks = applyStepsToBodyBlocks([], ["1", "2", "3", "4", "5"]);
    expect(blocks).toEqual([{ type: "steps", steps: ["1", "2", "3", "4"] }]);
  });

  it("removes the steps block when every step is cleared", () => {
    expect(
      applyStepsToBodyBlocks(
        [
          { type: "quick_answer", text: "Answer" },
          { type: "steps", steps: ["One"] },
        ],
        ["  ", ""],
      ),
    ).toEqual([{ type: "quick_answer", text: "Answer" }]);
  });

  it("writes a bodyBlocks override when only the steps change", () => {
    const values = {
      ...topicTextValuesOf(topic()),
      steps: ["Open the portal", "Pick a new rate", "Save"],
    };
    const overrides = overridesFromTextValues(topic(), values);

    expect(overrides.title).toBeUndefined();
    expect(overrides.summary).toBeUndefined();
    expect(overrides.bodyBlocks).toEqual([
      { type: "quick_answer", text: "You can borrow up to 50%." },
      { type: "steps", steps: ["Open the portal", "Pick a new rate", "Save"] },
    ]);
  });

  it("does not touch bodyBlocks when the steps are unchanged", () => {
    const overrides = overridesFromTextValues(topic(), topicTextValuesOf(topic()));
    expect(overrides.bodyBlocks).toBeUndefined();
  });
});

describe("previewTopicFromValues", () => {
  it("reflects the edited title, card line, answer and steps", () => {
    const preview = previewTopicFromValues(topic(), {
      title: "New title",
      summary: "New line",
      answer: "New answer",
      steps: ["A", "B"],
    });

    expect(preview.title).toBe("New title");
    expect(preview.summary).toBe("New line");
    expect(preview.bodyBlocks).toEqual([
      { type: "quick_answer", text: "New answer" },
      { type: "steps", steps: ["A", "B"] },
    ]);
  });

  it("shows an ADDED step immediately", () => {
    const preview = previewTopicFromValues(topic(), {
      ...topicTextValuesOf(topic()),
      steps: ["Log in", "Choose Loan", "Extra"],
    });
    expect(preview.bodyBlocks.find((block) => block.type === "steps")).toEqual({
      type: "steps",
      steps: ["Log in", "Choose Loan", "Extra"],
    });
  });

  it("shows a REMOVED step immediately", () => {
    const preview = previewTopicFromValues(topic(), {
      ...topicTextValuesOf(topic()),
      steps: ["Log in"],
    });
    expect(preview.bodyBlocks.find((block) => block.type === "steps")).toEqual({
      type: "steps",
      steps: ["Log in"],
    });
  });
});

describe("replaceTopicInBoard", () => {
  it("swaps the topic wherever it sits (featured and groups)", () => {
    const board = {
      featured: [topic()],
      hidden: [],
      groups: [
        { id: "g-1", name: "Loans", sortOrder: 0, topics: [topic()] },
      ],
    };
    const preview = previewTopicFromValues(topic(), {
      ...topicTextValuesOf(topic()),
      title: "Changed",
    });

    const next = replaceTopicInBoard(board, preview);

    expect(next.featured[0].title).toBe("Changed");
    expect(next.groups[0].topics[0].title).toBe("Changed");
  });
});
