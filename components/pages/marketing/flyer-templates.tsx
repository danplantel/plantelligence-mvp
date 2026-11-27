"use client";

import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";

export type FlyerTemplateId = "TopicalTemplate1" | "TopicalTemplate2" | "TopicalTemplate3" | "TopicalTemplate4" | "MeetingTemplate1";

/** Percentage-based focal point (0-100) for the custom flyer header image. */
export interface FlyerImagePosition {
  x: number;
  y: number;
}

export interface FlyerPreviewProps {
  headline: string;
  body: string;
  ctaText: string;
  bgColor: string;
  startDate: string;
  planName: string;
  planLogo?: string;
  organizationLogo?: string;
  /**
   * Up to three extra sponsor/carrier logos shown to the right of the vertical
   * divider in the header of templates that support a logo band
   * (currently `TopicalTemplate4`). The divider itself only renders when at
   * least one additional logo is present.
   */
  additionalLogos?: string[];
  disclaimerText?: string;
  flyerImage?: string;
  flyerQrUrl?: string;
  flyerQrDataUrl?: string;
  meetingTime?: string;
  meetingLocation?: string;
  flyerSubtitle?: string;
  flyerTemplate: FlyerTemplateId;
  flyerLanguage?: "en" | "es";
  /** Focal point (percentage) for the custom header image — centered by default. */
  flyerImagePosition?: FlyerImagePosition;
  /** Natural width of the custom flyer image (px). Required for accurate positioning. */
  flyerImageWidth?: number | null;
  /** Natural height of the custom flyer image (px). Required for accurate positioning. */
  flyerImageHeight?: number | null;
  /** Benefits category this flyer template belongs to (e.g. "Retirement"). */
  benefitsCategory?: string;
  /** Unique suffix appended to SVG id attributes to avoid collisions when multiple previews coexist. */
  idSuffix?: string;
  /** Override the default SVG className (e.g. strip border/shadow for thumbnails). */
  className?: string;
}

/** Default benefits category for each flyer template. All current templates map to "Retirement". */
export const FLYER_TEMPLATE_BENEFITS_CATEGORY: Record<FlyerTemplateId, string> = {
  TopicalTemplate1: "Retirement",
  TopicalTemplate2: "Retirement",
  TopicalTemplate3: "Retirement",
  TopicalTemplate4: "Retirement",
  MeetingTemplate1: "Retirement",
};

// ── Shared helpers ────────────────────────────────────────────

export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

export function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function useFlyerHelpers(startDate: string, meetingTime?: string) {
  const formatDate = (d: string) => {
    if (!d) return "";
    try {
      // If the date includes a time component, parse as full ISO date
      // so timezone offsets (e.g. "Z" suffix) are handled correctly
      if (d.includes("T")) {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
          return parsed.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        }
      }
      // Plain date string (e.g. "2026-07-29") — use local parts constructor
      const clean = d.split("T")[0].split(" ")[0];
      const [y, m, day] = clean.split("-").map(Number);
      const parsed = new Date(y, m - 1, day);
      if (isNaN(parsed.getTime())) return d;
      return parsed.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } catch { return d; }
  };
  const formatTime12h = (t: string) => {
    if (!t) return "";
    try {
      const [h, m] = t.split(":").map(Number);
      if (isNaN(h) || isNaN(m)) return t;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
    } catch { return t; }
  };
  const wrapText = (text: string, maxChars: number): string[] => {
    // ── 1. Extract color spans and strip markers to get plain text ──
    const spans: Array<{ start: number; end: number; hex: string }> = [];
    let plainText = "";
    let rawIdx = 0;
    let colorStack: Array<{ hex: string; plainStart: number }> = [];
    while (rawIdx < text.length) {
      // Check for bold marker (ignore for wrapping — just copy through)
      const colStart = text.slice(rawIdx).match(/^\{#([0-9a-fA-F]{6})\}/);
      const colEndMatch = rawIdx > 0 ? text.slice(rawIdx).match(/^\{\/\}/) : null;
      if (colStart) {
        colorStack.push({ hex: colStart[1], plainStart: plainText.length });
        rawIdx += colStart[0].length;
      } else if (colEndMatch && colorStack.length > 0) {
        const span = colorStack.pop()!;
        spans.push({ start: span.plainStart, end: plainText.length, hex: span.hex });
        rawIdx += colEndMatch[0].length;
      } else {
        plainText += text[rawIdx];
        rawIdx++;
      }
    }
    // ── 2. Wrap the clean plain text ──
    const paragraphs = plainText.split("\n");
    const plainLines: string[] = [];
    for (const paragraph of paragraphs) {
      if (paragraph === "") { plainLines.push(""); continue; }
      const words = paragraph.split(" ");
      let current = "";
      for (const word of words) {
        const test = (current + " " + word).trim();
        if (test.length > maxChars) {
          plainLines.push(current.trim());
          current = word;
        } else {
          current = test;
        }
      }
      if (current.trim()) plainLines.push(current.trim());
    }
    if (plainLines.length === 0) return [text];
    // ── 3. Map spans back into wrapped lines ──
    let charOffset = 0;
    return plainLines.map((line, li) => {
      const lineStart = charOffset;
      const lineEnd = charOffset + line.length;
      charOffset += line.length + 1; // +1 for the space/line separator
      let result = "";
      let cursor = 0;
      for (const span of spans) {
        const s = Math.max(span.start, lineStart);
        const e = Math.min(span.end, lineEnd);
        if (s < e) {
          // Copy text before this span
          result += line.slice(cursor, s - lineStart);
          result += `{#${span.hex}}${line.slice(s - lineStart, e - lineStart)}{/}`;
          cursor = e - lineStart;
        }
      }
      result += line.slice(cursor);
      return result;
    });
  };
  return {
    formattedDate: formatDate(startDate),
    formattedTime: formatTime12h(meetingTime || ""),
    wrapText,
  };
}

// ── Body text parsing helpers (bullet-point support) ──────────

export type BodyPart = { kind: "text"; text: string } | { kind: "bullet"; text: string };

/** Check if body text contains explicit bullet markers (`- `, `* `, `• `) */
export function hasUserBullets(body: string): boolean {
  if (!body) return false;
  return body.split("\n").some((line) => /^\s*-\s/.test(line));
}

/** Parse body text into segments, preserving bullet-point structure */
export function parseBodySegments(body: string): BodyPart[] {
  if (!body) return [];
  const lines = body.split("\n");
  const parts: BodyPart[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      // Preserve empty lines (from /n/n double newlines) as blank text parts
      parts.push({ kind: "text", text: "" });
      continue;
    }
    const match = trimmed.match(/^-\s+(.+)/);
    if (match) {
      parts.push({ kind: "bullet", text: match[1] });
    } else {
      parts.push({ kind: "text", text: trimmed });
    }
  }
  return parts;
}

/** Wrap a single line of text to fit within maxChars (reuses wrapText logic) */
export function wrapSingleLine(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      lines.push(current.trim());
      current = word;
    } else {
      current += " " + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.length ? lines : [text];
}

/** Parse **bold** markers and render as SVG tspan elements */
export function renderFormattedText(line: string): React.ReactNode[] {
  if (!line.includes("**") && !line.includes("{#")) return [line];
  const parts = line.split(/(\*\*[^*]+\*\*|\{[^}]+\}[^{]*\{\/\})/g);
  return parts.filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <tspan key={i} fontWeight="bold">{part.slice(2, -2)}</tspan>;
    }
    const colorMatch = part.match(/^\{#([0-9a-fA-F]{6})\}(.*)\{\/\}$/);
    if (colorMatch) {
      return <tspan key={i} fill={`#${colorMatch[1]}`}>{colorMatch[2]}</tspan>;
    }
    // Plain text — inherits fontWeight and fill from parent <text>
    return part;
  });
}

/**
 * Render parsed body parts as SVG elements.
 * - `bullet` parts get a filled circle + text
 * - `text` parts get plain text
 * Long segments are wrapped across multiple lines.
 */
