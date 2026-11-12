import { NextRequest, NextResponse } from "next/server";

import { planIdOrSlug } from "@/lib/plan-lookup";
import { isLocalDevLoopback, resolvePortalAdvisorId } from "@/lib/portal-access";
import prisma from "@/lib/prisma";
import { loadPlanAssistantTopics } from "@/lib/topics/assistant.server";

/**
 * The portal assistant's plan index.
 *
 *   GET ?forPortal=1
 *     200 { success, topics: AssistantPlacement[], hiddenSlugs: string[] }
 *
 * One request feeds every answer the sheet can give: the plan's placements for each
 * published location, plus the slugs the advisor hid. The shipped library is not
 * sent — it is already in the portal bundle — so the payload stays small even for a
 * plan with a hundred questions.
 *
 * This is a PORTAL surface only. It requires `forPortal=1` and scopes the plan to the
 * advisor its slug resolves to, exactly like `GET /api/clients/[id]/benefits/[category]`
 * without the dashboard half of that route: there is no editor that reads it, and a
 * read that any logged-in user could run against any plan is a door worth keeping
 * shut. The development loopback stays open for previews.
 *
 * Auth is resolved BEFORE the plan lookup, so an anonymous caller learns nothing
 * about whether a slug exists.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (request.nextUrl.searchParams.get("forPortal") !== "1") {
    return NextResponse.json(
      { error: "forPortal=1 is required." },
      { status: 400 },
    );
  }

  const advisorId = await resolvePortalAdvisorId(request);
  if (!advisorId && !isLocalDevLoopback(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.client.findFirst({
    where: {
      AND: [
        planIdOrSlug(params.id),
        ...(advisorId ? [{ userId: advisorId }] : []),
      ],
    },
    select: {
      id: true,
      userId: true,
      categoryPortalVisibility: true,
      employeeResourcesEnabled: true,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  // A plan belonging to another advisor is a 403, not a 404.
  if (advisorId && client.userId !== advisorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const benefitHubs = await prisma.benefit.findMany({
    where: { clientId: client.id },
    select: { category: true, isEnabled: true },
  });

  try {
    const result = await loadPlanAssistantTopics({
      clientId: client.id,
      categoryPortalVisibility: client.categoryPortalVisibility,
      employeeResourcesEnabled: client.employeeResourcesEnabled,
      benefitHubs,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[portal-assistant] read failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
