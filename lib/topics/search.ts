import { topicQuickAnswer } from "@/lib/topics/effective-topic";
import type { EffectiveTopic, TopicGroup } from "@/types/topic";

/**
 * Hub search (TF-7, handoff §5 "Search" / §17 TF-7).
 *
 * The rule is deliberately narrow: a query matches a topic's **title, quick answer and
 * tags** — plus its summary and its step text, because those are the same words a
 * participant would have read on the card or in the answer. Nothing else is searched:
 * no plan documents, no contacts, no cross-location results. Hub-wide search is Phase 2
 * and belongs with the Navigator (TF-12), which shares the entry box.
 *
 * Pure and shared on purpose. The Quick Answers section renders it today; TF-12 will
 * need the same matcher when the Ask box stops being decoration, and the acceptance
 * case ("typing 'loan' returns the 401(k) loan topic") is a unit test rather than a
 * click-through.
 */

/** Trim + lowercase, so "  Loan " and "loan" are one query. */
export function normalizeTopicQuery(query: string | null | undefined): string {
  return (query || "").trim().toLowerCase();
}

/** Every topic in the section, in group order. */
export function flattenTopicGroups(groups: readonly TopicGroup[]): EffectiveTopic[] {
  return groups.flatMap((group) => group.topics);
}

/**
 * Does this topic answer the query?
 *
 * An empty query matches everything, which is what makes search additive: clearing the
 * box restores the section rather than emptying it.
 */
export function matchesTopicQuery(
  topic: EffectiveTopic,
  query: string | null | undefined,
): boolean {
  const needle = normalizeTopicQuery(query);
  if (!needle) return true;

  const haystack = [
    topic.title,
    topic.summary || "",
    topicQuickAnswer(topic),
    ...topic.tags,
    // Step text is part of the answer a participant reads, so it is searchable too.
    ...topic.bodyBlocks.flatMap((block) =>
      block.type === "steps" ? block.steps : [],
    ),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

/**
 * A group-NAME match keeps every question in that group visible.
 *
 * That is how the list reads to a person: typing "Taking Money Out" should show the
 * group, not the questions that happen to contain those words.
 */
export function groupNameMatches(
  group: TopicGroup,
  query: string | null | undefined,
): boolean {
  const needle = normalizeTopicQuery(query);
  if (!needle) return true;
  return group.name.toLowerCase().includes(needle);
}

/** Groups filtered for the query, with the groups that end up empty dropped. */
export function filterTopicGroups(
  groups: readonly TopicGroup[],
  query: string | null | undefined,
): TopicGroup[] {
  return groups
    .map((group) => ({
      ...group,
      topics: groupNameMatches(group, query)
        ? group.topics
        : group.topics.filter((topic) => matchesTopicQuery(topic, query)),
    }))
    .filter((group) => group.topics.length > 0);
}

/** How many questions the filtered groups contain — the "N answers" line. */
export function countMatchedTopics(groups: readonly TopicGroup[]): number {
  return groups.reduce((total, group) => total + group.topics.length, 0);
}
