/**
 * TF-1/TF-4 backfill: turn every existing plan's legacy topic data into placements.
 *
 * A plan's topics have lived in two JSON columns on `Benefit`:
 *
 *   helpCards  the "How Can We Help You Today?" layout — card ids, order, primary, enabled
 *   faqs       the Quick Answers list — question, answer, link
 *
 * This script imports both into the topic framework, then leaves the JSON alone. The
 * read path only switches to placements once a plan is on the rollout list
 * (`lib/topics/read-source.ts`), so running this is safe and reversible.
 *
 * What it does, per plan and per benefit category that maps to a location:
 *
 *   1. Seeds the library defaults (`ensureLocationSeeded`).
 *   2. Re-applies the advisor's card choices: a card the plan showed as Featured stays
 *      Featured, in its order; a card stored as disabled becomes Hidden.
 *      The Account Access card is skipped — it is not a topic (that is TF-9).
 *   3. Imports FAQ items that have no library equivalent as org-scoped topics, in a
 *      "Questions" group, so no copy disappears. An item whose title already exists in
 *      that location is skipped, which is what stops the defaults appearing twice.
 *
 * Usage (see also `pnpm topics:backfill`):
 *   npx tsx scripts/topics/backfill-topic-placements.ts --plan <clientId> [--dry-run]
 *   npx tsx scripts/topics/backfill-topic-placements.ts --all [--dry-run]
 */

import { Prisma } from "@prisma/client";
import {
  ACCOUNT_ACCESS_CARD_ID,
  getHelpCardContent,
} from "../../lib/help-card-defaults";
import { topicLocationForCategory } from "../../lib/topic-locations";
import {
  createPrismaTopicSeedStore,
  ensureLocationSeeded,
} from "../../lib/topics/seed-plan-topics";
import { libraryTopicBySlug, systemTopicSlug } from "../../lib/topics/library";
import type { TopicLocation } from "../../types/topic";
import { createPrisma } from "../teammates/shared";

/**
 * A plain `npx tsx` run does not load `.env`; `createPrisma()` does, and widens the
 * pool for a CLI, which is why this script does not use the app's shared client.
 */
const prisma = createPrisma();

const LEGACY_FAQ_GROUP_NAME = "Questions";

interface LegacyCardEntry {
  id: string;
  enabled: boolean;
}

interface LegacyFaq {
  id?: string;
  question?: string;
  answer?: string;
  linkLabel?: string;
  linkHref?: string;
  enabled?: boolean;
}

interface PlanTarget {
  clientId: string;
  organizationId: string | null;
  categories: string[];
}

function normalize(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** `helpCards` is stored as entry objects, but a bare id list has been accepted too. */
function readLegacyCards(value: unknown): LegacyCardEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return { id: entry, enabled: true };
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      if (!id) return null;
      return { id, enabled: record.enabled !== false };
    })
    .filter((entry): entry is LegacyCardEntry => entry !== null);
}

function readLegacyFaqs(value: unknown): LegacyFaq[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is LegacyFaq => !!entry && typeof entry === "object",
  );
}

/** An org topic's slug, namespaced so it can never collide with a system one. */
function orgTopicSlug(organizationId: string, seed: string): string {
  return `org.${organizationId}.${slugify(seed)}`;
}

/**
 * Create (once) or find the org-scoped topic that stands in for a legacy FAQ item.
 */
async function upsertOrgTopic(params: {
  organizationId: string;
  slug: string;
  title: string;
  answer: string;
  location: TopicLocation;
  linkHref?: string;
  linkLabel?: string;
}) {
  const { organizationId, slug, title, answer, location } = params;
  const bodyBlocks = answer
    ? ([{ type: "quick_answer", text: answer }] as Prisma.InputJsonValue)
    : undefined;
  const defaultCta = params.linkHref
    ? ({
        label: params.linkLabel || "Learn more",
        actionType: "external_url",
        destination: params.linkHref,
      } as Prisma.InputJsonValue)
    : undefined;

  return prisma.topic.upsert({
    where: { slug },
    // Never rewrite an org topic's copy on a re-run — the advisor may have edited it.
    update: {},
    create: {
      scope: "org",
      organizationId,
      slug,
      title,
      bodyBlocks,
      defaultCta,
      defaultLocations: [location],
    },
  });
}

