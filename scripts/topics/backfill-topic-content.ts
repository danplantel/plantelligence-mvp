/**
 * Bring every plan's topics in line with the shipped library.
 *
 * Two things drift once a plan is seeded, because seeding is deliberately
 * one-and-done (it never overwrites a row and never re-adds a topic an advisor
 * took off the page):
 *
 *  1. A content pass ADDS topics (Contribution limits, Auto-escalation, …). A
 *     plan seeded before it has no placement for them, so they never appear.
 *     `syncNewLibraryTopics` closes that gap — it checks PLACEMENTS, not Topic
 *     rows, because the rows are shared across plans.
 *  2. A content pass also RENAMES and re-splits the Quick Answers groups. A plan
 *     seeded under the old names ("Contributions & Saving", "Taking Money Out",
 *     "Investing", "Planning Ahead") keeps them while the new topics land in the
 *     current six groups, so the participant sees the same section twice.
 *     `planGroupRealignment` moves each system answer to its shipped group, puts
 *     the canonical groups in the documented order, hides answers the library no
 *     longer ships, and reports the groups left empty.
 *
 * Both steps only run for a plan that already holds placements in that location,
 * so a legacy plan is left alone and its read source never flips. The benefit PUT
 * route calls the sync after every save; this script covers plans that are not
 * re-saved, and is the only place the group reconciliation runs — a save must not
 * snap an advisor's own regrouping back.
 *
 * Usage (see also `pnpm topics:backfill-content`):
 *   npx tsx scripts/topics/backfill-topic-content.ts --plan <clientIdOrSlug> [--dry-run]
 *   npx tsx scripts/topics/backfill-topic-content.ts --all [--dry-run]
 */

import { topicLocationForCategory } from "../../lib/topic-locations";
import { planGroupRealignment } from "../../lib/topics/group-realign";
import {
  DEFAULT_QUICK_ANSWER_GROUPS,
  libraryTopicsForLocation,
  systemTopicSlug,
} from "../../lib/topics/library";
import {
  createPrismaTopicSeedStore,
  syncNewLibraryTopics,
} from "../../lib/topics/seed-plan-topics";
import type {
  AccordionGroupRecord,
  TopicLocation,
  TopicPlacementRecord,
  TopicRecord,
} from "../../types/topic";
import { createPrisma } from "../teammates/shared";

/**
 * A plain `npx tsx` run does not load `.env`; `createPrisma()` does, and widens
 * the pool for a CLI, which is why this script does not use the app's client.
 */
const prisma = createPrisma();

interface PlanTarget {
  clientId: string;
  /** The plan's portal slug, so the log names the plan a person recognises. */
  slug: string | null;
  categories: string[];
}

interface CategoryPreview {
  category: string;
  location: TopicLocation | null;
  /** False when the plan holds no placements here — a legacy location. */
  onFramework: boolean;
  /** Library topics with no Topic row yet, i.e. what a real run would create. */
  missing: string[];
}

interface CategoryResult {
  category: string;
  location: TopicLocation | null;
  createdTopics: number;
  createdGroups: number;
  createdPlacements: number;
}

