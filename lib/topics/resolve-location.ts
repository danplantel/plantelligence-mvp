import { prisma } from "@/lib/prisma";
import { resolveEffectiveTopic } from "@/lib/topics/effective-topic";
import type {
  AccordionGroupRecord,
  EffectiveTopic,
  ResolvedLocationTopics,
  TopicGroup,
  TopicLocation,
  TopicPlacementRecord,
  TopicRecord,
} from "@/types/topic";

/**
 * Turning a plan's placements into what one location renders.
 *
 * Two layers on purpose:
 *
 *  - `resolveLocationTopics` is PURE. It takes plain records and returns the resolved
 *    location, so the ordering rules can be tested (and the admin builder can preview
 *    a draft) without a database.
 *  - `loadLocationTopics` is the server-only read. It queries by `clientId` + location,
 *    which is the plan-scoping boundary: there is no query here that could return
 *    another plan's placement.
 */

/** Where a Quick Answer lands when its placement names no group (or a stale one). */
export const UNGROUPED_TOPIC_GROUP_ID = "__ungrouped__";

/** The name shown for that last-resort group. */
export const UNGROUPED_TOPIC_GROUP_NAME = "Questions";

export interface LocationTopicsInput {
  location: TopicLocation;
  placements: TopicPlacementRecord[];
  topics: TopicRecord[];
  groups: AccordionGroupRecord[];
}

/** Placement order, then title — so an order tie can never make rendering unstable. */
function bySortOrder(a: EffectiveTopic, b: EffectiveTopic): number {
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
}

function byGroupOrder(a: AccordionGroupRecord, b: AccordionGroupRecord): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

/**
 * Resolve one location from records that are already scoped to a single plan.
 *
 * Rules (Section 3 · Rendering rules):
 *  - a `hidden` placement is counted but never returned;
 *  - a placement whose topic is missing is skipped rather than rendered empty;
 *  - a Quick Answer whose group is missing still shows, in the trailing "Questions"
 *    group, so an advisor deleting a group cannot silently lose the questions in it;
 *  - archived topics still render where a placement points at them — archiving flags
 *    a topic in the builder, it never pulls live content off a hub by itself.
 */
export function resolveLocationTopics({
  location,
  placements,
  topics,
  groups,
}: LocationTopicsInput): ResolvedLocationTopics {
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const groupById = new Map(groups.map((group) => [group.id, group]));

  const visible: EffectiveTopic[] = [];
  let hiddenCount = 0;

  for (const placement of placements) {
    // Defensive: the query is already scoped, but a caller can hand us a mixed list.
    if (placement.location !== location) continue;

    const topic = topicById.get(placement.topicId);
    if (!topic) continue;

    if (placement.displayMode === "hidden") {
      hiddenCount += 1;
      continue;
    }

    visible.push(resolveEffectiveTopic(topic, placement));
  }

  const featured = visible
    .filter((topic) => topic.displayMode === "featured")
    .sort(bySortOrder);

  const questions = visible
    .filter((topic) => topic.displayMode === "quick_answers")
    .sort(bySortOrder);

  const buckets = new Map<string, EffectiveTopic[]>();
  for (const question of questions) {
    const knownGroup =
      question.groupId && groupById.has(question.groupId)
        ? question.groupId
        : UNGROUPED_TOPIC_GROUP_ID;
    const bucket = buckets.get(knownGroup);
    if (bucket) bucket.push(question);
    else buckets.set(knownGroup, [question]);
  }

  const resolvedGroups: TopicGroup[] = [];
  for (const group of [...groups].sort(byGroupOrder)) {
    const topics = buckets.get(group.id);
    if (!topics || topics.length === 0) continue;
    resolvedGroups.push({
      id: group.id,
      name: group.name,
      sortOrder: group.sortOrder,
      topics,
    });
  }

  const ungrouped = buckets.get(UNGROUPED_TOPIC_GROUP_ID);
  if (ungrouped && ungrouped.length > 0) {
    resolvedGroups.push({
      id: UNGROUPED_TOPIC_GROUP_ID,
      name: UNGROUPED_TOPIC_GROUP_NAME,
      sortOrder: Number.MAX_SAFE_INTEGER,
      topics: ungrouped,
    });
  }

  return { location, featured, groups: resolvedGroups, hiddenCount };
}

/** Map a Prisma row to the hand-written record the pure resolver takes. */
function toTopicRecord(row: {
  id: string;
  scope: string;
  organizationId: string | null;
  slug: string;
  title: string;
  summary: string | null;
  iconKey: string | null;
  imageKey: string | null;
  bodyBlocks: unknown;
  tags: string[];
  defaultLocations: string[];
  isActionHub: boolean;
  defaultCta: unknown;
  status: string;
}): TopicRecord {
  return {
    id: row.id,
    // The generated enum values and the hand-written unions share their literals.
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
  };
}

/**
 * Read one location for one plan.
 *
 * Scoped by `clientId` in BOTH queries, which is the only thing that keeps two plans'
 * placements apart. Groups are read even when a location has no placements yet, so the
 * builder can show the plan's own group names before anything is placed in them.
 */
export async function loadLocationTopics(
  clientId: string,
  location: TopicLocation,
): Promise<ResolvedLocationTopics> {
  const id = (clientId || "").trim();
  if (!id) {
    return { location, featured: [], groups: [], hiddenCount: 0 };
  }

  const [placementRows, groupRows] = await Promise.all([
    prisma.topicPlacement.findMany({
      where: { clientId: id, location },
      include: { topic: true },
      orderBy: [{ sortOrder: "asc" }],
    }),
    prisma.accordionGroup.findMany({
      where: { clientId: id, location },
      orderBy: [{ sortOrder: "asc" }],
    }),
  ]);

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

  const topics: TopicRecord[] = placementRows.map((row) =>
    toTopicRecord(row.topic),
  );

  const groups: AccordionGroupRecord[] = groupRows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    location: row.location as TopicLocation,
    name: row.name,
    sortOrder: row.sortOrder,
  }));

  return resolveLocationTopics({ location, placements, topics, groups });
}