export function renderBodyParts(
  parts: BodyPart[],
  opts: {
    x: number;
    startY: number;
    lineHeight: number;
    maxChars: number;
    color?: string;
    fontSize?: number;
    fontWeight?: number | string;
    textAnchor?: "start" | "middle" | "end";
    bulletColor?: string;
    maxLines?: number;
  },
): React.ReactNode[] {
  const {
    x, startY, lineHeight, maxChars,
    color = "#333", fontSize = 14, fontWeight = 400,
    textAnchor = "start",
    bulletColor = "#333",
    maxLines = 20,
  } = opts;

  const elements: React.ReactNode[] = [];
  let lineIndex = 0;
  let partIndex = 0;

  for (const part of parts) {
    if (lineIndex >= maxLines) break;

    if (part.kind === "bullet") {
      // Wrap the bullet text
      const wrapped = wrapSingleLine(part.text, maxChars - 2); // -2 for bullet indent
      for (let i = 0; i < wrapped.length && lineIndex < maxLines; i++, lineIndex++, partIndex++) {
        const y = startY + lineIndex * lineHeight;
        if (i === 0) {
          // First line: bullet dot + text
          elements.push(
            <g key={`p${partIndex}`}>
              <polygon points={`${x + 2},${y - 9} ${x + 2},${y - 1} ${x + 10},${y - 5}`} fill={bulletColor} />
              <text x={x + 18} y={y} fill={color} fontSize={fontSize} fontWeight={fontWeight} textAnchor={textAnchor}>
                {renderFormattedText(wrapped[i])}
              </text>
            </g>,
          );
        } else {
          // Continuation lines: indented text only (no bullet)
          elements.push(
            <text key={`p${partIndex}`} x={x + 18} y={y} fill={color} fontSize={fontSize} fontWeight={fontWeight} textAnchor={textAnchor}>
              {renderFormattedText(wrapped[i])}
            </text>,
          );
        }
      }
    } else if (part.text === "") {
      // Empty line (from /n/n double newline) — render a blank line with spacing
      if (lineIndex < maxLines) {
        lineIndex++;
        // Push a transparent space to occupy the line height
        elements.push(
          <text key={`p${partIndex}`} x={x} y={startY + (lineIndex - 1) * lineHeight} fill="transparent" fontSize={1}>
            {""}
          </text>,
        );
        partIndex++;
      }
    } else {
      // Plain text — wrap normally
      const wrapped = wrapSingleLine(part.text, maxChars);
      for (let i = 0; i < wrapped.length && lineIndex < maxLines; i++, lineIndex++, partIndex++) {
        const y = startY + lineIndex * lineHeight;
        elements.push(
          <text key={`p${partIndex}`} x={x} y={y} fill={color} fontSize={fontSize} fontWeight={fontWeight} textAnchor={textAnchor}>
            {renderFormattedText(wrapped[i])}
          </text>,
        );
      }
    }
  }

  return elements;
}

// ── Flyer footer disclaimer — wraps long category-specific text onto up to two centered lines ──
const FLYER_DISCLAIMER_DEFAULT =
  "Securities and advisory services offered through LPL Financial, a registered investment advisor, Member FINRA/SIPC.";

function FlyerDisclaimer({ text }: { text?: string }) {
  const resolved = text || FLYER_DISCLAIMER_DEFAULT;
  const lines = wrapSingleLine(resolved, 118).slice(0, 2);
  const lineHeight = 11;
  const startY = 808 - ((lines.length - 1) * lineHeight) / 2;
  return (
    <>
      <rect x="0" y="792" width="612" height="28" fill="#f8f8f8" />
      {lines.map((line, i) => (
        <text key={i} x="306" y={startY + i * lineHeight} textAnchor="middle" fill="#111" fontSize="9" fontWeight="700">
          {line}
        </text>
      ))}
    </>
  );
}

