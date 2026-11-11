import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { topicLocationForCategory } from "@/lib/topic-locations";
import {
  DEFAULT_QUICK_ANSWER_GROUPS,
  libraryTopicsForLocation,
  libraryTopicsForStarterSet,
  systemTopicSlug,
  type CustomStarterSetId,
  type LibraryTopicSeed,
} from "@/lib/topics/library";
import type {
  AccordionGroupRecord,
  TopicBodyBlock,
  TopicCta,
  TopicLocation,
  TopicPlacementRecord,
  TopicRecord,
} from "@/types/topic";

/**
 * Seeding a plan's topics from the shipped library.
 *
 * Storage is injected (`TopicSeedStore`) for two reasons:
 *
 *  1. **Testability.** Plan isolation is the one thing this must never get wrong, and
 *     an in-memory store lets that be proved directly: seed plan A, seed plan B, then
 *     change A's placement and assert B's rows are untouched.
 *  2. **One implementation of the rules.** The Prisma adapter and the tests exercise
 *     the same code path, so a test cannot pass against logic the app does not run.
 *
 * Seeding NEVER overwrites:
 *  - an existing Topic (the library is shared; a plan never edits it),
 *  - an existing placement (its display mode, group and order belong to the advisor).
 *
 * Re-running is therefore safe: it only fills in what is missing.
 */

// ── Store contract ───────────────────────────────────────────────────────────

export interface NewTopicInput {
  slug: string;
  title: string;
  summary?: string | null;
  /** The answer blocks the panel renders (quick answer, steps, links). */
  bodyBlocks?: TopicBodyBlock[] | null;
  isActionHub?: boolean;
  defaultLocations: TopicLocation[];
  defaultCta?: TopicCta | null;
  tags?: string[];
}

export interface NewGroupInput {
  clientId: string;
  location: TopicLocation;
  name: string;
  sortOrder: number;
}

export interface NewPlacementInput {
  clientId: string;
  topicId: string;
  location: TopicLocation;
  displayMode: "featured" | "quick_answers" | "hidden";
  groupId?: string | null;
  sortOrder: number;
}

export interface TopicSeedStore {
  findTopicsBySlug(slugs: string[]): Promise<TopicRecord[]>;
  createTopic(input: NewTopicInput): Promise<TopicRecord>;
  listGroups(clientId: string, location: TopicLocation): Promise<AccordionGroupRecord[]>;
  createGroup(input: NewGroupInput): Promise<AccordionGroupRecord>;
  listPlacements(
    clientId: string,
    location: TopicLocation,
  ): Promise<TopicPlacementRecord[]>;
  createPlacement(input: NewPlacementInput): Promise<TopicPlacementRecord>;
}

/**
 * The production adapter. Every query is plan-scoped by `clientId`.
 *
 * The client is injectable because the CLI backfill script builds its own (it has to
 * load `.env` itself, which `next` does for the app). In the app the shared singleton
 * is used, so nothing changes.
 */
