/**
 * Flyer raster output: PDF via jsPDF, PNG via SVG → sharp (same content structure).
 */

import jsPDF from "jspdf";
import sharp from "sharp";

import type { FlyerBrandSnapshot } from "./flyer-brand";
import { renderQrToDataUrl } from "./qr-service";

export type FlyerRenderInput = {
  headline: string;
  body: string;
  cta: string;
  hubAbsoluteUrl: string;
  brand: FlyerBrandSnapshot;
};

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace(/^#/, "").trim();
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return [r, g, b];
  }
  const n = parseInt(raw.length === 6 ? raw : "1F3A60", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? w.slice(0, maxChars) : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function renderFlyerPdf(input: FlyerRenderInput): Promise<Buffer> {
  const qrDataUrl = await renderQrToDataUrl(input.hubAbsoluteUrl, {
    sizePx: 280,
    errorCorrectionLevel: "M",
    margin: 2,
  });

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 44;
  const innerW = pageW - margin * 2;

  const primary = hexToRgb(input.brand.sponsor.brandColor);
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, pageW, 8, "F");

  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(255, 255, 255);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text(input.brand.sponsor.companyName, margin, margin + 6);

  doc.setFontSize(22);
  doc.setTextColor(33, 33, 33);
  const headlineLines = doc.splitTextToSize(input.headline, innerW);
  doc.text(headlineLines, margin, margin + 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(55, 55, 55);
  const bodyLines = doc.splitTextToSize(input.body, innerW);
  const bodyStartY = margin + 36 + headlineLines.length * 26 + 14;
  doc.text(bodyLines, margin, bodyStartY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  const lastBodyY =
    bodyStartY + Math.max(bodyLines.length, 1) * 14 + 28;
  doc.text(input.cta, margin, Math.min(lastBodyY, pageH - margin - 140));

  const qrSize = 112;
  doc.addImage(
    qrDataUrl,
    "PNG",
    pageW - margin - qrSize,
    pageH - margin - qrSize - 44,
    qrSize,
    qrSize,
    undefined,
    "FAST",
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Scan for Benefits Hub", pageW - margin - qrSize, pageH - margin - 26, {
    baseline: "top",
  });

  const buf = doc.output("arraybuffer");
  return Buffer.from(buf);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** PNG export (social / email); matches PDF content approximately */
export async function renderFlyerPng(input: FlyerRenderInput): Promise<Buffer> {
  const qrDataUrl = await renderQrToDataUrl(input.hubAbsoluteUrl, {
    sizePx: 360,
    errorCorrectionLevel: "M",
    margin: 2,
  });

  const primary = hexToRgb(input.brand.sponsor.brandColor);
  const sponsor = escapeXml(input.brand.sponsor.companyName);
  const hlLines = wrapLines(input.headline, 34);
  const headlineSvg = hlLines
    .map((line, i) => {
      const y = 118 + i * 32;
      return `<text x="56" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="26" font-weight="700" fill="#212121">${escapeXml(line)}</text>`;
    })
    .join("");

  const lines = wrapLines(input.body, 88);
  const bodyStartY = 118 + Math.max(hlLines.length, 1) * 32 + 20;
  const bodyTexts = lines
    .map((line, i) => {
      const y = bodyStartY + i * 20;
      return `<text x="56" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="14" fill="#383838">${escapeXml(line)}</text>`;
    })
    .join("");

  const cta = escapeXml(input.cta);

  const W = 816;
  const H = 1056;
  const ctaY = Math.min(
    bodyStartY + lines.length * 20 + 36,
    H - 220,
  );

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect fill="rgb(${primary[0]},${primary[1]},${primary[2]})" x="0" y="0" width="${W}" height="14"/>
  <rect fill="#ffffff" x="0" y="14" width="${W}" height="${H - 14}"/>
  <text x="56" y="72" font-family="Helvetica,Arial,sans-serif" font-size="13" font-weight="700"
    fill="rgb(${primary[0]},${primary[1]},${primary[2]})">${sponsor}</text>
  ${headlineSvg}
  ${bodyTexts}
  <text x="56" y="${ctaY}" font-family="Helvetica,Arial,sans-serif" font-size="16" font-weight="700"
    fill="rgb(${primary[0]},${primary[1]},${primary[2]})">${cta}</text>
  <image href="${qrDataUrl}" x="${
    W - 56 - 160
  }" y="${H - 56 - 160}" width="160" height="160" preserveAspectRatio="xMidYMid meet"/>
  <text x="${W - 56 - 160}" y="${
    H - 40
  }" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="#757575">Scan for Benefits Hub</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
