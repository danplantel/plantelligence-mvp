/**
 * qrService — server-side QR payloads for flyers (PNG bitmap for PDF/PNG composition).
 *
 * Supports two backends:
 * 1. QR.io (dynamic, trackable QR codes) — when QR_IO_API_KEY is configured.
 * 2. Local `qrcode` package (static QR codes) — fallback when no API key.
 */

import QRCode from "qrcode";

export type QrEncodeOptions = {
  /** Pixel width/height of the square image */
  sizePx?: number;
  /** L | M | Q | H */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  /** Quiet zone modules (margin) */
  margin?: number;
};

const DEFAULT_SIZE = 320;

// ── QR.io types ──────────────────────────────────────────────────────────────

export interface QrIoCreateResponse {
  id: string;
  qr_code_url: string;
  short_url?: string;
  status?: string;
  message?: string;
}

export interface QrIoGeneratedResult {
  /** QR.io resource ID */
  id: string;
  /** Direct URL to the QR code PNG image */
  imageUrl: string;
  /** Short URL that the QR code resolves to (for display) */
  shortUrl: string;
  /** PNG image buffer fetched from QR.io */
  imageBuffer: Buffer;
  /** Base64 data URL of the QR image */
  imageDataUrl: string;
}

// ── QR.io API client ─────────────────────────────────────────────────────────

const QR_IO_BASE = "https://api.qr.io/v1";

function getQrIoApiKey(): string | undefined {
  return process.env.QR_IO_API_KEY?.trim() || undefined;
}

export function isQrIoConfigured(): boolean {
  return !!getQrIoApiKey();
}

/**
 * Create a dynamic QR code via QR.io API.
 *
 * @param targetUrl  – The destination URL the QR code should resolve to.
 * @param sizePx     – Desired image size (QR.io supports 150–2000).
 * @returns Full result including image buffer, data URL, and short URL.
 */
export async function generateQrViaQrIo(
  targetUrl: string,
  sizePx: number = DEFAULT_SIZE,
): Promise<QrIoGeneratedResult> {
  const apiKey = getQrIoApiKey();
  if (!apiKey) {
    throw new Error("QR_IO_API_KEY is not configured");
  }

  const url = String(targetUrl || "").trim();
  if (!url) {
    throw new Error("QR payload URL is empty");
  }

  // 1. Create the QR code resource
  const createRes = await fetch(`${QR_IO_BASE}/qr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      url,
      format: "png",
      size: Math.max(150, Math.min(2000, sizePx)),
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "");
    throw new Error(
      `QR.io create failed (HTTP ${createRes.status}): ${errText}`,
    );
  }

  const createData = (await createRes.json()) as QrIoCreateResponse;

  if (createData.message) {
    throw new Error(`QR.io error: ${createData.message}`);
  }

  const imageUrl = createData.qr_code_url;
  const shortUrl = createData.short_url || url;
  const qrId = createData.id;

  if (!imageUrl) {
    throw new Error("QR.io response missing qr_code_url");
  }

  // 2. Fetch the QR code PNG image
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(
      `Failed to fetch QR image from QR.io (HTTP ${imageRes.status})`,
    );
  }

  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const b64 = imageBuffer.toString("base64");
  const imageDataUrl = `data:image/png;base64,${b64}`;

  return {
    id: qrId,
    imageUrl,
    shortUrl,
    imageBuffer,
    imageDataUrl,
  };
}

/**
 * Generate QR code data URL — tries QR.io first, falls back to local `qrcode`.
 */
export async function generateQrDataUrl(
  absoluteUrl: string,
  options?: QrEncodeOptions,
): Promise<{ dataUrl: string; source: "qrio" | "local"; qrIoId?: string; shortUrl?: string }> {
  const size = options?.sizePx ?? DEFAULT_SIZE;

  // Try QR.io first
  if (isQrIoConfigured()) {
    try {
      const result = await generateQrViaQrIo(absoluteUrl, size);
      return {
        dataUrl: result.imageDataUrl,
        source: "qrio",
        qrIoId: result.id,
        shortUrl: result.shortUrl,
      };
    } catch (err) {
      console.warn(
        "[qr-service] QR.io generation failed, falling back to local qrcode:",
        (err as Error).message,
      );
    }
  }

  // Fallback to local qrcode package
  const dataUrl = await renderQrToDataUrl(absoluteUrl, options);
  return { dataUrl, source: "local" };
}

// ── Local qrcode-based generation (fallback) ─────────────────────────────────

export async function renderQrToPngBuffer(
  absoluteUrl: string,
  options?: QrEncodeOptions,
): Promise<Buffer> {
  const url = String(absoluteUrl || "").trim();
  if (!url) {
    throw new Error("QR payload URL is empty");
  }

  const size = options?.sizePx ?? DEFAULT_SIZE;
  const margin = options?.margin ?? 2;
  const errorCorrectionLevel = options?.errorCorrectionLevel ?? "M";

  return QRCode.toBuffer(url, {
    type: "png",
    width: size,
    margin,
    errorCorrectionLevel,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export async function renderQrToDataUrl(
  absoluteUrl: string,
  options?: QrEncodeOptions,
): Promise<string> {
  const buf = await renderQrToPngBuffer(absoluteUrl, options);
  const b64 = buf.toString("base64");
  return `data:image/png;base64,${b64}`;
}
