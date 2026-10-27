import { topicHashSlug } from "@/lib/topics/deep-link";
import type {
  TopicLocation,
  TopicPlacementRecord,
  TopicRecord,
} from "@/types/topic";
import type { LifeEventTemplate } from "@/lib/life-events/templates";

/**
 * Turning a Life Event template into the checklist one plan actually shows (TF-8).
 *
 * A Life Event is a view over placements, not new content, so the rules are about what
 * to DROP. Three things remove a step:
 *
 *  1. **The plan does not have that topic in that location** — no placement, so there
 *     is nothing to link to.
 *  2. **The placement is hidden** — the advisor took it off that hub, so the checklist
 *     must not resurrect it.
 *  3. **The location is switched off** — a hidden benefit category, or Employee
 *     Resources before the plan published it. This is the handoff's rule 1: "Hidden
 *     benefit categories hide their placements everywhere, including inside Life
 *     Events."
 *
 * The acceptance case lives here: "Having a baby" ships seven steps, and switching
 * Group Life off removes the life-insurance step, leaving six.
 */

export interface ResolvedLifeEventStep {
  /** Stable per template + position, so React keys and tests are not index-fragile. */
  id: string;
  label: string;
  location: TopicLocation;
  topicSlug: string;
  isActionHub: boolean;
  placementId: string;
  /** `/{plan}/{hub}#{topic}`, or null when the caller passed no plan slug. */
  href: string | null;
}

export interface ResolvedLifeEvent {
  key: string;
  title: string;
  deadlineDays: number | null;
  deadlineLabel?: string;
  ctaLabel: string;
  steps: ResolvedLifeEventStep[];
  /** How many template steps were dropped, for the builder's "N of M" line. */
  droppedCount: number;
}

/**
 * The portal path each location opens at.
 *
 * `custom` keeps the legacy `/wellness-programs` segment, which the header still
 * resolves, so a checklist link works without knowing the advisor's own hub name.
 */
export const LIFE_EVENT_HUB_PATH: Record<TopicLocation, string> = {
  retirement: "retirement",
  group_health: "health-insurance",
  group_life: "life-insurance",
  custom: "wellness-programs",
  employee_resources: "employee-resources",
};

/** `sys.401k-loans` → `401k-loans`, so a template can use the library spelling. */
function librarySlug(slug: string): string {
  return (slug || "").trim().replace(/^sys\./, "");
}

export function resolveLifeEventSteps(input: {
  template: LifeEventTemplate;
  /** This plan's placements, any location. */
  placements: readonly TopicPlacementRecord[];
  /** The topics those placements point at. */
  topics: readonly TopicRecord[];
  /** False for a hidden category, or Employee Resources before it is published. */
  isLocationVisible: (location: TopicLocation) => boolean;
  planSlug?: string | null;
}): ResolvedLifeEventStep[] {
  const topicById = new Map(input.topics.map((topic) => [topic.id, topic]));
  const plan = (input.planSlug || "").trim();

  const steps: ResolvedLifeEventStep[] = [];

  input.template.steps.forEach((step, index) => {
    // 1. The plan must have this topic in this location.
    const placement = input.placements.find((candidate) => {
      if (candidate.location !== step.location) return false;
      const topic = topicById.get(candidate.topicId);
      return !!topic && librarySlug(topic.slug) === step.topicSlug;
    });
    if (!placement) return;

    // 2. A hidden placement is off the hub, so it is off the checklist.
    if (placement.displayMode === "hidden") return;

    // 3. A switched-off location contributes nothing, anywhere.
    if (!input.isLocationVisible(step.location)) return;

    const topic = topicById.get(placement.topicId)!;
    const hash = encodeURIComponent(topicHashSlug(topic.slug));
    const hubPath = LIFE_EVENT_HUB_PATH[step.location];

    steps.push({
      id: `${input.template.key}:${index}:${step.topicSlug}`,
      label: step.label,
      location: step.location,
      topicSlug: step.topicSlug,
      isActionHub: topic.isActionHub === true,
      placementId: placement.id,
      href: plan ? `/${plan}/${hubPath}#${hash}` : null,
    });
  });

  return steps;
}

/** The whole checklist: the template's framing plus its surviving steps. */
export function resolveLifeEvent(input: {
  template: LifeEventTemplate;
  placements: readonly TopicPlacementRecord[];
  topics: readonly TopicRecord[];
  isLocationVisible: (location: TopicLocation) => boolean;
  planSlug?: string | null;
}): ResolvedLifeEvent {
  const steps = resolveLifeEventSteps(input);

  return {
    key: input.template.key,
    title: input.template.title,
    deadlineDays: input.template.deadlineDays,
    ...(input.template.deadlineLabel
      ? { deadlineLabel: input.template.deadlineLabel }
      : {}),
    ctaLabel: input.template.ctaLabel,
    steps,
    droppedCount: input.template.steps.length - steps.length,
  };
}

/**
 * The deadline banner's line, or `null` when the template has no window.
 *
 * The number of days is plan-configurable in the stored row; this only formats it, so
 * a plan that shortens its window to 14 days reads "14 days …" without new copy.
 */
export function lifeEventDeadlineText(
  event: Pick<ResolvedLifeEvent, "deadlineDays" | "deadlineLabel">,
  daysOverride?: number | null,
): string | null {
  const days =
    daysOverride === undefined || daysOverride === null
      ? event.deadlineDays
      : daysOverride;
  if (!days || days <= 0) return null;
  const label = (event.deadlineLabel || "").trim();
  // The template's label already reads as a duration ("days to add your child…"), so
  // the number carries its own unit only when there is no label to lean on.
  if (label) return `${days} ${label}`;
  return `${days} ${days === 1 ? "day" : "days"} left`;
}
