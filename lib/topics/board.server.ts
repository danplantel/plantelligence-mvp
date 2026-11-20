import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  FEATURED_CAP,
  isNoopPlan,
  planBoardApply,
  validateBoard,
  type BoardPlan,
  type TopicBoardInput,
} from "@/lib/topics/board";
import {
  UNGROUPED_TOPIC_GROUP_ID,
  UNGROUPED_TOPIC_GROUP_NAME,
} from "@/lib/topics/ungrouped";
import { resolveEffectiveTopic } from "@/lib/topics/effective-topic";
import { libraryTopicBySlug, systemTopicSlug } from "@/lib/topics/library";
import type {
  ActionHubLink,
  EffectiveTopic,
  TopicLocation,
  TopicPlacementRecord,
  TopicRecord,
} from "@/types/topic";

/**
 * Reading and writing the admin board for ONE location of ONE plan (TF-3).
 *
 * Server-only. The rules live in `board.ts`; this is the Prisma adapter, and every
 * query is scoped by `clientId` — the only thing keeping two plans' placements apart.
 */

export interface BoardGroupView {
  id: string;
  name: string;
  sortOrder: number;
  topics: EffectiveTopic[];
}

export interface TopicBoard {
  location: TopicLocation;
  /** Featured cards, in order — read-only here; Section 4 owns their layout. */
  featured: EffectiveTopic[];
  /** Quick Answers groups, in order, including groups that are currently empty. */
  groups: BoardGroupView[];
  /** Placements the advisor has hidden from participants. */
  hidden: EffectiveTopic[];
  featuredCap: number;
}

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

function toPlacementRecord(row: {
  id: string;
  clientId: string;
  topicId: string;
  location: string;
  displayMode: string;
  groupId: string | null;
  sortOrder: number;
  overrides: unknown;
  actionHubLink: unknown;
}): TopicPlacementRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    topicId: row.topicId,
    location: row.location as TopicLocation,
    displayMode: row.displayMode as TopicPlacementRecord["displayMode"],
    groupId: row.groupId,
    sortOrder: row.sortOrder,
    overrides: row.overrides,
    actionHubLink: row.actionHubLink,
  };
}

/**
 * A sub-link as a Prisma Json input value.
 *
 * `ActionHubLink` is a hand-written interface, so it has no index signature and the
 * generated input type cannot accept it directly. `DbNull` is how Prisma clears a
 * nullable Json column — a bare `null` is rejected by the same type.
 */
function actionHubLinkJson(
  link: ActionHubLink | null | undefined,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
  if (!link) return Prisma.DbNull;
  return { ...link } as unknown as Prisma.InputJsonObject;
}

/**
 * The board, including what the participant page does NOT show.
 *
 * `loadLocationTopics` deliberately drops hidden placements and empty groups; the
 * builder needs both, which is why this reads the raw rows and resolves them itself.
 */
