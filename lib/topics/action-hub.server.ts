import prisma from "@/lib/prisma";
import {
  benefitCategoryToVisibilityKey,
  getCategoryPortalVisibility,
} from "@/lib/portal-category-visibility";
import { benefitCategoryForLocation, isBenefitCategoryLocation } from "@/lib/topic-locations";
import {
  resolveActionHubRows,
  type ActionHubCandidate,
} from "@/lib/topics/action-hub";
import { readActionHubLink } from "@/lib/topics/effective-topic";
import type { ActionHubRow, TopicLocation } from "@/types/topic";

/**
 * Reading Action Hub panels for ONE plan (TF-5, handoff §6).
 *
 * Server-only. The rules are in `action-hub.ts`; this assembles the candidates for a
 * set of topics and lets the pure resolver decide what renders.
 *
 * A topic is an Action Hub because the SAME action exists in more than one benefit, so
 * the panel's rows are the topic's OTHER placements in this plan. Three reads, all
 * scoped by `clientId` — there is no query here that can see another plan's rows:
 *
 *   1. the topic's placements (where else does this plan hold it, and what sub-link
 *      did the advisor set for each?);
 *   2. the plan's Portal Visibility (a category switched off contributes no row);
 *   3. those categories' Benefit rows (provider login URL, then the provider's own
 *      site, then the provider's email address).
 *
 * Nothing here is fatal: a participant's benefit page must still render if this lookup
 * fails, so a thrown query degrades to "no panels".
 */

/** The provider fields a row can fall back to, from `Benefit.providerContact`. */
interface ProviderContactLike {
  websiteUrl?: unknown;
  email?: unknown;
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readProviderContact(value: unknown): ProviderContactLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ProviderContactLike;
}

/**
 * The panels for a set of topics, keyed by `topicId`.
 *
 * Topics with nothing to show are simply absent from the map, so the caller can pass
 * the whole thing straight to the participants' components and spread the props
 * without filtering again.
 */
export async function loadActionHubPanels(params: {
  clientId: string;
  topicIds: readonly string[];
}): Promise<Record<string, ActionHubRow[]>> {
  const clientId = (params.clientId || "").trim();
  const topicIds = Array.from(new Set((params.topicIds || []).filter(Boolean)));
  if (!clientId || topicIds.length === 0) return {};

  try {
    const placementRows = await prisma.topicPlacement.findMany({
      where: {
        clientId,
        topicId: { in: topicIds },
        // A hidden placement is off the page, so it must not add a row either.
        displayMode: { not: "hidden" },
      },
      select: { topicId: true, location: true, actionHubLink: true },
    });

    if (placementRows.length === 0) return {};

    const locations = new Set<TopicLocation>();
    for (const row of placementRows) {
      const location = row.location as TopicLocation;
      if (isBenefitCategoryLocation(location)) locations.add(location);
    }
    if (locations.size === 0) return {};

    const categories = Array.from(locations)
      .map(benefitCategoryForLocation)
      .filter((category): category is string => !!category);

    const [plan, benefits] = await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        select: { categoryPortalVisibility: true },
      }),
      prisma.benefit.findMany({
        where: { clientId, category: { in: categories } },
        select: {
          category: true,
          insuranceLoginUrl: true,
          providerContact: true,
        },
      }),
    ]);

    const visibility = getCategoryPortalVisibility(plan?.categoryPortalVisibility);
    const benefitByCategory = new Map(benefits.map((row) => [row.category, row]));

    const result: Record<string, ActionHubRow[]> = {};

    for (const topicId of topicIds) {
      const candidates: ActionHubCandidate[] = placementRows
        .filter((row) => row.topicId === topicId)
        .map((row) => {
          const location = row.location as TopicLocation;
          const category = benefitCategoryForLocation(location);
          const benefit = category ? benefitByCategory.get(category) : undefined;
          const provider = readProviderContact(benefit?.providerContact);

          return {
            location,
            link: readActionHubLink(row.actionHubLink),
            // The plan's own login URL is the real destination — the provider's
            // marketing site is a worse answer and only comes second.
            providerUrl:
              asTrimmedString(benefit?.insuranceLoginUrl) ||
              asTrimmedString(provider.websiteUrl),
            contactUrl: asTrimmedString(provider.email),
            visible: category
              ? visibility[benefitCategoryToVisibilityKey(category)] !== false
              : true,
          };
        });

      const rows = resolveActionHubRows(candidates);
      if (rows.length > 0) result[topicId] = rows;
    }

    return result;
  } catch (error) {
    console.error("[topics] action hub resolve failed:", clientId, error);
    return {};
  }
}
