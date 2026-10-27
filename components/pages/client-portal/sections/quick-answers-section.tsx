"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import { readableColor } from "polished";
import { QUICK_ANSWERS_SECTION_ID } from "@/lib/portal-section-anchors";
import { portalRadiusValue } from "@/lib/typography-themes";
import { topicQuickAnswer } from "@/lib/topics/effective-topic";
import {
  buildTopicUrl,
  readHashTopicSlug,
  topicMatchesHash,
} from "@/lib/topics/deep-link";
import { resolveTopicHref } from "@/lib/topics/link-href";
import { cn } from "@/lib/utils";
import type { EffectiveTopic, TopicGroup } from "@/types/topic";

/**
 * "Get Quick Answers" — the second question area on a benefit hub (TF-2).
 *
 * The Featured cards above answer a handful of rich topics; this holds everything
 * else, as the handoff specifies: questions grouped by name, two columns on desktop,
 * with search on top. One answer is open at a time, and a topic lives here OR in
 * Featured — never both, because a placement has one display mode.
 *
 * COLOUR: the handoff calls the reference look a "navy accordion", but navy is only
 * what that demo's brand happens to be. Every surface here is driven by the plan's own
 * tokens — a question bar is `brandColor` filled with `readableColor(brandColor)` on
 * top, exactly like `components/faq-section.tsx`, and `secondaryColor` is used only
 * for the Action Hub note. Nothing is hard-coded.
 *
 * Layout contract:
 *  - `sm` and up: two columns, each a stack of groups. Answers expand in their column.
 *  - phone: the question list is one column and tapping a question opens a full-screen
 *    answer view with a back arrow (handoff: "a view within the page, not a new page").
 *    That view is a `pushState` entry, so the browser back button closes it.
 *
 * Content blocks: `quick_answer` and `steps` render here, and the placement CTA sits at
 * the foot of the answer. `documents`, `video` and `contact` blocks resolve in TF-10,
 * where the template schema lands; they are skipped rather than rendered as empty rows.
 */

export interface QuickAnswersSectionProps {
  groups: TopicGroup[];
  brandColor?: string;
  secondaryColor?: string;
  /** Portal base path, so an internal CTA stays inside this plan. */
  basePath?: string;
  className?: string;
}

/** Placeholder that says what the section is, above the search box. */
const SECTION_TITLE = "Get Quick Answers";
const SEARCH_PLACEHOLDER = "Search answers for this benefit";

/** Every topic in the section, in group order. */
function flattenGroups(groups: TopicGroup[]): EffectiveTopic[] {
  return groups.flatMap((group) => group.topics);
}

