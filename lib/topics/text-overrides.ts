import { topicQuickAnswer } from "@/lib/topics/effective-topic";
import type {
  EffectiveTopic,
  TopicBodyBlock,
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
}

/** A card's steps can never exceed this many. */
export const MAX_TOPIC_STEPS = 4;

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

/** The card's CURRENT copy, as the editor pre-fills it. */
export function topicTextValuesOf(topic: EffectiveTopic): TopicTextValues {
  return {
    title: topic.title,
    summary: (topic.summary ?? "").trim(),
    answer: topicQuickAnswer(topic),
    steps: topicStepsOf(topic),
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
  const bodyBlocks = applyStepsToBodyBlocks(withAnswer, steps);
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

  // The answer and the steps live in the same bodyBlocks array, so either edit
  // rewrites the block list (preserving whatever else is there — resources, CTA).
  if (answerChanged || stepsChanged) {
    const withAnswer = answerChanged
      ? buildBodyBlocksWithAnswer(topic.bodyBlocks, nextAnswer)
      : topic.bodyBlocks;
    const nextBlocks = applyStepsToBodyBlocks(withAnswer, nextSteps);
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