// ── Shared dark footer with yellow text + curved arrow + QR ──
// Used by all 4 templates. footerY = top of footer rect.
function DarkFooter({
  footerY,
  totalHeight,
  planLogo,
  planName,
  flyerQrUrl,
  flyerQrDataUrl,
  bgColor,
  scanLabel = "Scan this QR code to learn more",
  scanLabel2,
  scanLabelHighlight,
  urlLabel,
  urlLabelPrefix,
  flyerLanguage = "en",
}: {
  footerY: number;
  totalHeight: number;
  planLogo?: string;
  planName: string;
  flyerQrUrl?: string;
  flyerQrDataUrl?: string;
  bgColor: string;
  scanLabel?: string;
  scanLabel2?: string;
  scanLabelHighlight?: string;
  urlLabel?: string;
  urlLabelPrefix?: string;
  flyerLanguage?: "en" | "es";
}) {
  const isSpanish = flyerLanguage === "es";
  const es_scanLabel = scanLabelHighlight
    ? `${scanLabelHighlight}${scanLabel.slice(scanLabelHighlight.length)}`
    : scanLabel;
  // Resolve Spanish labels — used when props are the defaults from MeetingTemplate1/2
  const resolvedScanLabel = isSpanish
    ? (scanLabel === "Scan this QR code to explore your options"
        ? "Escanea este c\u00f3digo QR para explorar tus opciones"
        : scanLabel === "Scan this QR code to learn more"
          ? "Escanea este c\u00f3digo QR para obtener m\u00e1s informaci\u00f3n"
          : scanLabel === "Scan this QR Code or visit:"
            ? "Escanea este c\u00f3digo QR o visita:"
            : es_scanLabel)
    : scanLabel;
  const resolvedScanLabel2 = isSpanish && scanLabel2 === "and schedule a consultation."
    ? "y programe una consulta."
    : scanLabel2;
  const resolvedScanLabelHighlight = isSpanish && scanLabelHighlight === "Scan this QR code"
    ? "Escanea este c\u00f3digo QR"
    : scanLabelHighlight;
  const resolvedUrlLabelPrefix = isSpanish && urlLabelPrefix === "or visit: "
    ? "o visite: "
    : urlLabelPrefix;
  const { url: resolvedPlanLogo } = useBrandingImageUrl(planLogo);
  const footerH = totalHeight - footerY;
  // Use blue accent on light backgrounds for readability, yellow otherwise
  const isLightBg = bgColor === "#f3f3f3";
  const accentColor = isLightBg ? "#0097c7" : "#f5c518";
  const textColor = isLightBg ? "#222" : "#ccc";
  const qrSize = 100;
  const qrX = 612 - 48 - qrSize;
  const qrY = footerY + (footerH - qrSize) / 2;
  const arrowEndX = qrX - 8;
  const arrowMidY = footerY + footerH / 2;

  return (
    <>
      {/* Dark footer background — use bgColor prop with fallback */}
      <rect x="0" y={footerY} width="612" height={footerH} fill={bgColor || "#111111"} />

      {/* Organization logo — below the text, bottom left */}
      {resolvedPlanLogo && (
        <g transform={`translate(20, ${footerY + footerH - 56})`}>
          <image href={resolvedPlanLogo} x="0" y="0" width="120" height="40" preserveAspectRatio="xMidYMid contain" />
        </g>
      )}

      {/* Footer text — natural letter spacing, mixed colors */}
      <text x="36" y={arrowMidY - (resolvedScanLabel2 ? 24 : 18)} fontSize="14" fontWeight="700" fill={textColor}>
        {resolvedScanLabelHighlight ? (
          <>
            <tspan fill={accentColor}>{resolvedScanLabelHighlight}</tspan>
            <tspan fill={textColor}>{resolvedScanLabel.slice(resolvedScanLabelHighlight.length)}</tspan>
          </>
        ) : (
          resolvedScanLabel
        )}
      </text>
      {resolvedScanLabel2 && (
        <text x="36" y={arrowMidY - 4} fill={textColor} fontSize="14" fontWeight="700">
          {resolvedScanLabel2}
        </text>
      )}
      {urlLabel && (
        <text x="36" y={arrowMidY + (resolvedScanLabel2 ? 16 : 0)} fontSize="12" fontWeight="400" fill={textColor}>
          {resolvedUrlLabelPrefix && <tspan fill={textColor}>{resolvedUrlLabelPrefix}</tspan>}
          <tspan fill={accentColor}>{urlLabel}</tspan>
        </text>
      )}

      {/* Exact curved arrow SVG — all paths use accentColor */}
      <g transform={`translate(${arrowEndX - 140}, ${arrowMidY - 20}) scale(1.09)`}>
        <path d="M0 0 C4.54412889 1.47027815 9.05427938 2.9912716 13.5078125 4.71875 C29.9979476 11.10624713 45.85447946 14.21485226 63.5625 14.0625 C64.57119141 14.05798828 65.57988281 14.05347656 66.61914062 14.04882812 C69.07949147 14.03716769 71.53971239 14.02080378 74 14 C74 11.69 74 9.38 74 7 C79.48055344 9.02542192 83.85222466 11.84443202 88.5703125 15.28125 C90.98170332 16.98705701 93.44986368 18.51166421 96 20 C94.60606911 27.85828541 86.88512756 33.1488173 80.91796875 37.75 C79 39 79 39 77 39 C77 36.69 77 34.38 77 32 C76.42894531 31.95101562 75.85789062 31.90203125 75.26953125 31.8515625 C72.50933639 31.59704533 69.75529965 31.30297603 67 31 C65.55173828 30.85111328 65.55173828 30.85111328 64.07421875 30.69921875 C42.06204178 27.93021555 16.1307125 17.42937717 0 2 C0 1.34 0 0.68 0 0 Z" fill={accentColor} transform="translate(8,8)" />
        <path d="M0 0 C4.54412889 1.47027815 9.05427938 2.9912716 13.5078125 4.71875 C29.9979476 11.10624713 45.85447946 14.21485226 63.5625 14.0625 C64.57119141 14.05798828 65.57988281 14.05347656 66.61914062 14.04882812 C69.07949147 14.03716769 71.53971239 14.02080378 74 14 C74 11.69 74 9.38 74 7 C79.48055344 9.02542192 83.85222466 11.84443202 88.5703125 15.28125 C90.98170332 16.98705701 93.44986368 18.51166421 96 20 C94.60606911 27.85828541 86.88512756 33.1488173 80.91796875 37.75 C79 39 79 39 77 39 C77 37.02 77 35.04 77 33 C78.485 33.99 78.485 33.99 80 35 C80 34.34 80 33.68 80 33 C81.32 33 82.64 33 84 33 C84 32.01 84 31.02 84 30 C84.66 30 85.32 30 86 30 C86.99 28.515 86.99 28.515 88 27 C88.66 27.33 89.32 27.66 90 28 C90 26.35 90 24.7 90 23 C90.66 23 91.32 23 92 23 C91.505 22.38125 91.01 21.7625 90.5 21.125 C89 19 89 19 89 17 C87.35 16.67 85.7 16.34 84 16 C84 15.34 84 14.68 84 14 C81.69 13.67 79.38 13.34 77 13 C76.67 13.99 76.34 14.98 76 16 C64.12 16 52.24 16 40 16 C40 15.67 40 15.34 40 15 C35.545 15.495 35.545 15.495 31 16 C31 17.32 31 18.64 31 20 C25.59155737 18.44236852 20.94822424 15.97465286 16.0625 13.25 C14.90331055 12.62351562 14.90331055 12.62351562 13.72070312 11.984375 C8.73856121 9.22166571 3.88091775 6.23486495 0 2 C0 1.34 0 0.68 0 0 Z" fill={accentColor} transform="translate(8,8)" />
        <path d="M0 0 C7.18357193 2.33944021 14.26080759 4.91855606 21.33398438 7.5703125 C22.13771484 7.869375 22.94144531 8.1684375 23.76953125 8.4765625 C24.84618042 8.8799585 24.84618042 8.8799585 25.94458008 9.29150391 C27.9461479 9.98143737 29.93917022 10.51936197 32 11 C32 11.99 32 12.98 32 14 C32.99 14.33 33.98 14.66 35 15 C33.02 15.99 33.02 15.99 31 17 C31 17.99 31 18.98 31 20 C25.59155737 18.44236852 20.94822424 15.97465286 16.0625 13.25 C14.90331055 12.62351562 14.90331055 12.62351562 13.72070312 11.984375 C8.73856121 9.22166571 3.88091775 6.23486495 0 2 C0 1.34 0 0.68 0 0 Z" fill={accentColor} transform="translate(8,8)" />
        <path d="M0 0 C6.875 2.75 6.875 2.75 8 5 C6.68 5 5.36 5 4 5 C3.34 6.32 2.68 7.64 2 9 C-9.88 9 -21.76 9 -34 9 C-34 8.67 -34 8.34 -34 8 C-36.64 7.67 -39.28 7.34 -42 7 C-42 6.34 -42 5.68 -42 5 C-40.21722656 5.2165625 -40.21722656 5.2165625 -38.3984375 5.4375 C-25.55754434 6.90585325 -12.91671561 7.24084524 0 7 C0 4.69 0 2.38 0 0 Z" fill={accentColor} transform="translate(82,15)" />
        <path d="M0 0 C0 0.33 0 0.66 0 1 C15.84 1.495 15.84 1.495 32 2 C32 2.33 32 2.66 32 3 C31.1028125 3.01458252 30.205625 3.02916504 29.28125 3.04418945 C25.918693 3.1056308 22.55690297 3.1798513 19.19482422 3.26245117 C17.74603719 3.29548803 16.29712801 3.32358455 14.84814453 3.34643555 C6.97911823 3.47388015 0.33049128 3.85458487 -7 7 C-9.203125 6.5871582 -9.203125 6.5871582 -11 6 C-11.33 4.68 -11.66 3.36 -12 2 C-7.8794254 0.00214565 -4.54805635 -0.17835515 0 0 Z" fill={accentColor} transform="translate(50,22)" />
        <path d="M0 0 C7.44302097 2.39690506 14.71837152 5.15262441 22 8 C22 8.33 22 8.66 22 9 C15.25 9.125 15.25 9.125 13 8 C13.33 8.99 13.66 9.98 14 11 C8.11497889 9.67587025 4.03910791 6.3466542 0 2 C0 1.34 0 0.68 0 0 Z" fill={accentColor} transform="translate(8,8)" />
        <path d="M0 0 C2.04224637 0.11514149 4.08380159 0.24257326 6.125 0.375 C7.26195312 0.44460937 8.39890625 0.51421875 9.5703125 0.5859375 C12.95393616 0.99443876 15.81612441 1.80967569 19 3 C19 3.33 19 3.66 19 4 C17.56260487 4.02712066 16.12506137 4.04645067 14.6875 4.0625 C13.48673828 4.07990234 13.48673828 4.07990234 12.26171875 4.09765625 C10 4 10 4 7 3 C7 3.66 7 4.32 7 5 C7.99 5.33 8.98 5.66 10 6 C8.3125 6.6875 8.3125 6.6875 6 7 C3.3125 5.8125 3.3125 5.8125 1 4 C0.35546875 1.88671875 0.35546875 1.88671875 0 0 Z" fill={accentColor} transform="translate(21,16)" />
        <path d="M0 0 C1.72880982 -0.05449838 3.45812712 -0.09301688 5.1875 -0.125 C6.15042969 -0.14820313 7.11335938 -0.17140625 8.10546875 -0.1953125 C11.16006204 0.01080041 13.20059593 0.81563674 16 2 C18.4320759 2.44252057 18.4320759 2.44252057 20.8125 2.625 C21.99779297 2.73714844 21.99779297 2.73714844 23.20703125 2.8515625 C23.79871094 2.90054688 24.39039062 2.94953125 25 3 C25 3.66 25 4.32 25 5 C19.31153864 4.51205072 13.6534345 3.86114981 8 3.0625 C6.3603125 2.83240234 6.3603125 2.83240234 4.6875 2.59765625 C2 2 2 2 0 0 Z" fill={accentColor} transform="translate(60,35)" />
        <path d="M0 0 C4.92127034 -0.16682272 8.50343896 -0.24828052 13 2 C13 2.33 13 2.66 13 3 C6.25 3.125 6.25 3.125 4 2 C4.33 2.99 4.66 3.98 5 5 C3.68 4.67 2.36 4.34 1 4 C0.67 2.68 0.34 1.36 0 0 Z" fill={accentColor} transform="translate(17,14)" />
        <path d="M0 0 C3.96 0.33 7.92 0.66 12 1 C10.68 1.33 9.36 1.66 8 2 C8 2.66 8 3.32 8 4 C5.69 4.33 3.38 4.66 1 5 C0.67 3.35 0.34 1.7 0 0 Z" fill={accentColor} transform="translate(28,19)" />
        <path d="M0 0 C6.11774896 -0.49940808 9.02495953 0.75099398 14 4 C12 5 12 5 9.1796875 4.22265625 C8.08914062 3.83980469 6.99859375 3.45695312 5.875 3.0625 C4.77929688 2.68222656 3.68359375 2.30195312 2.5546875 1.91015625 C1.71164063 1.60980469 0.86859375 1.30945313 0 1 C0 0.67 0 0.34 0 0 Z" fill={accentColor} transform="translate(44,30)" />
        <path d="M0 0 C3.0625 0.125 3.0625 0.125 5.0625 1.125 C5.0625 1.785 5.0625 2.445 5.0625 3.125 C2.4225 3.455 -0.2175 3.785 -2.9375 4.125 C-3.2675 3.135 -3.5975 2.145 -3.9375 1.125 C-2.9375 0.125 -2.9375 0.125 0 0 Z" fill={accentColor} transform="translate(41.9375,22.875)" />
        <path d="M0 0 C1.485 0.99 1.485 0.99 3 2 C3 1.34 3 0.68 3 0 C4.32 0 5.64 0 7 0 C5.9024777 2.99324263 5.32317108 3.84610901 2.375 5.25 C1.59125 5.4975 0.8075 5.745 0 6 C0 4.02 0 2.04 0 0 Z" fill={accentColor} transform="translate(85,41)" />
        <path d="M0 0 C2.9719385 1.12451727 5.33440687 2.22293791 8 4 C8 4.66 8 5.32 8 6 C5.21788056 5.62403791 3.4120716 5.32681541 1.1875 3.5625 C0 2 0 2 0 0 Z" fill={accentColor} transform="translate(8,8)" />
        <path d="M0 0 C3.91606575 0.53400897 6.39338934 1.19669467 10 3 C7.03 3 4.06 3 1 3 C0.67 2.01 0.34 1.02 0 0 Z" fill={accentColor} transform="translate(30,17)" />
      </g>

      {/* QR code box */}
      <rect x={qrX} y={qrY} width={qrSize} height={qrSize} rx="4" fill="white" />
      {flyerQrDataUrl ? (
        <image href={flyerQrDataUrl} x={qrX + 4} y={qrY + 4} width={qrSize - 8} height={qrSize - 8} preserveAspectRatio="xMidYMid meet" />
      ) : flyerQrUrl ? (
        <image
          href={`https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(flyerQrUrl)}`}
          x={qrX + 4} y={qrY + 4} width={qrSize - 8} height={qrSize - 8}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <rect x={qrX + 10} y={qrY + 10} width={qrSize - 20} height={qrSize - 20} rx="2" fill="none" stroke="#ccc" strokeWidth="1" strokeDasharray="4,4" />
      )}

    </>
  );
}