/** Does any field of this question match the query? */
function matchesQuery(topic: EffectiveTopic, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    topic.title,
    topic.summary || "",
    topicQuickAnswer(topic),
    ...topic.tags,
    ...topic.bodyBlocks.flatMap((block) =>
      block.type === "steps" ? block.steps : [],
    ),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** A group-name match keeps a whole group visible, which is how the search reads. */
function groupNameMatches(group: TopicGroup, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return group.name.toLowerCase().includes(needle);
}

/** A question's shape, shown as a small chip the way today's rich questions do. */
function topicChip(topic: EffectiveTopic): string | null {
  const steps = topic.bodyBlocks.find((block) => block.type === "steps");
  if (steps && steps.type === "steps") {
    return `${steps.steps.length} steps`;
  }
  return null;
}

/** The answer body: quick answer, then steps, then the placement CTA. */
function TopicAnswer({
  topic,
  brandColor,
  secondaryColor,
  basePath,
}: {
  topic: EffectiveTopic;
  brandColor: string;
  secondaryColor: string;
  basePath: string;
}) {
  const quickAnswer = topicQuickAnswer(topic);

  return (
    <div className="space-y-3">
      {quickAnswer && (
        <p className="font-red-hat text-[15px] leading-relaxed text-neutral-700 sm:text-base">
          {quickAnswer}
        </p>
      )}

      {topic.bodyBlocks.map((block, index) => {
        if (block.type !== "steps") return null;
        return (
          <ol
            key={`steps-${index}`}
            className="list-decimal space-y-1 pl-5 font-red-hat text-[15px] leading-relaxed text-neutral-700 marker:font-semibold"
          >
            {block.steps.map((step, stepIndex) => (
              <li key={stepIndex}>{step}</li>
            ))}
          </ol>
        );
      })}

      {topic.cta && (
        <div className="pt-1">
          <a
            href={resolveTopicHref(topic.cta.destination, basePath).href || "#"}
            {...(resolveTopicHref(topic.cta.destination, basePath).external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="inline-flex min-h-10 items-center justify-center px-5 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-opacity hover:opacity-90"
            style={{
              backgroundColor: brandColor,
              color: readableColor(brandColor),
              borderRadius: portalRadiusValue(),
            }}
          >
            {topic.cta.label}
          </a>
        </div>
      )}

      {topic.isActionHub && (
        <p
          className="font-red-hat text-[12px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: secondaryColor }}
        >
          Applies to more than one benefit
        </p>
      )}
    </div>
  );
}

export function QuickAnswersSection({
  groups,
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  basePath = "",
  className,
}: QuickAnswersSectionProps) {
  const [query, setQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  /** Phone-only answer view. Kept apart so the two layouts cannot fight. */
  const [mobileSlug, setMobileSlug] = useState<string | null>(null);

  const allTopics = useMemo(() => flattenGroups(groups), [groups]);

  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        topics: groupNameMatches(group, query)
          ? group.topics
          : group.topics.filter((topic) => matchesQuery(topic, query)),
      }))
      .filter((group) => group.topics.length > 0);
  }, [groups, query]);

  const visibleCount = filteredGroups.reduce(
    (total, group) => total + group.topics.length,
    0,
  );

  /** Two balanced columns on desktop; empty groups are already gone. */
  const columns = useMemo(() => {
    const left: TopicGroup[] = [];
    const right: TopicGroup[] = [];
    filteredGroups.forEach((group, index) => {
      (index % 2 === 0 ? left : right).push(group);
    });
    return [left, right];
  }, [filteredGroups]);

  const mobileTopic = allTopics.find((topic) => topic.slug === mobileSlug) ?? null;

  const isPhoneViewport = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 639px)").matches;

  // A deep link (`#401k-loans`) opens that answer on first paint.
  useEffect(() => {
    const fromHash = readHashTopicSlug(window.location.hash);
    if (!fromHash) return;
    const match = allTopics.find((topic) => topicMatchesHash(topic, fromHash));
    if (match) setOpenSlug(match.slug);
    // Only re-run when the answer set itself changes.
  }, [allTopics]);

  // Browser back closes the phone answer view (it was pushed, not replaced).
  useEffect(() => {
    const onPopState = () => {
      const state = (window.history.state || {}) as { topicSlug?: string };
      setMobileSlug(state.topicSlug ?? null);
      if (!state.topicSlug) setOpenSlug(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /** Put the open answer in the URL, so the link is shareable. */
  const syncHash = (slug: string | null) => {
    try {
      window.history.replaceState(
        window.history.state,
        "",
        buildTopicUrl(window.location.href, slug),
      );
    } catch {
      // History is unavailable (sandboxed frame); the panel still works.
    }
  };

  const toggleTopic = (topic: EffectiveTopic) => {
    if (isPhoneViewport()) {
      setMobileSlug(topic.slug);
      try {
        window.history.pushState(
          { topicSlug: topic.slug },
          "",
          buildTopicUrl(window.location.href, topic.slug),
        );
      } catch {
        /* see syncHash */
      }
      return;
    }

    const next = openSlug === topic.slug ? null : topic.slug;
    setOpenSlug(next);
    syncHash(next);
  };

  const closeMobile = () => {
    setMobileSlug(null);
    if ((window.history.state as { topicSlug?: string } | null)?.topicSlug) {
      window.history.back();
    }
  };

  const questionButton = (topic: EffectiveTopic) => {
    const isOpen = openSlug === topic.slug;
    const chip = topicChip(topic);

    return (
      <button
        key={topic.slug}
        type="button"
        aria-expanded={isOpen}
        aria-controls={`quick-answer-${topic.slug}`}
        onClick={() => toggleTopic(topic)}
        data-testid="quick-answer-question"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200 hover:opacity-90 sm:px-5"
        style={{
          backgroundColor: brandColor,
          color: readableColor(brandColor),
        }}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-red-hat text-[13px] font-semibold leading-snug sm:text-sm">
            {topic.title}
          </span>
          {chip && (
            <span
              className="rounded-full px-2 py-0.5 font-red-hat text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{
                backgroundColor: "rgba(255,255,255,0.18)",
                color: readableColor(brandColor),
              }}
            >
              {chip}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-300",
            isOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
    );
  };

  // A location with nothing visible renders nothing — no header, no search box.
  if (allTopics.length === 0) return null;

  return (
    <section
      id={QUICK_ANSWERS_SECTION_ID}
      className={cn(
        "w-full scroll-mt-24 bg-neutral-50 py-16 sm:scroll-mt-28 lg:py-20 lg:scroll-mt-32",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2
            className="font-dm-serif text-2xl leading-tight sm:text-3xl lg:text-4xl"
            style={{ color: brandColor }}
          >
            {SECTION_TITLE}
          </h2>
          <p className="mt-2 font-red-hat text-sm text-neutral-600 sm:text-base">
            Every other question about this benefit, grouped and searchable.
          </p>
        </div>

        <div className="mx-auto mb-6 max-w-2xl">
          <label className="relative block">
            <span className="sr-only">{SEARCH_PLACEHOLDER}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={SEARCH_PLACEHOLDER}
              data-testid="quick-answers-search"
              className="h-11 w-full border border-neutral-300 bg-white pl-9 pr-9 font-red-hat text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
              style={{ borderRadius: portalRadiusValue() }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear the search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </label>

          <p className="mt-2 text-center font-red-hat text-[12px] text-neutral-500">
            {visibleCount === 0
              ? "No answers match that search."
              : `${visibleCount} answer${visibleCount === 1 ? "" : "s"}`}
          </p>
        </div>

        {/* Two columns from `sm` up. The phone layout is the same list; tapping a
            question opens the full-screen view below. */}
        <div className="grid gap-6 md:grid-cols-2">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="space-y-6">
              {column.map((group) => (
                <div key={group.id}>
                  <h3
                    className="mb-2 font-red-hat text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500"
                  >
                    {group.name}
                  </h3>
                  <div className="space-y-2">
                    {group.topics.map((topic) => {
                      const isOpen = openSlug === topic.slug;
                      return (
                        <div
                          key={topic.slug}
                          id={`quick-answer-card-${topic.slug}`}
                          className="overflow-hidden border border-neutral-200 bg-white"
                          style={{ borderRadius: portalRadiusValue(1.5) }}
                        >
                          {questionButton(topic)}
                          {/* Desktop/tablet: the answer expands in its column. On a
                              phone it is hidden here and shown full-screen instead. */}
                          <div
                            id={`quick-answer-${topic.slug}`}
                            className="hidden md:block"
                          >
                            {isOpen && (
                              <div className="border-t border-neutral-200 px-4 py-3 sm:px-5">
                                <TopicAnswer
                                  topic={topic}
                                  brandColor={brandColor}
                                  secondaryColor={secondaryColor}
                                  basePath={basePath}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Phone answer view: a view within the page, with a back arrow. */}
      {mobileTopic && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-white md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={mobileTopic.title}
          data-testid="quick-answer-fullscreen"
        >
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
              backgroundColor: brandColor,
              color: readableColor(brandColor),
            }}
          >
            <button
              type="button"
              onClick={closeMobile}
              aria-label="Back to the question list"
              className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/15"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <p className="min-w-0 truncate font-red-hat text-sm font-semibold">
              {mobileTopic.title}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <TopicAnswer
              topic={mobileTopic}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              basePath={basePath}
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default QuickAnswersSection;
