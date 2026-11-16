"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  Search,
  User,
  X,
} from "lucide-react";
import { mix, readableColor } from "polished";
import {
  HAVE_QUESTIONS_SECTION_ID,
  QUICK_ANSWERS_SECTION_ID,
} from "@/lib/portal-section-anchors";
import { useOptionalClientPortal } from "@/contexts/client-portal-context";
import { resolvePortalPrimaryContact } from "@/lib/portal-primary-contact";
import { portalRadiusValue } from "@/lib/typography-themes";
import {
  CONTRIBUTION_LIMITS_YEAR,
  ELECTIVE_DEFERRAL_LIMIT,
} from "@/lib/plan-contribution-limits";
import { toExternalUrl } from "@/lib/url-utils";
import { splitTextLinks } from "@/lib/text/linkify";
import { topicQuickAnswer } from "@/lib/topics/effective-topic";
import {
  buildTopicUrl,
  readHashTopicSlug,
  readSearchQueryParam,
  topicMatchesHash,
} from "@/lib/topics/deep-link";
import {
  countMatchedTopics,
  filterTopicGroups,
  flattenTopicGroups,
} from "@/lib/topics/search";
import { resolveTopicHref } from "@/lib/topics/link-href";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionHubPanel } from "./action-hub-panel";
import type { ActionHubRow, EffectiveTopic, TopicGroup } from "@/types/topic";

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
 *  - `md` and up: two columns, each a stack of groups. Answers expand in their column,
 *    and the question bars carry a caret for that fold.
 *  - phone (`< md`): the question list is one column. Nothing folds in place — the
 *    caret is hidden, because tapping a question opens the full-screen answer view
 *    (handoff: "a view within the page, not a new page"). That view slides up, keeps
 *    a pinned action bar at the bottom (Close + the topic's CTA), and is a
 *    `pushState` entry, so the browser back button closes it.
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
  /**
   * Action Hub rows per topic slug (`topics.actionHubPanels`, TF-5). An answer whose
   * slug has rows replaces its single CTA with the choice of benefits.
   */
  actionHubPanels?: Record<string, ActionHubRow[]> | null;
  /**
   * The benefit category. It resolves the key contact (and that person's booking
   * link) for a CTA whose destination is left to the advisor — "Book a Meeting".
   */
  category?: string;
  /** Explicit scheduling link; wins over the resolved key contact's. */
  advisorBookingUrl?: string;
  /** The plan's login URL, for `{{recordkeeper_url}}` in a topic's copy. */
  recordkeeperUrl?: string;
  /** The provider administering this benefit, for `{{recordkeeper_name}}`. */
  recordkeeperName?: string;
  /** The plan sponsor, for `{{plan_sponsor_name}}`. */
  planSponsorName?: string;
  /**
   * True while the hub is still fetching this benefit's placements
   * (`GET …/benefits/<category>?withTopics=1`). The section then draws its
   * skeleton instead of rendering `null` and popping in after the sections
   * around it, which used to shove the page down as it arrived.
   */
  loading?: boolean;
  className?: string;
}

/** The section heading participants read, above the category row. */
const SECTION_TITLE = "Get Quick Answers to Common Benefits Questions";
const SEARCH_PLACEHOLDER = "Search answers for this benefit";
/** The supporting line under the heading — the skeleton shows it too. */
const SECTION_SUBTITLE =
  "Every other question about this benefit, grouped and searchable.";

/**
 * The free-text search box.
 *
 * HIDDEN, NOT DELETED. The section now leads with a row of category buttons, and
 * those cover the lookup a participant actually does ("where do I find …?" →
 * pick a category). The field, its `?q=` deep-link handling and `filterTopicGroups`
 * all still work and stay wired: flip this to `true` and the box returns above the
 * category row, exactly as before.
 */
const SEARCH_ENABLED = false;

/**
 * The heading block, shared by the live section and its skeleton so the two are the
 * same height and the swap cannot shift the page.
 */