/** Put a placement where the legacy card sat, or leave an existing one alone. */
async function placeTopic(params: {
  clientId: string;
  topicId: string;
  location: TopicLocation;
  displayMode: "featured" | "quick_answers" | "hidden";
  groupId?: string | null;
  sortOrder: number;
}) {
  return prisma.topicPlacement.upsert({
    where: {
      clientId_topicId_location: {
        clientId: params.clientId,
        topicId: params.topicId,
        location: params.location,
      },
    },
    update: {
      displayMode: params.displayMode,
      groupId: params.groupId ?? null,
      sortOrder: params.sortOrder,
    },
    create: {
      clientId: params.clientId,
      topicId: params.topicId,
      location: params.location,
      displayMode: params.displayMode,
      groupId: params.groupId ?? null,
      sortOrder: params.sortOrder,
    },
  });
}

/**
 * Mirror the plan's saved card layout onto the seeded placements.
 *
 * A card id that exists in the shipped library re-uses that topic. Any other id
 * (a catalogue card the library does not ship as a default, e.g. Medicare) is created
 * as an org topic from the catalogue copy, so the participant's page keeps the card
 * it has today.
 */
async function applyLegacyCardLayout(params: {
  clientId: string;
  organizationId: string | null;
  location: TopicLocation;
  helpCards: unknown;
}): Promise<number> {
  const { clientId, organizationId, location } = params;
  const cards = readLegacyCards(params.helpCards).filter(
    (card) => card.id !== ACCOUNT_ACCESS_CARD_ID,
  );
  let placed = 0;

  for (const [index, card] of cards.entries()) {
    const library = libraryTopicBySlug(card.id);
    let topicId: string | null = null;

    if (library) {
      const topic = await prisma.topic.findUnique({
        where: { slug: systemTopicSlug(library.slug) },
        select: { id: true },
      });
      topicId = topic?.id ?? null;
    } else if (organizationId) {
      const content = getHelpCardContent(card.id);
      const created = await upsertOrgTopic({
        organizationId,
        slug: orgTopicSlug(organizationId, `legacy-card-${card.id}`),
        title: content?.title || card.id,
        answer: (content?.paragraphs ?? []).join(" "),
        location,
      });
      topicId = created.id;
    }

    if (!topicId) continue;

    await placeTopic({
      clientId,
      topicId,
      location,
      // The advisor's page is the source of truth at cut-over: a card they showed stays
      // a Featured card, in its saved order; a card they unticked becomes Hidden.
      displayMode: card.enabled ? "featured" : "hidden",
      sortOrder: index,
    });
    placed += 1;
  }

  return placed;
}

/** Import FAQ items that have no library equivalent, in one trailing group. */
async function importLegacyFaqs(params: {
  clientId: string;
  organizationId: string | null;
  location: TopicLocation;
  faqs: unknown;
}): Promise<number> {
  const { clientId, organizationId, location } = params;
  if (!organizationId) return 0;

  const existing = await prisma.topicPlacement.findMany({
    where: { clientId, location },
    include: { topic: { select: { title: true } } },
  });
  // Titles already placed in this location — a legacy FAQ matching one of these would
  // otherwise duplicate the shipped default.
  const takenTitles = new Set(
    existing.map((placement) => normalize(placement.topic.title)),
  );

  let order =
    existing
      .filter((placement) => placement.displayMode === "quick_answers")
      .reduce((max, placement) => Math.max(max, placement.sortOrder), -1) + 1;

  let groupId: string | null = null;
  let imported = 0;

  for (const faq of readLegacyFaqs(params.faqs)) {
    const title = (faq.question || "").trim();
    if (!title) continue;
    const key = normalize(title);
    if (takenTitles.has(key)) continue;

    if (!groupId) {
      const group = await prisma.accordionGroup.upsert({
        where: {
          clientId_location_name: {
            clientId,
            location,
            name: LEGACY_FAQ_GROUP_NAME,
          },
        },
        update: {},
        create: {
          clientId,
          location,
          name: LEGACY_FAQ_GROUP_NAME,
          sortOrder: 99,
        },
      });
      groupId = group.id;
    }

    const topic = await upsertOrgTopic({
      organizationId,
      slug: orgTopicSlug(organizationId, `faq-${faq.id || title}`),
      title,
      answer: (faq.answer || "").trim(),
      location,
      linkHref: faq.linkHref,
      linkLabel: faq.linkLabel,
    });

    await placeTopic({
      clientId,
      topicId: topic.id,
      location,
      // A legacy `enabled: false` item keeps its place in the builder, hidden.
      displayMode: faq.enabled === false ? "hidden" : "quick_answers",
      groupId,
      sortOrder: order,
    });

    takenTitles.add(key);
    order += 1;
    imported += 1;
  }

  return imported;
}

