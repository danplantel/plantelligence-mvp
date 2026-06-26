import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// ── PATCH /api/marketing/assets/[id] ──

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.marketingAsset.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields = [
      "status", "headline", "body", "ctaText",
      "startDate", "endDate", "bgColor", "data",
    ] as const;

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const asset = await prisma.marketingAsset.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: asset });
  } catch (error) {
    console.error("PATCH /api/marketing/assets/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE /api/marketing/assets/[id] ──

const QR_IO_DELETE_URL = "https://api.qr.io/v1/delete";

async function deleteQrFromQrIo(qrIoId: string): Promise<boolean> {
  const apiKey = process.env.QR_IO_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[delete-asset] QR_IO_API_KEY not configured — skipping QR.io delete");
    return false;
  }
  try {
    const res = await fetch(QR_IO_DELETE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: apiKey, qrid: qrIoId }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[delete-asset] QR.io delete failed (HTTP ${res.status}):`, body.slice(0, 500));
      return false;
    }
    const data = await res.json().catch(() => ({}));
    console.log("[delete-asset] QR.io delete response:", JSON.stringify(data).slice(0, 300));
    return true;
  } catch (err) {
    console.error("[delete-asset] QR.io delete error:", (err as Error).message);
    return false;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.marketingAsset.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete associated QR code from QR.io if one exists
    const assetData = existing.data as Record<string, unknown> | null;
    const qrIoId = (assetData?.flyerQrIoId as string)?.trim();
    if (qrIoId) {
      console.log(`[delete-asset] Deleting QR.io QR code: ${qrIoId}`);
      await deleteQrFromQrIo(qrIoId);
      // Non-blocking: proceed with asset deletion regardless of QR.io result
    }

    await prisma.marketingAsset.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/marketing/assets/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
