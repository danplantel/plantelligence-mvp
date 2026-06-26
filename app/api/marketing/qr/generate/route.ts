import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { generateQrViaQrIo, renderQrToDataUrl } from "@/lib/marketing/qr-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketing/qr/generate
 *
 * Generates a QR code image for the given URL.
 * Uses QR.io (dynamic, trackable) when QR_IO_API_KEY is configured;
 * falls back to local qrcode generation otherwise.
 *
 * Body: { url: string, size?: number }
 * Returns: { success: true, data: { dataUrl, source, qrIoId?, shortUrl? } }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      url?: string;
      size?: number;
    };

    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 },
      );
    }

    // Validate URL format (basic check)
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    const size = body.size && body.size >= 150 && body.size <= 2000
      ? Math.round(body.size)
      : 320;

    const apiKey = process.env.QR_IO_API_KEY?.trim();

    if (apiKey) {
      // Use QR.io for dynamic, trackable QR codes
      try {
        const result = await generateQrViaQrIo(url, size);
        return NextResponse.json({
          success: true,
          data: {
            dataUrl: result.imageDataUrl,
            source: "qrio" as const,
            qrIoId: result.id,
            shortUrl: result.shortUrl,
          },
        });
      } catch (err) {
        console.error(
          "[POST /api/marketing/qr/generate] QR.io failed:",
          (err as Error).message,
        );
        // Fall through to local generation
      }
    }

    // Fallback: local qrcode generation
    const dataUrl = await renderQrToDataUrl(url, {
      sizePx: size,
      errorCorrectionLevel: "M",
      margin: 2,
    });

    return NextResponse.json({
      success: true,
      data: {
        dataUrl,
        source: "local" as const,
      },
    });
  } catch (e) {
    console.error("[POST /api/marketing/qr/generate]", e);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 },
    );
  }
}
