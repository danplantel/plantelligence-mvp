/**
 * qrService — server-side QR payloads for flyers (PNG bitmap for PDF/PNG composition).
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
