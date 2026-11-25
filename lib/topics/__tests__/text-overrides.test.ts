import { describe, expect, it } from "vitest";

import { readTopicBodyBlocks } from "@/lib/topics/effective-topic";
import {
  applyMediaToBodyBlocks,
  detachDocumentIdFromBodyBlocks,
  normalizeTopicDocuments,
  overridesFromTextValues,
  previewTopicFromValues,
  topicDocumentsOf,
  topicTextValuesOf,
} from "@/lib/topics/text-overrides";
import type { EffectiveTopic, TopicBodyBlock } from "@/types/topic";

/**
 * Documents that belong to ONE topic.
 *
 * The advisor can attach the benefit's own documents (ids resolved through the
 * plan's library) AND a document of the topic's own — a title + link stored on the
 * placement, so it never reaches the benefit's Documents & Forms list. These tests
 * pin the storage shape (a `topic_document` body block), that it survives the
 * server's block reader, and that a copy-only edit leaves it alone.
 */

function topic(overrides: Partial<EffectiveTopic> = {}): EffectiveTopic {
  return {
    topicId: "t-1",
    placementId: "p-1",
    slug: "sys.401k-loans",
    location: "retirement",
    displayMode: "featured",
    title: "Can I take a loan?",
    bodyBlocks: [{ type: "quick_answer", text: "Yes, within limits." }],
    tags: [],
    isActionHub: false,
    sortOrder: 0,
    ...overrides,
  };
}

describe("readTopicBodyBlocks — topic-only documents", () => {
  it("keeps a titled document with its link, trimmed", () => {
    expect(
      readTopicBodyBlocks([
        {
          type: "topic_document",
          title: "  Loan request form ",
          url: " /forms/loan.pdf ",
        },
      ]),
    ).toEqual([
      { type: "topic_document", title: "Loan request form", url: "/forms/loan.pdf" },
    ]);
  });

  it("drops a half-filled one — a title with no link is not a document", () => {
    expect(
      readTopicBodyBlocks([
        { type: "topic_document", title: "No link" },
        { type: "topic_document", url: "https://x.test/only-a-link" },
      ]),
    ).toEqual([]);
  });
});

describe("topicDocumentsOf", () => {
  it("lists the topic's own documents, not the plan's document ids", () => {
    const card = topic({
      bodyBlocks: [
        { type: "quick_answer", text: "Yes." },
        { type: "documents", documentIds: ["doc-1"] },
        {
          type: "topic_document",
          title: "Loan request form",
          url: "https://x.test/loan",
        },
      ],
    });

    expect(topicDocumentsOf(card)).toEqual([
      { title: "Loan request form", url: "https://x.test/loan" },
    ]);
    expect(topicTextValuesOf(card).documentIds).toEqual(["doc-1"]);
    expect(topicTextValuesOf(card).topicDocuments).toEqual([
      { title: "Loan request form", url: "https://x.test/loan" },
    ]);
  });
});

describe("overridesFromTextValues — topic-only documents", () => {
  it("writes them as their own blocks, keeping the answer", () => {
    const card = topic();

    const overrides = overridesFromTextValues(card, {
      ...topicTextValuesOf(card),
      topicDocuments: [{ title: " Loan request form ", url: "https://x.test/loan" }],
    });

    expect(overrides.bodyBlocks).toEqual([
      { type: "quick_answer", text: "Yes, within limits." },
      {
        type: "topic_document",
        title: "Loan request form",
        url: "https://x.test/loan",
      },
    ]);
  });

  it("leaves them untouched when a caller edits only the copy", () => {
    const card = topic({
      bodyBlocks: [
        { type: "quick_answer", text: "Yes." },
        {
          type: "topic_document",
          title: "Loan request form",
          url: "https://x.test/loan",
        },
      ],
    });

    // No media fields at all: this is the "copy only" caller.
    const overrides = overridesFromTextValues(card, {
      title: "Loans",
      summary: "",
      answer: "Yes.",
      steps: [],
    });

    expect(overrides.title).toBe("Loans");
    expect(overrides.bodyBlocks).toBeUndefined();
  });
});

