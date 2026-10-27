import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { planIdOrSlug } from "@/lib/plan-lookup";
import { isLocalDevLoopback, resolvePortalAdvisorId } from "@/lib/portal-access";
import { resolvePlanAccess } from "@/lib/teammates/access.server";
import { loadLifeEvents } from "@/lib/life-events/server";

/**
 * The plan's Life Event checklists (TF-8).
 *
 * A READ only — the checklists are a view over placements, so there is nothing to write
 * here. Authorization follows the benefit read: the public portal resolves the owning
 * advisor from the plan slug, a dashboard session is checked against the plan's
 * `create_benefits: view`.
 *
 * Every event whose steps all drop out is omitted, so the hub-home strip never shows a
 * tile that opens an empty checklist.
 */

async function resolvePlanId(
  id: string,
  request: NextRequest,
): Promise<[string | null, NextResponse | null]> {
  const forPortal = request.nextUrl.searchParams.get("forPortal") === "1";

  if (forPortal) {
    const advisorId = await resolvePortalAdvisorId(request);
    if (!advisorId && !isLocalDevLoopback(request)) {
      return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })];
    }

    const plan = await prisma.client.findFirst({
      where: {
        AND: [planIdOrSlug(id), ...(advisorId ? [{ userId: advisorId }] : [])],
      },
      select: { id: true, userId: true },
    });

    if (!plan) {
      return [null, NextResponse.json({ error: "Client not found" }, { status: 404 })];
    }
    if (advisorId && plan.userId !== advisorId) {
      return [null, NextResponse.json({ error: "Forbidden" }, { status: 403 })];
    }
    return [plan.id, null];
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })];
  }

  const plan = await prisma.client.findFirst({
    where: planIdOrSlug(id),
    select: { id: true },
  });
  if (!plan) {
    return [null, NextResponse.json({ error: "Client not found" }, { status: 404 })];
  }

  const access = await resolvePlanAccess({
    userId,
    clientIdOrSlug: plan.id,
    category: null,
    permission: "create_benefits",
    level: "view",
  });
  if (!access.allowed) {
    return [
      null,
      NextResponse.json(
        { error: access.message, code: access.reason },
        { status: access.reason === "plan_not_found" ? 404 : 403 },
      ),
    ];
  }

  return [plan.id, null];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const [clientId, error] = await resolvePlanId(params.id, request);
  if (error) return error;

  try {
    // No `planSlug` on purpose: `loadLifeEvents` uses the plan's stored slug, so the
    // step links are `/<slug>/<hub>#<topic>` even when the page was opened by id.
    const events = await loadLifeEvents({ clientId: clientId! });
    return NextResponse.json({ success: true, events });
  } catch (loadError) {
    console.error("[life-events] read failed:", loadError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
