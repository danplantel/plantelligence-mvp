import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/flyers?clientId= — library list for a plan (session-owned).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = request.nextUrl.searchParams.get("clientId")?.trim();
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId query parameter is required" },
        { status: 400 },
      );
    }

    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "1";

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const flyers = await prisma.marketingFlyer.findMany({
      where: {
        clientId,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        clientId: true,
        mode: true,
        modeOptions: true,
        headline: true,
        body: true,
        cta: true,
        hubUrlSnapshot: true,
        title: true,
        pdfStorageKey: true,
        pngStorageKey: true,
        aiModel: true,
        aiPromptVersion: true,
        generatedCopyAt: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: flyers.map((f) => ({
        ...f,
        generatedCopyAt: f.generatedCopyAt?.toISOString() ?? null,
        archivedAt: f.archivedAt?.toISOString() ?? null,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[GET /api/marketing/flyers]", e);
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to list flyers",
        details:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
      },
      { status: 500 },
    );
  }
}