describe("applyMediaToBodyBlocks", () => {
  it("keeps the media group ordered: shared documents, own documents, videos", () => {
    const blocks = applyMediaToBodyBlocks(
      [
        { type: "quick_answer", text: "Yes." },
        { type: "documents", documentIds: ["doc-1"] },
        { type: "topic_document", title: "Old form", url: "https://old.test" },
      ],
      {
        documentIds: ["doc-1"],
        topicDocuments: [{ title: "Loan request form", url: "https://x.test/loan" }],
        videoIds: ["video-1"],
      },
    );

    expect(blocks.map((block) => block.type)).toEqual([
      "quick_answer",
      "documents",
      "topic_document",
      "video",
    ]);
    expect(blocks[2]).toEqual({
      type: "topic_document",
      title: "Loan request form",
      url: "https://x.test/loan",
    });
  });
});

describe("previewTopicFromValues", () => {
  it("shows a topic-only document before anything is saved", () => {
    const card = topic();

    const preview = previewTopicFromValues(card, {
      ...topicTextValuesOf(card),
      topicDocuments: [{ title: "Loan request form", url: "https://x.test/loan" }],
    });

    expect(topicDocumentsOf(preview)).toEqual([
      { title: "Loan request form", url: "https://x.test/loan" },
    ]);
  });

  it("removes one that was taken off the list", () => {
    const card = topic({
      bodyBlocks: [
        { type: "quick_answer", text: "Yes." },
        { type: "topic_document", title: "Old form", url: "https://old.test" },
      ],
    });

    const preview = previewTopicFromValues(card, {
      ...topicTextValuesOf(card),
      topicDocuments: [],
    });

    expect(topicDocumentsOf(preview)).toEqual([]);
  });
});

describe("normalizeTopicDocuments", () => {
  it("trims, drops half-filled entries and de-duplicates", () => {
    expect(
      normalizeTopicDocuments([
        { title: " Form ", url: " https://x.test " },
        { title: "form", url: "https://x.test" },
        { title: "No link", url: " " },
      ]),
    ).toEqual([{ title: "Form", url: "https://x.test" }]);
  });
});

/**
 * Deleting a plan document must not leave a topic pointing at it. A topic stores
 * only ids, so the delete route detaches the id from every card that carried it.
 */
describe("detachDocumentIdFromBodyBlocks", () => {
  it("takes the id out of a block that holds others, keeping their order", () => {
    expect(
      detachDocumentIdFromBodyBlocks(
        [
          { type: "quick_answer", text: "Yes." },
          { type: "documents", documentIds: ["doc-1", "doc-2", "doc-3"] },
        ],
        "doc-2",
      ),
    ).toEqual([
      { type: "quick_answer", text: "Yes." },
      { type: "documents", documentIds: ["doc-1", "doc-3"] },
    ]);
  });

  it("drops the block when that id was the only one — never widens it to the whole category", () => {
    expect(
      detachDocumentIdFromBodyBlocks(
        [
          { type: "quick_answer", text: "Yes." },
          { type: "documents", documentIds: ["doc-1"] },
          { type: "video", videoId: "vid-1" },
        ],
        "doc-1",
      ),
    ).toEqual([
      { type: "quick_answer", text: "Yes." },
      { type: "video", videoId: "vid-1" },
    ]);
  });

  it("leaves an empty block alone — it names no document", () => {
    const blocks: TopicBodyBlock[] = [
      { type: "quick_answer", text: "Yes." },
      { type: "documents" },
    ];
    expect(detachDocumentIdFromBodyBlocks(blocks, "doc-1")).toEqual(blocks);
  });

  it("returns the same list when the id is not attached", () => {
    const blocks: TopicBodyBlock[] = [
      { type: "documents", documentIds: ["doc-1"] },
    ];
    expect(detachDocumentIdFromBodyBlocks(blocks, "doc-9")).toEqual(blocks);
  });
});
