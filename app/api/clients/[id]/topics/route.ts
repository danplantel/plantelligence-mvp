import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  TOPIC_LOCATION_CATEGORY,
  isTopicLocation,
  topicLocationAccessCategory,
} from "@/lib/topic-locations";
import { applyTopicBoard, loadTopicBoard } from "@/lib/topics/board.server";
import { resolveBuilderClient } from "@/lib/topics/builder-access.server";
import {
  readTopicBodyBlocks,
  readTopicOverrides,
} from "@/lib/topics/effective-topic";
import { libraryTopicsForLocation } from "@/lib/topics/library";
import { loadPlanMediaLibrary } from "@/lib/topics/media-library";
import { ensureLocationSeeded } from "@/lib/topics/seed-plan-topics";
import type {
  EffectiveTopic,
  TopicBodyBlock,
  TopicLocation,
  TopicPlacementOverrides,
} from "@/types/topic";

/**
 * The admin board for ONE location of ONE plan (TF-3).
 *
 *   GET  ?location=retirement   the zones plus the library the drawer offers
 *   PUT  { location, groups, placements }   reconcile the whole board
 *   POST { location }           seed this location from the library (first use)
 *
 * A single PUT for the complete board is what makes "move a question, rename its
 * group, reorder" one atomic write, and keeps re-sends idempotent. POST exists because
 * a plan that predates the framework has NO placements, and seeding is what gives the
 * Quick Answers section something to edit.
 *
 * Permissions are the plan's `create_benefits` scope for this location's category:
 * view to read, edit to write.
 */

function readLocation(value: string | null): TopicLocation | null {
  // Every location is addressable, Employee Resources included (TF-6): the fifth hub
  // uses the SAME builder, so its board is read and written through this route.
  return isTopicLocation(value) ? value : null;
}

function librarySlug(topic: EffectiveTopic): string {
  return topic.slug.replace(/^sys\./, "");
}

