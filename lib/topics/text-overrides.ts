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
 * plan's wording can never change another's. Three fields are editable — the title,
 * the short card line (`summary`), and the expanded answer (the `quick_answer` block,
 * with any steps / links around it preserved).
 */
export interface TopicTextValues {
  title: string;
  summary: string;
  answer: string;
}

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

/** The card's CURRENT copy, as the editor pre-fills it. */
export function topicTextValuesOf(topic: EffectiveTopic): TopicTextValues {
  return {
    title: topic.title,
    summary: (topic.summary ?? "").trim(),
    answer: topicQuickAnswer(topic),
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
  if (nextAnswer !== original.answer.trim()) {
    const blocks = buildBodyBlocksWithAnswer(topic.bodyBlocks, nextAnswer);
    overrides.bodyBlocks = blocks.length > 0 ? blocks : null;
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
