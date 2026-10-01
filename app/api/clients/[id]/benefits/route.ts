import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { planIdOrSlug } from "@/lib/plan-lookup";
import { getPresignedReadUrl, isR2Configured } from "@/lib/r2";
import {
  resolvePortalAdvisorId,
  isLocalDevLoopback,
} from "@/lib/portal-access";
import { resolvePlanAccess } from "@/lib/teammates/access.server";

/**
 * Shared helper: resolve a client by ObjectId or slug.
 * Supports both portal (forPortal + plan slug in the path) and authenticated
 * access.
 */
async function resolveClient(
  id: string,
  request: NextRequest
): Promise<[any, NextResponse | null]> {
  const forPortal = request.nextUrl.searchParams.get("forPortal") === "1";
  const portalAdvisorId = forPortal
    ? await resolvePortalAdvisorId(request)
    : undefined;

  // Development-only localhost preview: no session and no plan owner, so the
  // plan is resolved by id/slug alone (never enabled outside `next dev`).
  const devPublic = forPortal && isLocalDevLoopback(request);

  // Session identity, tracked separately from the portal advisor: the two need different
  // authorization rules (T2). This used to be folded into one `ownerId`, which then scoped the
  // plan lookup by the session user — "the plan I created" — and a teammate is never
  // `Client.userId`. So this read 404'd for every invited teammate and Step 1's benefit-rows
  // snapshot came back empty, taking the benefit's saved support-contact selection with it.
  let sessionUserId: string | undefined;
  if (!portalAdvisorId) {
    const session = await getServerSession(authOptions);
    sessionUserId = session?.user?.id;
    if (!sessionUserId && !devPublic) {
      return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })];
    }
  }

  // Same by-id-or-slug fix as the `[category]` route, for the same reason: `ObjectId.isValid`
  // is false for a cuid, so the id lookup was skipped and the slug fallback could never match
  // an id. See that route for the full note.
  //
  // Scoping follows that route too: a portal request is scoped to its advisor, while a session
  // request is looked up unscoped and authorized by assignment below.
  const client = await prisma.client.findFirst({
    where: {
      AND: [
        planIdOrSlug(id),
        ...(portalAdvisorId ? [{ userId: portalAdvisorId }] : []),
      ],
    },
  });

  if (!client) {
    return [null, NextResponse.json({ error: "Client not found" }, { status: 404 })];
  }

  // Public portal: the plan must belong to the advisor the slug resolved to.
  if (portalAdvisorId) {
    if (client.userId !== portalAdvisorId) {
      return [null, NextResponse.json({ error: "Forbidden" }, { status: 403 })];
    }
    return [client, null];
  }

  // Dev-local preview: intentionally open in development.
  if (!sessionUserId) return [client, null];

  // Dashboard session — T2: the caller's ASSIGNMENT decides, not ownership.
  const access = await resolvePlanAccess({
    userId: sessionUserId,
    clientIdOrSlug: client.id,
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

  return [client, null];
}

/**
 * GET /api/clients/[id]/benefits
 * Returns all Benefit rows for a client. R2 keys are converted to presigned URLs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [client, error] = await resolveClient(params.id, request);
    if (error) return error;

    const clientId = client.id;

    const benefits = await prisma.benefit.findMany({
      where: { clientId },
      orderBy: { category: "asc" },
    });

    // Convert R2 keys to presigned URLs for planVideo
    if (isR2Configured()) {
      const extractKey = (v: string): string | null => {
        if (!v || v.startsWith("http")) return null;
        try {
          const u = new URL(v, "http://localhost");
          const k = u.searchParams.get("key");
          if (k) return k;
        } catch { /* not a URL, treat as raw key */ }
        return v;
      };

      const benefitsWithUrls = await Promise.all(
        benefits.map(async (b) => {
          const rawKey = b.planVideo ? extractKey(String(b.planVideo)) : null;
          if (rawKey) {
            try {
              const url = await getPresignedReadUrl({ key: rawKey });
              if (url) return { ...b, planVideo: url };
            } catch { /* keep original if signing fails */ }
          }
          return b;
        })
      );

      return NextResponse.json({ success: true, benefits: benefitsWithUrls });
    }

    return NextResponse.json({ success: true, benefits });
  } catch (error) {
    console.error("Error fetching benefits:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