export function createPrismaTopicSeedStore(
  prisma: PrismaClient = defaultPrisma,
): TopicSeedStore {
  return {
    async findTopicsBySlug(slugs) {
      if (slugs.length === 0) return [];
      const rows = await prisma.topic.findMany({
        where: { slug: { in: slugs } },
      });
      return rows.map((row) => ({
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
    },

    async createTopic(input) {
      const row = await prisma.topic.create({
        data: {
          scope: "system",
          slug: input.slug,
          title: input.title,
          summary: input.summary ?? null,
          isActionHub: input.isActionHub ?? false,
          defaultLocations: input.defaultLocations,
          // Json columns need the structural cast: a plain interface is not
          // assignable to Prisma's index-signature JSON input type.
          bodyBlocks: (input.bodyBlocks ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          defaultCta: (input.defaultCta ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          tags: input.tags ?? [],
        },
      });
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
    },

    async listGroups(clientId, location) {
      const rows = await prisma.accordionGroup.findMany({
        where: { clientId, location },
        orderBy: [{ sortOrder: "asc" }],
      });
      return rows.map((row) => ({
        id: row.id,
        clientId: row.clientId,
        location: row.location as TopicLocation,
        name: row.name,
        sortOrder: row.sortOrder,
      }));
    },

    async createGroup(input) {
      const row = await prisma.accordionGroup.create({
        data: {
          clientId: input.clientId,
          location: input.location,
          name: input.name,
          sortOrder: input.sortOrder,
        },
      });
      return {
        id: row.id,
        clientId: row.clientId,
        location: row.location as TopicLocation,
        name: row.name,
        sortOrder: row.sortOrder,
      };
    },

    async listPlacements(clientId, location) {
      const rows = await prisma.topicPlacement.findMany({
        where: { clientId, location },
        orderBy: [{ sortOrder: "asc" }],
      });
      return rows.map((row) => ({
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
    },

    async createPlacement(input) {
      const row = await prisma.topicPlacement.create({
        data: {
          clientId: input.clientId,
          topicId: input.topicId,
          location: input.location,
          displayMode: input.displayMode,
          groupId: input.groupId ?? null,
          sortOrder: input.sortOrder,
        },
      });
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
    },
  };
}

// ── Seeding ──────────────────────────────────────────────────────────────────

export interface SeedTopicsResult {
  seeded: boolean;
  location: TopicLocation | null;
  createdTopics: number;
  createdGroups: number;
  createdPlacements: number;
}

const NOTHING_SEEDED: SeedTopicsResult = {
  seeded: false,
  location: null,
  createdTopics: 0,
  createdGroups: 0,
  createdPlacements: 0,
};

/**
 * Collapse duplicate slugs.
 *
 * A topic can appear once per location in the library ("Update My Beneficiaries" is
 * both a Retirement and a Group Life card), and it is ONE Topic row. Locations are
 * merged so the created topic describes every hub it belongs to.
 */
function dedupeSeedTopics(seeds: LibraryTopicSeed[]): LibraryTopicSeed[] {
  const bySlug = new Map<string, LibraryTopicSeed>();

  for (const seed of seeds) {
    const existing = bySlug.get(seed.slug);
    if (!existing) {
      bySlug.set(seed.slug, {
        ...seed,
        defaultLocations: [...seed.defaultLocations],
      });
      continue;
    }
    for (const location of seed.defaultLocations) {
      if (!existing.defaultLocations.includes(location)) {
        existing.defaultLocations.push(location);
      }
    }
  }

  return [...bySlug.values()];
}

/** The declared group order, then any group the seeds mention but the list omits. */
function groupOrderFor(
  location: TopicLocation,
  seeds: LibraryTopicSeed[],
): string[] {
  const declared = [...(DEFAULT_QUICK_ANSWER_GROUPS[location] ?? [])];
  const seen = new Set(declared);

  for (const seed of seeds) {
    if (seed.displayByDefault !== "quick_answers") continue;
    const group = (seed.group || "").trim();
    if (!group || seen.has(group)) continue;
    seen.add(group);
    declared.push(group);
  }

  return declared;
}

/**
 * Seed one location of one plan from the shipped library.
 *
 * `clientId` is present in every write, and the store is the only thing that touches
 * storage — so a plan can only ever receive its own placements.
 */
export async function seedLocationTopics(params: {
  clientId: string;
  category?: string | null;
  location?: TopicLocation | null;
  seeds?: LibraryTopicSeed[];
  store?: TopicSeedStore;
}): Promise<SeedTopicsResult> {
  const clientId = (params.clientId || "").trim();
  if (!clientId) return NOTHING_SEEDED;

  const location =
    params.location ?? topicLocationForCategory(params.category);
  // Employee Resources and an unknown category have no defaults to seed.
  if (!location) return NOTHING_SEEDED;

  const seeds = dedupeSeedTopics(
    params.seeds ?? libraryTopicsForLocation(location),
  );
  if (seeds.length === 0) return NOTHING_SEEDED;

  const store = params.store ?? createPrismaTopicSeedStore();

  // 1. Groups, in declared order.
  const existingGroups = await store.listGroups(clientId, location);
  const groupByName = new Map(existingGroups.map((group) => [group.name, group]));
  let createdGroups = 0;

  for (const [index, name] of groupOrderFor(location, seeds).entries()) {
    if (groupByName.has(name)) continue;
    const created = await store.createGroup({
      clientId,
      location,
      name,
      sortOrder: index,
    });
    groupByName.set(name, created);
    createdGroups += 1;
  }

  // 2. Topics — created once and shared; an existing one is left exactly as it is.
  const slugs = seeds.map((seed) => systemTopicSlug(seed.slug));
  const existingTopics = await store.findTopicsBySlug(slugs);
  const topicBySlug = new Map(existingTopics.map((topic) => [topic.slug, topic]));
  let createdTopics = 0;

  for (const seed of seeds) {
    const slug = systemTopicSlug(seed.slug);
    if (topicBySlug.has(slug)) continue;
    const created = await store.createTopic({
      slug,
      title: seed.title,
      summary: seed.summary ?? null,
      bodyBlocks: seed.bodyBlocks ?? null,
      isActionHub: seed.isActionHub ?? false,
      defaultLocations: seed.defaultLocations,
      defaultCta: seed.cta ?? null,
      tags: seed.tags ?? [],
    });
    topicBySlug.set(slug, created);
    createdTopics += 1;
  }

  // 3. Placements — only where the plan does not already have one for this location.
  const existingPlacements = await store.listPlacements(clientId, location);
  const placedTopicIds = new Set(
    existingPlacements.map((placement) => placement.topicId),
  );
  let createdPlacements = 0;

  // Featured cards, hidden cards and each group's questions are ordered
  // independently, which is what the builder shows and what the resolver reads
  // back. Hidden is its own zone: a conditionally-off card must not consume a
  // featured position, or promoting it later would land it out of order.
  let featuredOrder = 0;
  let hiddenOrder = 0;
  const groupCounters = new Map<string, number>();

  for (const seed of seeds) {
    const topic = topicBySlug.get(systemTopicSlug(seed.slug));
    if (!topic || placedTopicIds.has(topic.id)) continue;

    let sortOrder: number;
    let groupId: string | null = null;

    if (seed.displayByDefault === "quick_answers") {
      const group =
        seed.group && groupByName.get(seed.group)
          ? groupByName.get(seed.group)!
          : null;
      groupId = group?.id ?? null;
      const key = groupId ?? "__ungrouped__";
      sortOrder = groupCounters.get(key) ?? 0;
      groupCounters.set(key, sortOrder + 1);
    } else if (seed.displayByDefault === "featured") {
      sortOrder = featuredOrder;
      featuredOrder += 1;
    } else {
      sortOrder = hiddenOrder;
      hiddenOrder += 1;
    }

    await store.createPlacement({
      clientId,
      topicId: topic.id,
      location,
      displayMode: seed.displayByDefault,
      groupId,
      sortOrder,
    });
    placedTopicIds.add(topic.id);
    createdPlacements += 1;
  }

  return {
    seeded: true,
    location,
    createdTopics,
    createdGroups,
    createdPlacements,
  };
}

/**
 * Add topics the shipped library has GAINED since a location was seeded.
 *
 * Seeding never overwrites a row and never re-adds a topic the advisor took off
 * the page — but a content pass ADDS topics (Contribution limits,
 * Auto-escalation, …) that a plan seeded before it has never had. Those are
 * safe to add: an advisor takes a topic off the page by setting its placement to
 * "hidden", and nothing in the app deletes a placement, so "this location has no
 * placement for this library topic" can only mean the plan never received it.
 *
 * The test is per PLACEMENT, not per Topic row. Topic rows are shared across
 * plans: the first plan that saves after a content pass creates
 * `sys.contribution-limits`, and every other plan must still get its own
 * placement for it. Keying on the row would make the topic appear on one plan
 * and silently skip the rest, which is the bug this function exists to fix.
 *
 * Idempotent and cheap: one slug lookup and one placement list per call, writes
 * only for topics this location does not hold yet.
 */
export async function syncNewLibraryTopics(params: {
  clientId: string;
  category?: string | null;
  store?: TopicSeedStore;
}): Promise<SeedTopicsResult> {
  const clientId = (params.clientId || "").trim();
  if (!clientId) return NOTHING_SEEDED;

  const location = topicLocationForCategory(params.category);
  if (!location) return NOTHING_SEEDED;

  const seeds = dedupeSeedTopics(libraryTopicsForLocation(location));
  if (seeds.length === 0) return NOTHING_SEEDED;

  const store = params.store ?? createPrismaTopicSeedStore();

  // Only plans already ON the framework get new library topics. A legacy plan
  // has no placements; adding a handful would flip its read source and replace
  // its whole page with those few topics.
  const existingPlacements = await store.listPlacements(clientId, location);
  if (existingPlacements.length === 0) {
    return { ...NOTHING_SEEDED, location };
  }

  const existingTopics = await store.findTopicsBySlug(
    seeds.map((seed) => systemTopicSlug(seed.slug)),
  );
  const topicBySlug = new Map(
    existingTopics.map((topic) => [topic.slug, topic]),
  );
  const placedTopicIds = new Set(
    existingPlacements.map((placement) => placement.topicId),
  );
  const missing = seeds.filter((seed) => {
    const topic = topicBySlug.get(systemTopicSlug(seed.slug));
    // No row yet, or a row another plan created but this location never got.
    return !topic || !placedTopicIds.has(topic.id);
  });
  if (missing.length === 0) {
    return { ...NOTHING_SEEDED, location };
  }

  // Groups those new topics need (a plan seeded earlier may not have them yet).
  const existingGroups = await store.listGroups(clientId, location);
  const groupByName = new Map(existingGroups.map((group) => [group.name, group]));
  let createdGroups = 0;
  for (const [index, name] of groupOrderFor(location, missing).entries()) {
    if (groupByName.has(name)) continue;
    const created = await store.createGroup({
      clientId,
      location,
      name,
      sortOrder: existingGroups.length + index,
    });
    groupByName.set(name, created);
    createdGroups += 1;
  }

  let featuredOrder = existingPlacements.filter(
    (placement) => placement.displayMode === "featured",
  ).length;
  let hiddenOrder = existingPlacements.filter(
    (placement) => placement.displayMode === "hidden",
  ).length;
  const groupCounters = new Map<string, number>();
  for (const placement of existingPlacements) {
    if (placement.displayMode !== "quick_answers") continue;
    const key = placement.groupId ?? "__ungrouped__";
    groupCounters.set(key, Math.max(groupCounters.get(key) ?? 0, placement.sortOrder + 1));
  }

  let createdTopics = 0;
  let createdPlacements = 0;

  for (const seed of missing) {
    const slug = systemTopicSlug(seed.slug);
    let topic = topicBySlug.get(slug);
    if (!topic) {
      topic = await store.createTopic({
        slug,
        title: seed.title,
        summary: seed.summary ?? null,
        bodyBlocks: seed.bodyBlocks ?? null,
        isActionHub: seed.isActionHub ?? false,
        defaultLocations: seed.defaultLocations,
        defaultCta: seed.cta ?? null,
        tags: seed.tags ?? [],
      });
      topicBySlug.set(slug, topic);
      createdTopics += 1;
    }
    if (!topic?.id || placedTopicIds.has(topic.id)) continue;

    let sortOrder: number;
    let groupId: string | null = null;
    if (seed.displayByDefault === "quick_answers") {
      groupId = (seed.group && groupByName.get(seed.group)?.id) || null;
      const key = groupId ?? "__ungrouped__";
      sortOrder = groupCounters.get(key) ?? 0;
      groupCounters.set(key, sortOrder + 1);
    } else if (seed.displayByDefault === "featured") {
      sortOrder = featuredOrder;
      featuredOrder += 1;
    } else {
      sortOrder = hiddenOrder;
      hiddenOrder += 1;
    }

    await store.createPlacement({
      clientId,
      topicId: topic.id,
      location,
      displayMode: seed.displayByDefault,
      groupId,
      sortOrder,
    });
    placedTopicIds.add(topic.id);
    createdPlacements += 1;
  }

  return {
    seeded: true,
    location,
    createdTopics,
    createdGroups,
    createdPlacements,
  };
}

/**
 * Seed a category's location only if the plan has nothing there yet.
 *
 * This is the lazy path for plans created before the framework shipped: opening an
 * existing hub fills in its defaults exactly once, and never re-adds a topic the
 * advisor removed (a removal is a placement delete, and any remaining placement is
 * enough to prove the location was seeded).
 */
export async function ensureLocationSeeded(params: {
  clientId: string;
  category?: string | null;
  store?: TopicSeedStore;
}): Promise<SeedTopicsResult> {
  const clientId = (params.clientId || "").trim();
  const location = topicLocationForCategory(params.category);
  if (!clientId || !location) return NOTHING_SEEDED;

  const store = params.store ?? createPrismaTopicSeedStore();
  const existing = await store.listPlacements(clientId, location);
  if (existing.length > 0) {
    return { ...NOTHING_SEEDED, location };
  }

  return seedLocationTopics({ clientId, category: params.category, store });
}

/**
 * Seed the Custom hub from a starter-set suggestion (Wellness, Voluntary, …).
 *
 * Custom has no fixed defaults, so this is only called after the advisor accepts a
 * suggestion in the builder. Nothing here runs automatically.
 */
export async function seedCustomStarterSet(params: {
  clientId: string;
  setId: CustomStarterSetId;
  store?: TopicSeedStore;
}): Promise<SeedTopicsResult> {
  return seedLocationTopics({
    clientId: params.clientId,
    location: "custom",
    seeds: libraryTopicsForStarterSet(params.setId),
    store: params.store,
  });
}
