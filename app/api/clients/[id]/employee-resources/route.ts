import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { planIdOrSlug } from "@/lib/plan-lookup";
import { isLocalDevLoopback, resolvePortalAdvisorId } from "@/lib/portal-access";
import { topicLocationAccessCategory } from "@/lib/topic-locations";
import { resolveBuilderClient } from "@/lib/topics/builder-access.server";
import { loadLocationTopics } from "@/lib/topics/resolve-location";
import { seedLocationTopics } from "@/lib/topics/seed-plan-topics";
import type { TopicLocation } from "@/types/topic";

/**
 * The Employee Resources hub (TF-6).
 *
 * The fifth location uses the SAME template, the SAME placements and the SAME builder
 * as a benefit category, but it is not one: there is no `Benefit` row behind it, so it
 * cannot count toward the 1–4 category limit or change the plan's completion state.
 *
 *   GET ?forPortal=1   this hub's placements, or `enabled: false` when the plan has
 *                      not switched the fifth location on
 *   PUT { enabled }    the per-plan toggle
 *
 * Authorization splits on purpose:
 *
 *  - GET follows the same rule as the benefit read — the public portal resolves the
 *    owning advisor from the plan slug, a dashboard session is checked against
 *    `create_benefits` on the "Employee Resources" scope. A participant's page has to
 *    load, and it reveals nothing the benefit pages do not.
 *  - PUT is dashboard-only (`resolveBuilderClient`), because it is a WRITE. Reusing
 *    the portal-tolerant path here would let an anonymous visitor flip the toggle.
 *
 * Both use the "Employee Resources" permission scope, which is what lets an HR
 * collaborator be granted this location ALONE: they can edit this hub and nothing else
 * on the plan.
 */

const LOCATION: TopicLocation = "employee_resources";
const ACCESS_CATEGORY = topicLocationAccessCategory(LOCATION);

interface HubPlan {
  id: string;
  /** The plan's portal slug — what the public URL is actually addressed by. */
  slug: string | null;
  employeeResourcesEnabled: boolean;
}

/**
 * Resolve the plan for a READ.
 *
 * Mirrors the benefit route's `resolveClient` (the audited reference): portal requests
 * are scoped to the advisor their slug resolves to, dashboard requests are authorized
 * against the location's own category scope, and the development loopback stays open.
 */
async function resolveHubPlan(
  id: string,
  request: NextRequest,
): Promise<[HubPlan | null, NextResponse | null]> {
  const forPortal = request.nextUrl.searchParams.get("forPortal") === "1";

  if (forPortal) {
    const advisorId = await resolvePortalAdvisorId(request);
    if (!advisorId && !isLocalDevLoopback(request)) {
      return [
        null,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      ];
    }

    const plan = await prisma.client.findFirst({
      where: {
        AND: [
          planIdOrSlug(id),
          ...(advisorId ? [{ userId: advisorId }] : []),
        ],
      },
      select: {
        id: true,
        userId: true,
        slug: true,
        employeeResourcesEnabled: true,
      },
    });

    if (!plan) {
      return [
        null,
        NextResponse.json({ error: "Client not found" }, { status: 404 }),
      ];
    }
    // A plan belonging to another advisor is a 403, not a 404.
    if (advisorId && plan.userId !== advisorId) {
      return [null, NextResponse.json({ error: "Forbidden" }, { status: 403 })];
    }
    return [plan, null];
  }

  // Dashboard: the assignment check, scoped to this location's category.
  const access = await resolveBuilderClient({
    id,
    level: "view",
    category: ACCESS_CATEGORY,
  });
  if (!access.ok) return [null, access.response];

  const plan = await prisma.client.findUnique({
    where: { id: access.clientId },
    select: { id: true, slug: true, employeeResourcesEnabled: true },
  });
  if (!plan) {
    return [
      null,
      NextResponse.json({ error: "Client not found" }, { status: 404 }),
    ];
  }
  return [plan, null];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const [plan, error] = await resolveHubPlan(params.id, request);
  if (error) return error;

  if (!plan!.employeeResourcesEnabled) {
    // Not enabled: no placements are read at all, so a plan that has never opted in
    // pays nothing for the hub existing.
    return NextResponse.json({
      success: true,
      enabled: false,
      slug: plan!.slug,
      topics: null,
    });
  }

  try {
    const topics = await loadLocationTopics(plan!.id, LOCATION);
    // `slug` lets the admin card link to the PUBLIC portal URL rather than to the
    // plan id, which is what `/…/<slug>/employee-resources` is addressed by.
    return NextResponse.json({
      success: true,
      enabled: true,
      slug: plan!.slug,
      topics,
    });
  } catch (loadError) {
    console.error("[employee-resources] read failed:", loadError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const access = await resolveBuilderClient({
    id: params.id,
    level: "edit",
    category: ACCESS_CATEGORY,
  });
  if (!access.ok) return access.response;

  let enabled = false;
  try {
    const body = await request.json();
    enabled = body?.enabled === true;
  } catch {
    return NextResponse.json(
      { error: "A body of { enabled: boolean } is required." },
      { status: 400 },
    );
  }

  try {
    await prisma.client.update({
      where: { id: access.clientId },
      data: { employeeResourcesEnabled: enabled },
    });

    // Turning it on is what makes the page worth visiting, so seed the location the
    // first time. `seedLocationTopics` takes the LOCATION directly: the `ensure…`
    // wrapper resolves one from a Benefit category, and this hub deliberately has
    // none. Seeding is idempotent and never fatal — the toggle is already saved.
    if (enabled) {
      try {
        await seedLocationTopics({ clientId: access.clientId, location: LOCATION });
      } catch (seedError) {
        console.error("[employee-resources] seed failed:", seedError);
      }
    }

    return NextResponse.json({ success: true, enabled });
  } catch (saveError) {
    console.error("[employee-resources] toggle failed:", saveError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
