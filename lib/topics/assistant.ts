import {
  CUSTOM_BENEFIT_CATEGORY,
  customBenefitRouteSlug,
  customBenefitTitleFromHubs,
} from "@/lib/benefit-custom-name";
import { fillHelpCardTokens } from "@/lib/help-card-defaults";
import {
  isCategoryVisibleInPortal,
  type CategoryPortalVisibility,
} from "@/lib/portal-category-visibility";
import {
  TOPIC_LOCATION_LABELS,
  topicLocationForCategory,
} from "@/lib/topic-locations";
import { topicHashSlug } from "@/lib/topics/deep-link";
import {
  libraryTopicBySlug,
  libraryTopicsForLocation,
} from "@/lib/topics/library";
import type {
  TopicBodyBlock,
  TopicCta,
  TopicDisplayMode,
  TopicLocation,
} from "@/types/topic";

/**
 * The portal assistant's brain (TF-12 successor, deterministic).
 *
 * The sheet in `portal-chatbot.tsx` used to append what the visitor typed and stop
 * there. This module turns a question into a grounded reply:
 *
 *  - **Corpus.** Every topic in the shipped library (`lib/topics/library`), for every
 *    location, overlaid with the plan's own placements. A placement wins for copy,
 *    tags and CTA because it is already `resolveEffectiveTopic` output; a topic the
 *    advisor hid is dropped entirely; an org-authored topic the library does not
 *    carry is added.
 *  - **Retrieval.** Ranked keyword scoring over title, tags, group, summary, quick
 *    answer, steps and location label, with a small synonym map ("401k" → retirement,
 *    "PT0" → time off, "COBRA" stays COBRA). No network, no model: the same question
 *    always scores the same way, which is what makes it testable.
 *  - **Navigation.** Answers carry the deep link to the topic on the plan's hub, the
 *    topic's own CTA, and the hub itself. Explicit navigation questions ("where do I
 *    log in", "take me to my life insurance page") resolve to hub / login links even
 *    when no topic matches. Contact questions hand off to the advisor's booking link
 *    or the plan's benefits team.
 *
 * Pure on purpose: it takes plain records, returns plain replies, and never imports
 * Prisma. `assistant.server.ts` is the reader that assembles the placements for one
 * plan; the chatbot component is the renderer.
 */

/**
 * The window event the landing page's Ask bar dispatches to hand a question to the
 * assistant. It lives here so the hero and the sheet share one spelling without
 * importing each other.
 */
export const ASSISTANT_ASK_EVENT = "portal-chatbot:ask";

// ── Corpus ───────────────────────────────────────────────────────────────────

/** One placement as the assistant reads it: already resolved against the library. */
export interface AssistantPlacement {
  /** Stored slug, possibly namespaced (`sys.401k-loans`). */
  slug: string;
  location: TopicLocation;
  title: string;
  summary?: string | null;
  bodyBlocks?: TopicBodyBlock[];
  tags?: string[];
  /** The Quick Answers group name, when the placement sits in one. */
  group?: string | null;
  displayMode: TopicDisplayMode;
  isActionHub?: boolean;
  cta?: TopicCta;
}

/**
 * One entry in the assistant's corpus. `slug` is the PUBLISHED slug (no `sys.`) —
 * the form that appears in a deep link.
 */
export interface AssistantTopic {
  slug: string;
  /** The stored slug, kept for `#fragment` construction. */
  storedSlug: string;
  location: TopicLocation;
  /** "Retirement", "Group Health", or the advisor's own Custom hub name. */
  locationLabel: string;
  title: string;
  summary?: string;
  quickAnswer: string;
  steps: string[];
  tags: string[];
  group?: string;
  cta?: TopicCta;
  displayMode: "featured" | "quick_answers";
  /** True when THIS plan places the topic — only then is a deep link safe. */
  isPlaced: boolean;
  isActionHub: boolean;
}

export type AssistantField =
  | "title"
  | "tags"
  | "group"
  | "summary"
  | "answer"
  | "steps"
  | "location";

interface SearchFields {
  tokens: Record<AssistantField, Set<string>>;
  titleTokens: string;
  normalized: {
    title: string;
    tags: string;
    answer: string;
    group: string;
  };
}

export interface AssistantIndex {
  topics: AssistantTopic[];
  /** Precomputed vocabulary, keyed by `location:slug`. */
  fields: Record<string, SearchFields>;
}

export interface AssistantCorpusInput {
  placed?: readonly AssistantPlacement[];
  /** Stored or published slugs the advisor hid. Never answered, never linked. */
  hiddenSlugs?: readonly string[];
  /** The advisor's own name for the Custom hub, for labels and vocabulary. */
  customHubTitle?: string | null;
}

const LOCATION_ORDER: readonly TopicLocation[] = [
  "retirement",
  "group_health",
  "group_life",
  "custom",
  "employee_resources",
];

/** `sys.401k-loans` → `401k-loans`. */
function publishedSlug(slug: string | null | undefined): string {
  return (slug || "").trim().replace(/^sys\./, "");
}

function trimmed(value: string | null | undefined): string {
  return (value || "").trim();
}

