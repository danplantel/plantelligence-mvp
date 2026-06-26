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

/**
 * Actual response from POST https://api.qr.io/v1/create
 * Returns downloadable image URLs + qrid.
 */
export interface QrIoCreateResponse {
  /** QR identifier in the dashboard */
  qrid?: string;
  /** Direct URL to PNG image */
  png?: string;
  /** Direct URL to SVG image */
  svg?: string;
  /** Direct URL to JPG image */
  jpg?: string;
  /** Direct URL to PDF */
  pdf?: string;
  /** Direct URL to EPS */
  eps?: string;
  /** Error message if applicable */
  message?: string;
  [key: string]: unknown;
}

export interface QrIoGeneratedResult {
  /** QR.io resource ID (for dashboard) */
  id: string;
  /** Direct URL to the QR PNG image — use as <image href> or fetch for inline */
  imageUrl: string;
  /** Display name in QR.io dashboard */
  name: string;
}

// ── QR.io API client ─────────────────────────────────────────────────────────

const QR_IO_CREATE_URL = "https://api.qr.io/v1/create";

function getQrIoApiKey(): string | undefined {
  return process.env.QR_IO_API_KEY?.trim() || undefined;
}

export function isQrIoConfigured(): boolean {
  return !!getQrIoApiKey();
}

/**
 * Create a dynamic QR code via QR.io API.
 *
 * API docs (https://qr.io/api-documentation):
 *   POST https://api.qr.io/v1/create
 *   Body (JSON): { apikey, data, title?, ...optional design params }
 *   Response:    { success, id, svg, ... }
 *
 * Dynamic QR codes (default) are stored in the QR.io dashboard automatically.
 *
 * @param targetUrl  – The URL to encode in the QR code.
 * @param options    – title (dashboard name), optional design params.
 */
export async function generateQrViaQrIo(
  targetUrl: string,
  options?: { name?: string },
): Promise<QrIoGeneratedResult> {
  const apiKey = getQrIoApiKey();
  if (!apiKey) {
    throw new Error("QR_IO_API_KEY is not configured");
  }

  const url = String(targetUrl || "").trim();
  if (!url) {
    throw new Error("QR payload URL is empty");
  }

  const title = options?.name?.trim() || `Flyer - ${new URL(url).hostname}`;

  // QR.io expects the API key in the JSON body, NOT as a header.
  // Dynamic QR code (default) — minimal required params per API docs example.
  const bodyPayload: Record<string, unknown> = {
    apikey: apiKey,
    data: url,
  };

  // Title helps identify the QR in the dashboard
  if (title) {
    bodyPayload.title = title;
  }

  console.log("[qr-service] POST", QR_IO_CREATE_URL, JSON.stringify({ ...bodyPayload, apikey: "***" }));

  const createRes = await fetch(QR_IO_CREATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyPayload),
  });

  const responseText = await createRes.text().catch(() => "");

  if (!createRes.ok) {
    console.error("[qr-service] QR.io create failed — HTTP", createRes.status, "body:", responseText.slice(0, 2000));
    throw new Error(
      `QR.io create failed (HTTP ${createRes.status}): ${responseText.slice(0, 500)}`,
    );
  }

  let createData: QrIoCreateResponse;
  try {
    createData = JSON.parse(responseText) as QrIoCreateResponse;
  } catch {
    console.error("[qr-service] QR.io non-JSON response:", responseText.slice(0, 2000));
    throw new Error(`QR.io returned non-JSON response: ${responseText.slice(0, 300)}`);
  }

  console.log("[qr-service] QR.io create success — qrid:", createData.qrid);

  if (createData.message) {
    throw new Error(`QR.io error: ${createData.message}`);
  }

  // QR.io returns downloadable image URLs (png, svg, jpg, etc.)
  // Prefer PNG for broad compatibility in SVG <image> tags and PDF generation
  const imageUrl = createData.png || createData.svg || createData.jpg;
  const qrId = createData.qrid || "unknown";

  if (!imageUrl) {
    console.error("[qr-service] QR.io full response:", JSON.stringify(createData).slice(0, 2000));
    throw new Error(`QR.io response missing image URL. Keys: ${Object.keys(createData).join(", ")}`);
  }

  return {
    id: qrId,
    imageUrl,
    name: title,
  };
}

/**
 * Generate QR code data URL — tries QR.io first, falls back to local `qrcode`.
 */
export async function generateQrDataUrl(
  absoluteUrl: string,
  options?: QrEncodeOptions & { name?: string },
): Promise<{ dataUrl: string; source: "qrio" | "local"; qrIoId?: string; name?: string }> {

  // Try QR.io first
  if (isQrIoConfigured()) {
    try {
      const result = await generateQrViaQrIo(absoluteUrl, { name: options?.name });
      return {
        dataUrl: result.imageUrl,
        source: "qrio",
        qrIoId: result.id,
        name: result.name,
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
