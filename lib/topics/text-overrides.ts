import { topicQuickAnswer } from "@/lib/topics/effective-topic";
import type {
  EffectiveTopic,
  TopicBodyBlock,
  TopicDocumentLink,
  TopicPlacementOverrides,
} from "@/types/topic";

/**
 * Editing one card's text for THIS plan.
 *
 * The Featured cards and the Quick Answers questions are the same placement board, so
 * a text change is written as the placement's `overrides` (see
 * `lib/topics/effective-topic.ts`): the shared Topic row is never touched, so one
 * plan's wording can never change another's. The editable copy is the title, the short
 * card line (`summary`), the expanded answer (the `quick_answer` block), and the
 * numbered STEPS that sit under the answer ("Financial Planning" ships three).
 */
export interface TopicTextValues {
  title: string;
  summary: string;
  answer: string;
  /** The how-to steps under the answer, in order. */
  steps: string[];
  /**
   * The plan-document ids attached to this topic. Optional so a caller that only
   * edits copy (and never touches media) leaves the existing attachments alone.
   */
  documentIds?: string[];
  /** The plan-video ids attached to this topic. Optional for the same reason. */
  videoIds?: string[];
  /**
   * Documents that belong to THIS topic only — a title + link stored on the
   * placement, never on the plan's library, so they stay off the benefit's
   * Documents & Forms list. Optional for the same reason as the ids above.
   */
  topicDocuments?: TopicDocumentLink[];
}

/** A card's steps can never exceed this many. */
export const MAX_TOPIC_STEPS = 4;

/**
 * How much copy each field holds.
 *
 * These are the lengths the CARD can actually show, not arbitrary caps: a title
 * is one line on a tile, the card line is the two-line teaser under it, a step is
 * one short instruction, and the answer is the block a participant reads in the
 * open panel. The editor shows a counter beside each field so an advisor never
 * discovers the limit by having text silently clipped by the layout.
 */
export const MAX_TOPIC_TITLE_LENGTH = 60;
/** The two-line teaser printed on the tile. */
export const MAX_TOPIC_SUMMARY_LENGTH = 140;
/** The expanded answer in the open panel (a paragraph, not an essay). */
export const MAX_TOPIC_ANSWER_LENGTH = 700;
/** One numbered how-to step — a single instruction. */
export const MAX_TOPIC_STEP_LENGTH = 120;

/**
 * The overrides payload the `PATCH /topics` endpoint reads. A `null` field means
 * "remove this override" (fall back to the shipped copy); an absent field is left
 * untouched.
 */
export interface TopicTextOverrides {
  title?: string | null;
  summary?: string | null;
  bodyBlocks?: TopicBodyBlock[] | null;
}

/** The steps a topic currently shows (from its FIRST steps block). */
export function topicStepsOf(topic: EffectiveTopic): string[] {
  const block = topic.bodyBlocks.find((candidate) => candidate.type === "steps");
  if (!block || block.type !== "steps") return [];
  return block.steps
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, MAX_TOPIC_STEPS);
}