function quickAnswerOf(blocks: readonly TopicBodyBlock[]): string {
  const block = blocks.find(
    (candidate): candidate is { type: "quick_answer"; text: string } =>
      candidate.type === "quick_answer",
  );
  return block?.text ?? "";
}

function stepsOf(blocks: readonly TopicBodyBlock[]): string[] {
  return blocks.flatMap((block) => (block.type === "steps" ? block.steps : []));
}

function locationLabel(
  location: TopicLocation,
  customHubTitle?: string | null,
): string {
  if (location === "custom") {
    const title = trimmed(customHubTitle);
    return title || "Other benefits";
  }
  return TOPIC_LOCATION_LABELS[location];
}

function fromPlacement(
  placement: AssistantPlacement,
  customHubTitle: string | null | undefined,
): AssistantTopic {
  const blocks = placement.bodyBlocks ?? [];
  return {
    slug: publishedSlug(placement.slug),
    storedSlug: trimmed(placement.slug),
    location: placement.location,
    locationLabel: locationLabel(placement.location, customHubTitle),
    title: placement.title,
    ...(trimmed(placement.summary) ? { summary: trimmed(placement.summary) } : {}),
    quickAnswer: quickAnswerOf(blocks),
    steps: stepsOf(blocks),
    tags: [...(placement.tags ?? [])],
    ...(trimmed(placement.group) ? { group: trimmed(placement.group) } : {}),
    ...(placement.cta ? { cta: placement.cta } : {}),
    displayMode: placement.displayMode === "featured" ? "featured" : "quick_answers",
    isPlaced: true,
    isActionHub: placement.isActionHub === true,
  };
}

/**
 * Build the searchable corpus.
 *
 * Library entries come first, in location order, so two plans that seed nothing
 * still produce the same list. Placements override their slug, and org topics are
 * appended after the library's own entries.
 */
export function buildAssistantCorpus({
  placed = [],
  hiddenSlugs = [],
  customHubTitle,
}: AssistantCorpusInput = {}): AssistantIndex {
  const hidden = new Set(Array.from(hiddenSlugs, (slug) => publishedSlug(slug)));
  const placementByKey = new Map<string, AssistantPlacement>();
  for (const placement of placed) {
    if (placement.displayMode === "hidden") continue;
    placementByKey.set(
      `${placement.location}:${publishedSlug(placement.slug)}`,
      placement,
    );
  }

  const topics: AssistantTopic[] = [];
  const seen = new Set<string>();
  const add = (topic: AssistantTopic) => {
    const key = `${topic.location}:${topic.slug}`;
    if (seen.has(key)) return;
    seen.add(key);
    topics.push(topic);
  };

  for (const location of LOCATION_ORDER) {
    for (const seed of libraryTopicsForLocation(location)) {
      if (hidden.has(seed.slug)) continue;
      const placement = placementByKey.get(`${location}:${seed.slug}`);
      if (placement) {
        add(fromPlacement(placement, customHubTitle));
        continue;
      }
      // A topic the library gates behind a plan setting is not an answer until the
      // plan actually places it — silence beats telling everyone they have a match.
      if (seed.displayByDefault === "hidden") continue;
      add({
        slug: seed.slug,
        storedSlug: seed.slug,
        location,
        locationLabel: locationLabel(location, customHubTitle),
        title: seed.title,
        ...(trimmed(seed.summary) ? { summary: trimmed(seed.summary) } : {}),
        quickAnswer: quickAnswerOf(seed.bodyBlocks ?? []),
        steps: stepsOf(seed.bodyBlocks ?? []),
        tags: [...(seed.tags ?? [])],
        ...(seed.group ? { group: seed.group } : {}),
        ...(seed.cta ? { cta: seed.cta } : {}),
        displayMode: seed.displayByDefault === "featured" ? "featured" : "quick_answers",
        isPlaced: false,
        isActionHub: seed.isActionHub === true,
      });
    }
  }

  // Topics the library does not carry: an advisor's own, or a library entry that
  // was retired after this plan had already placed it.
  for (const placement of placed) {
    if (placement.displayMode === "hidden") continue;
    const slug = publishedSlug(placement.slug);
    if (hidden.has(slug) || libraryTopicBySlug(slug)) continue;
    add(fromPlacement(placement, customHubTitle));
  }

  const fields: Record<string, SearchFields> = {};
  for (const topic of topics) {
    fields[`${topic.location}:${topic.slug}`] = indexTopic(topic);
  }
  return { topics, fields };
}

// ── Vocabulary ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "about", "after", "again", "all", "also", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "between", "both", "but",
  "by", "can", "could", "did", "definition", "do", "does", "doing", "don", "don't",
  "each", "explain", "few", "find", "for", "from", "get", "gets", "getting", "give",
  "gives", "go", "got", "had", "has", "have", "having", "he", "her", "here", "hers",
  "him", "his", "how", "i", "if", "im", "in", "into", "is", "it", "its", "just",
  "know", "like", "many", "may", "me", "mean", "meaning", "means", "might", "more",
  "most", "much", "must", "my", "need", "no", "not", "of", "on", "once", "only",
  "open", "or", "other", "our", "out", "over", "own", "please", "same", "see", "she",
  "should", "so", "some", "stand", "stands", "such", "tell", "than", "that", "the",
  "their", "them", "then", "there", "these", "they", "this", "those", "through",
  "to", "too", "under", "until", "up", "us", "very", "want", "was", "we", "were",
  "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with",
  "would", "you", "your",
]);

