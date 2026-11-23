import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import {
  isLocalDevLoopback,
  resolvePortalAdvisorId,
} from "@/lib/portal-access";
import { loadPlanMediaLibrary } from "@/lib/topics/media-library";

/**
 * GET — the plan's attachable media (documents + videos).
 *
 * Read by the portal sections so a topic's stored media ids can be turned into the
 * document and video the participant actually sees. Access mirrors
 * `GET /api/documents/client/[clientId]`: a portal request is scoped to the advisor
 * the plan slug resolves to, everything else to the signed-in user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const forPortal = request.nextUrl.searchParams.get("forPortal") === "1";
    const portalAdvisorId = forPortal
      ? await resolvePortalAdvisorId(request)
      : undefined;
    const devPublic = forPortal && isLocalDevLoopback(request);

    let userId: string | undefined = portalAdvisorId;
    if (!userId) {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        userId = session.user.id;
      } else if (!devPublic) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const client = await prisma.client.findFirst({
      where: {
        OR: [{ id: params.id }, { slug: params.id }],
        ...(userId ? { userId } : {}),
      },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const media = await loadPlanMediaLibrary(client.id);
    return NextResponse.json({ success: true, ...media });
  } catch (error) {
    console.error("[plan-media] read failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 },
    );
  }
}
