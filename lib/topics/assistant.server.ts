import {
  getCategoryPortalVisibility,
  isCategoryVisibleInPortal,
} from "@/lib/portal-category-visibility";
import { prisma } from "@/lib/prisma";
import {
  benefitCategoryForLocation,
  TOPIC_LOCATION_ORDER,
  topicLocationForCategory,
} from "@/lib/topic-locations";
import type { AssistantPlacement } from "@/lib/topics/assistant";
import {
  resolveLocationTopics,
  toAccordionGroupRecord,
  toPlacementRecord,
  toTopicRecord,
} from "@/lib/topics/resolve-location";
import type { EffectiveTopic, TopicLocation } from "@/types/topic";

/**
 * The portal assistant's read of one plan (M2).
 *
 * `lib/topics/assistant` is the pure brain; this is the only part that touches the
 * database. It deliberately does TWO reads for every location at once — all of the
 * plan's placements (with their topics) and all of its accordion groups — then runs
 * the same pure `resolveLocationTopics` the hubs use, once per published location.
 * The hub pages make one request per benefit; the assistant must not, because it
 * answers for every hub from a single question.
 *
 * Only PUBLISHED locations are read:
 *
 *  - a canonical hub needs a Benefit row that is enabled AND visible in portal
 *    settings, exactly like the header and the page itself;
 *  - Employee Resources has no Benefit row, so the plan's own flag is the only
 *    answer and it is opt-in.
 *
 * A hub the plan switched off therefore contributes no placement — the assistant
 * still answers that subject from the shipped library (`buildAssistantCorpus` fills
 * every location), but it will not pretend the plan customized an answer nobody can
 * read, and `buildAssistantHubs` gives it no link to offer.
 *
 * HIDDEN placements are reported as slugs, not content. The client needs them so its
 * library-wide fill can drop the topic too; an advisor who hid a question meant it.
 */
export interface AssistantLocationInput {
  clientId: string;
  /** The raw `Client.categoryPortalVisibility` value. */
  categoryPortalVisibility?: unknown;
  employeeResourcesEnabled?: boolean;
  /** The plan's Benefit rows, for "does this hub exist and is it enabled?". */
  benefitHubs?: readonly {
    category?: string | null;
    isEnabled?: boolean;
  }[] | null;
}

export interface AssistantTopicsResult {
  topics: AssistantPlacement[];
  hiddenSlugs: string[];
}

/** Which locations the portal actually publishes for this plan. */
function publishedLocations(input: AssistantLocationInput): TopicLocation[] {
  const visibility = getCategoryPortalVisibility(
    input.categoryPortalVisibility,
  );
  const rows = Array.isArray(input.benefitHubs) ? input.benefitHubs : null;
  const locations: TopicLocation[] = [];

  for (const location of TOPIC_LOCATION_ORDER) {
    const category = benefitCategoryForLocation(location);
    if (!category) continue;
    if (!isCategoryVisibleInPortal(category, visibility)) continue;
    if (rows) {
      const row = rows.find(
        (entry) => topicLocationForCategory(entry?.category) === location,
      );
      // No Benefit row means no page to visit, and `isEnabled: false` is the
      // advisor's switch for the same thing.
      if (!row || row.isEnabled === false) continue;
    }
    locations.push(location);
  }

  if (input.employeeResourcesEnabled === true) {
    locations.push("employee_resources");
  }

  return locations;
}

/** `EffectiveTopic` → the compact record the client-side corpus consumes. */
function toAssistantPlacement(
  topic: EffectiveTopic,
  group?: string,
): AssistantPlacement {
  return {
    slug: topic.slug,
    location: topic.location,
    title: topic.title,
    summary: topic.summary ?? null,
    bodyBlocks: topic.bodyBlocks,
    tags: topic.tags,
    group: group ?? null,
    displayMode: topic.displayMode === "featured" ? "featured" : "quick_answers",
    isActionHub: topic.isActionHub,
    ...(topic.cta ? { cta: topic.cta } : {}),
  };
}

/**
 * Read the plan's placements for the assistant.
 *
 * Returns the placements (Featured first, then each group's questions in order) and
 * the slugs the advisor hid. Two queries total; no reads at all when nothing is
 * published.
 */
export async function loadPlanAssistantTopics(
  input: AssistantLocationInput,
): Promise<AssistantTopicsResult> {
  const clientId = (input.clientId || "").trim();
  if (!clientId) return { topics: [], hiddenSlugs: [] };

  const locations = publishedLocations(input);
  if (locations.length === 0) return { topics: [], hiddenSlugs: [] };

  const [placementRows, groupRows] = await Promise.all([
    prisma.topicPlacement.findMany({
      where: { clientId, location: { in: locations } },
      include: { topic: true },
      orderBy: [{ sortOrder: "asc" }],
    }),
    prisma.accordionGroup.findMany({
      where: { clientId, location: { in: locations } },
      orderBy: [{ sortOrder: "asc" }],
    }),
  ]);

  const hiddenSlugs = placementRows
    .filter((row) => row.displayMode === "hidden")
    .map((row) => row.topic.slug);

  const topics: AssistantPlacement[] = [];
  for (const location of locations) {
    const rows = placementRows.filter((row) => row.location === location);
    const resolved = resolveLocationTopics({
      location,
      placements: rows.map(toPlacementRecord),
      topics: rows.map((row) => toTopicRecord(row.topic)),
      groups: groupRows
        .filter((row) => row.location === location)
        .map(toAccordionGroupRecord),
    });

    for (const topic of resolved.featured) {
      topics.push(toAssistantPlacement(topic));
    }
    for (const group of resolved.groups) {
      for (const topic of group.topics) {
        topics.push(toAssistantPlacement(topic, group.name));
      }
    }
  }

  return { topics, hiddenSlugs };
}