/** What a real run would do, without writing anything. */
async function previewCategory(
  clientId: string,
  category: string,
): Promise<CategoryPreview> {
  const location = topicLocationForCategory(category);
  if (!location) {
    return { category, location: null, onFramework: false, missing: [] };
  }

  const placements = await prisma.topicPlacement.findMany({
    where: { clientId, location },
    select: { topicId: true },
  });
  if (placements.length === 0) {
    return { category, location, onFramework: false, missing: [] };
  }

  // Mirrors `syncNewLibraryTopics`: a topic is pending when THIS location has no
  // placement for it. A Topic row shared from another plan still needs a row
  // here, so the row's existence proves nothing.
  const seeds = libraryTopicsForLocation(location);
  const stored = await prisma.topic.findMany({
    where: { slug: { in: seeds.map((seed) => systemTopicSlug(seed.slug)) } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(stored.map((row) => [row.slug, row.id]));
  const placed = new Set(placements.map((row) => row.topicId));
  const missing = seeds
    .filter((seed) => {
      const id = idBySlug.get(systemTopicSlug(seed.slug));
      return !id || !placed.has(id);
    })
    .map((seed) => seed.title);

  return { category, location, onFramework: true, missing };
}

async function syncCategory(
  clientId: string,
  category: string,
): Promise<CategoryResult> {
  const result = await syncNewLibraryTopics({
    clientId,
    category,
    store: createPrismaTopicSeedStore(prisma),
  });

  return {
    category,
    location: result.location,
    createdTopics: result.createdTopics,
    createdGroups: result.createdGroups,
    createdPlacements: result.createdPlacements,
  };
}

interface RealignResult {
  location: TopicLocation;
  createdGroups: number;
  regrouped: number;
  hidden: number;
  droppedGroups: number;
}

function toGroupRecord(row: {
  id: string;
  clientId: string;
  location: string;
  name: string;
  sortOrder: number;
}): AccordionGroupRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    location: row.location as TopicLocation,
    name: row.name,
    sortOrder: row.sortOrder,
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

/**
 * Reconcile this location's Quick Answers groups with the library (see the file
 * header). Creates any canonical group the plan lacks, then applies the plan from
 * `planGroupRealignment` and drops the groups it emptied.
 */
async function realignGroups(
  clientId: string,
  category: string,
  dryRun: boolean,
): Promise<RealignResult | null> {
  const location = topicLocationForCategory(category);
  if (!location) return null;

  const canonical = DEFAULT_QUICK_ANSWER_GROUPS[location] ?? [];
  const readGroups = () =>
    prisma.accordionGroup.findMany({
      where: { clientId, location },
      orderBy: { sortOrder: "asc" },
    });

  let groupRows = await readGroups();
  const missingNames = canonical.filter(
    (name) => !groupRows.some((row) => row.name.trim() === name),
  );
  if (missingNames.length > 0 && !dryRun) {
    await prisma.$transaction(
      missingNames.map((name) =>
        prisma.accordionGroup.create({
          data: {
            clientId,
            location,
            name,
            // Canonical order is the documented order, not "after the stale ones".
            sortOrder: canonical.indexOf(name),
          },
        }),
      ),
    );
    groupRows = await readGroups();
  }

  const groupRecords = groupRows.map(toGroupRecord);
  // A dry run has not written the missing groups yet; stand them in so the counts
  // match what a real run would do.
  if (dryRun) {
    for (const name of missingNames) {
      groupRecords.push({
        id: `pending:${name}`,
        clientId,
        location,
        name,
        sortOrder: canonical.indexOf(name),
      });
    }
  }

  const placementRows = await prisma.topicPlacement.findMany({
    where: { clientId, location },
  });
  const topicRows =
    placementRows.length > 0
      ? await prisma.topic.findMany({
          where: { id: { in: [...new Set(placementRows.map((row) => row.topicId))] } },
        })
      : [];

  const plan = planGroupRealignment({
    location,
    groups: groupRecords,
    placements: placementRows.map(toPlacementRecord),
    topics: topicRows.map(toTopicRecord),
  });

  const hidden = plan.placements.filter(
    (entry) => entry.displayMode === "hidden",
  ).length;
  const regrouped = plan.placements.length - hidden;
  const existingIds = new Set(groupRows.map((row) => row.id));
  const droppable = plan.emptiedGroups.filter((id) => existingIds.has(id));

  if (!dryRun) {
    if (plan.groupOrders.length > 0 || plan.placements.length > 0) {
      await prisma.$transaction([
        ...plan.groupOrders.map((entry) =>
          prisma.accordionGroup.update({
            where: { id: entry.id },
            data: { sortOrder: entry.sortOrder },
          }),
        ),
        ...plan.placements.map((entry) =>
          prisma.topicPlacement.update({
            where: { id: entry.placementId },
            data: {
              groupId: entry.groupId,
              displayMode: entry.displayMode,
              sortOrder: entry.sortOrder,
            },
          }),
        ),
      ]);
    }
    if (droppable.length > 0) {
      await prisma.accordionGroup.deleteMany({
        where: { id: { in: droppable } },
      });
    }
  }

  return {
    location,
    createdGroups: missingNames.length,
    regrouped,
    hidden,
    droppedGroups: droppable.length,
  };
}

async function loadTargets(planArgument: string | null): Promise<PlanTarget[]> {
  if (planArgument) {
    const client = await prisma.client.findFirst({
      where: { OR: [{ id: planArgument }, { slug: planArgument }] },
      select: {
        id: true,
        slug: true,
        benefits: { select: { category: true } },
      },
    });
    if (!client) return [];
    return [
      {
        clientId: client.id,
        slug: client.slug,
        categories: client.benefits.map((benefit) => benefit.category),
      },
    ];
  }

  const clients = await prisma.client.findMany({
    where: { benefits: { some: {} } },
    select: {
      id: true,
      slug: true,
      benefits: { select: { category: true } },
    },
  });

  return clients.map((client) => ({
    clientId: client.id,
    slug: client.slug,
    categories: client.benefits.map((benefit) => benefit.category),
  }));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const planIndex = args.indexOf("--plan");
  const planArgument = planIndex >= 0 ? args[planIndex + 1] ?? null : null;

  if (!planArgument && !args.includes("--all")) {
    console.error("Usage: --plan <clientIdOrSlug> | --all  [--dry-run]");
    process.exit(1);
  }

  const targets = await loadTargets(planArgument);
  if (targets.length === 0) {
    console.log("No plans matched. Nothing to do.");
    return;
  }

  console.log(
    `${dryRun ? "DRY RUN — " : ""}syncing the library with ${targets.length} plan(s)`,
  );

  let totalTopics = 0;
  let totalGroups = 0;
  let totalPlacements = 0;
  let totalRegrouped = 0;
  let totalHidden = 0;
  let totalDropped = 0;

  for (const target of targets) {
    const lines: string[] = [];

    for (const category of target.categories) {
      if (dryRun) {
        const preview = await previewCategory(target.clientId, category);
        if (!preview.location) {
          lines.push(`    ${category}: not a benefit location — skipped`);
          continue;
        }
        if (!preview.onFramework) {
          lines.push(
            `    ${category} (${preview.location}): legacy plan, no placements — skipped`,
          );
          continue;
        }
        const realign = await realignGroups(target.clientId, category, true);
        totalRegrouped += realign?.regrouped ?? 0;
        totalHidden += realign?.hidden ?? 0;
        totalDropped += realign?.droppedGroups ?? 0;
        const realignNote = realign
          ? `, ${realign.regrouped} to regroup, ${realign.hidden} to hide, ` +
            `${realign.droppedGroups} group(s) to drop` +
            (realign.createdGroups
              ? `, ${realign.createdGroups} group(s) to create`
              : "")
          : "";
        lines.push(
          `    ${category} (${preview.location}): ` +
            (preview.missing.length
              ? `${preview.missing.length} missing — ${preview.missing.join(", ")}`
              : "up to date") +
            realignNote,
        );
        continue;
      }

      const result = await syncCategory(target.clientId, category);
      if (!result.location) {
        lines.push(`    ${category}: not a benefit location — skipped`);
        continue;
      }
      const realign = await realignGroups(target.clientId, category, false);
      totalTopics += result.createdTopics;
      totalGroups += result.createdGroups;
      totalPlacements += result.createdPlacements;
      totalRegrouped += realign?.regrouped ?? 0;
      totalHidden += realign?.hidden ?? 0;
      totalDropped += realign?.droppedGroups ?? 0;
      lines.push(
        `    ${category} (${result.location}): ` +
          `${result.createdTopics} topic(s), ${result.createdGroups} group(s), ` +
          `${result.createdPlacements} placement(s); ` +
          `${realign?.regrouped ?? 0} regrouped, ${realign?.hidden ?? 0} hidden, ` +
          `${realign?.droppedGroups ?? 0} group(s) dropped`,
      );
    }

    console.log(
      `  ${target.clientId}${target.slug ? ` (${target.slug})` : ""}`,
    );
    for (const line of lines) console.log(line);
  }

  console.log(
    dryRun
      ? `Dry run finished; nothing was written. Planned: ${totalRegrouped} ` +
          `regrouped, ${totalHidden} hidden, ${totalDropped} group(s) dropped.`
      : `Sync finished — created ${totalTopics} topic(s), ${totalGroups} group(s), ` +
          `${totalPlacements} placement(s); ${totalRegrouped} regrouped, ` +
          `${totalHidden} hidden, ${totalDropped} group(s) dropped.`,
  );
}

main()
  .catch((error) => {
    console.error("[topics:backfill-content] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