/**
 * A single user-supplied header logo for TopicalTemplate4.
 *
 * Kept as its own component so `useBrandingImageUrl` can be called once per
 * logo (hooks cannot run inside a `.map` in the parent). Returns nothing when
 * the value cannot be resolved so missing slots collapse without a gap.
 */
function AdditionalLogo({
  src,
  x,
  y,
  width,
  height,
}: {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const { url } = useBrandingImageUrl(src);
  if (!url) return null;
  return (
    <image
      href={url}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

// ── Dark footer #2 — full-bleed band with a boxed QR + scan copy ──
// Used by TopicalTemplate4. Unlike DarkFooter, the QR sits on a white card at
// the left and the copy is stacked to its right, with an optional URL line,
// a short rule and a contact line. The band is navy by default and flips to a
// light surface when the advisor chooses the light footer colour.
function DarkFooter2({
  footerY,
  totalHeight,
  flyerQrUrl,
  flyerQrDataUrl,
  bgColor,
  flyerLanguage = "en",
}: {
  footerY: number;
  totalHeight: number;
  flyerQrUrl?: string;
  flyerQrDataUrl?: string;
  bgColor: string;
  flyerLanguage?: "en" | "es";
}) {
  const isSpanish = flyerLanguage === "es";
  const isLight = bgColor === "#f3f3f3";
  const barFill = isLight ? "#f3f3f3" : "#05091f";
  const headingColor = isLight ? "#05091f" : "#ffffff";
  const mutedColor = isLight ? "#3a3b47" : "#d9d7e0";
  const ruleColor = isLight ? "#9a97a8" : "#605d7a";
  const accentColor = "#ce8c2b";

  const line1 = isSpanish ? "Escanee para explorar" : "Scan to explore";
  const line2 = isSpanish ? "su Centro de Beneficios." : "your Benefits Hub.";
  const questions = isSpanish
    ? "\u00bfPreguntas? 877-757-3263 \u00b7 Ayuda en espa\u00f1ol"
    : "Questions? 877-757-3263 \u00b7 Ayuda en espa\u00f1ol";

  const qrSize = 122;
  const qrX = 75;
  const qrY = footerY + 21;
  const displayUrl = flyerQrUrl
    ? truncateText(
        flyerQrUrl.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
        36,
      )
    : "";

  return (
    <>
      {/* Band background */}
      <rect x="0" y={footerY} width="612" height={totalHeight - footerY} fill={barFill} />

      {/* QR card */}
      <rect x={qrX} y={qrY} width={qrSize} height={qrSize} rx="6" fill="#ffffff" />
      {flyerQrDataUrl ? (
        <image
          href={flyerQrDataUrl}
          x={qrX + 12}
          y={qrY + 12}
          width={qrSize - 24}
          height={qrSize - 24}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : flyerQrUrl ? (
        <image
          href={`https://api.qrserver.com/v1/create-qr-code/?size=${qrSize - 24}x${qrSize - 24}&data=${encodeURIComponent(flyerQrUrl)}`}
          x={qrX + 12}
          y={qrY + 12}
          width={qrSize - 24}
          height={qrSize - 24}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <rect
          x={qrX + 24}
          y={qrY + 24}
          width={qrSize - 48}
          height={qrSize - 48}
          rx="2"
          fill="none"
          stroke="#cccccc"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
      )}

      {/* Copy block */}
      <text x="232" y={footerY + 46} fontSize="29" fontWeight="600" fill={headingColor}>
        {line1}
      </text>
      <text x="232" y={footerY + 80} fontSize="29" fontWeight="600" fill={headingColor}>
        {line2}
      </text>
      {displayUrl && (
        <text x="232" y={footerY + 110} fontSize="16" fontWeight="500" fill={accentColor}>
          {displayUrl}
        </text>
      )}
      <rect x="232" y={footerY + 123} width="42" height="3" rx="1.5" fill={ruleColor} />
      <text x="232" y={footerY + 153} fontSize="13" fill={mutedColor}>
        {questions}
      </text>
    </>
  );
}

// ── Mini thumbnail SVGs for the template selector ─────────────

export function TemplateThumbnail({ id, bgColor }: { id: string; bgColor: string }) {
  const c = bgColor || "#23919c";
  const thumbYellow = "#f5c518";
  switch (id) {
    case "TopicalTemplate1":
      return (
        <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="60" height="80" fill="white" />
          <rect x="5" y="6" width="50" height="7" rx="1" fill="#e00" opacity="0.85" />
          <rect x="8" y="16" width="44" height="4" rx="1" fill="#111" opacity="0.7" />
          <rect x="12" y="22" width="36" height="3" rx="1" fill="#111" opacity="0.5" />
          <rect x="10" y="28" width="40" height="22" rx="2" fill="#eee" />
          <circle cx="30" cy="39" r="8" fill="#ddd" />
          <rect x="5" y="53" width="20" height="6" rx="1" fill="#ccc" />
          <rect x="5" y="62" width="50" height="2" rx="1" fill="#ddd" />
          <rect x="5" y="66" width="42" height="2" rx="1" fill="#ddd" />
          <rect y="72" width="60" height="8" fill="#111" />
          <rect x="40" y="73" width="8" height="6" rx="1" fill="white" opacity="0.3" />
          <rect x="5" y="75" width="20" height="2" rx="1" fill={thumbYellow} opacity="0.8" />
        </svg>
      );
    case "TopicalTemplate2":
      return (
        <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="60" height="80" fill="white" />
          <rect width="60" height="38" fill="#bbb" />
          <circle cx="30" cy="19" r="10" fill="#999" />
          <rect y="38" width="60" height="42" fill="white" />
          <rect x="5" y="41" width="50" height="5" rx="1" fill="#111" opacity="0.8" />
          <rect x="8" y="48" width="44" height="3" rx="1" fill="#111" opacity="0.5" />
          <circle cx="8" cy="56" r="1.5" fill="#555" />
          <rect x="12" y="54.5" width="30" height="2" rx="1" fill="#ccc" />
          <circle cx="8" cy="61" r="1.5" fill="#555" />
          <rect x="12" y="59.5" width="26" height="2" rx="1" fill="#ccc" />
          <rect x="5" y="65" width="20" height="5" rx="1" fill="#ddd" />
          <rect x="35" y="65" width="20" height="5" rx="1" fill="#ddd" />
          <rect y="73" width="60" height="7" fill="#111" />
          <rect x="40" y="74" width="6" height="5" rx="1" fill="white" opacity="0.3" />
          <rect x="5" y="76" width="18" height="1.5" rx="0.75" fill={thumbYellow} opacity="0.8" />
        </svg>
      );
    case "TopicalTemplate3":
      return (
        <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="60" height="80" fill="white" />
          <rect width="60" height="24" fill="#bbb" />
          <rect x="5" y="6" width="50" height="4" rx="1" fill="white" opacity="0.9" />
          <rect x="10" y="12" width="40" height="3" rx="1" fill="white" opacity="0.7" />
          <rect x="18" y="27" width="24" height="8" rx="2" fill="#ddd" />
          <rect x="5" y="38" width="50" height="4" rx="1" fill="#111" opacity="0.7" />
          <rect x="10" y="44" width="40" height="3" rx="1" fill="#555" opacity="0.5" />
          <rect x="5" y="50" width="50" height="2" rx="1" fill="#ccc" />
          <rect x="5" y="54" width="44" height="2" rx="1" fill="#ccc" />
          <rect x="5" y="58" width="48" height="2" rx="1" fill="#ccc" />
          <rect x="5" y="63" width="50" height="0.5" fill="#eee" />
          <rect x="5" y="66" width="20" height="6" rx="1" fill="#ddd" />
          <rect x="44" y="65" width="10" height="8" rx="1" fill="#ddd" />
          <rect y="75" width="60" height="5" fill="#111" />
        </svg>
      );
    case "TopicalTemplate4":
      return (
        <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="60" height="80" fill="#fdfdf9" />
          {/* Header logo band */}
          <rect x="5" y="4" width="13" height="7" rx="1" fill="#605d7a" opacity="0.55" />
          <rect x="19" y="6" width="0.6" height="4" fill="#605d7a" opacity="0.6" />
          <rect x="22" y="5.5" width="8" height="4" rx="0.5" fill="#605d7a" opacity="0.4" />
          <rect x="32" y="5.5" width="8" height="4" rx="0.5" fill="#605d7a" opacity="0.4" />
          <rect x="42" y="5.5" width="9" height="4" rx="0.5" fill="#605d7a" opacity="0.4" />
          {/* Headline + body */}
          <rect x="5" y="17" width="22" height="4" rx="0.5" fill="#08091a" opacity="0.85" />
          <rect x="5" y="23" width="18" height="4" rx="0.5" fill="#08091a" opacity="0.85" />
          <rect x="5" y="29" width="20" height="4" rx="0.5" fill="#ce8c2b" />
          <rect x="5" y="36" width="9" height="0.8" fill="#605d7a" />
          <rect x="5" y="40" width="24" height="1.6" rx="0.8" fill="#08091a" opacity="0.45" />
          <rect x="5" y="43" width="21" height="1.6" rx="0.8" fill="#08091a" opacity="0.45" />
          <rect x="5" y="46" width="17" height="1.6" rx="0.8" fill="#08091a" opacity="0.45" />
          {/* Hero image */}
          <rect x="34" y="14" width="26" height="38" fill="#c9b79c" />
          <circle cx="47" cy="27" r="6" fill="#8f7f6a" opacity="0.6" />
          {/* Dark footer with QR */}
          <rect y="52" width="60" height="20" fill="#05091f" />
          <rect x="6" y="56" width="12" height="12" rx="1" fill="white" />
          <rect x="8.5" y="58.5" width="7" height="7" fill="#05091f" opacity="0.85" />
          <rect x="22" y="57" width="20" height="3" rx="0.4" fill="#ffffff" opacity="0.9" />
          <rect x="22" y="62" width="16" height="3" rx="0.4" fill="#ffffff" opacity="0.9" />
          <rect x="22" y="67" width="13" height="1.2" rx="0.4" fill="#ce8c2b" />
          {/* Disclaimer strip */}
          <rect y="72" width="60" height="8" fill="#fdfdf9" />
          <rect x="5" y="74" width="40" height="1" rx="0.5" fill="#605d7a" opacity="0.5" />
          <rect x="5" y="76.5" width="34" height="1" rx="0.5" fill="#605d7a" opacity="0.5" />
        </svg>
      );
    case "MeetingTemplate1":
      return (
        <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="60" height="80" fill="white" />
          <rect width="60" height="28" fill="#222" />
          <rect x="5" y="6" width="50" height="5" rx="1" fill="white" opacity="0.9" />
          <rect x="8" y="13" width="44" height="4" rx="1" fill={thumbYellow} opacity="0.85" />
          <rect x="12" y="19" width="36" height="3" rx="1" fill="white" opacity="0.6" />
          <rect x="18" y="31" width="24" height="8" rx="2" fill="#ddd" />
          <rect x="8" y="42" width="44" height="3" rx="1" fill="#111" opacity="0.7" />
          <rect x="12" y="47" width="36" height="2.5" rx="1" fill="#111" opacity="0.5" />
          <rect x="5" y="53" width="6" height="6" rx="1" fill={c} opacity="0.3" />
          <rect x="13" y="54" width="30" height="2" rx="1" fill="#ccc" />
          <rect x="13" y="58" width="24" height="2" rx="1" fill="#ccc" />
          <circle cx="8" cy="65" r="2.5" fill={c} opacity="0.3" />
          <rect x="13" y="63.5" width="22" height="2" rx="1" fill="#ccc" />
          <rect y="72" width="60" height="8" fill="#111" />
          <rect x="40" y="73" width="6" height="5" rx="1" fill="white" opacity="0.3" />
          <rect x="5" y="75" width="18" height="1.5" rx="0.75" fill={thumbYellow} opacity="0.8" />
        </svg>
      );
    default:
      return null;
  }
}

// ── Router ────────────────────────────────────────────────────

export function FlyerPreview(props: FlyerPreviewProps) {
  const { className: _className, ...rest } = props;
  const svgCls = _className ?? "w-full h-auto max-w-[420px] rounded-xl shadow-sm border";
  const suffixed = { ...rest, sid: rest.idSuffix || "", svgCls };
  switch (rest.flyerTemplate) {
    case "TopicalTemplate2": return <TopicalTemplate2 {...suffixed} />;
    case "TopicalTemplate3": return <TopicalTemplate3 {...suffixed} />;
    case "TopicalTemplate4": return <TopicalTemplate4 {...suffixed} />;
    case "MeetingTemplate1": return <MeetingTemplate1 {...suffixed} />;
    default:                 return <TopicalTemplate1 {...suffixed} />;
  }
}

// ── Topical Templates ─────────────────────────────────────────
export function TopicalTemplate1(allProps: FlyerPreviewProps & { sid?: string; svgCls?: string }) {
  const {
    headline, body, bgColor, startDate, planName, planLogo,
    flyerImage, flyerImagePosition, flyerImageWidth, flyerImageHeight, flyerQrUrl, flyerQrDataUrl, meetingTime, meetingLocation,
    flyerSubtitle, organizationLogo, disclaimerText, flyerLanguage,
    benefitsCategory, sid = "", svgCls,
  } = allProps;
  const templateBenefitsCategory =
    benefitsCategory ?? FLYER_TEMPLATE_BENEFITS_CATEGORY.TopicalTemplate1;
  const { wrapText } = useFlyerHelpers(startDate, meetingTime);
  const bodyLines = body ? wrapText(body, 76) : [];
  const parts = body ? parseBodySegments(body) : [];
  const userBullets = hasUserBullets(body);
  const { url: resolvedPlanLogo } = useBrandingImageUrl(planLogo);
  const piggyBankUrl = "/create-flyer-images/meeting/template_01/piggy_bank.png";
  // Custom flyer image focal point (percentages, centered by default) — replaces the piggy bank image.
  const piggyImgPosX = flyerImagePosition?.x ?? 50;
  const piggyImgPosY = flyerImagePosition?.y ?? 50;
  const piggyImgW = 371.25; // 247.5 * 1.5 — oversize so the image can be shifted within the clip
  const piggyImgH = 405;    // 270 * 1.5
  const piggyImgX = 270.75 - (piggyImgW - 247.5) * (piggyImgPosX / 100);
  const piggyImgY = 200 - (piggyImgH - 270) * (piggyImgPosY / 100);
  // Word-wrap subtitle (flyerSubtitle prop) instead of body lines
  const subtitleWrapped: string[] = flyerSubtitle
    ? wrapText(flyerSubtitle.toUpperCase(), 26)
    : [];
  const footerY = 640;

  return (
    <svg
      viewBox="0 0 612 848"
      xmlns="http://www.w3.org/2000/svg"
      className={svgCls ?? "w-full h-auto max-w-[420px] rounded-xl shadow-sm border"}
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      data-benefits-category={templateBenefitsCategory}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
               @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;700;900&display=swap');`}</style>

      {/* Light gray background */}
      <rect width="612" height="820" fill="#f8f8f8" rx="8" />

      {/* Large bold headline — top center (Bebas Neue font) */}
      <text
        x="306" y="120"
        textAnchor="middle"
        fill="#ED1C24"
        fontSize="130"
        fontWeight="100"
        letterSpacing="8"
        fontFamily="'Bebas Neue', sans-serif"
      >
        {renderFormattedText(truncateText(headline.toUpperCase(), 10))}
      </text>

      {/* Subtitle lines — word-wrapped (no truncation, Montserrat Light) */}
      {subtitleWrapped.slice(0, 3).map((line, i) => (
        <text key={`sl-${i}`} x="306" y={156 + i * 26} textAnchor="middle" fill="#111" fontSize="24" >
          {renderFormattedText(line)}
        </text>
      ))}

      {/* Two images — horizontally aligned */}
      <defs>
        <clipPath id={`cl1-left${sid}`}><rect x="80" y="185" width="157" height="300" rx="4" /></clipPath>
        <clipPath id={`cl1-right${sid}`}><rect x="270.75" y="200" width="247.5" height="270" rx="4" /></clipPath>
      </defs>
      {/* Left: Company Logo (20% smaller) */}
      <g clipPath={`url(#cl1-left${sid})`}>
        {resolvedPlanLogo ? (
          <image href={resolvedPlanLogo} x="80" y="185" width="157" height="300" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <rect x="80" y="185" width="157" height="300" rx="4" fill="#f0f0f0" />
        )}
      </g>
      {/* Right: Piggy Bank (40% bigger) — overridable via a custom flyer image */}
      <g clipPath={`url(#cl1-right${sid})`}>
        {flyerImage ? (
            <image
              href={flyerImage}
              x={piggyImgX}
              y={piggyImgY}
              width={piggyImgW}
              height={piggyImgH}
              preserveAspectRatio="xMinYMin slice"
            />
        ) : (
          // 10px top/bottom margin on the default piggy bank image
          <image href={piggyBankUrl} x="270.75" y="210" width="211.5" height="216" preserveAspectRatio="xMidYMid meet" />
        )}
      </g>

      {/* Plan logo — left side, vertically centered with image */}
      <DarkFooter
        footerY={footerY}
        totalHeight={792}
        planLogo={organizationLogo || planLogo}
        planName={planName}
        flyerQrUrl={flyerQrUrl}
        flyerQrDataUrl={flyerQrDataUrl}
        bgColor={bgColor}
        scanLabel="Scan this QR code to explore your options"
        scanLabelHighlight="Scan this QR code"
        scanLabel2="and schedule a consultation."
        urlLabelPrefix="or visit: "
        urlLabel={flyerQrUrl ? truncateText(flyerQrUrl, 45) : undefined}
        flyerLanguage={flyerLanguage}
      />

      {/* Disclaimer section below footer */}
      <FlyerDisclaimer text={disclaimerText} />

      {/* Powered by PLANtelligence */}
      <text x="306" y={834} textAnchor="middle" fill="#c1c1c1" fontSize="10" fontWeight="400" letterSpacing="1">
        powered by PLANtelligence®
      </text>

      {/* Body text below images — supports user-typed bullets (-, *, •) */}
      {userBullets ? (
        renderBodyParts(parts, {
          x: 80, startY: 510, lineHeight: 24, maxChars: 68,
          color: "#333", fontSize: 14, bulletColor: "#cc0000", maxLines: 6,
          textAnchor: "start",
        })
      ) : bodyLines.length > 0 ? (
        bodyLines.slice(0, 6).map((line, i) => (
          <text key={i} x="306" y={510 + i * 24} textAnchor="middle" fill="#333" fontSize="14" fontWeight="400" fontFamily="'Montserrat', sans-serif" letterSpacing="-0.3">{renderFormattedText(line)}</text>
        ))
      ) : (
        <>
          <text x="306" y="510" textAnchor="middle" fill="#333" fontSize="15" fontWeight="600">
            Retirement Savings
          </text>
          <text x="306" y="534" textAnchor="middle" fill="#333" fontSize="15" fontWeight="600">
            From Your Former Employer
          </text>
        </>
      )}
    </svg>
  );
}

export function TopicalTemplate2(allProps: FlyerPreviewProps & { sid?: string; svgCls?: string }) {
  const {
    headline, body, bgColor, startDate, planName, planLogo,
    flyerImage, flyerImagePosition, flyerImageWidth, flyerImageHeight, flyerQrUrl, flyerQrDataUrl, meetingTime, flyerSubtitle,
    organizationLogo, disclaimerText, flyerLanguage,
    benefitsCategory, sid = "", svgCls,
  } = allProps;
  const templateBenefitsCategory =
    benefitsCategory ?? FLYER_TEMPLATE_BENEFITS_CATEGORY.TopicalTemplate2;
  const { wrapText } = useFlyerHelpers(startDate, meetingTime);
  const bodyLines = body ? wrapText(body, 68) : [];
  const parts = body ? parseBodySegments(body) : [];
  const userBullets = hasUserBullets(body);
  const footerY = 640;
  const parentOutlineUrl = "/create-flyer-images/meeting/template_02/parent_outline.png";
  // Custom header image focal point (percentages, centered by default).
  const heroImgPosX = flyerImagePosition?.x ?? 50;
  const heroImgPosY = flyerImagePosition?.y ?? 50;
  const heroImgW = 918; // 612 * 1.5 — oversize so the image can be shifted within the clip
  const heroImgH = 600; // 400 * 1.5
  const heroImgX = -(heroImgW - 612) * (heroImgPosX / 100);
  const heroImgY = -(heroImgH - 400) * (heroImgPosY / 100);
  const subtitleWrapped: string[] = flyerSubtitle
    ? wrapText(flyerSubtitle, 66)
    : [];
  const defaultBodyText = `People often forget to:
* Add a beneficiary
* Update an existing one
* Review after major life events`;
  const defaultBodyParts = parseBodySegments(defaultBodyText);

  return (
    <svg
      viewBox="0 0 612 848"
      xmlns="http://www.w3.org/2000/svg"
      className={svgCls ?? "w-full h-auto max-w-[420px] rounded-xl shadow-sm border"}
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      data-benefits-category={templateBenefitsCategory}
    >
      <defs>
        <clipPath id={`b2-photoClip${sid}`}><rect width="612" height="400" rx="8" /></clipPath>
      </defs>

      {/* White background */}
      <rect width="612" height="820" fill="white" rx="8" />

      {/* Hero image — parent_outline.png (overridable via a custom header image) */}
      <g clipPath={`url(#b2-photoClip${sid})`}>
          <image
            href={flyerImage || parentOutlineUrl}
            x={heroImgX}
            y={heroImgY}
            width={heroImgW}
            height={heroImgH}
            preserveAspectRatio="xMinYMin slice"
          />
      </g>

      {/* Bold headline — below photo */}
      <text x="306" y="468" textAnchor="middle" fill="#111" fontSize="30" fontWeight="900" letterSpacing="-0.5">
        {renderFormattedText(truncateText(headline, 32))}
      </text>
      {subtitleWrapped.slice(0, 3).map((line, i) => (
        <text key={`sl-${i}`} x="306" y={500 + i * 26} textAnchor="middle" fill="#444" fontSize="17" fontWeight="500">
          {renderFormattedText(line)}
        </text>
      ))}

      {/* Body — respects user-typed bullet markers (-, *, •) */}
      {userBullets ? (
        renderBodyParts(parts, {
          x: 80, startY: 530, lineHeight: 28, maxChars: 66,
          color: "#333", fontSize: 14, bulletColor: bgColor, maxLines: 6,
        })
      ) : bodyLines.length > 0 ? (
        bodyLines.slice(0, 6).map((line, i) => (
          <text key={i} x="80" y={530 + i * 28 + 11} fill="#333" fontSize="14" fontWeight="400">{renderFormattedText(line)}</text>
        ))
      ) : (
        renderBodyParts(defaultBodyParts, {
          x: 80, startY: 530, lineHeight: 28, maxChars: 66,
          color: "#333", fontSize: 14, bulletColor: bgColor, maxLines: 6,
        })
      )}

      {/* Centered advisor logo */}
      <LogoRow planLogo={planLogo} planName={planName} y={395} bgColor={bgColor} />

      <DarkFooter
        footerY={footerY}
        totalHeight={792}
        planLogo={organizationLogo || planLogo}
        planName={planName}
        flyerQrUrl={flyerQrUrl}
        flyerQrDataUrl={flyerQrDataUrl}
        bgColor={bgColor}
        scanLabel="Scan this QR code to explore your options"
        scanLabelHighlight="Scan this QR code"
        scanLabel2="and schedule a consultation."
        urlLabelPrefix="or visit: "
        urlLabel={flyerQrUrl ? truncateText(flyerQrUrl, 45) : undefined}
        flyerLanguage={flyerLanguage}
      />

      {/* Disclaimer section below footer */}
      <FlyerDisclaimer text={disclaimerText} />

      {/* Powered by PLANtelligence */}
      <text x="306" y={834} textAnchor="middle" fill="#c1c1c1" fontSize="10" fontWeight="400" letterSpacing="1">
        powered by PLANtelligence®
      </text>
    </svg>
  );
}

export function TopicalTemplate3(allProps: FlyerPreviewProps & { sid?: string; svgCls?: string }) {
  const {
    headline, body, bgColor, startDate, planName, planLogo,
    flyerImage, flyerImagePosition, flyerImageWidth, flyerImageHeight, flyerQrUrl, flyerQrDataUrl, meetingTime, flyerSubtitle,
    organizationLogo, disclaimerText, flyerLanguage,
    benefitsCategory, sid = "", svgCls,
  } = allProps;
  const templateBenefitsCategory =
    benefitsCategory ?? FLYER_TEMPLATE_BENEFITS_CATEGORY.TopicalTemplate3;
  const { wrapText } = useFlyerHelpers(startDate, meetingTime);
  const bodyLines = body ? wrapText(body, 82) : [];
  const parts = body ? parseBodySegments(body) : [];
  const userBullets = hasUserBullets(body);
  const footerY = 630;
  const holdingCompassUrl = "/create-flyer-images/meeting/template_03/holding_a_compass.png";
  // Custom header image focal point (percentages, centered by default).
  const heroImgPosX = flyerImagePosition?.x ?? 50;
  const heroImgPosY = flyerImagePosition?.y ?? 50;
  const heroImgW = 918; // 612 * 1.5 — oversize so the image can be shifted within the clip
  const heroImgH = 360; // 240 * 1.5
  const heroImgX = -(heroImgW - 612) * (heroImgPosX / 100);
  const heroImgY = -(heroImgH - 240) * (heroImgPosY / 100);
  const headlineWrapped: string[] = wrapText(headline, 22);
  const subtitleWrapped: string[] = flyerSubtitle
    ? wrapText(flyerSubtitle, 70)
    : [];

  return (
    <svg
      viewBox="0 0 612 848"
      xmlns="http://www.w3.org/2000/svg"
      className={svgCls ?? "w-full h-auto max-w-[420px] rounded-xl shadow-sm border"}
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      data-benefits-category={templateBenefitsCategory}
    >
      <defs>
        <linearGradient id={`c3-overlay${sid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.65" />
        </linearGradient>
        <clipPath id={`c3-photoClip${sid}`}><rect width="612" height="240" rx="8" /></clipPath>
      </defs>

      {/* White background */}
      <rect width="612" height="820" fill="white" rx="8" />

      {/* Hero image — holding_a_compass.png with overlay and headline (overridable via a custom header image) */}
      <g clipPath={`url(#c3-photoClip${sid})`}>
          <image
            href={flyerImage || holdingCompassUrl}
            x={heroImgX}
            y={heroImgY}
            width={heroImgW}
            height={heroImgH}
            preserveAspectRatio="xMinYMin slice"
          />
        <rect width="612" height="240" fill={`url(#c3-overlay${sid})`} />
        {headlineWrapped.slice(0, 4).map((line, i) => (
          <text key={`hl-${i}`} x="40" y={90 + i * 32} textAnchor="start" fill="white" fontSize="22" fontWeight="800" letterSpacing="-0.5">
            {renderFormattedText(line)}
          </text>
        ))}
      </g>

      {/* Centered plan logo */}
      <CenteredLogo planLogo={planLogo} planName={planName} y={260} />

      {/* Subtitle — right below the logo */}
      {subtitleWrapped.slice(0, 3).map((line, i) => (
        <text key={`sl-${i}`} x="306" y={350 + i * 24} textAnchor="middle" fill="#444" fontSize="17" fontWeight="600">
          {renderFormattedText(line)}
        </text>
      ))}

      {/* Body paragraphs — supports user-typed bullets (-, *, •) */}
      {userBullets ? (
        renderBodyParts(parts, {
          x: 48, startY: 400, lineHeight: 18, maxChars: 92,
          color: "#333", fontSize: 13, bulletColor: bgColor, maxLines: 16,
        })
      ) : bodyLines.length > 0 ? (
        bodyLines.slice(0, 16).map((line, i) => (
          <text key={i} x="48" y={400 + i * 18} fill="#333" fontSize="13" fontWeight="400">{renderFormattedText(line)}</text>
        ))
      ) : (
        <>
          <text x="48" y="400" fill="#333" fontSize="13">Join us for this important event.</text>
          <text x="48" y="422" fill="#333" fontSize="13">Details will be shared with registered attendees.</text>
        </>
      )}

      <DarkFooter
        footerY={footerY}
        totalHeight={792}
        planLogo={organizationLogo || planLogo}
        planName={planName}
        flyerQrUrl={flyerQrUrl}
        flyerQrDataUrl={flyerQrDataUrl}
        bgColor={bgColor}
        scanLabel="Scan this QR code to explore your options"
        scanLabelHighlight="Scan this QR code"
        scanLabel2="and schedule a consultation."
        urlLabelPrefix="or visit: "
        urlLabel={flyerQrUrl ? truncateText(flyerQrUrl, 45) : undefined}
        flyerLanguage={flyerLanguage}
      />

      {/* Disclaimer section below footer */}
      <FlyerDisclaimer text={disclaimerText} />

      {/* Powered by PLANtelligence */}
      <text x="306" y={834} textAnchor="middle" fill="#c1c1c1" fontSize="10" fontWeight="400" letterSpacing="1">
        powered by PLANtelligence®
      </text>
    </svg>
  );
}

// ── Topical Template 4 — editorial serif + logo band ─────────
/**
 * Full-bleed editorial flyer: a header logo band (plan-sponsor logo on the
 * left, then an optional auto-divider and up to three user-supplied logos), a
 * large serif headline whose final line is gold, a tall hero photograph on the
 * right, and the navy QR footer (`DarkFooter2`).
 */
export function TopicalTemplate4(allProps: FlyerPreviewProps & { sid?: string; svgCls?: string }) {
  const {
    headline, body, bgColor, startDate, planName, planLogo,
    flyerImage, flyerImagePosition, flyerQrUrl, flyerQrDataUrl, flyerSubtitle,
    disclaimerText, flyerLanguage, additionalLogos,
    benefitsCategory, sid = "", svgCls,
  } = allProps;
  const templateBenefitsCategory =
    benefitsCategory ?? FLYER_TEMPLATE_BENEFITS_CATEGORY.TopicalTemplate4;
  const { wrapText } = useFlyerHelpers(startDate);
  const { url: resolvedPlanLogo } = useBrandingImageUrl(planLogo);
  const additional = (additionalLogos ?? []).filter((logo) => !!logo).slice(0, 3);

  const NAVY = "#08091a";
  const GOLD = "#ce8c2b";
  const CREAM = "#fdfdf9";
  const DIVIDER = "#605d7a";
  const disclaimerLines = wrapSingleLine(
    disclaimerText || FLYER_DISCLAIMER_DEFAULT,
    120,
  ).slice(0, 5);

  // Headline: honour explicit line breaks, then wrap each into the serif
  // column. Only the final visible line is gold, mirroring the artwork.
  const headlineLines = (headline || "")
    .split("\n")
    .flatMap((line) => wrapSingleLine(line.trim(), 12))
    .filter((line) => line.length > 0)
    .slice(0, 3);
  // Only a genuine multi-line headline gets its last line in gold; a lone line
  // stays navy so an edited one-line flyer is not rendered entirely in gold.
  const goldLineIndex = headlineLines.length > 1 ? headlineLines.length - 1 : -1;
  const bodyLines = body ? wrapText(body, 27).slice(0, 6) : [];
  const subtitleText = flyerSubtitle ? truncateText(flyerSubtitle, 44) : "";

  // Hero photo — right-hand column, from y=137 to the footer (515).
  const HERO_X = 350;
  const HERO_Y = 137;
  const HERO_W = 262;
  const HERO_H = 382;
  const footerY = 515;
  const heroImgW = HERO_W * 1.5;
  const heroImgH = HERO_H * 1.5;
  const posX = flyerImagePosition?.x ?? 50;
  const posY = flyerImagePosition?.y ?? 50;
  const heroImgX = HERO_X - (heroImgW - HERO_W) * (posX / 100);
  const heroImgY = HERO_Y - (heroImgH - HERO_H) * (posY / 100);

  return (
    <svg
      viewBox="0 0 612 792"
      xmlns="http://www.w3.org/2000/svg"
      className={svgCls ?? "w-full h-auto max-w-[420px] rounded-xl shadow-sm border"}
      style={{ fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}
      data-benefits-category={templateBenefitsCategory}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Poppins:wght@300;400;500;600&display=swap');`}</style>

      <defs>
        <clipPath id={`t4-photoClip${sid}`}>
          <rect x={HERO_X} y={HERO_Y} width={HERO_W} height={HERO_H} />
        </clipPath>
      </defs>

      {/* Cream page background */}
      <rect width="612" height="792" fill={CREAM} />

      {/* Hero photograph (custom flyer image, else the template default) */}
      <g clipPath={`url(#t4-photoClip${sid})`}>
        {flyerImage ? (
          <image
            href={flyerImage}
            x={heroImgX}
            y={heroImgY}
            width={heroImgW}
            height={heroImgH}
            preserveAspectRatio="xMinYMin slice"
          />
        ) : (
          <image
            href="/create-flyer-images/topical/template_05/hero.jpg"
            x={HERO_X}
            y={HERO_Y}
            width={HERO_W}
            height={HERO_H}
            preserveAspectRatio="xMidYMid slice"
          />
        )}
      </g>

      {/* Header logo band */}
      {resolvedPlanLogo ? (
        <image
          href={resolvedPlanLogo}
          x="42"
          y="38"
          width="128"
          height="66"
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <text x="42" y="78" fill={NAVY} fontSize="17" fontWeight="700" fontFamily="'Playfair Display', Georgia, serif">
          {truncateText(planName, 18)}
        </text>
      )}

      {/* Divider + up to three additional logos (divider only when logos exist) */}
      {additional.length > 0 && (
        <>
          <line x1="186" y1="54" x2="186" y2="96" stroke={DIVIDER} strokeWidth="1.2" />
          {additional.map((logo, i) => {
            const slotW = 376 / additional.length;
            const cx = 198 + slotW * i + slotW / 2;
            const w = Math.min(112, slotW - 8);
            return (
              <AdditionalLogo
                key={`logo-${i}`}
                src={logo}
                x={cx - w / 2}
                y={42}
                width={w}
                height={54}
              />
            );
          })}
        </>
      )}

      {/* Headline — last line in gold */}
      {headlineLines.map((line, i) => (
        <text
          key={`hl-${i}`}
          x="68"
          y={199 + i * 52}
          fill={i === goldLineIndex ? GOLD : NAVY}
          fontSize="54"
          fontWeight="500"
          letterSpacing="-0.5"
          fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
        >
          {renderFormattedText(line)}
        </text>
      ))}

      {/* Short rule under the headline */}
      <line x1="68" y1="332" x2="127" y2="332" stroke={DIVIDER} strokeWidth="1.5" />

      {/* Body copy */}
      {bodyLines.length > 0 ? (
        bodyLines.map((line, i) => (
          <text
            key={`b-${i}`}
            x="68"
            y={369 + i * 17.5}
            fill={NAVY}
            fontSize="16"
            fontWeight="400"
            fontFamily="'Poppins', 'Helvetica Neue', Arial, sans-serif"
          >
            {renderFormattedText(line)}
          </text>
        ))
      ) : (
        <text x="68" y="369" fill={NAVY} fontSize="16" fontWeight="400">
          Explore your benefits and helpful resources.
        </text>
      )}

      {/* Category / benefit line */}
      {subtitleText && (
        <text x="68" y="481" fill={NAVY} fontSize="16" fontWeight="500" fontFamily="'Poppins', 'Helvetica Neue', Arial, sans-serif">
          {subtitleText}
        </text>
      )}

      {/* Navy QR footer */}
      <DarkFooter2
        footerY={footerY}
        totalHeight={682}
        flyerQrUrl={flyerQrUrl}
        flyerQrDataUrl={flyerQrDataUrl}
        bgColor={bgColor}
        flyerLanguage={flyerLanguage}
      />

      {/* Disclaimer on the cream band below the footer */}
      {disclaimerLines.map((line, i) => (
        <text key={`d-${i}`} x="68" y={700 + i * 11} fill={DIVIDER} fontSize="9.5" fontWeight="400">
          {line}
        </text>
      ))}

      {/* Powered by PLANtelligence */}
      <text x="544" y="748" textAnchor="end" fill="#b9b8c4" fontSize="9" fontWeight="400" letterSpacing="0.5">
        powered by PLANtelligence®
      </text>
    </svg>
  );
}

// ── Meeting Templates ─────────────────────────────────────────
export function MeetingTemplate1(allProps: FlyerPreviewProps & { sid?: string; svgCls?: string }) {
  const {
    headline, body, bgColor, startDate, planName, planLogo,
    flyerImage, flyerImagePosition, flyerImageWidth, flyerImageHeight, flyerQrUrl, flyerQrDataUrl, meetingTime, meetingLocation, flyerSubtitle,
    organizationLogo, disclaimerText, flyerLanguage,
    benefitsCategory, sid = "", svgCls,
  } = allProps;
  const templateBenefitsCategory =
    benefitsCategory ?? FLYER_TEMPLATE_BENEFITS_CATEGORY.MeetingTemplate1;
  const { formattedDate, formattedTime, wrapText } = useFlyerHelpers(startDate, meetingTime);
  const bodyLines = body ? wrapText(body, 68) : [];
  const parts = body ? parseBodySegments(body) : [];
  const userBullets = hasUserBullets(body);
  const footerY = 640;
  const countingMoneyUrl = "/create-flyer-images/meeting/template_04/counting_money.jpg";
  // Custom header image focal point (percentages, centered by default).
  const heroImgPosX = flyerImagePosition?.x ?? 50;
  const heroImgPosY = flyerImagePosition?.y ?? 50;
  const heroImgW = 918; // 612 * 1.5 — oversize so the image can be shifted within the clip
  const heroImgH = 390; // 260 * 1.5
  const heroImgX = -(heroImgW - 612) * (heroImgPosX / 100);
  const heroImgY = -(heroImgH - 260) * (heroImgPosY / 100);
  const headlineWrapped: string[] = wrapText(headline, 30);
  const subtitleWrapped: string[] = flyerSubtitle
    ? wrapText(flyerSubtitle, 56)
    : headline ? wrapText(headline, 56) : [];

  return (
    <svg
      viewBox="0 0 612 848"
      xmlns="http://www.w3.org/2000/svg"
      className={svgCls ?? "w-full h-auto max-w-[420px] rounded-xl shadow-sm border"}
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      data-benefits-category={templateBenefitsCategory}
    >
      <defs>
        <linearGradient id={`e4-overlay${sid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.72" />
        </linearGradient>
        <clipPath id={`e4-photoClip${sid}`}><rect width="612" height="260" rx="8" /></clipPath>
      </defs>

      {/* White background */}
      <rect width="612" height="820" fill="white" rx="8" />

      {/* Hero image — counting_money.jpg with overlay and headline (overridable via a custom flyer image) */}
      <g clipPath={`url(#e4-photoClip${sid})`}>
        <image
          href={flyerImage || countingMoneyUrl}
          x={heroImgX}
          y={heroImgY}
          width={heroImgW}
          height={heroImgH}
          preserveAspectRatio="xMinYMin slice"
        />
        <rect width="612" height="260" fill={`url(#e4-overlay${sid})`} />
        {headlineWrapped.slice(0, 4).map((line, i) => (
          <text key={`hl-${i}`} x="306" y={95 + i * 40} textAnchor="middle" fill="white" fontSize="32" fontWeight="800" letterSpacing="-0.5">
            {renderFormattedText(line)}
          </text>
        ))}
      </g>

      {/* Centered plan logo below header — headline and subtitle appear below the image to avoid overlap/duplication */}
      <CenteredLogo planLogo={planLogo} planName={planName} y={276} />

      {/* Bold centered subheadline — word-wrapped */}
      {subtitleWrapped.slice(0, 3).map((line, i) => (
        <text key={`sl-${i}`} x="306" y={360 + i * 24} textAnchor="middle" fill="#111" fontSize="20" fontWeight="600">
          {renderFormattedText(line)}
        </text>
      ))}

      {/* Location icon + text */}
      <g transform="translate(60, 425)">
        <circle cx="18" cy="18" r="18" fill="#111" opacity="0.1" />
        <text x="18" y="24" textAnchor="middle" fill="#111" fontSize="20">📍</text>
        <text x="50" y="14" fill="#111" fontSize="16" fontWeight="700">Where:</text>
        <text x="50" y="30" fill="#333" fontSize="16">{truncateText(meetingLocation || "Virtual via Zoom", 36)}</text>
      </g>

      {/* Calendar icon + meeting details */}
      <g transform="translate(60, 475)">
        {/* Calendar icon */}
        <rect width="36" height="36" rx="4" fill="#111" opacity="0.1" />
        <rect x="4" y="10" width="28" height="22" rx="2" fill="none" stroke="#111" strokeWidth="1.5" />
        <line x1="4" y1="16" x2="32" y2="16" stroke="#111" strokeWidth="1.5" />
        <line x1="13.3" y1="16" x2="13.3" y2="32" stroke="#111" strokeWidth="0.8" opacity="0.4" />
        <line x1="22.6" y1="16" x2="22.6" y2="32" stroke="#111" strokeWidth="0.8" opacity="0.4" />
        <line x1="4" y1="22" x2="32" y2="22" stroke="#111" strokeWidth="0.8" opacity="0.4" />
        <line x1="4" y1="27" x2="32" y2="27" stroke="#111" strokeWidth="0.8" opacity="0.4" />
        <rect x="10" y="4" width="4" height="8" rx="2" fill="#111" />
        <rect x="22" y="4" width="4" height="8" rx="2" fill="#111" />
        <text x="50" y="14" fill="#111" fontSize="16" fontWeight="700">Group Sessions:</text>
        <text x="50" y="30" fill="#333" fontSize="16">
          {formattedDate ? `${formattedDate}${formattedTime ? ` at ${formattedTime}` : ""}` : "Date & time TBD"}
        </text>
        {userBullets ? (
          renderBodyParts(parts, {
            x: 50, startY: 46, lineHeight: 18, maxChars: 66,
            color: "#333", fontSize: 16, bulletColor: bgColor, maxLines: 3,
          })
        ) : (
          bodyLines.slice(0, 3).map((line, i) => (
            <text key={i} x="50" y={46 + i * 18} fill="#333" fontSize="16" fontWeight="400">{renderFormattedText(line)}</text>
          ))
        )}
      </g>

      <DarkFooter
        footerY={footerY}
        totalHeight={792}
        planLogo={organizationLogo || planLogo}
        planName={planName}
        flyerQrUrl={flyerQrUrl}
        flyerQrDataUrl={flyerQrDataUrl}
        bgColor={bgColor}
        scanLabel="Scan this QR code to explore your options"
        scanLabelHighlight="Scan this QR code"
        scanLabel2="and schedule a consultation."
        urlLabelPrefix="or visit: "
        urlLabel={flyerQrUrl ? truncateText(flyerQrUrl, 45) : undefined}
        flyerLanguage={flyerLanguage}
      />

      {/* Disclaimer section below footer */}
      <FlyerDisclaimer text={disclaimerText} />

      {/* Powered by PLANtelligence */}
      <text x="306" y={834} textAnchor="middle" fill="#c1c1c1" fontSize="10" fontWeight="400" letterSpacing="1">
        powered by PLANtelligence®
      </text>
    </svg>
  );
}


// ── Shared sub-components ─────────────────────────────────────

function CenteredLogo({
  planLogo, planName, y, small,
}: {
  planLogo?: string;
  planName: string;
  y: number;
  small?: boolean;
}) {
  const { url: resolvedPlanLogo } = useBrandingImageUrl(planLogo);
  const h = small ? 40 : 70;
  const w = small ? 120 : 200;
  if (resolvedPlanLogo) {
    return (
      <image
        href={resolvedPlanLogo}
        x={(612 - w) / 2}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid contain"
      />
    );
  }
  return (
    <text x="306" y={y + h / 2 + 6} textAnchor="middle" fill="#888" fontSize={small ? 13 : 16} fontWeight="600">
      {truncateText(planName, 28)}
    </text>
  );
}

function LogoRow({
  planLogo, planName, y, bgColor,
}: {
  planLogo?: string;
  planName: string;
  y: number;
  bgColor: string;
}) {
  const { url: resolvedPlanLogo } = useBrandingImageUrl(planLogo);
  return (
    <g transform={`translate(0, ${y})`}>
      {/* Centered advisor logo */}
      {resolvedPlanLogo ? (
        <image href={resolvedPlanLogo} x="226" y="0" width="160" height="50" preserveAspectRatio="xMidYMid contain" />
      ) : (
        <text x="306" y="30" textAnchor="middle" fill="#555" fontSize="14" fontWeight="700">{truncateText(planName, 28)}</text>
      )}
    </g>
  );
}