function QuickAnswersHeading() {
  return (
    <div className="mb-8 text-center">
      {/* `text-gray-900`, matching the "How Can We Help You Today?" heading: the
          two section titles read as a pair, and neither takes the plan's brand
          colour. */}
      <h2 className="mx-auto font-dm-serif text-2xl leading-tight text-gray-900 sm:text-3xl lg:whitespace-nowrap lg:text-4xl">
        {SECTION_TITLE}
      </h2>
      <p className="mx-auto mt-2 max-w-2xl font-red-hat text-sm text-neutral-600 sm:text-base">
        {SECTION_SUBTITLE}
      </p>
    </div>
  );
}

/**
 * The section's placeholder while the hub's topics are in flight.
 *
 * The section renders nothing until the benefit read answers, so on a hub page it
 * used to appear seconds after the sections around it — and pushed them down when it
 * did. This claims the section's frame on first paint: the same anchor id, heading,
 * search field and two-column rhythm the answer list will occupy, so the answers swap
 * in without a jump.
 */
function QuickAnswersSkeleton({ className }: { className?: string }) {
  return (
    <section
      id={QUICK_ANSWERS_SECTION_ID}
      aria-busy="true"
      data-testid="quick-answers-skeleton"
      className={cn(
        "w-full scroll-mt-24 bg-neutral-50 py-16 sm:scroll-mt-28 lg:py-20 lg:scroll-mt-32",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <QuickAnswersHeading />

        {/* The category row, then the selected category's questions — the same
            rhythm the real section uses, so the answers swap in without a jump. */}
        <div className="mb-6 flex gap-2 overflow-hidden" aria-hidden="true">
          {[0, 1, 2, 3].map((chip) => (
            <Skeleton
              key={chip}
              className="h-10 w-36 shrink-0"
              style={{ borderRadius: portalRadiusValue() }}
            />
          ))}
        </div>

        <p className="sr-only" role="status">
          Loading this benefit&rsquo;s answers…
        </p>

        <div className="grid gap-2 md:grid-cols-2" aria-hidden="true">
          {[0, 1, 2, 3].map((question) => (
            <Skeleton
              key={question}
              className="h-[46px] w-full"
              style={{ borderRadius: portalRadiusValue(1.5) }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * TF-7: the matcher lives in `lib/topics/search.ts`.
 *
 * It is shared rather than local because the same rule has to hold wherever a query is
 * typed — this section today, the Navigator's Ask box later — and because the
 * acceptance case ("loan" finds 401(k) loans) belongs in a unit test.
 */

/**
 * Answer copy with the addresses in it made clickable.
 *
 * Advisors write "You can see your personal estimate at ssa.gov/myaccount." and
 * "Log in at {{recordkeeper_url}}." as prose; the token becomes a full URL. A
 * reader had no way to follow either, so every address is an anchor that opens in
 * a new tab. Copy with no address renders as one plain string — no wrapper, no
 * extra markup.
 */
function LinkedText({ text, color }: { text: string; color: string }) {
  const segments = splitTextLinks(text);
  if (!segments.some((segment) => segment.type === "link")) {
    return <>{text}</>;
  }

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "link" ? (
          <a
            key={`${segment.href}-${index}`}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-1 underline-offset-2 transition-opacity hover:opacity-80"
            style={{ color }}
          >
            {segment.value}
          </a>
        ) : (
          <Fragment key={`text-${index}`}>{segment.value}</Fragment>
        ),
      )}
    </>
  );
}

/** A question's shape, shown as a small chip the way today's rich questions do. */
function topicChip(topic: EffectiveTopic): string | null {
  const steps = topic.bodyBlocks.find((block) => block.type === "steps");
  if (steps && steps.type === "steps") {
    return `${steps.steps.length} steps`;
  }
  return null;
}

/** A placement CTA, resolved once so the answer body and the phone action bar agree. */
interface ResolvedTopicCta {
  label: string;
  href: string;
  external: boolean;
}

/**
 * The topic's CTA, destination and all.
 *
 * A placement CTA can carry its own destination. When it does not, its `target`
 * decides: the plan's login URL, the advisor's booking link, or the contact band.
 * A label that names the advisor is the fallback for older rows.
 */
function resolveTopicCta(
  topic: EffectiveTopic,
  options: {
    basePath: string;
    advisorBookingUrl?: string;
    recordkeeperUrl?: string;
  },
): ResolvedTopicCta | null {
  const label = (topic.cta?.label ?? "").trim();
  if (!label) return null;

  const { basePath, advisorBookingUrl, recordkeeperUrl } = options;
  const labelImpliesAdvisor = /book|advisor|talk|review|counsel/i.test(label);
  const target =
    topic.cta?.target ?? (labelImpliesAdvisor ? "advisor" : "recordkeeper");
  const targetUrl =
    target === "recordkeeper"
      ? toExternalUrl(recordkeeperUrl)
      : target === "advisor"
        ? advisorBookingUrl
        : `#${HAVE_QUESTIONS_SECTION_ID}`;
  const resolved = resolveTopicHref(
    topic.cta?.destination || targetUrl || `#${HAVE_QUESTIONS_SECTION_ID}`,
    basePath,
  );

  return { label, href: resolved.href || "#", external: resolved.external };
}

/** The answer body: quick answer, then steps, then the placement CTA. */
function TopicAnswer({
  topic,
  brandColor,
  secondaryColor,
  basePath,
  actionHubRows,
  advisorBookingUrl,
  recordkeeperUrl,
  fillTokens,
  showCta = true,
}: {
  topic: EffectiveTopic;
  brandColor: string;
  secondaryColor: string;
  basePath: string;
  /** TF-5: the other benefits this action applies to, when it is an Action Hub. */
  actionHubRows?: ActionHubRow[];
  /**
   * The advisor's scheduling link. A CTA with no destination — "Book a Meeting" —
   * goes here; with none set it goes to the Have Questions band, where the
   * advisor's card lives.
   */
  advisorBookingUrl?: string;
  /** The plan's login URL, for a CTA that targets the recordkeeper. */
  recordkeeperUrl?: string;
  /** Replaces the per-plan `{{tokens}}` a topic's copy may contain. */
  fillTokens: (text: string) => string;
  /**
   * Whether to draw the placement CTA here. The phone view passes `false` and
   * prints it in its pinned action bar instead, so a long answer cannot bury it.
   */
  showCta?: boolean;
}) {
  const quickAnswer = fillTokens(topicQuickAnswer(topic));
  const hasActionHub = !!actionHubRows && actionHubRows.length > 0;
  /** The answer's Video / Contact blocks, drawn as small resource chips. */
  const resources: { kind: "video" | "contact"; label: string }[] = [];
  for (const block of topic.bodyBlocks) {
    if (block.type === "video" && block.videoId) {
      resources.push({ kind: "video", label: fillTokens(block.videoId) });
    }
    if (block.type === "contact" && block.contactId) {
      resources.push({ kind: "contact", label: fillTokens(block.contactId) });
    }
  }
  const resolvedCta = resolveTopicCta(topic, {
    basePath,
    advisorBookingUrl,
    recordkeeperUrl,
  });

  return (
    <div className="space-y-3">
      {quickAnswer && (
        <p className="font-red-hat text-[15px] leading-relaxed text-neutral-700 sm:text-base">
          <LinkedText text={quickAnswer} color={brandColor} />
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
              <li key={stepIndex}>
                <LinkedText text={fillTokens(step)} color={brandColor} />
              </li>
            ))}
          </ol>
        );
      })}

      {/* Video / Contact — the handoff's resource blocks. Document blocks carry
          ids that resolve in TF-10, so they are skipped rather than printed as
          identifiers. */}
      {resources.length > 0 && (
        <div
          data-testid="quick-answer-resources"
          className="flex flex-wrap gap-2"
        >
          {resources.map((resource) => (
            <span
              key={`${resource.kind}-${resource.label}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 font-red-hat text-[12px] text-neutral-700"
            >
              {resource.kind === "video" ? (
                <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <User className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {resource.label}
            </span>
          ))}
        </div>
      )}

      {/* The Action Hub panel IS the CTA when there is a choice to make. With one
          row it collapses to a single button, so both cases land here. */}
      {hasActionHub ? (
        <ActionHubPanel
          rows={actionHubRows}
          brandColor={brandColor}
          basePath={basePath}
          ctaLabel={topic.cta?.label}
        />
      ) : resolvedCta && showCta ? (
        <div className="pt-1">
          <a
            href={resolvedCta.href}
            {...(resolvedCta.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="inline-flex min-h-10 items-center justify-center px-5 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-opacity hover:opacity-90"
            style={{
              backgroundColor: brandColor,
              color: readableColor(brandColor),
              borderRadius: portalRadiusValue(),
            }}
          >
            {resolvedCta.label}
          </a>
        </div>
      ) : null}

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
  actionHubPanels,
  category,
  advisorBookingUrl,
  recordkeeperUrl,
  recordkeeperName,
  planSponsorName,
  loading = false,
  className,
}: QuickAnswersSectionProps) {
  // The plan's key contact for this benefit owns the scheduling link a
  // destination-less CTA ("Book a Meeting") points at.
  const portal = useOptionalClientPortal();
  const keyContact = resolvePortalPrimaryContact(
    (portal.clientData as any)?.keyContacts,
    category,
  );
  const resolvedBookingUrl = toExternalUrl(
    advisorBookingUrl || keyContact?.schedulingUrl,
  );
  const resolvedLoginUrl = toExternalUrl(recordkeeperUrl);
  /** The per-plan values a topic's copy may name. */
  const fillTokens = (text: string) => {
    if (!text) return text;
    const advisorName = String(
      keyContact?.fullName || keyContact?.name || "",
    ).trim();
    const advisorFirm = String(
      keyContact?.companyName || keyContact?.company || "",
    ).trim();
    return text
      .replace(
        /\{\{recordkeeper_url\}\}/g,
        resolvedLoginUrl || "your recordkeeper's website",
      )
      .replace(
        /\{\{recordkeeper_name\}\}/g,
        (recordkeeperName || "").trim() || "your recordkeeper",
      )
      .replace(/\{\{advisor_name\}\}/g, advisorName || "your advisor")
      .replace(
        /\{\{advisor_firm\}\}/g,
        advisorFirm || "your advisor's firm",
      )
      .replace(
        /\{\{plan_sponsor_name\}\}/g,
        (planSponsorName || "").trim() || "your employer",
      )
      // Annual IRS figures — global values, updated each January.
      .replace(/\{\{plan_year\}\}/g, String(CONTRIBUTION_LIMITS_YEAR))
      .replace(/\{\{deferral_limit\}\}/g, ELECTIVE_DEFERRAL_LIMIT);
  };

  const [query, setQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  /** Phone-only answer view. Kept apart so the two layouts cannot fight. */
  const [mobileSlug, setMobileSlug] = useState<string | null>(null);

  const allTopics = useMemo(() => flattenTopicGroups(groups), [groups]);

  const filteredGroups = useMemo(
    () => filterTopicGroups(groups, query),
    [groups, query],
  );

  const visibleCount = countMatchedTopics(filteredGroups);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  /**
   * The category row's source.
   *
   * `filteredGroups`, not `groups`: a `?q=` link can still narrow the set even
   * though the search box is hidden, and a category that no longer matches must
   * not stay selected. Falls back to the first category so the section always
   * shows one.
   */
  const visibleGroups = filteredGroups;
  const activeGroup =
    visibleGroups.find((group) => group.id === activeGroupId) ??
    visibleGroups[0] ??
    null;

  const selectGroup = (group: TopicGroup) => {
    setActiveGroupId(group.id);
    // An answer left open in the previous category would hang open under a list
    // that no longer contains it.
    setOpenSlug(null);
    syncHash(null);
  };

  /**
   * `?q=` (TF-7): a link can open the hub already filtered, and typing keeps the URL
   * in step so the filtered view is shareable. `replaceState` — never `pushState` — so
   * typing does not bury the previous page under a history entry per keystroke.
   */
  const syncQuery = (next: string) => {
    setQuery(next);
    try {
      const url = new URL(window.location.href);
      if (next.trim()) url.searchParams.set("q", next);
      else url.searchParams.delete("q");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    } catch {
      // History can be unavailable (sandboxed frames); search still works.
    }
  };

  useEffect(() => {
    const fromUrl = readSearchQueryParam(window.location.search);
    if (fromUrl) setQuery(fromUrl);
  }, []);

  const mobileTopic = allTopics.find((topic) => topic.slug === mobileSlug) ?? null;

  /**
   * The phone answer view, and its pinned action bar.
   *
   * The bar carries a Close button always, plus the topic's own CTA when it has
   * one — unless the topic is an Action Hub, whose panel already IS the call to
   * action and would otherwise be repeated. `resolveTopicCta` is the same helper
   * the desktop answer uses, so the two can never point at different places.
   */
  const mobileActionHubRows = mobileTopic
    ? actionHubPanels?.[mobileTopic.slug]
    : undefined;
  const mobileCta =
    mobileTopic &&
    !(mobileActionHubRows && mobileActionHubRows.length > 0)
      ? resolveTopicCta(mobileTopic, {
          basePath,
          advisorBookingUrl: resolvedBookingUrl,
          recordkeeperUrl: resolvedLoginUrl,
        })
      : null;

  /**
   * Phones get the full-screen answer; everything from `md` up expands in place.
   * The breakpoint must match the CSS (`md:hidden` on the view, `md:block` on
   * the inline answer and the caret), or a tablet width would land on neither
   * layout.
   */
  const isPhoneViewport = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767px)").matches;

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
        // CLOSED: a plain white bar with the question in the plan's colour — the
        // card around it carries the shadow, because the card clips its corners
        // and would cut a shadow drawn inside it.
        // OPEN: the plan's colour fills the bar, and the label flips to whatever
        // is readable on it. Only one can be open, so the coloured bar IS the
        // "this one" marker — no extra icon needed.
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200 sm:px-5"
        style={{
          backgroundColor: isOpen ? brandColor : "#ffffff",
          color: isOpen ? readableColor(brandColor) : brandColor,
        }}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-red-hat text-[13px] font-semibold leading-snug sm:text-sm">
            {topic.title}
          </span>
          {chip && (
            <span
              className="rounded-full px-2 py-0.5 font-red-hat text-[10px] font-bold uppercase tracking-[0.08em]"
              // The chip follows the bar: a translucent white pill on the filled
              // (open) bar, a wash of the brand on the white (closed) one — on
              // white, white-on-white made it disappear.
              style={{
                backgroundColor: isOpen
                  ? "rgba(255,255,255,0.18)"
                  : mix(0.9, "#ffffff", brandColor),
                color: isOpen ? readableColor(brandColor) : brandColor,
              }}
            >
              {chip}
            </span>
          )}
        </span>
        {/* Phones: the bar opens the full-screen answer, so it carries a "go"
            affordance — a chevron in a circle, in the plan's primary colour. The
            circle keeps a wash of the brand behind it so it stays visible on a
            plan whose primary colour is very light, and the icon itself stays
            the plain brand colour. */}
        {/* `hidden max-md:flex`, not `flex md:hidden`: the base state is hidden
            and the phone range turns it on, so a desktop header can never draw
            it whatever order the display utilities land in. */}
        <span
          data-testid="quick-answer-open-arrow"
          className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border max-md:flex"
          style={{
            borderColor: brandColor,
            backgroundColor: mix(0.9, "#ffffff", brandColor),
            color: brandColor,
          }}
          aria-hidden="true"
        >
          <ChevronRight className="h-4 w-4" />
        </span>

        <ChevronDown
          className={cn(
            // From `md` up the answer really does expand in place, so the caret
            // is drawn there — and on a phone it would promise a fold that does
            // not exist, which is why it is hidden below `md`.
            "hidden h-4 w-4 shrink-0 transition-transform duration-300 md:block",
            isOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
    );
  };

  // The hub is still fetching this benefit's placements: draw the section's frame so
  // it does not arrive late and shove the page down. Only while there is nothing to
  // show — a revalidation over data already on screen must not flash a skeleton.
  if (loading && allTopics.length === 0) {
    return <QuickAnswersSkeleton className={className} />;
  }

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
        {/* The heading is allowed the full column width and, from `lg` up, is kept on
            ONE line — at the same type size. The old `max-w-2xl` wrapper forced a break
            mid-sentence on desktop. Only the supporting line stays narrow. The block
            itself is shared with the skeleton, so the two cannot drift apart. */}
        <QuickAnswersHeading />

        {/* Free-text search — hidden for now, not deleted. `SEARCH_ENABLED` above
            puts it back exactly as it was, `?q=` deep links and all. */}
        {SEARCH_ENABLED && (
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
                onChange={(event) => syncQuery(event.target.value)}
                placeholder={SEARCH_PLACEHOLDER}
                data-testid="quick-answers-search"
                className="h-11 w-full border border-neutral-300 bg-white pl-9 pr-9 font-red-hat text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
                style={{ borderRadius: portalRadiusValue() }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => syncQuery("")}
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
        )}

        {/* The category row: one chip per topic group, and the list below shows
            exactly the selected one.

            It SCROLLS rather than wraps. A benefit's categories ("Savings &
            Contributions", "Getting Started", "Loans & Withdrawals", …) do not fit
            a desktop row, and wrapping them turned the row into a block of buttons
            that pushed the first answer below the fold. `snap-x` + `shrink-0` keep
            a chip whole while it scrolls, and the scrollbar is hidden because the
            row is short enough that a 16 px strip would read as a divider. */}
        {/* Shown for ONE category too: the row carries the name of what is
            listed below it, so a benefit with a single group still says which
            group it is instead of starting at a bare stack of questions. */}
        {visibleGroups.length > 0 && (
          <>
            {/* STICKY on a phone: the categories travel with the reader, so the
                answers below can be swapped without scrolling back to the top of
                the section. `top-14` clears the portal's fixed header (its phone
                logo band is 38 px plus 8 px of padding each side); the row stops
                sticking from `md`, where all of it is on screen at once anyway.

                Centred from `md` up — it is a navigation strip, not a control
                bar, so it should not hug the left edge. The centring lives on
                this wrapper: `justify-center` on the scroller itself would push
                the first chip out of reach once the row is wider than the
                screen, because scrollable overflow cannot be scrolled into the
                content box's left side. */}
            <div className="sticky top-14 z-20 -mx-4 mb-3 bg-neutral-50/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 md:static md:mx-0 md:mb-6 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
              <div className="relative flex justify-center">
                {/* Right-edge fade. On a phone the row is a carousel — a chip and
                    a bit of the next one are all that fit — and a hard edge reads
                    as a clipped button rather than as "there is more this way". */}
                <span
                  aria-hidden="true"
                  data-testid="quick-answer-categories-fade"
                  className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-neutral-50 to-transparent md:hidden"
                />
                <div
                  role="tablist"
                  aria-label="Answer categories"
                  data-testid="quick-answer-categories"
                  className="flex max-w-full min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
            {visibleGroups.map((group) => {
              const isActive = activeGroup?.id === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid="quick-answer-category"
                  onClick={() => selectGroup(group)}
                  // The SELECTED chip wears the portal header's own "you are here"
                  // treatment — `text-gray-900`, a brand-coloured underline and a
                  // wash of the brand (never the brand itself) — so the two
                  // navigation rows on a hub page mean the same thing. See
                  // `navLinkClass` / `navLinkStyle` in `portal-header.tsx`.
                  // `min-w-[56%]` on a phone is what makes two chips read as a
                  // SLIDER: two of them plus the gap are wider than the screen,
                  // so the second is visibly cut and the row announces itself as
                  // scrollable. From `md` the chips size to their labels.
                  className={cn(
                    "min-w-[56%] shrink-0 snap-start truncate border-0 border-b-2 px-4 py-2 text-center font-red-hat text-[13px] font-semibold transition-colors duration-200 md:min-w-0",
                    isActive
                      ? "text-gray-900"
                      : "border-transparent bg-white text-gray-600 hover:bg-neutral-50 hover:text-gray-900",
                  )}
                  style={{
                    borderRadius: portalRadiusValue(),
                    ...(isActive
                      ? {
                          borderBottomColor: brandColor,
                          backgroundColor: mix(0.88, "#ffffff", brandColor),
                        }
                      : {}),
                  }}
                >
                  {group.name}
                </button>
              );
            })}
                </div>
              </div>
            </div>

            {/* A hairline, so the sticky row never floats into the first
                accordion as it passes over it. */}
            <div
              aria-hidden="true"
              data-testid="quick-answer-categories-divider"
              className="mb-6 h-px w-full bg-neutral-300/70"
            />
          </>
        )}

        {/* The selected category's questions, two columns from `md`. The phone
            layout is the same list; tapping a question opens the full-screen
            view below. It is the `tabpanel` for the chip row above, labelled by
            the active category — no second copy of the name on screen.

            `items-start` is load-bearing. Grid items stretch to the row's height
            by default, so opening one answer made its NEIGHBOUR's white card
            grow to the same height — a second "open" card with nothing in it.
            Start-aligned items keep every card the height of its own content. */}
        <div
          role="tabpanel"
          aria-label={activeGroup?.name}
          data-testid="quick-answer-panel"
          className="grid items-start gap-2 md:grid-cols-2"
        >
          {activeGroup?.topics.map((topic) => {
            const isOpen = openSlug === topic.slug;
            return (
              <div
                key={topic.slug}
                id={`quick-answer-card-${topic.slug}`}
                // The elevation lives here, not on the header: the card clips its
                // corners, so a shadow drawn inside it would be cut off at the
                // edges. A closed card sits proud of the page; the open one is
                // flat, because its filled header is the emphasis.
                className={cn(
                  "group overflow-hidden border border-neutral-200 bg-white transition-shadow duration-200",
                  isOpen ? "shadow-none" : "shadow-sm hover:shadow-md",
                )}
                style={{ borderRadius: portalRadiusValue(1.5) }}
              >
                {questionButton(topic)}
                {/* Desktop/tablet: the answer expands in the list. On a phone it
                    is hidden here and shown full-screen instead.

                    The body grows and fades rather than appearing in one frame:
                    a 300-600 px block of copy that pops in under the bar reads
                    as a page jump, and with two columns of them it is easy to
                    lose which bar was clicked. `initial={false}` keeps a deep
                    link's answer already-open on first paint — nothing should
                    animate itself as the page loads. */}
                <div id={`quick-answer-${topic.slug}`} className="hidden md:block">
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          duration: 0.24,
                          ease: [0.22, 1, 0.36, 1] as [
                            number,
                            number,
                            number,
                            number,
                          ],
                        }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-neutral-200 px-4 py-3 sm:px-5">
                          <TopicAnswer
                            topic={topic}
                            brandColor={brandColor}
                            secondaryColor={secondaryColor}
                            basePath={basePath}
                            actionHubRows={actionHubPanels?.[topic.slug]}
                            advisorBookingUrl={resolvedBookingUrl}
                            recordkeeperUrl={resolvedLoginUrl}
                            fillTokens={fillTokens}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phone answer view: a view within the page, with a back arrow. It
          slides up from the bottom edge so it reads as a sheet arriving over
          the list rather than a new page replacing it — and `AnimatePresence`
          keeps it mounted long enough to slide back down on close. */}
      <AnimatePresence>
        {mobileTopic && (
          <motion.div
            className="fixed inset-0 z-[70] flex flex-col bg-white md:hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              duration: 0.32,
              ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            }}
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

            {/* The answer is the only scrollable region. The action bar below
                is a sibling, so it stays pinned however long the answer is. */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <TopicAnswer
                topic={mobileTopic}
                brandColor={brandColor}
                secondaryColor={secondaryColor}
                basePath={basePath}
                actionHubRows={mobileActionHubRows}
                advisorBookingUrl={resolvedBookingUrl}
                recordkeeperUrl={resolvedLoginUrl}
                fillTokens={fillTokens}
                // Its CTA lives in the pinned bar below instead.
                showCta={false}
              />
            </div>

            {/* Pinned phone action bar. The buttons stack full-width so each
                label stays on ONE line whatever the CTA is called. The extra
                bottom padding lifts them clear of the home-indicator area,
                which was clipping their lower edge on an iPhone 14 Pro. */}
            <div
              data-testid="quick-answer-mobile-actions"
              className="shrink-0 border-t border-neutral-200 bg-white px-4 pb-[calc(1.75rem_+_env(safe-area-inset-bottom,0px))] pt-3"
            >
              <div className="flex flex-col gap-2">
                {mobileCta ? (
                  <a
                    href={mobileCta.href}
                    {...(mobileCta.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    data-testid="quick-answer-mobile-cta"
                    className="inline-flex min-h-11 w-full items-center justify-center truncate whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-[0.1em] transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: brandColor,
                      color: readableColor(brandColor),
                      borderRadius: portalRadiusValue(),
                    }}
                  >
                    {mobileCta.label}
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={closeMobile}
                  aria-label="Close the answer"
                  className="inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap border border-neutral-300 px-4 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-700 transition-colors hover:bg-neutral-100"
                  style={{ borderRadius: portalRadiusValue() }}
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default QuickAnswersSection;
