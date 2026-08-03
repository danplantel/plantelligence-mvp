import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ObjectId } from "mongodb";
import { getPresignedReadUrl, isR2Configured } from "@/lib/r2";

/**
 * Shared helper: resolve a client by ObjectId or slug.
 * Supports both portal (forPortal + x-advisor-id) and authenticated access.
 */
async function resolveClient(
  id: string,
  request: NextRequest
): Promise<[any, NextResponse | null]> {
  const forPortal = request.nextUrl.searchParams.get("forPortal") === "1";
  const portalAdvisorId = forPortal
    ? (request.headers.get("x-advisor-id") || undefined)
    : undefined;

  let sessionUserId: string | undefined;

  if (!portalAdvisorId) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })];
    }
    sessionUserId = session.user.id;
  }

  const isObjectId = ObjectId.isValid(id);
  let client = null;

  if (isObjectId) {
    client = await prisma.client.findUnique({ where: { id } });
  }

  if (!client) {
    if (forPortal && portalAdvisorId) {
      client = await prisma.client.findFirst({
        where: { slug: id, userId: portalAdvisorId },
      });
    } else if (forPortal) {
      client = await prisma.client.findFirst({
        where: { slug: id, userId: sessionUserId },
      });
    } else {
      client = await prisma.client.findFirst({
        where: { slug: id, userId: sessionUserId },
      });
    }
  }

  if (!client) {
    return [null, NextResponse.json({ error: "Client not found" }, { status: 404 })];
  }

  // Ownership check for authenticated requests (portal requests are pre-scoped)
  if (!portalAdvisorId && client.userId !== sessionUserId) {
    return [null, NextResponse.json({ error: "Forbidden" }, { status: 403 })];
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
