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
 * Body: { url: string, name?: string }
 * Returns: { success: true, data: { dataUrl, source, qrIoId?, name? } }
 */
export async function POST(request: NextRequest) {
  console.log("[qr/generate] ═══ INCOMING REQUEST ═══");

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    console.log("[qr/generate] session:", { hasUserId: !!userId });

    if (!userId) {
      console.log("[qr/generate] ❌ Unauthorized — returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      url?: string;
      name?: string;
    };

    const rawUrl = body.url?.trim();
    console.log("[qr/generate] body:", { url: rawUrl, name: body.name });

    if (!rawUrl) {
      console.log("[qr/generate] ❌ Missing url — returning 400");
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 },
      );
    }

    // Auto-prepend https:// if no protocol is present
    let url = rawUrl;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      console.log("[qr/generate] ❌ Invalid URL format after prepend — returning 400");
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    const name = body.name?.trim() || "";

    const apiKeyConfigured = !!process.env.QR_IO_API_KEY?.trim();
    console.log("[qr/generate] QR_IO_API_KEY configured:", apiKeyConfigured);

    if (apiKeyConfigured) {
      // Use QR.io for dynamic, trackable QR codes
      try {
        console.log("[qr/generate] → Calling generateQrViaQrIo...");
        const result = await generateQrViaQrIo(url, { name: name || undefined });
        console.log("[qr/generate] ✅ QR.io success:", { id: result.id, name: result.name, imageUrl: result.imageUrl.slice(0, 60) });
        return NextResponse.json({
          success: true,
          data: {
            dataUrl: result.imageUrl,
            source: "qrio" as const,
            qrIoId: result.id,
            name: result.name,
          },
        });
      } catch (err) {
        console.error(
          "[qr/generate] ❌ QR.io failed:",
          (err as Error).message,
        );
        // Fall through to local generation
      }
    } else {
      console.log("[qr/generate] ⚠️ QR_IO_API_KEY not set — using local fallback");
    }

    // Fallback: local qrcode generation
    console.log("[qr/generate] → Using local qrcode fallback");
    const dataUrl = await renderQrToDataUrl(url, {
      sizePx: 320,
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
    console.error("[qr/generate] ❌ Uncaught error:", e);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 },
    );
  }
}
