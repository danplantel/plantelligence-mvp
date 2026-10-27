import { NextRequest, NextResponse } from "next/server";
import {
  benefitCategoryForLocation,
  isTopicLocation,
} from "@/lib/topic-locations";
import { applyTopicBoard, loadTopicBoard } from "@/lib/topics/board.server";
import { resolveBuilderClient } from "@/lib/topics/builder-access.server";
import { libraryTopicsForLocation } from "@/lib/topics/library";
import { ensureLocationSeeded } from "@/lib/topics/seed-plan-topics";
import type { EffectiveTopic, TopicLocation } from "@/types/topic";

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
  if (!isTopicLocation(value)) return null;
  // Employee Resources is reserved for TF-6: it has no Benefit category and no
  // builder surface yet, so it is not addressable here.
  return value === "employee_resources" ? null : value;
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
    category: benefitCategoryForLocation(location),
  });
  if (!access.ok) return access.response;

  try {
    const board = await loadTopicBoard(access.clientId, location);
    return NextResponse.json({
      success: true,
      location,
      board,
      library: libraryFor(board),
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
    category: benefitCategoryForLocation(location),
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

  const category = benefitCategoryForLocation(location);
  const access = await resolveBuilderClient({
    id: params.id,
    level: "edit",
    category,
  });
  if (!access.ok) return access.response;

  try {
    // Idempotent: `ensureLocationSeeded` only fills a location that has nothing yet,
    // so pressing this twice cannot duplicate a plan's topics.
    const seeded = await ensureLocationSeeded({ clientId: access.clientId, category });
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