/**
 * Query-side synonyms, keyed by the stemmed word the visitor typed. Values are
 * already-stemmed canonical tokens. The corpus is never expanded: a topic matches
 * when its own words include the canonical token, so "medical" reaches a topic that
 * says "health" but not the other way round.
 */
const SYNONYMS: Record<string, string[]> = {
  // Retirement
  "401k": ["retirement"],
  "403b": ["retirement"],
  "457": ["retirement"],
  pension: ["retirement"],
  ira: ["retirement"],
  // Health
  medical: ["health"],
  doctor: ["health"],
  copay: ["health"],
  deductible: ["health"],
  claim: ["health"],
  prescription: ["health"],
  pharmacy: ["health"],
  network: ["health"],
  telehealth: ["health"],
  dental: ["health"],
  vision: ["health"],
  // Life
  death: ["life"],
  disability: ["life"],
  std: ["life"],
  ltd: ["life"],
  supplemental: ["life"],
  // Employee Resources
  pto: ["time", "off"],
  vacation: ["time", "off"],
  sick: ["time", "off"],
  holiday: ["time", "off"],
  leave: ["time", "off"],
  fmla: ["time", "off"],
  payroll: ["pay"],
  paycheck: ["pay"],
  w2: ["pay"],
  stub: ["pay"],
  handbook: ["employee", "resources"],
  // Portal account
  log: ["login"],
  sign: ["login"],
  account: ["login"],
  access: ["login"],
  // Contact
  human: ["contact"],
  someone: ["contact"],
  representative: ["contact"],
  advisor: ["contact"],
  adviser: ["contact"],
  // Loan language
  repaid: ["repay"],
  repaying: ["repay"],
  payoff: ["repay"],
};

/** `401(k)` → `401k`, `W-2` → `w2`, before punctuation is flattened. */
function preNormalize(text: string): string {
  return (text || "")
    .replace(/\b(401|403|457)\s*\(\s*([bk])\s*\)/gi, "$1$2")
    .replace(/\bw\s*-\s*2\b/gi, "w2");
}