export async function loadTopicBoard(
  clientId: string,
  location: TopicLocation,
): Promise<TopicBoard> {
  const [placementRows, groupRows] = await Promise.all([
    prisma.topicPlacement.findMany({
      where: { clientId, location },
      include: { topic: true },
      orderBy: [{ sortOrder: "asc" }],
    }),
    prisma.accordionGroup.findMany({
      where: { clientId, location },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const resolved = placementRows.map((row) =>
    resolveEffectiveTopic(toTopicRecord(row.topic), toPlacementRecord(row)),
  );

  const featured = resolved
    .filter((topic) => topic.displayMode === "featured")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const hidden = resolved
    .filter((topic) => topic.displayMode === "hidden")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const questions = resolved.filter(
    (topic) => topic.displayMode === "quick_answers",
  );

  const groups: BoardGroupView[] = groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    sortOrder: group.sortOrder,
    topics: questions
      .filter((topic) => topic.groupId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  /**
   * Questions that name no section (or one that no longer exists) still belong to
   * the board: without this they would vanish on reload AND be re-offered in the
   * "Add from the library" drawer. They travel in the same virtual group the
   * builder strips out again before writing.
   */
  const knownGroupIds = new Set(groupRows.map((group) => group.id));
  const ungrouped = questions
    .filter((topic) => !topic.groupId || !knownGroupIds.has(topic.groupId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (ungrouped.length > 0) {
    groups.push({
      id: UNGROUPED_TOPIC_GROUP_ID,
      name: UNGROUPED_TOPIC_GROUP_NAME,
      sortOrder: groupRows.length,
      topics: ungrouped,
    });
  }

  return { location, featured, groups, hidden, featuredCap: FEATURED_CAP };
}

export interface ApplyBoardResult {
  ok: boolean;
  error?: string;
  plan?: BoardPlan;
  applied: boolean;
}

/**
 * Swap a placement's sentinel for a real Topic id.
 *
 * "Add from the library" sends the library SLUG (`contribution-limits`) because a
 * topic the plan has never placed has no Topic row yet — there is no id to send.
 * Writing that straight into `TopicPlacement.topicId` violates the foreign key, so
 * the slug is resolved to (or becomes) the shared system Topic row first. Exported
 * for the unit test; the lookup lives in `resolvePlacementTopics`.
 */
export function mapPlacementTopicIds(
  placements: TopicBoardInput["placements"],
  topicIdBySlug: Map<string, string>,
): TopicBoardInput["placements"] {
  if (topicIdBySlug.size === 0) return placements;
  return placements.map((placement) => {
    const resolved = topicIdBySlug.get(placement.topicId);
    return resolved ? { ...placement, topicId: resolved } : placement;
  });
}

/**
 * Give every sentinel placement a real Topic id, creating the shared system row
 * from the library when this is the first plan to place it.
 *
 * A slug that matches no library entry is left alone: `validateBoard` /
 * the database then reject it instead of this silently inventing a topic.
 */
async function resolvePlacementTopics(
  placements: TopicBoardInput["placements"],
): Promise<TopicBoardInput["placements"]> {
  const requested = [...new Set(placements.map((placement) => placement.topicId))];
  if (requested.length === 0) return placements;

  const existing = await prisma.topic.findMany({
    where: { id: { in: requested } },
    select: { id: true },
  });
  const known = new Set(existing.map((row) => row.id));
  const sentinels = requested.filter((value) => !known.has(value));
  if (sentinels.length === 0) return placements;

  // One batch, one round-trip. Sequentially these upserts cost a network trip
  // each, which is most of the latency of "Add from the library".
  const seeds = [...new Set(sentinels.map(libraryTopicBySlug))]
    .filter((seed): seed is NonNullable<typeof seed> => Boolean(seed));
  if (seeds.length === 0) return placements;

  // `update: {}` on purpose: the row is shared by every plan, so inserting a
  // topic here must never rewrite copy another plan is already reading.
  const rows = await prisma.$transaction(
    seeds.map((seed) =>
      prisma.topic.upsert({
        where: { slug: systemTopicSlug(seed.slug) },
        update: {},
        create: {
          scope: "system",
          slug: systemTopicSlug(seed.slug),
          title: seed.title,
          summary: seed.summary ?? null,
          isActionHub: seed.isActionHub ?? false,
          defaultLocations: seed.defaultLocations,
          bodyBlocks: (seed.bodyBlocks ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          defaultCta: (seed.cta ?? undefined) as Prisma.InputJsonValue | undefined,
          tags: seed.tags ?? [],
        },
        select: { id: true },
      }),
    ),
  );

  const topicIdBySlug = new Map<string, string>();
  seeds.forEach((seed, index) => {
    const row = rows[index];
    if (row) topicIdBySlug.set(seed.slug, row.id);
  });

  return mapPlacementTopicIds(placements, topicIdBySlug);
}

/**
 * Make storage match the submitted board.
 *
 * Validated first (one placement per topic and the Featured ceiling are rules, not UI
 * hints), then written in ONE transaction so a half-applied reorder is impossible.
 * An unchanged board performs no writes at all.
 */
export async function applyTopicBoard(params: {
  clientId: string;
  location: TopicLocation;
  board: TopicBoardInput;
}): Promise<ApplyBoardResult> {
  const { clientId, location } = params;

  if (params.board?.location && params.board.location !== location) {
    return {
      ok: false,
      error: "Board location does not match the request.",
      applied: false,
    };
  }

  // Library slugs become Topic ids BEFORE validation, so the duplicate check and
  // the foreign key both see the id the placement will actually be written with.
  const placements = await resolvePlacementTopics(
    Array.isArray(params.board?.placements) ? params.board.placements : [],
  );
  const board: TopicBoardInput = { ...params.board, location, placements };

  const validation = validateBoard(board);
  if (!validation.ok) {
    return { ok: false, error: validation.error, applied: false };
  }

  const [groupRows, placementRows] = await Promise.all([
    prisma.accordionGroup.findMany({ where: { clientId, location } }),
    prisma.topicPlacement.findMany({ where: { clientId, location } }),
  ]);

  const plan = planBoardApply({
    current: {
      groups: groupRows.map((group) => ({
        id: group.id,
        clientId: group.clientId,
        location: group.location as TopicLocation,
        name: group.name,
        sortOrder: group.sortOrder,
      })),
      placements: placementRows.map(toPlacementRecord),
    },
    next: board,
  });

  if (isNoopPlan(plan)) {
    return { ok: true, plan, applied: false };
  }

  /**
   * Batched, not an interactive callback transaction.
   *
   * The callback form round-trips once PER STATEMENT, so an eight-card reorder
   * was a dozen sequential writes on one held-open transaction. Against a pooled
   * remote database that took 13 s and the server killed it mid-flight
   * (`P2028 Transaction not found`), which the editor then rolled back — the
   * reorder visibly snapped away seconds after it was made. `$transaction([...])`
   * sends the same statements as ONE implicit transaction in ONE round-trip, so
   * the write is still atomic and finishes in a fraction of the time.
   */

  // Groups first: a new group's id is what a new placement needs.
  const createdGroups = plan.groupsToCreate.length
    ? await prisma.$transaction(
        plan.groupsToCreate.map((group) =>
          prisma.accordionGroup.create({
            data: {
              clientId,
              location,
              name: group.name,
              sortOrder: group.sortOrder,
            },
          }),
        ),
      )
    : [];
  const createdGroupIds = new Map<string, string>();
  plan.groupsToCreate.forEach((group, index) => {
    const created = createdGroups[index];
    if (created) {
      createdGroupIds.set(group.name.trim().toLowerCase(), created.id);
    }
  });

  if (plan.groupsToUpdate.length) {
    await prisma.$transaction(
      plan.groupsToUpdate.map((group) =>
        prisma.accordionGroup.update({
          where: { id: group.id },
          data: { name: group.name, sortOrder: group.sortOrder },
        }),
      ),
    );
  }

  const placementWrites = [
    ...plan.placementsToUpdate.map((placement) =>
      prisma.topicPlacement.update({
        where: { id: placement.id },
        data: {
          displayMode: placement.displayMode,
          groupId: placement.groupId,
          sortOrder: placement.sortOrder,
          // TF-5: only written when the board carried a sub-link, so a plain reorder
          // can never blank one.
          ...(placement.actionHubLink === undefined
            ? {}
            : { actionHubLink: actionHubLinkJson(placement.actionHubLink) }),
        },
      }),
    ),
    ...plan.placementsToCreate.map((placement) => {
      // `planBoardApply` marks a group it is creating in this same request as
      // `name:<key>`; swap that for the id the create above returned.
      const rawGroupId = placement.groupId;
      const groupId = rawGroupId?.startsWith("name:")
        ? createdGroupIds.get(rawGroupId.slice("name:".length)) ?? null
        : rawGroupId;

      return prisma.topicPlacement.create({
        data: {
          clientId,
          topicId: placement.topicId,
          location,
          displayMode: placement.displayMode,
          groupId,
          sortOrder: placement.sortOrder,
          actionHubLink: actionHubLinkJson(placement.actionHubLink),
        },
      });
    }),
  ];

  if (placementWrites.length) {
    try {
      await prisma.$transaction(placementWrites);
    } catch (error) {
      // The placements did not land, so the groups created above must not be
      // left behind as empty sections: put the board back exactly as it was.
      if (createdGroupIds.size > 0) {
        await prisma.accordionGroup
          .deleteMany({
            where: { id: { in: [...createdGroupIds.values()] } },
          })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  return { ok: true, plan, applied: true };
}
