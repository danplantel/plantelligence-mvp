import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getPresignedReadUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/flyers/[id]/file?format=pdf|png
 * Redirects to a short-lived presigned GET URL for the R2 object.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const flyerId = params.id?.trim();
    const format = request.nextUrl.searchParams.get("format")?.toLowerCase();

    if (!flyerId || (format !== "pdf" && format !== "png")) {
      return NextResponse.json(
        { error: "Missing or invalid format (pdf|png)" },
        { status: 400 },
      );
    }

    const flyer = await prisma.marketingFlyer.findFirst({
      where: {
        id: flyerId,
        client: { userId },
      },
    });

    if (!flyer) {
      return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
    }

    const key =
      format === "pdf" ? flyer.pdfStorageKey : flyer.pngStorageKey;

    const url = await getPresignedReadUrl({
      key,
      expiresInSeconds: 60 * 60,
      responseContentDisposition: `attachment; filename="flyer-${flyerId}.${format}"`,
      responseContentType:
        format === "pdf" ? "application/pdf" : "image/png",
    });

    if (!url) {
      return NextResponse.json(
        { error: "Could not generate download URL" },
        { status: 503 },
      );
    }

    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[GET /api/marketing/flyers/[id]/file]", e);
    return NextResponse.json(
      { error: "Failed to prepare download" },
      { status: 500 },
    );
  }
}
