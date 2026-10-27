import prisma from "@/lib/prisma";
import {
  benefitCategoryToVisibilityKey,
  getCategoryPortalVisibility,
} from "@/lib/portal-category-visibility";
import { benefitCategoryForLocation } from "@/lib/topic-locations";
import {
  lifeEventDeadlineText,
  resolveLifeEvent,
  type ResolvedLifeEventStep,
} from "@/lib/life-events/resolve";
import { LIFE_EVENT_TEMPLATES } from "@/lib/life-events/templates";
import type { TopicLocation, TopicPlacementRecord, TopicRecord } from "@/types/topic";

/**
 * Reading a plan's Life Events for the participant page (TF-8).
 *
 * Server-only. Three reads, all scoped by `clientId`:
 *
 *  1. the plan's placements (any location) — the steps ARE placements;
 *  2. the topics those placements point at;
 *  3. any stored `LifeEvent` rows, which only exist once an advisor has edited one.
 *
 * With no stored rows the eight templates resolve directly, so the hub-home strip has
 * real checklists from day one without a seeding step. A stored row contributes its own
 * deadline window and its `active` flag; the steps still come from placements, which is
 * what keeps "hidden category drops its steps" true no matter who edited what.
 */

export interface LifeEventPayloadStep extends ResolvedLifeEventStep {}

export interface LifeEventPayload {
  key: string;
  title: string;
  /** Ready-to-print banner line, or null for "no deadline". */
  deadlineText: string | null;
  ctaLabel: string;
  steps: LifeEventPayloadStep[];
}

/** Which locations this plan currently publishes. */
function locationVisibility(plan: {
  categoryPortalVisibility: unknown;
  employeeResourcesEnabled: boolean;
}): (location: TopicLocation) => boolean {
  const visibility = getCategoryPortalVisibility(plan.categoryPortalVisibility);
  return (location) => {
    if (location === "employee_resources") return plan.employeeResourcesEnabled;
    const category = benefitCategoryForLocation(location);
    if (!category) return false;
    return visibility[benefitCategoryToVisibilityKey(category)] !== false;
  };
}

export async function loadLifeEvents(params: {
  clientId: string;
  planSlug?: string | null;
}): Promise<LifeEventPayload[]> {
  const clientId = (params.clientId || "").trim();
  if (!clientId) return [];

  const [plan, placementRows, topicRows, storedEvents] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: {
        slug: true,
        categoryPortalVisibility: true,
        employeeResourcesEnabled: true,
      },
    }),
    prisma.topicPlacement.findMany({ where: { clientId } }),
    prisma.topic.findMany(),
    prisma.lifeEvent.findMany({
      where: { clientId, active: true },
      orderBy: [{ sortOrder: "asc" }],
    }),
  ]);

  if (!plan) return [];

  const placements: TopicPlacementRecord[] = placementRows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    topicId: row.topicId,
    location: row.location as TopicLocation,
    displayMode: row.displayMode as TopicPlacementRecord["displayMode"],
    groupId: row.groupId,
    sortOrder: row.sortOrder,
    overrides: row.overrides,
    actionHubLink: row.actionHubLink,
  }));

  const topics: TopicRecord[] = topicRows.map((row) => ({
    id: row.id,
    scope: row.scope as TopicRecord["scope"],
    organizationId: row.organizationId,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    iconKey: row.iconKey,
    imageKey: row.imageKey,
    bodyBlocks: row.bodyBlocks,
    tags: row.tags,
    defaultLocations: row.defaultLocations as TopicLocation[],
    isActionHub: row.isActionHub,
    defaultCta: row.defaultCta,
    status: row.status as TopicRecord["status"],
  }));

  const isLocationVisible = locationVisibility(plan);
  const storedByKey = new Map(storedEvents.map((event) => [event.key, event]));
  const planSlug = (params.planSlug || plan.slug || "").trim() || null;

  const events: LifeEventPayload[] = [];

  for (const template of LIFE_EVENT_TEMPLATES) {
    const stored = storedByKey.get(template.key);

    const resolved = resolveLifeEvent({
      template,
      placements,
      topics,
      isLocationVisible,
      planSlug,
    });

    // Nothing to do for this event on this plan — render no tile for it.
    if (resolved.steps.length === 0) continue;

    events.push({
      key: resolved.key,
      title: stored?.title?.trim() || resolved.title,
      // The plan's own window wins; with neither, there is no banner.
      deadlineText: lifeEventDeadlineText(
        {
          deadlineDays: stored?.deadlineDays ?? resolved.deadlineDays,
          deadlineLabel: resolved.deadlineLabel,
        },
      ),
      ctaLabel: resolved.ctaLabel,
      steps: resolved.steps,
    });
  }

  return events;
}