async function backfillPlan(target: PlanTarget, dryRun: boolean) {
  const summary = {
    plan: target.clientId,
    categories: 0,
    cards: 0,
    faqs: 0,
    skipped: [] as string[],
  };

  for (const category of target.categories) {
    const location = topicLocationForCategory(category);
    if (!location) {
      summary.skipped.push(`${category} (not a benefit location)`);
      continue;
    }

    if (!dryRun) {
      await ensureLocationSeeded({
        clientId: target.clientId,
        category,
        store: createPrismaTopicSeedStore(prisma),
      });
    }
    summary.categories += 1;

    const benefit = await prisma.benefit.findFirst({
      where: { clientId: target.clientId, category },
      select: { helpCards: true, faqs: true },
    });
    if (!benefit) continue;

    if (dryRun) {
      summary.cards += readLegacyCards(benefit.helpCards).filter(
        (card) => card.id !== ACCOUNT_ACCESS_CARD_ID,
      ).length;
      summary.faqs += readLegacyFaqs(benefit.faqs).length;
      continue;
    }

    summary.cards += await applyLegacyCardLayout({
      clientId: target.clientId,
      organizationId: target.organizationId,
      location,
      helpCards: benefit.helpCards,
    });
    summary.faqs += await importLegacyFaqs({
      clientId: target.clientId,
      organizationId: target.organizationId,
      location,
      faqs: benefit.faqs,
    });
  }

  return summary;
}

async function loadTargets(planArgument: string | null): Promise<PlanTarget[]> {
  if (planArgument) {
    const client = await prisma.client.findFirst({
      where: {
        OR: [{ id: planArgument }, { slug: planArgument }],
      },
      select: { id: true, organizationId: true, benefits: { select: { category: true } } },
    });
    if (!client) return [];
    return [
      {
        clientId: client.id,
        organizationId: client.organizationId,
        categories: client.benefits.map((benefit) => benefit.category),
      },
    ];
  }

  const clients = await prisma.client.findMany({
    where: { benefits: { some: {} } },
    select: {
      id: true,
      organizationId: true,
      benefits: { select: { category: true } },
    },
  });

  return clients.map((client) => ({
    clientId: client.id,
    organizationId: client.organizationId,
    categories: client.benefits.map((benefit) => benefit.category),
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const planIndex = args.indexOf("--plan");
  const planArgument =
    planIndex >= 0 ? args[planIndex + 1] ?? null : null;
  const all = args.includes("--all") || !planArgument;

  if (!all && !planArgument) {
    console.error(
      "Usage: --plan <clientIdOrSlug> | --all  [--dry-run]",
    );
    process.exit(1);
  }

  const targets = await loadTargets(planArgument);
  if (targets.length === 0) {
    console.log("No plans matched. Nothing to do.");
    return;
  }

  console.log(
    `${dryRun ? "DRY RUN — " : ""}backfilling ${targets.length} plan(s)`,
  );

  const results = [];
  for (const target of targets) {
    results.push(await backfillPlan(target, dryRun));
  }

  for (const result of results) {
    console.log(
      `  ${result.plan}: ${result.categories} location(s), ` +
        `${result.cards} card(s), ${result.faqs} FAQ(s)` +
        (result.skipped.length ? ` — skipped ${result.skipped.join(", ")}` : ""),
    );
  }

  console.log(
    dryRun
      ? "Dry run finished; nothing was written."
      : "Backfill finished. Plans keep reading legacy JSON until they are listed in TOPIC_FRAMEWORK_PLANS.",
  );
}

main()
  .catch((error) => {
    console.error("[topics:backfill] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