/** Lower-case words with punctuation flattened. */
export function tokenize(text: string): string[] {
  return preNormalize(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** A deliberately small stemmer: plurals, then `-ing` / `-ed`. */
function stem(token: string): string {
  let value = token;
  if (value.endsWith("'s")) value = value.slice(0, -2);
  if (value.length > 5 && value.endsWith("ing")) value = value.slice(0, -3);
  else if (value.length > 4 && value.endsWith("ed")) value = value.slice(0, -2);
  else if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) {
    value = value.slice(0, -1);
  }
  return value;
}

/** Meaningful, stemmed query words — the phrase used for exact-ish matches. */
export function meaningfulTokens(question: string): string[] {
  const out: string[] = [];
  for (const raw of tokenize(question)) {
    if (STOP_WORDS.has(raw)) continue;
    const value = stem(raw);
    if (value.length < 2 || STOP_WORDS.has(value)) continue;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

/** Meaningful words plus their synonyms — what actually scores a topic. */
export function queryTokens(question: string): string[] {
  const out: string[] = [];
  const push = (value: string) => {
    if (value && !out.includes(value)) out.push(value);
  };
  for (const token of meaningfulTokens(question)) {
    push(token);
    for (const synonym of SYNONYMS[token] ?? []) push(synonym);
  }
  return out;
}

function tokenSet(text: string): Set<string> {
  const set = new Set<string>();
  for (const raw of tokenize(text)) {
    if (STOP_WORDS.has(raw)) continue;
    const value = stem(raw);
    if (value.length >= 2) set.add(value);
  }
  return set;
}

function normalizeText(text: string): string {
  return tokenize(text).join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word phrase match, so "pay" cannot match inside "repayment". */
function includesPhrase(haystack: string, phrase: string): boolean {
  if (!haystack || !phrase) return false;
  return new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(phrase)}([^a-z0-9]|$)`,
  ).test(haystack);
}

function indexTopic(topic: AssistantTopic): SearchFields {
  const title = normalizeText(topic.title);
  const tags = normalizeText(topic.tags.join(" "));
  const group = normalizeText(topic.group || "");
  const summary = normalizeText(topic.summary || "");
  const answer = normalizeText(topic.quickAnswer);
  const steps = normalizeText(topic.steps.join(" "));
  const location = normalizeText(
    `${topic.locationLabel} ${topic.location.replace(/_/g, " ")}`,
  );

  return {
    tokens: {
      title: tokenSet(topic.title),
      tags: tokenSet(topic.tags.join(" ")),
      group: tokenSet(topic.group || ""),
      summary: tokenSet(topic.summary || ""),
      answer: tokenSet(topic.quickAnswer),
      steps: tokenSet(topic.steps.join(" ")),
      location: tokenSet(
        `${topic.locationLabel} ${topic.location.replace(/_/g, " ")}`,
      ),
    },
    titleTokens: Array.from(tokenSet(topic.title)).sort().join("|"),
    normalized: { title, tags, answer, group },
  };
}

// ── Ranking ──────────────────────────────────────────────────────────────────

const FIELD_WEIGHTS: Record<AssistantField, number> = {
  title: 10,
  tags: 8,
  group: 6,
  summary: 4,
  answer: 3,
  steps: 2,
  location: 2,
};

const TITLE_WEIGHT = FIELD_WEIGHTS.title;

const MIN_CONFIDENT_SCORE = 55;
const MIN_SUGGEST_SCORE = 20;
const CONFIDENT_MARGIN = 15;

export interface AssistantMatch {
  topic: AssistantTopic;
  score: number;
}

export interface AssistantSearchResult {
  matches: AssistantMatch[];
  confident: boolean;
}

/** A title with four words or fewer is fully specific; longer ones dilute per word. */
const TITLE_SPECIFICITY_WORDS = 4;

function fieldWeight(
  fields: SearchFields,
  field: AssistantField,
): number {
  if (field !== "title") return FIELD_WEIGHTS[field];
  const factor = Math.min(
    1,
    TITLE_SPECIFICITY_WORDS / Math.max(TITLE_SPECIFICITY_WORDS, fields.tokens.title.size),
  );
  return FIELD_WEIGHTS.title * factor;
}

/** Highest field weight that contains the token, 0 when no field does. */
function bestFieldWeight(fields: SearchFields, token: string): number {
  let best = 0;
  for (const field of Object.keys(FIELD_WEIGHTS) as AssistantField[]) {
    if (fields.tokens[field].has(token)) {
      best = Math.max(best, fieldWeight(fields, field));
    }
  }
  return best;
}

/** Placed first, then Featured, then canonical location order, then title. */
function compareMatches(a: AssistantMatch, b: AssistantMatch): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.topic.isPlaced !== b.topic.isPlaced) return a.topic.isPlaced ? -1 : 1;
  if (a.topic.displayMode !== b.topic.displayMode) {
    return a.topic.displayMode === "featured" ? -1 : 1;
  }
  const locationDifference =
    LOCATION_ORDER.indexOf(a.topic.location) -
    LOCATION_ORDER.indexOf(b.topic.location);
  if (locationDifference !== 0) return locationDifference;
  return a.topic.title.localeCompare(b.topic.title);
}

/**
 * Rank the corpus against a question.
 *
 * `score` is the weighted field sum normalised against the best possible score for
 * that query (every word in the title), so a two-word title hit reads as 100 no
 * matter how many words were typed. Phrase bonuses can push a topic above 100 —
 * that is intentional: an exact title (or a tag phrase such as "pay stub") should
 * beat a scattered multi-word hit.
 */
export function searchAssistantTopics(
  index: AssistantIndex,
  question: string,
  limit = 3,
): AssistantSearchResult {
  const tokens = queryTokens(question);
  if (tokens.length === 0) return { matches: [], confident: false };

  const meaningful = meaningfulTokens(question);
  const phrase = meaningful.join(" ");
  const maxPossible = tokens.length * TITLE_WEIGHT;
  const results: AssistantMatch[] = [];

  for (const topic of index.topics) {
    const fields = index.fields[`${topic.location}:${topic.slug}`];
    if (!fields) continue;

    let raw = 0;
    let matched = 0;
    for (const token of tokens) {
      const weight = bestFieldWeight(fields, token);
      if (weight > 0) {
        raw += weight;
        matched += 1;
      }
    }
    if (matched === 0) continue;

    if (phrase) {
      if (fields.normalized.title === phrase) raw += 40;
      else if (includesPhrase(fields.normalized.title, phrase)) {
        // The same phrase is stronger evidence in a short title. "…on my pay stub?"
        // is a long question; "PTO policy" is the topic's name.
        const titleLength = Math.max(fields.tokens.title.size, 1);
        raw += Math.max(15, Math.round((25 * meaningful.length) / titleLength));
      } else if (includesPhrase(fields.normalized.tags, phrase)) raw += 15;
      else if (includesPhrase(fields.normalized.answer, phrase)) raw += 8;
    }

    results.push({
      topic,
      score: Math.round((raw / maxPossible) * 100),
    });
  }

  results.sort(compareMatches);

  const top = results[0];
  if (!top) return { matches: [], confident: false };

  // A near-tie is usually the same intent written twice ("Update My Beneficiary"
  // on Retirement and Group Life), so competition is measured against the best
  // DIFFERENT title rather than against a duplicate.
  const competitor = results.find(
    (match) =>
      match !== top &&
      index.fields[`${match.topic.location}:${match.topic.slug}`]?.titleTokens !==
        index.fields[`${top.topic.location}:${top.topic.slug}`]?.titleTokens,
  );

  const confident =
    top.score >= MIN_CONFIDENT_SCORE &&
    (!competitor || top.score >= competitor.score + CONFIDENT_MARGIN);

  return { matches: results.slice(0, Math.max(limit, 1)), confident };
}

// ── Plan, hubs and links ─────────────────────────────────────────────────────

export interface AssistantHub {
  location: TopicLocation;
  label: string;
  href: string;
}

export interface AssistantPlan {
  /** The `[id]` route segment — the plan's slug (or id) as it appears in the URL. */
  clientId: string;
  companyName?: string | null;
  advisorName?: string | null;
  loginUrl?: string | null;
  appointmentUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  hubs: AssistantHub[];
}

export interface AssistantHubInput {
  clientId?: string | null;
  benefitHubs?:
    | readonly {
        category?: string | null;
        isEnabled?: boolean;
        title?: string | null;
      }[]
    | null;
  categoryPortalVisibility?: CategoryPortalVisibility | null;
  employeeResourcesEnabled?: boolean;
}

interface HubDefinition {
  location: TopicLocation;
  category: string;
  segment: string;
  label: string;
}

/**
 * The hub pages this plan actually publishes.
 *
 * Mirrors the portal header: a canonical hub needs a Benefit row that is enabled and
 * a category that is visible; the Custom hub takes the advisor's own name for the
 * benefit; Employee Resources is not a Benefit row at all, so only the plan's own
 * flag can speak for it.
 */
export function buildAssistantHubs({
  clientId: clientIdInput,
  benefitHubs,
  categoryPortalVisibility,
  employeeResourcesEnabled,
}: AssistantHubInput): AssistantHub[] {
  const clientId = trimmed(clientIdInput);
  if (!clientId) return [];

  const rows = Array.isArray(benefitHubs) ? benefitHubs : null;
  const customTitle = customBenefitTitleFromHubs(rows);
  const definitions: HubDefinition[] = [
    {
      location: "retirement",
      category: "Retirement",
      segment: "retirement",
      label: TOPIC_LOCATION_LABELS.retirement,
    },
    {
      location: "group_health",
      category: "Group Health",
      segment: "health-insurance",
      label: TOPIC_LOCATION_LABELS.group_health,
    },
    {
      location: "group_life",
      category: "Group Life",
      segment: "life-insurance",
      label: TOPIC_LOCATION_LABELS.group_life,
    },
    {
      location: "custom",
      category: CUSTOM_BENEFIT_CATEGORY,
      segment: customBenefitRouteSlug(customTitle),
      label: customTitle || "Other benefits",
    },
  ];

  const hubs: AssistantHub[] = [];
  for (const definition of definitions) {
    if (
      !isCategoryVisibleInPortal(
        definition.category,
        categoryPortalVisibility ?? null,
      )
    ) {
      continue;
    }
    if (rows) {
      const row = rows.find(
        (entry) =>
          topicLocationForCategory(entry?.category) === definition.location,
      );
      if (!row || row.isEnabled === false) continue;
    }
    hubs.push({
      location: definition.location,
      label: definition.label,
      href: `/${clientId}/${definition.segment}`,
    });
  }

  if (employeeResourcesEnabled === true) {
    hubs.push({
      location: "employee_resources",
      label: TOPIC_LOCATION_LABELS.employee_resources,
      href: `/${clientId}/employee-resources`,
    });
  }

  return hubs;
}

export interface AssistantLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface AssistantRelated {
  label: string;
  href: string;
}

/** A chip the visitor can press. It names the topic it stands for, so its answer is exact. */
export interface AssistantSuggestion {
  label: string;
  query: string;
  topicSlug?: string;
  location?: TopicLocation;
}

export type AssistantReply =
  | {
      kind: "answer";
      topicSlug: string;
      location: TopicLocation;
      text: string;
      steps: string[];
      links: AssistantLink[];
      related: AssistantRelated[];
      /** Shown in smaller type: the topic is not on this plan's page yet. */
      note?: string;
    }
  | { kind: "navigate"; text: string; links: AssistantLink[] }
  | {
      kind: "suggest";
      text: string;
      options: AssistantSuggestion[];
      links: AssistantLink[];
    }
  | { kind: "handoff"; text: string; links: AssistantLink[] }
  | { kind: "smalltalk"; text: string; links: AssistantLink[] };

function hubFor(
  plan: AssistantPlan,
  location: TopicLocation,
): AssistantHub | undefined {
  return plan.hubs.find((hub) => hub.location === location);
}

function hubLinks(plan: AssistantPlan): AssistantLink[] {
  return plan.hubs.map((hub) => ({ label: hub.label, href: hub.href }));
}

function teamLink(plan: AssistantPlan): AssistantLink {
  return {
    label: "Meet your benefits team",
    href: `/${plan.clientId}/my-benefits-team`,
  };
}

function advisorLink(plan: AssistantPlan): AssistantLink {
  if (trimmed(plan.appointmentUrl)) {
    return {
      label: "Book a time with your benefits team",
      href: trimmed(plan.appointmentUrl),
      external: true,
    };
  }
  return teamLink(plan);
}

function contactLink(plan: AssistantPlan, label: string): AssistantLink {
  if (trimmed(plan.contactEmail)) {
    return { label, href: `mailto:${trimmed(plan.contactEmail)}` };
  }
  if (trimmed(plan.contactPhone)) {
    return { label, href: `tel:${trimmed(plan.contactPhone)}` };
  }
  return teamLink(plan);
}

/** The CTA the topic ships, resolved against this plan. */
function ctaLink(
  topic: AssistantTopic,
  plan: AssistantPlan,
): AssistantLink | undefined {
  const cta = topic.cta;
  if (!cta || !trimmed(cta.label)) return undefined;

  if (cta.target === "recordkeeper" && trimmed(plan.loginUrl)) {
    return { label: cta.label, href: trimmed(plan.loginUrl), external: true };
  }
  if (cta.target === "advisor") {
    return { ...advisorLink(plan), label: cta.label };
  }
  if (cta.target === "contact") return contactLink(plan, cta.label);

  const destination = trimmed(cta.destination);
  if (destination) {
    return {
      label: cta.label,
      href: destination,
      external: /^https?:\/\//i.test(destination),
    };
  }

  // Shipped CTAs such as "Talk Through My Options" carry no target, but their
  // label says who they belong to. Route those to the advisor before falling back
  // to the provider portal, so a conversation CTA never opens a login page.
  if (/(advisor|adviser|talk|book|meet|call|help|ask)/i.test(cta.label)) {
    return { ...advisorLink(plan), label: cta.label };
  }

  // The shipped default for `external_url` with no destination is the provider's
  // own portal ("Request a Loan", "Add Coverage", …).
  if (trimmed(plan.loginUrl)) {
    return { label: cta.label, href: trimmed(plan.loginUrl), external: true };
  }
  return undefined;
}

/** The topic's own place on its hub, or the hub when this plan never placed it. */
function topicLink(
  topic: AssistantTopic,
  plan: AssistantPlan,
): AssistantLink | undefined {
  const hub = hubFor(plan, topic.location);
  if (!hub) return undefined;
  if (!topic.isPlaced) return { label: `See ${hub.label}`, href: hub.href };
  return {
    label: "Open on your plan page",
    href: `${hub.href}#${encodeURIComponent(topicHashSlug(topic.storedSlug))}`,
  };
}

function relatedLinks(
  topic: AssistantTopic,
  matches: readonly AssistantMatch[],
  plan: AssistantPlan,
): AssistantRelated[] {
  const out: AssistantRelated[] = [];
  const seenTitles = new Set<string>([normalizeText(topic.title)]);
  for (const match of matches) {
    if (match.topic.slug === topic.slug && match.topic.location === topic.location) {
      continue;
    }
    const title = normalizeText(match.topic.title);
    if (seenTitles.has(title)) continue;
    seenTitles.add(title);
    const link = topicLink(match.topic, plan);
    const hub = hubFor(plan, match.topic.location);
    out.push({
      label: match.topic.title,
      href: link?.href ?? hub?.href ?? `/${plan.clientId}`,
    });
    if (out.length === 2) break;
  }
  return out;
}

// ── Intent routing ───────────────────────────────────────────────────────────

const SMALL_TALK = new Set([
  "hi",
  "hi there",
  "hello",
  "hello there",
  "hey",
  "hey there",
  "thanks",
  "thank you",
  "thank you so much",
  "thx",
  "ty",
  "bye",
  "goodbye",
  "see you",
]);

const CONTACT_RE =
  /\b(talk|speak|call|email|contact|advisor|adviser|human|someone|representative|rep|hr|support)\b/;

const NAVIGATION_RE =
  /\b(where|find|open|take me|go to|goto|link|page|hub|portal|log in|login|sign in|signin|recordkeeper|account access|my account|documents|forms|news|events|webinar|videos|team)\b/;

const LOGIN_RE =
  /\b(log in|login|sign in|signin|recordkeeper|account access|my account|online account)\b/;

const DOCUMENT_RE = /\b(document|documents|form|forms|notice|notices|paperwork|pdf)\b/;

const NEWS_RE = /\b(news|event|events|webinar|webinars|video|videos)\b/;

const TEAM_RE = /\b(team|advisor|adviser|consultant)\b/;

const HUB_WORDS: Record<TopicLocation, string[]> = {
  retirement: ["retirement", "401k", "403b", "457", "pension", "ira"],
  group_health: [
    "health",
    "medical",
    "dental",
    "vision",
    "prescription",
    "insurance",
  ],
  group_life: [
    "life insurance",
    "life",
    "disability",
    "ad&d",
    "accidental death",
  ],
  custom: ["wellness", "eap", "voluntary", "custom benefit", "other benefit"],
  employee_resources: [
    "employee resources",
    "human resources",
    "hr",
    "time off",
    "pto",
    "payroll",
    "handbook",
  ],
};

function suggestsContact(normalized: string): boolean {
  return CONTACT_RE.test(normalized);
}

function navigationReply(
  normalized: string,
  plan: AssistantPlan,
): AssistantReply | null {
  const allHubLinks = hubLinks(plan);

  if (LOGIN_RE.test(normalized)) {
    const login = trimmed(plan.loginUrl);
    return {
      kind: "navigate",
      text: login
        ? "You can sign in to your plan's account from the link below. If you have never registered, the provider's sign-in page walks you through it."
        : "Your plan's sign-in link has not been posted here yet. Your benefits team can send it to you.",
      links: [
        ...(login
          ? [{ label: "Sign in to your plan account", href: login, external: true }]
          : []),
        ...allHubLinks,
      ],
    };
  }

  if (DOCUMENT_RE.test(normalized)) {
    return {
      kind: "navigate",
      text: "Plan documents and forms live on each benefit page, under Documents & Forms.",
      links: allHubLinks,
    };
  }

  if (NEWS_RE.test(normalized)) {
    return {
      kind: "navigate",
      text: "News, events and webinars are collected on the portal's News & Events page.",
      links: [{ label: "News & Events", href: `/${plan.clientId}/news-events` }],
    };
  }

  if (TEAM_RE.test(normalized)) {
    return {
      kind: "navigate",
      text: "You can meet the people who support your plan — and book time with them — on your benefits team page.",
      links: [teamLink(plan)],
    };
  }

  const matched = plan.hubs.filter((hub) =>
    (HUB_WORDS[hub.location] ?? []).some((word) =>
      includesPhrase(normalized, word),
    ),
  );
  if (matched.length > 0) {
    return {
      kind: "navigate",
      text:
        matched.length === 1
          ? `Your ${matched[0].label} page is the place to start.`
          : "These benefit pages are the place to start.",
      links: matched.map((hub) => ({ label: hub.label, href: hub.href })),
    };
  }

  return null;
}

function suggestionReply(
  matches: readonly AssistantMatch[],
  plan: AssistantPlan,
  index: AssistantIndex,
): AssistantReply {
  const options: AssistantSuggestion[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const title = normalizeText(match.topic.title);
    if (seen.has(title)) continue;
    seen.add(title);
    options.push(suggestionFor(match.topic));
    if (options.length === 3) break;
  }

  // A near-tie can still be one title repeated across locations. Offer the
  // library's own starters rather than an empty chip row.
if (options.length === 0) {
  for (const starter of assistantStarterQuestions(index)) {
    if (seen.has(normalizeText(starter.label))) continue;
    seen.add(normalizeText(starter.label));
    options.push(starter);
  }
}

  return {
    kind: "suggest",
    text: "I found a few answers that might be what you're after. Which one did you mean?",
    options,
    links: hubLinks(plan).slice(0, 4),
  };
}

/** Library topics that make useful openers on any plan. */
const STARTER_LIBRARY_SLUGS = [
  "401k-loans",
  "cobra",
  "beneficiaries",
  "pay-stubs-direct-deposit",
  "enroll-change-contributions",
];

/** A corpus topic as a chip the visitor can press. */
function suggestionFor(topic: AssistantTopic): AssistantSuggestion {
  return {
    label: topic.title,
    query: topic.title,
    topicSlug: topic.slug,
    location: topic.location,
  };
}

/**
 * The questions to offer before the visitor has typed anything.
 *
 * The plan's own Featured cards come first (they are the topics its advisor chose to
 * lead with), then its other placed questions, and only then a few library staples.
 * That keeps the first screen relevant to a plan that only publishes Group Health.
 */
export function assistantStarterQuestions(
  index: AssistantIndex,
  limit = 3,
): AssistantSuggestion[] {
  const picked: AssistantTopic[] = [];
  const seen = new Set<string>();
  const add = (topic: AssistantTopic | undefined) => {
    if (!topic || picked.length >= limit) return;
    const key = normalizeText(topic.title);
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(topic);
  };

  for (const topic of index.topics) {
    if (topic.isPlaced && topic.displayMode === "featured") add(topic);
  }
  for (const topic of index.topics) {
    if (topic.isPlaced) add(topic);
  }
  for (const slug of STARTER_LIBRARY_SLUGS) {
    add(index.topics.find((candidate) => candidate.slug === slug));
  }

  return picked.slice(0, limit).map(suggestionFor);
}

function fallbackReply(
  index: AssistantIndex,
  plan: AssistantPlan,
): AssistantReply {
  return {
    kind: "suggest",
    text: "I could not find that in your plan's answers. I can help with coverage, enrollment, claims, retirement accounts, leave and pay — or you can ask a person.",
    options: assistantStarterQuestions(index),
    links: [...hubLinks(plan).slice(0, 4), advisorLink(plan)],
  };
}

function handoffReply(plan: AssistantPlan): AssistantReply {
  const name = trimmed(plan.advisorName);
  const links: AssistantLink[] = [advisorLink(plan)];
  if (trimmed(plan.contactEmail)) {
    links.push({ label: "Email the team", href: `mailto:${trimmed(plan.contactEmail)}` });
  }
  if (trimmed(plan.contactPhone)) {
    links.push({ label: "Call the team", href: `tel:${trimmed(plan.contactPhone)}` });
  }
  if (!links.some((link) => link.href.endsWith("/my-benefits-team"))) {
    links.push(teamLink(plan));
  }
  return {
    kind: "handoff",
    text: name
      ? `${name} and the benefits team can help with plan-specific questions.`
      : "A real person can help with plan-specific questions. Your benefits team can answer them.",
    links,
  };
}

function answerReply(
  topic: AssistantTopic,
  matches: readonly AssistantMatch[],
  plan: AssistantPlan,
  contactRequested: boolean,
): AssistantReply {
  const text =
    fillHelpCardTokens(
      topic.quickAnswer || topic.summary || "",
      topic.locationLabel,
    ) || `Here is what your plan says about ${topic.title}.`;

  const links: AssistantLink[] = [];
  const cta = ctaLink(topic, plan);
  if (cta) links.push(cta);
  const deepLink = topicLink(topic, plan);
  if (deepLink) links.push(deepLink);
  const hub = hubFor(plan, topic.location);
  if (hub && deepLink && deepLink.href !== hub.href) {
    links.push({ label: `See all ${hub.label} questions`, href: hub.href });
  }
  if (contactRequested) {
    const advisor = advisorLink(plan);
    if (!links.some((link) => link.href === advisor.href)) links.push(advisor);
  }

  return {
    kind: "answer",
    topicSlug: topic.slug,
    location: topic.location,
    text,
    steps: topic.steps.slice(0, 3),
    links,
    related: relatedLinks(topic, matches, plan),
    ...(topic.isPlaced
      ? {}
      : {
          note: "This answer is from the general benefits library. It is not on your plan's page yet — your benefits team can confirm it applies to you.",
        }),
  };
}

export interface AssistantQuestion {
  question: string;
  index: AssistantIndex;
  plan: AssistantPlan;
}

/**
 * Question → reply. Deterministic: same input, same output.
 *
 * Order matters. A confident answer wins (and picks up the contact link when the
 * visitor also asked for a person); an explicit "talk to someone" wins when nothing
 * matched; navigation questions resolve to pages; everything else gets suggestions
 * rather than an invented answer.
 */
export function respondToQuestion({
  question,
  index,
  plan,
}: AssistantQuestion): AssistantReply {
  const normalized = normalizeText(question);
  const trimmedNormalized = normalized.trim();

  if (SMALL_TALK.has(trimmedNormalized)) {
    return {
      kind: "smalltalk",
      text: "Hi! Ask me anything about your plan — coverage, enrollment, claims, or your retirement account.",
      links: hubLinks(plan),
    };
  }

  // "Where do I log in?" is a navigation question before it is an answer. The
  // troubleshooting topic ("I can't log in") stays reachable when the visitor says
  // what went wrong, which is what `loginTrouble` checks.
  const loginTrouble =
    /\b(cant|can t|cannot|locked|forgot|reset|password|trouble|problem|error)\b/.test(
      normalized,
    );
  if (LOGIN_RE.test(normalized) && !loginTrouble) {
    const login = navigationReply(normalized, plan);
    if (login) return login;
  }

  const search = searchAssistantTopics(index, question, 3);
  const top = search.matches[0];
  const contactRequested = suggestsContact(normalized);

  if (search.confident && top) {
    return answerReply(top.topic, search.matches.slice(1), plan, contactRequested);
  }

  if (contactRequested) return handoffReply(plan);

  if (NAVIGATION_RE.test(normalized)) {
    const navigation = navigationReply(normalized, plan);
    if (navigation) return navigation;
  }

  if (top && top.score >= MIN_SUGGEST_SCORE) {
    return suggestionReply(search.matches, plan, index);
  }

  return fallbackReply(index, plan);
}

export interface AssistantTopicQuestion {
  slug: string;
  location: TopicLocation;
  index: AssistantIndex;
  plan: AssistantPlan;
}

/**
 * The exact answer a chip stands for.
 *
 * Chips know their topic, so pressing one must not re-run retrieval: two topics can
 * share a title ("Update My Beneficiary" is both a Retirement card and a Group Life
 * answer), and only the chip knows which one the visitor chose.
 */
export function respondToTopic({
  slug,
  location,
  index,
  plan,
}: AssistantTopicQuestion): AssistantReply {
  const topic = index.topics.find(
    (candidate) => candidate.slug === slug && candidate.location === location,
  );
  if (!topic) {
    return respondToQuestion({ question: slug, index, plan });
  }
  return answerReply(topic, [], plan, false);
}

export interface AssistantHubQuestion {
  location: TopicLocation;
  index: AssistantIndex;
  plan: AssistantPlan;
}

/** That hub's topics, placed Featured first, then its other questions, then library copy. */
function hubTopicChoices(
  index: AssistantIndex,
  location: TopicLocation,
  limit: number,
): AssistantTopic[] {
  const pool = index.topics.filter((topic) => topic.location === location);
  const ordered = [
    ...pool.filter((topic) => topic.isPlaced && topic.displayMode === "featured"),
    ...pool.filter(
      (topic) => topic.isPlaced && topic.displayMode === "quick_answers",
    ),
    ...pool.filter((topic) => !topic.isPlaced),
  ];

  const seen = new Set<string>();
  const choices: AssistantTopic[] = [];
  for (const topic of ordered) {
    const key = normalizeText(topic.title);
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push(topic);
    if (choices.length >= limit) break;
  }
  return choices;
}

/**
 * What a benefit button in the greeting asks: "What can you help me with in X?"
 *
 * The reply stays in the sheet. It offers that hub's own topics as chips rather than
 * routing to the page, and choosing one runs the normal question path — so the answer
 * is grounded and still carries its CTA and deep link.
 */
export function respondToHub({
  location,
  index,
  plan,
}: AssistantHubQuestion): AssistantReply {
  const hub = plan.hubs.find((candidate) => candidate.location === location);
  const label = hub?.label ?? TOPIC_LOCATION_LABELS[location];
  const choices = hubTopicChoices(index, location, 5);

  if (choices.length === 0) {
    return {
      kind: "handoff",
      text: `I don't have any answers for ${label} yet. Your benefits team can help with it.`,
      links: [teamLink(plan)],
    };
  }

  return {
    kind: "suggest",
    text: `Here's what I can help with in ${label}. Pick a topic, or ask me your own question.`,
    options: choices.map(suggestionFor),
    links: [],
  };
}
