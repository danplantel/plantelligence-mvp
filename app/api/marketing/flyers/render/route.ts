import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  buildFlyerBrandSnapshot,
  getBenefitsHubAbsoluteUrl,
  getOwnedClient,
  isFlyerMode,
  renderFlyerPdf,
  renderFlyerPng,
} from "@/lib/marketing";
import { putObjectBuffer, buildMarketingFlyerAssetKey, isR2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "R2 storage is not configured" },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      clientId?: string;
      mode?: string;
      modeOptions?: Record<string, unknown> | null;
      headline?: string;
      body?: string;
      cta?: string;
      title?: string | null;
    };

    const clientId = body.clientId?.trim();
    const mode = body.mode?.trim();
    const headline = body.headline?.trim();
    const textBody = body.body?.trim();
    const cta = body.cta?.trim();

    if (!clientId || !mode || !headline || !textBody || !cta) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: clientId, mode, headline, body, cta",
        },
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
        subdomain: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let hubAbsoluteUrl: string;
    try {
      hubAbsoluteUrl = getBenefitsHubAbsoluteUrl(
        clientId,
        user.subdomain ?? undefined,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hub URL misconfigured";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const brand = buildFlyerBrandSnapshot(client, user);

    const pdfBuf = await renderFlyerPdf({
      headline,
      body: textBody,
      cta,
      hubAbsoluteUrl,
      brand,
    });

    const pngBuf = await renderFlyerPng({
      headline,
      body: textBody,
      cta,
      hubAbsoluteUrl,
      brand,
    });

    const flyerId = new ObjectId().toHexString();
    const pdfKey = buildMarketingFlyerAssetKey({
      orgId: userId,
      planId: clientId,
      flyerId,
      variant: "pdf",
    });
    const pngKey = buildMarketingFlyerAssetKey({
      orgId: userId,
      planId: clientId,
      flyerId,
      variant: "png",
    });

    const pdfOk = await putObjectBuffer({
      key: pdfKey,
      body: pdfBuf,
      contentType: "application/pdf",
    });
    const pngOk = await putObjectBuffer({
      key: pngKey,
      body: pngBuf,
      contentType: "image/png",
    });

    if (!pdfOk || !pngOk) {
      return NextResponse.json(
        { error: "Failed to upload flyer assets to storage" },
        { status: 500 },
      );
    }

    const brandJson = JSON.parse(
      JSON.stringify(brand),
    ) as Prisma.InputJsonValue;

    const record = await prisma.marketingFlyer.create({
      data: {
        id: flyerId,
        clientId,
        userId,
        mode,
        ...(body.modeOptions != null
          ? {
              modeOptions: body.modeOptions as Prisma.InputJsonValue,
            }
          : {}),
        headline,
        body: textBody,
        cta,
        hubUrlSnapshot: hubAbsoluteUrl,
        brandSnapshot: brandJson,
        pdfStorageKey: pdfKey,
        pngStorageKey: pngKey,
        title: body.title?.trim() || null,
        generatedCopyAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: record.id,
        clientId: record.clientId,
        mode: record.mode,
        hubUrlSnapshot: record.hubUrlSnapshot,
        pdfStorageKey: record.pdfStorageKey,
        pngStorageKey: record.pngStorageKey,
        title: record.title,
        createdAt: record.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[POST /api/marketing/flyers/render]", e);
    return NextResponse.json(
      { error: "Failed to render flyer" },
      { status: 500 },
    );
  }
}
