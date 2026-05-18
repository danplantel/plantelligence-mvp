import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  generateFlyerCopy,
  buildFlyerBrandSnapshot,
  getOwnedClient,
  isFlyerMode,
} from "@/lib/marketing";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      clientId?: string;
      mode?: string;
      modeOptions?: Record<string, unknown> | null;
      userHint?: string | null;
    };

    const clientId = body.clientId?.trim();
    const mode = body.mode?.trim();

    if (!clientId || !mode) {
      return NextResponse.json(
        { error: "clientId and mode are required" },
        { status: 400 },
      );
    }

    if (!isFlyerMode(mode)) {
      return NextResponse.json({ error: "Invalid flyer mode" }, { status: 400 });
    }

    const client = await getOwnedClient(clientId, userId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        company: true,
        name: true,
        advisorLogo: true,
        advisorLogoUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const brand = buildFlyerBrandSnapshot(client, user);
    const copy = await generateFlyerCopy({
      mode,
      modeOptions: body.modeOptions ?? undefined,
      brand,
      userHint: body.userHint ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        headline: copy.headline,
        body: copy.body,
        cta: copy.cta,
        aiModel: copy.aiModel,
        aiPromptVersion: copy.aiPromptVersion,
      },
    });
  } catch (e) {
    console.error("[POST /api/marketing/flyers/generate-copy]", e);
    return NextResponse.json(
      { error: "Failed to generate flyer copy" },
      { status: 500 },
    );
  }
}
