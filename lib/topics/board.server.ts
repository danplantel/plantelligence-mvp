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
import { resolveEffectiveTopic } from "@/lib/topics/effective-topic";
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

  return { location, featured, groups, hidden, featuredCap: FEATURED_CAP };
}

export interface ApplyBoardResult {
  ok: boolean;
  error?: string;
  plan?: BoardPlan;
  applied: boolean;
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

  const validation = validateBoard({ ...params.board, location });
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
    next: { ...params.board, location },
  });

  if (isNoopPlan(plan)) {
    return { ok: true, plan, applied: false };
  }

  await prisma.$transaction(async (tx) => {
    // Groups first: a new group's id is what a new placement needs.
    const createdGroupIds = new Map<string, string>();
    for (const group of plan.groupsToCreate) {
      const created = await tx.accordionGroup.create({
        data: {
          clientId,
          location,
          name: group.name,
          sortOrder: group.sortOrder,
        },
      });
      createdGroupIds.set(group.name.trim().toLowerCase(), created.id);
    }

    for (const group of plan.groupsToUpdate) {
      await tx.accordionGroup.update({
        where: { id: group.id },
        data: { name: group.name, sortOrder: group.sortOrder },
      });
    }

    for (const placement of plan.placementsToUpdate) {
      await tx.topicPlacement.update({
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
      });
    }

    for (const placement of plan.placementsToCreate) {
      // `planBoardApply` marks a group it is creating in this same request as
      // `name:<key>`; swap that for the id the create above returned.
      const rawGroupId = placement.groupId;
      const groupId = rawGroupId?.startsWith("name:")
        ? createdGroupIds.get(rawGroupId.slice("name:".length)) ?? null
        : rawGroupId;

      await tx.topicPlacement.create({
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
    }
  });

  return { ok: true, plan, applied: true };
}