/** The library drawer's contents: this location's shipped topics not already placed. */
function libraryFor(board: Awaited<ReturnType<typeof loadTopicBoard>>) {
  const usedSlugs = new Set(
    [
      ...board.featured,
      ...board.hidden,
      ...board.groups.flatMap((group) => group.topics),
    ].map(librarySlug),
  );

  return libraryTopicsForLocation(board.location)
    .filter((topic) => !usedSlugs.has(topic.slug))
    .map((topic) => ({
      slug: topic.slug,
      title: topic.title,
      summary: topic.summary ?? null,
      isActionHub: topic.isActionHub ?? false,
      displayByDefault: topic.displayByDefault,
      group: topic.group ?? null,
    }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const location = readLocation(request.nextUrl.searchParams.get("location"));
  if (!location) {
    return NextResponse.json(
      { error: "A valid location is required." },
      { status: 400 },
    );
  }

  const access = await resolveBuilderClient({
    id: params.id,
    level: "view",
    category: topicLocationAccessCategory(location),
  });
  if (!access.ok) return access.response;

  try {
    const board = await loadTopicBoard(access.clientId, location);
    // The plan's own documents and videos, so a topic's "Edit text" dialog can
    // attach them by id. Read here so BOTH card lists share one library. This is
    // best-effort: a media read failure must never take the board down with it.
    let media = { documents: [] as unknown[], videos: [] as unknown[] };
    try {
      // Scope the document picker to THIS benefit's category (Employee Resources
      // has none, so it sees the whole plan library) — the same rule the hub's
      // Documents tab uses, so a topic is never offered another benefit's files.
      media = await loadPlanMediaLibrary(access.clientId, {
        category: TOPIC_LOCATION_CATEGORY[location],
      });
    } catch (mediaError) {
      console.error("[topics] media library read failed:", mediaError);
    }
    return NextResponse.json({
      success: true,
      location,
      board,
      library: libraryFor(board),
      media,
    });
  } catch (error) {
    console.error("[topics] board read failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const location = readLocation(
    typeof body?.location === "string" ? body.location : null,
  );
  if (!location) {
    return NextResponse.json(
      { error: "A valid location is required." },
      { status: 400 },
    );
  }

  const access = await resolveBuilderClient({
    id: params.id,
    level: "edit",
    category: topicLocationAccessCategory(location),
  });
  if (!access.ok) return access.response;

  try {
    const result = await applyTopicBoard({
      clientId: access.clientId,
      location,
      board: {
        location,
        groups: Array.isArray(body.groups) ? body.groups : [],
        placements: Array.isArray(body.placements) ? body.placements : [],
      },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // The freshly reconciled board, so the client never guesses at ids for a group it
    // just created.
    const board = await loadTopicBoard(access.clientId, location);
    return NextResponse.json({
      success: true,
      applied: result.applied,
      board,
      library: libraryFor(board),
    });
  } catch (error) {
    console.error("[topics] board write failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const location = readLocation(
    typeof body?.location === "string" ? body.location : null,
  );
  if (!location) {
    return NextResponse.json(
      { error: "A valid location is required." },
      { status: 400 },
    );
  }

  const category = topicLocationAccessCategory(location);
  const access = await resolveBuilderClient({
    id: params.id,
    level: "edit",
    category,
  });
  if (!access.ok) return access.response;

  try {
    // Idempotent: `ensureLocationSeeded` only fills a location that has nothing yet,
    // so pressing this twice cannot duplicate a plan's topics. The LOCATION is passed
    // as well as the category: Employee Resources has no Benefit category, so a
    // category-only lookup could never resolve it and seeding this hub did nothing.
    const seeded = await ensureLocationSeeded({
      clientId: access.clientId,
      category,
      location,
    });
    const board = await loadTopicBoard(access.clientId, location);
    return NextResponse.json({
      success: true,
      seeded: seeded.createdPlacements,
      board,
      library: libraryFor(board),
    });
  } catch (error) {
    console.error("[topics] seeding failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** A trimmed string, or "" — the only shape these fields ever store. */
function trimStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** An overrides object as a Prisma Json input value; empty clears the column. */
function overridesJson(
  value: TopicPlacementOverrides,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
  return Object.keys(value).length > 0
    ? (value as unknown as Prisma.InputJsonObject)
    : Prisma.DbNull;
}

/**
 * PATCH — edit ONE card's copy for THIS plan.
 *
 * The Featured cards and the Quick Answers questions are the same placement board, so
 * editing the text of either writes the placement's `overrides` (see
 * `lib/topics/effective-topic.ts`) rather than the shared Topic row — one plan's edit
 * can never change another's copy. Fields are MERGED into what is stored: an absent
 * key is left alone, `null`/"" removes that override (so the card falls back to the
 * shipped copy), and `bodyBlocks` replaces the answer while the reader keeps the
 * shipped steps around it.
 *
 * Body: `{ location, topicId, overrides: { title?, summary?, bodyBlocks? } }`
 * Returns the refreshed board, exactly like PUT, so the page beside the panel updates
 * in the same frame.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const location = readLocation(
    typeof body?.location === "string" ? body.location : null,
  );
  if (!location) {
    return NextResponse.json(
      { error: "A valid location is required." },
      { status: 400 },
    );
  }

  const topicId = typeof body?.topicId === "string" ? body.topicId : "";
  if (!topicId) {
    return NextResponse.json({ error: "A topicId is required." }, { status: 400 });
  }

  const access = await resolveBuilderClient({
    id: params.id,
    level: "edit",
    category: topicLocationAccessCategory(location),
  });
  if (!access.ok) return access.response;

  try {
    const placement = await prisma.topicPlacement.findFirst({
      where: { clientId: access.clientId, location, topicId },
      select: { id: true, overrides: true },
    });
    if (!placement) {
      return NextResponse.json(
        { error: "That question is not on this page." },
        { status: 404 },
      );
    }

    // Start from what is stored so an edit to one field keeps the others.
    const merged: TopicPlacementOverrides = readTopicOverrides(placement.overrides);
    const incoming =
      body?.overrides && typeof body.overrides === "object"
        ? (body.overrides as Record<string, unknown>)
        : {};

    if (Object.prototype.hasOwnProperty.call(incoming, "title")) {
      const title = trimStr(incoming.title);
      if (title) merged.title = title;
      else delete merged.title;
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "summary")) {
      const summary = trimStr(incoming.summary);
      if (summary) merged.summary = summary;
      else delete merged.summary;
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "bodyBlocks")) {
      if (incoming.bodyBlocks === null) {
        delete merged.bodyBlocks;
      } else if (Array.isArray(incoming.bodyBlocks)) {
        const blocks: TopicBodyBlock[] = readTopicBodyBlocks(incoming.bodyBlocks);
        if (blocks.length > 0) merged.bodyBlocks = blocks;
        else delete merged.bodyBlocks;
      }
    }

    await prisma.topicPlacement.update({
      where: { id: placement.id },
      data: { overrides: overridesJson(merged) },
    });

    const board = await loadTopicBoard(access.clientId, location);
    return NextResponse.json({
      success: true,
      board,
      library: libraryFor(board),
    });
  } catch (error) {
    console.error("[topics] text update failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