/** Trim, drop half-filled entries and de-duplicate a topic's own documents. */
export function normalizeTopicDocuments(
  documents: TopicDocumentLink[],
): TopicDocumentLink[] {
  const seen = new Set<string>();
  const clean: TopicDocumentLink[] = [];
  for (const entry of documents) {
    const title = (entry?.title || "").trim();
    const url = (entry?.url || "").trim();
    if (!title || !url) continue;
    const key = `${title.toLowerCase()}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ title, url });
  }
  return clean;
}

/**
 * Every document that belongs to this topic ONLY, in block order.
 *
 * These are not plan-library documents: they are the ones an advisor typed into
 * the Edit Topic dialog, so they render inside this card and nowhere else.
 */
export function topicDocumentsOf(topic: EffectiveTopic): TopicDocumentLink[] {
  const documents: TopicDocumentLink[] = [];
  for (const block of topic.bodyBlocks) {
    if (block.type !== "topic_document") continue;
    documents.push({ title: block.title, url: block.url });
  }
  return documents;
}

/** Every plan-document id this topic attaches, in block order, de-duplicated. */
export function topicDocumentIdsOf(topic: EffectiveTopic): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const block of topic.bodyBlocks) {
    if (block.type !== "documents") continue;
    for (const raw of block.documentIds ?? []) {
      const id = raw.trim();
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** Every plan-video id this topic attaches, in block order, de-duplicated. */
export function topicVideoIdsOf(topic: EffectiveTopic): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const block of topic.bodyBlocks) {
    if (block.type !== "video" || !block.videoId) continue;
    const id = block.videoId.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** The card's CURRENT copy, as the editor pre-fills it. */
export function topicTextValuesOf(topic: EffectiveTopic): TopicTextValues {
  return {
    title: topic.title,
    summary: (topic.summary ?? "").trim(),
    answer: topicQuickAnswer(topic),
    steps: topicStepsOf(topic),
    documentIds: topicDocumentIdsOf(topic),
    videoIds: topicVideoIdsOf(topic),
    topicDocuments: topicDocumentsOf(topic),
  };
}

/**
 * Build the topic as it WOULD read with these values — the live-preview shape the
 * page beside the panel renders. Used while the card editor is open, so adding or
 * removing a step shows instantly, before anything is saved.
 */
export function previewTopicFromValues(
  topic: EffectiveTopic,
  values: TopicTextValues,
): EffectiveTopic {
  const answer = values.answer.trim();
  const steps = values.steps
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, MAX_TOPIC_STEPS);
  const withAnswer = answer
    ? buildBodyBlocksWithAnswer(topic.bodyBlocks, answer)
    : topic.bodyBlocks.filter((block) => block.type !== "quick_answer");
  let bodyBlocks = applyStepsToBodyBlocks(withAnswer, steps);
  if (
    values.documentIds !== undefined ||
    values.videoIds !== undefined ||
    values.topicDocuments !== undefined
  ) {
    bodyBlocks = applyMediaToBodyBlocks(bodyBlocks, {
      documentIds: values.documentIds ?? topicDocumentIdsOf(topic),
      videoIds: values.videoIds ?? topicVideoIdsOf(topic),
      topicDocuments: values.topicDocuments ?? topicDocumentsOf(topic),
    });
  }
  const summary = values.summary.trim();
  return {
    ...topic,
    title: values.title.trim() || topic.title,
    summary: summary || undefined,
    bodyBlocks,
  };
}

/** The board shape a preview swaps one topic into (the Quick Answers board). */
interface TopicBoardLike {
  featured: EffectiveTopic[];
  hidden: EffectiveTopic[];
  groups: {
    id: string;
    name: string;
    sortOrder: number;
    topics: EffectiveTopic[];
  }[];
}

/** Return `board` with one topic replaced (by `topicId`) wherever it sits. */
export function replaceTopicInBoard<T extends TopicBoardLike>(
  board: T,
  topic: EffectiveTopic,
): T {
  const swap = (list: EffectiveTopic[]) =>
    list.map((entry) => (entry.topicId === topic.topicId ? topic : entry));
  return {
    ...board,
    featured: swap(board.featured),
    hidden: swap(board.hidden),
    groups: board.groups.map((group) => ({
      ...group,
      topics: swap(group.topics),
    })),
  };
}

/**
 * Replace the FIRST `quick_answer` block with `answer`, leaving every other block
 * (steps, resources, CTA) in place. An empty answer removes the quick answer.
 */
export function buildBodyBlocksWithAnswer(
  blocks: TopicBodyBlock[],
  answer: string,
): TopicBodyBlock[] {
  const trimmed = answer.trim();
  const index = blocks.findIndex((block) => block.type === "quick_answer");
  if (!trimmed) {
    return blocks.filter((block) => block.type !== "quick_answer");
  }
  const answerBlock: TopicBodyBlock = { type: "quick_answer", text: trimmed };
  if (index < 0) return [answerBlock, ...blocks];
  return [...blocks.slice(0, index), answerBlock, ...blocks.slice(index + 1)];
}

/**
 * Remove one plan-document id from a topic's blocks.
 *
 * A topic stores only ids, so a document the advisor deletes from the plan's
 * library would otherwise leave every card that attached it pointing at nothing:
 * the Edit Topic dialog could only call it "no longer in the library" and the
 * portal would drop it. The delete route uses this to detach the id at the
 * source, so the two never disagree.
 *
 * A `documents` block that held ONLY that id is dropped (an empty block means
 * "every document for this category", which would be a different promise); a
 * block with other ids keeps them, in order.
 */
export function detachDocumentIdFromBodyBlocks(
  blocks: TopicBodyBlock[],
  documentId: string,
): TopicBodyBlock[] {
  const target = documentId.trim();
  if (!target) return blocks;
  const result: TopicBodyBlock[] = [];
  for (const block of blocks) {
    if (block.type !== "documents") {
      result.push(block);
      continue;
    }
    // No ids at all is the "whole category" block — it names no document, so a
    // deleted id cannot be in it.
    if (!block.documentIds || block.documentIds.length === 0) {
      result.push(block);
      continue;
    }
    const remaining = block.documentIds.filter((id) => id.trim() !== target);
    if (remaining.length === block.documentIds.length) {
      result.push(block);
      continue;
    }
    if (remaining.length > 0) {
      result.push({ type: "documents", documentIds: remaining });
    }
  }
  return result;
}

/**
 * Replace the steps block with `steps` (clamped to {@link MAX_TOPIC_STEPS}). An empty
 * list removes the steps block; a topic with no steps block gains one at the end.
 */
export function applyStepsToBodyBlocks(
  blocks: TopicBodyBlock[],
  steps: string[],
): TopicBodyBlock[] {
  const clean = steps
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, MAX_TOPIC_STEPS);
  const index = blocks.findIndex((block) => block.type === "steps");
  if (clean.length === 0) {
    return blocks.filter((block) => block.type !== "steps");
  }
  const stepBlock: TopicBodyBlock = { type: "steps", steps: clean };
  if (index < 0) return [...blocks, stepBlock];
  return [...blocks.slice(0, index), stepBlock, ...blocks.slice(index + 1)];
}

/**
 * Replace the topic's media with the given plan documents, topic-only documents
 * and plan videos, keeping every other block (answer, steps, CTA) in place.
 *
 * The block list keeps its shape: the new media blocks take the slot of the OLD
 * media blocks, or are appended when the topic had none. Within the group the
 * order is plan documents → topic-only documents → videos, so a participant reads
 * the benefit's shared documents first. One `topic_document` / `video` block per
 * entry, because each carries a single document / id.
 */
export function applyMediaToBodyBlocks(
  blocks: TopicBodyBlock[],
  media: {
    documentIds?: string[];
    videoIds?: string[];
    topicDocuments?: TopicDocumentLink[];
  },
): TopicBodyBlock[] {
  const documentIds = [
    ...new Set((media.documentIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ];
  const videoIds = [
    ...new Set((media.videoIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ];
  const topicDocuments = normalizeTopicDocuments(media.topicDocuments ?? []);

  const mediaBlocks: TopicBodyBlock[] = [];
  if (documentIds.length > 0) {
    mediaBlocks.push({ type: "documents", documentIds });
  }
  for (const document of topicDocuments) {
    mediaBlocks.push({
      type: "topic_document",
      title: document.title,
      url: document.url,
    });
  }
  for (const videoId of videoIds) {
    mediaBlocks.push({ type: "video", videoId });
  }

  const result: TopicBodyBlock[] = [];
  let inserted = false;
  for (const block of blocks) {
    if (
      block.type === "documents" ||
      block.type === "topic_document" ||
      block.type === "video"
    ) {
      if (!inserted) {
        result.push(...mediaBlocks);
        inserted = true;
      }
      continue;
    }
    result.push(block);
  }
  if (!inserted) result.push(...mediaBlocks);
  return result;
}

/**
 * The overrides to send for an edit — only the fields that actually changed, so
 * saving the title never freezes the answer against a later library copy pass.
 *
 * A cleared field is sent as `null`, which the endpoint reads as "remove the
 * override" (fall back to the shipped copy) rather than "show nothing".
 */
export function overridesFromTextValues(
  topic: EffectiveTopic,
  values: TopicTextValues,
): TopicTextOverrides {
  const original = topicTextValuesOf(topic);
  const overrides: TopicTextOverrides = {};

  const nextTitle = values.title.trim();
  if (nextTitle !== original.title.trim()) {
    overrides.title = nextTitle || null;
  }

  const nextSummary = values.summary.trim();
  if (nextSummary !== original.summary.trim()) {
    overrides.summary = nextSummary || null;
  }

  const nextAnswer = values.answer.trim();
  const answerChanged = nextAnswer !== original.answer.trim();
  const nextSteps = values.steps
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, MAX_TOPIC_STEPS);
  const stepsChanged =
    JSON.stringify(nextSteps) !== JSON.stringify(original.steps);

  // Media is edited in the same dialog; only touch it when the caller supplied it.
  const mediaProvided =
    values.documentIds !== undefined ||
    values.videoIds !== undefined ||
    values.topicDocuments !== undefined;
  const nextDocumentIds = values.documentIds ?? topicDocumentIdsOf(topic);
  const nextVideoIds = values.videoIds ?? topicVideoIdsOf(topic);
  const nextTopicDocuments = normalizeTopicDocuments(
    values.topicDocuments ?? topicDocumentsOf(topic),
  );
  const mediaChanged =
    mediaProvided &&
    (JSON.stringify(nextDocumentIds) !==
      JSON.stringify(topicDocumentIdsOf(topic)) ||
      JSON.stringify(nextVideoIds) !== JSON.stringify(topicVideoIdsOf(topic)) ||
      JSON.stringify(nextTopicDocuments) !==
        JSON.stringify(topicDocumentsOf(topic)));

  // The answer, steps and media all live in the same bodyBlocks array, so any of
  // them changing rewrites the block list (preserving whatever else is there — CTA,
  // resources). Steps are re-applied so the list stays ordered answer → steps → media.
  if (answerChanged || stepsChanged || mediaChanged) {
    const withAnswer = answerChanged
      ? buildBodyBlocksWithAnswer(topic.bodyBlocks, nextAnswer)
      : topic.bodyBlocks;
    let nextBlocks = applyStepsToBodyBlocks(withAnswer, nextSteps);
    if (mediaProvided) {
      nextBlocks = applyMediaToBodyBlocks(nextBlocks, {
        documentIds: nextDocumentIds,
        videoIds: nextVideoIds,
        topicDocuments: nextTopicDocuments,
      });
    }
    overrides.bodyBlocks = nextBlocks.length > 0 ? nextBlocks : null;
  }

  return overrides;
}

/** True when an edit would change nothing. */
export function isTextUnchanged(
  topic: EffectiveTopic,
  values: TopicTextValues,
): boolean {
  return Object.keys(overridesFromTextValues(topic, values)).length === 0;
}

/** Re-exported for callers that want the raw stored-override shape. */
export type { TopicPlacementOverrides };
