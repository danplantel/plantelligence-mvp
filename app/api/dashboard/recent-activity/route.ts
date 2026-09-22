export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { ActivityItem } from "@/lib/recent-activity";

/** Rows pulled from each source before merging; the feed only needs the newest few. */
const PER_SOURCE_LIMIT = 8;

/** Total items handed to the feed. */
const FEED_LIMIT = 12;

/** Marketing asset type → the noun used in the feed line. */
const ASSET_TYPE_LABELS: Record<string, string> = {
  flyer: "Flyer",
  "portal-notice": "Portal notice",
  "pop-up": "Popup",
  "news-post": "News post",
};

/**
 * Recent Activity feed: one merged, newest-first list assembled from the records the
 * dashboard already owns — plans, documents, meetings and marketing assets.
 *
 * Each source is queried separately with its own bound, then mapped into a single item shape
 * and sorted together. There is no activity table, so this reads the domain records directly
 * rather than introducing a second write path that could drift from them.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // The user's plans. One query serves three purposes: the "plan created" events, the
    // plan-name lookup the other sources need, and the id list for sources reached through
    // the client rather than carrying a userId of their own.
    const clients = await prisma.client.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        companyName: true,
        createdAt: true,
        previousName: true,
        nameUpdatedAt: true,
      },
    });

    const clientIds = clients.map((client) => client.id);
    const planNameById = new Map(clients.map((c) => [c.id, c.companyName]));
    const planName = (clientId: string | null | undefined) =>
      clientId ? planNameById.get(clientId) : undefined;

    const [slugs, documents, meetings, assets] = await Promise.all([
      // PortalSlug has no relation to Client, so it is filtered by id. Every slug a plan has
      // ever used lives here: the current row plus one alias per past rename, which is what
      // makes a portal-URL change recoverable. Ordered oldest-first so the original slug is
      // first per plan. Not bounded by PER_SOURCE_LIMIT: the table holds one live row per
      // plan plus one per past rename, and a bounded newest-first take would drop the
      // original slug — the very row "published" needs — for a frequently renamed plan.
      clientIds.length
        ? prisma.portalSlug.findMany({
            where: { clientId: { in: clientIds } },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              slug: true,
              clientId: true,
              retiredAt: true,
              replacedBy: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),

      clientIds.length
        ? prisma.document.findMany({
            where: { clientId: { in: clientIds }, archivedAt: null },
            orderBy: { uploadedAt: "desc" },
            take: PER_SOURCE_LIMIT,
            select: { id: true, title: true, clientId: true, uploadedAt: true },
          })
        : Promise.resolve([]),

      prisma.meeting.findMany({
        where: { userId, archived: { not: true } },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        select: {
          id: true,
          meeting: true,
          client: true,
          clientId: true,
          createdAt: true,
        },
      }),

      prisma.marketingAsset.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        select: {
          id: true,
          headline: true,
          type: true,
          clientId: true,
          createdAt: true,
        },
      }),
    ]);

    // `slugs` is oldest-first, so the first entry per plan is its original slug — when the
    // plan went live. Using the current row's createdAt instead would re-fire a "published"
    // event on every rename, because a rename promotes a brand-new row.
    const publishedSlugs: (typeof slugs)[number][] = [];
    const publishedClientIds = new Set<string>();
    for (const slug of slugs) {
      if (publishedClientIds.has(slug.clientId)) continue;
      publishedClientIds.add(slug.clientId);
      publishedSlugs.push(slug);
    }

    const items: ActivityItem[] = [
      ...clients.slice(0, PER_SOURCE_LIMIT).map((client) => ({
        id: `plan-created-${client.id}`,
        kind: "plan-created" as const,
        title: "New plan created",
        planName: client.companyName,
        at: client.createdAt.toISOString(),
        href: `/edit-client/${client.id}`,
      })),

      // Renames are derived from the plans themselves rather than the newest-created slice,
      // since a plan created long ago can be renamed today.
      ...clients.flatMap((client) =>
        client.nameUpdatedAt
          ? [
              {
                id: `plan-renamed-${client.id}`,
                kind: "plan-renamed" as const,
                title: "Plan renamed",
                // The current name, so the row stays correct if the plan is renamed again.
                planName: client.companyName,
                subject: client.previousName
                  ? `Previously ${client.previousName}`
                  : undefined,
                at: client.nameUpdatedAt.toISOString(),
                href: `/edit-client/${client.id}`,
              },
            ]
          : [],
      ),

      ...publishedSlugs.map((slug) => ({
        id: `plan-published-${slug.id}`,
        kind: "plan-published" as const,
        title: "Plan published",
        planName: planName(slug.clientId),
        at: slug.createdAt.toISOString(),
        href: `/edit-client/${slug.clientId}`,
      })),

      // A retired slug is a portal-URL change: the alias keeps the address the plan used to
      // answer on, the moment it stopped (`retiredAt`), and what replaced it (`replacedBy`).
      ...slugs.flatMap((slug) =>
        slug.retiredAt
          ? [
              {
                id: `portal-url-changed-${slug.id}`,
                kind: "portal-url-changed" as const,
                title: "Portal URL changed",
                planName: planName(slug.clientId),
                subject: slug.replacedBy
                  ? `${slug.slug} → ${slug.replacedBy}`
                  : slug.slug,
                at: slug.retiredAt.toISOString(),
                href: `/edit-client/${slug.clientId}`,
              },
            ]
          : [],
      ),

      ...documents.map((document) => ({
        id: `document-uploaded-${document.id}`,
        kind: "document-uploaded" as const,
        title: "Document uploaded",
        planName: planName(document.clientId),
        subject: document.title,
        at: document.uploadedAt.toISOString(),
        href: `/documents?planId=${encodeURIComponent(document.clientId)}`,
      })),

      ...meetings.map((meeting) => ({
        id: `meeting-added-${meeting.id}`,
        kind: "meeting-added" as const,
        title: "Meeting added",
        // Prefer the live plan name over `meeting.client`, which is a denormalised snapshot
        // taken when the meeting was created — otherwise a renamed plan would keep showing
        // its old name here. The stored name is only the fallback for meetings with no plan.
        planName: planName(meeting.clientId) || meeting.client,
        subject: meeting.meeting,
        at: meeting.createdAt.toISOString(),
        href: "/communications/meetings",
      })),

      ...assets.map((asset) => ({
        id: `marketing-asset-created-${asset.id}`,
        kind: "marketing-asset-created" as const,
        title: `${ASSET_TYPE_LABELS[asset.type] ?? "Marketing asset"} created`,
        planName: planName(asset.clientId),
        subject: asset.headline,
        at: asset.createdAt.toISOString(),
        href: "/communications/marketing",
      })),
    ];

    // ISO 8601 timestamps sort lexicographically in chronological order.
    items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

    return NextResponse.json({
      success: true,
      data: items.slice(0, FEED_LIMIT),
    });
  } catch (error) {
    console.error("Error building recent activity:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
