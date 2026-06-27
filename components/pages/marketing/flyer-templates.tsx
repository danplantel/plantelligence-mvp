"use client";

import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";

export type FlyerTemplateId = "classic" | "bold" | "clean" | "event";

export interface FlyerPreviewProps {
  headline: string;
  body: string;
  ctaText: string;
  bgColor: string;
  startDate: string;
  planName: string;
  planLogo?: string;
  flyerImage?: string;
  flyerQrUrl?: string;
  flyerQrDataUrl?: string;
  meetingTime?: string;
  meetingLocation?: string;
  flyerSubtitle?: string;
  flyerTemplate: FlyerTemplateId;
}

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
      const clean = d.split("T")[0].split(" ")[0];
      const parsed = new Date(clean + "T12:00:00");
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
  };
  return {
    formattedDate: formatDate(startDate),
    formattedTime: formatTime12h(meetingTime || ""),
    wrapText,
  };
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
  urlLabel,
}: {
  footerY: number;
  totalHeight: number;
  planLogo?: string;
  planName: string;
  flyerQrUrl?: string;
  flyerQrDataUrl?: string;
  bgColor: string;
  scanLabel?: string;
  urlLabel?: string;
}) {
  const { url: resolvedPlanLogo } = useBrandingImageUrl(planLogo);
  const footerH = totalHeight - footerY;
  const yellow = "#f5c518";
  const qrSize = 100;
  const qrX = 612 - 48 - qrSize;
  const qrY = footerY + (footerH - qrSize) / 2;
  const arrowEndX = qrX - 8;
  const arrowMidY = footerY + footerH / 2;

  return (
    <>
      {/* Dark footer background */}
      <rect x="0" y={footerY} width="612" height={footerH} fill="#111111" />

      {/* Plan logo — bottom left */}
      {resolvedPlanLogo && (
        <g transform={`translate(40, ${footerY + 16})`}>
          <image href={resolvedPlanLogo} x="0" y="0" width="120" height="40" preserveAspectRatio="xMidYMid contain" />
        </g>
      )}

      {/* Yellow scan text — constrained width to prevent arrow overlap */}
      <text x="36" y={arrowMidY - 18} fill={yellow} fontSize="14" fontWeight="700" textLength="260" lengthAdjust="spacing">
        {scanLabel}
      </text>
      {urlLabel && (
        <text x="36" y={arrowMidY} fill={yellow} fontSize="12" fontWeight="400" textLength="270" lengthAdjust="spacing">
          {urlLabel}
        </text>
      )}

      {/* Exact curved arrow SVG provided by user — all paths forced to solid yellow */}
      {/* Original SVG viewBox: 0 0 111 55. Scaled to ~120×60 and positioned left of QR box */}
      <g transform={`translate(${arrowEndX - 140}, ${arrowMidY - 36}) scale(1.09)`}>
        <path d="M0 0 C4.54412889 1.47027815 9.05427938 2.9912716 13.5078125 4.71875 C29.9979476 11.10624713 45.85447946 14.21485226 63.5625 14.0625 C64.57119141 14.05798828 65.57988281 14.05347656 66.61914062 14.04882812 C69.07949147 14.03716769 71.53971239 14.02080378 74 14 C74 11.69 74 9.38 74 7 C79.48055344 9.02542192 83.85222466 11.84443202 88.5703125 15.28125 C90.98170332 16.98705701 93.44986368 18.51166421 96 20 C94.60606911 27.85828541 86.88512756 33.1488173 80.91796875 37.75 C79 39 79 39 77 39 C77 36.69 77 34.38 77 32 C76.42894531 31.95101562 75.85789062 31.90203125 75.26953125 31.8515625 C72.50933639 31.59704533 69.75529965 31.30297603 67 31 C65.55173828 30.85111328 65.55173828 30.85111328 64.07421875 30.69921875 C42.06204178 27.93021555 16.1307125 17.42937717 0 2 C0 1.34 0 0.68 0 0 Z" fill={yellow} transform="translate(8,8)" />
        <path d="M0 0 C4.54412889 1.47027815 9.05427938 2.9912716 13.5078125 4.71875 C29.9979476 11.10624713 45.85447946 14.21485226 63.5625 14.0625 C64.57119141 14.05798828 65.57988281 14.05347656 66.61914062 14.04882812 C69.07949147 14.03716769 71.53971239 14.02080378 74 14 C74 11.69 74 9.38 74 7 C79.48055344 9.02542192 83.85222466 11.84443202 88.5703125 15.28125 C90.98170332 16.98705701 93.44986368 18.51166421 96 20 C94.60606911 27.85828541 86.88512756 33.1488173 80.91796875 37.75 C79 39 79 39 77 39 C77 37.02 77 35.04 77 33 C78.485 33.99 78.485 33.99 80 35 C80 34.34 80 33.68 80 33 C81.32 33 82.64 33 84 33 C84 32.01 84 31.02 84 30 C84.66 30 85.32 30 86 30 C86.99 28.515 86.99 28.515 88 27 C88.66 27.33 89.32 27.66 90 28 C90 26.35 90 24.7 90 23 C90.66 23 91.32 23 92 23 C91.505 22.38125 91.01 21.7625 90.5 21.125 C89 19 89 19 89 17 C87.35 16.67 85.7 16.34 84 16 C84 15.34 84 14.68 84 14 C81.69 13.67 79.38 13.34 77 13 C76.67 13.99 76.34 14.98 76 16 C64.12 16 52.24 16 40 16 C40 15.67 40 15.34 40 15 C35.545 15.495 35.545 15.495 31 16 C31 17.32 31 18.64 31 20 C25.59155737 18.44236852 20.94822424 15.97465286 16.0625 13.25 C14.90331055 12.62351562 14.90331055 12.62351562 13.72070312 11.984375 C8.73856121 9.22166571 3.88091775 6.23486495 0 2 C0 1.34 0 0.68 0 0 Z" fill={yellow} transform="translate(8,8)" />
        <path d="M0 0 C7.18357193 2.33944021 14.26080759 4.91855606 21.33398438 7.5703125 C22.13771484 7.869375 22.94144531 8.1684375 23.76953125 8.4765625 C24.84618042 8.8799585 24.84618042 8.8799585 25.94458008 9.29150391 C27.9461479 9.98143737 29.93917022 10.51936197 32 11 C32 11.99 32 12.98 32 14 C32.99 14.33 33.98 14.66 35 15 C33.02 15.99 33.02 15.99 31 17 C31 17.99 31 18.98 31 20 C25.59155737 18.44236852 20.94822424 15.97465286 16.0625 13.25 C14.90331055 12.62351562 14.90331055 12.62351562 13.72070312 11.984375 C8.73856121 9.22166571 3.88091775 6.23486495 0 2 C0 1.34 0 0.68 0 0 Z" fill={yellow} transform="translate(8,8)" />
        <path d="M0 0 C6.875 2.75 6.875 2.75 8 5 C6.68 5 5.36 5 4 5 C3.34 6.32 2.68 7.64 2 9 C-9.88 9 -21.76 9 -34 9 C-34 8.67 -34 8.34 -34 8 C-36.64 7.67 -39.28 7.34 -42 7 C-42 6.34 -42 5.68 -42 5 C-40.21722656 5.2165625 -40.21722656 5.2165625 -38.3984375 5.4375 C-25.55754434 6.90585325 -12.91671561 7.24084524 0 7 C0 4.69 0 2.38 0 0 Z" fill={yellow} transform="translate(82,15)" />
        <path d="M0 0 C0 0.33 0 0.66 0 1 C15.84 1.495 15.84 1.495 32 2 C32 2.33 32 2.66 32 3 C31.1028125 3.01458252 30.205625 3.02916504 29.28125 3.04418945 C25.918693 3.1056308 22.55690297 3.1798513 19.19482422 3.26245117 C17.74603719 3.29548803 16.29712801 3.32358455 14.84814453 3.34643555 C6.97911823 3.47388015 0.33049128 3.85458487 -7 7 C-9.203125 6.5871582 -9.203125 6.5871582 -11 6 C-11.33 4.68 -11.66 3.36 -12 2 C-7.8794254 0.00214565 -4.54805635 -0.17835515 0 0 Z" fill={yellow} transform="translate(50,22)" />
        <path d="M0 0 C7.44302097 2.39690506 14.71837152 5.15262441 22 8 C22 8.33 22 8.66 22 9 C15.25 9.125 15.25 9.125 13 8 C13.33 8.99 13.66 9.98 14 11 C8.11497889 9.67587025 4.03910791 6.3466542 0 2 C0 1.34 0 0.68 0 0 Z" fill={yellow} transform="translate(8,8)" />
        <path d="M0 0 C2.04224637 0.11514149 4.08380159 0.24257326 6.125 0.375 C7.26195312 0.44460937 8.39890625 0.51421875 9.5703125 0.5859375 C12.95393616 0.99443876 15.81612441 1.80967569 19 3 C19 3.33 19 3.66 19 4 C17.56260487 4.02712066 16.12506137 4.04645067 14.6875 4.0625 C13.48673828 4.07990234 13.48673828 4.07990234 12.26171875 4.09765625 C10 4 10 4 7 3 C7 3.66 7 4.32 7 5 C7.99 5.33 8.98 5.66 10 6 C8.3125 6.6875 8.3125 6.6875 6 7 C3.3125 5.8125 3.3125 5.8125 1 4 C0.35546875 1.88671875 0.35546875 1.88671875 0 0 Z" fill={yellow} transform="translate(21,16)" />
        <path d="M0 0 C1.72880982 -0.05449838 3.45812712 -0.09301688 5.1875 -0.125 C6.15042969 -0.14820313 7.11335938 -0.17140625 8.10546875 -0.1953125 C11.16006204 0.01080041 13.20059593 0.81563674 16 2 C18.4320759 2.44252057 18.4320759 2.44252057 20.8125 2.625 C21.99779297 2.73714844 21.99779297 2.73714844 23.20703125 2.8515625 C23.79871094 2.90054688 24.39039062 2.94953125 25 3 C25 3.66 25 4.32 25 5 C19.31153864 4.51205072 13.6534345 3.86114981 8 3.0625 C6.3603125 2.83240234 6.3603125 2.83240234 4.6875 2.59765625 C2 2 2 2 0 0 Z" fill={yellow} transform="translate(60,35)" />
        <path d="M0 0 C4.92127034 -0.16682272 8.50343896 -0.24828052 13 2 C13 2.33 13 2.66 13 3 C6.25 3.125 6.25 3.125 4 2 C4.33 2.99 4.66 3.98 5 5 C3.68 4.67 2.36 4.34 1 4 C0.67 2.68 0.34 1.36 0 0 Z" fill={yellow} transform="translate(17,14)" />
        <path d="M0 0 C3.96 0.33 7.92 0.66 12 1 C10.68 1.33 9.36 1.66 8 2 C8 2.66 8 3.32 8 4 C5.69 4.33 3.38 4.66 1 5 C0.67 3.35 0.34 1.7 0 0 Z" fill={yellow} transform="translate(28,19)" />
        <path d="M0 0 C6.11774896 -0.49940808 9.02495953 0.75099398 14 4 C12 5 12 5 9.1796875 4.22265625 C8.08914062 3.83980469 6.99859375 3.45695312 5.875 3.0625 C4.77929688 2.68222656 3.68359375 2.30195312 2.5546875 1.91015625 C1.71164063 1.60980469 0.86859375 1.30945313 0 1 C0 0.67 0 0.34 0 0 Z" fill={yellow} transform="translate(44,30)" />
        <path d="M0 0 C3.0625 0.125 3.0625 0.125 5.0625 1.125 C5.0625 1.785 5.0625 2.445 5.0625 3.125 C2.4225 3.455 -0.2175 3.785 -2.9375 4.125 C-3.2675 3.135 -3.5975 2.145 -3.9375 1.125 C-2.9375 0.125 -2.9375 0.125 0 0 Z" fill={yellow} transform="translate(41.9375,22.875)" />
        <path d="M0 0 C1.485 0.99 1.485 0.99 3 2 C3 1.34 3 0.68 3 0 C4.32 0 5.64 0 7 0 C5.9024777 2.99324263 5.32317108 3.84610901 2.375 5.25 C1.59125 5.4975 0.8075 5.745 0 6 C0 4.02 0 2.04 0 0 Z" fill={yellow} transform="translate(85,41)" />
        <path d="M0 0 C2.9719385 1.12451727 5.33440687 2.22293791 8 4 C8 4.66 8 5.32 8 6 C5.21788056 5.62403791 3.4120716 5.32681541 1.1875 3.5625 C0 2 0 2 0 0 Z" fill={yellow} transform="translate(8,8)" />
        <path d="M0 0 C3.91606575 0.53400897 6.39338934 1.19669467 10 3 C7.03 3 4.06 3 1 3 C0.67 2.01 0.34 1.02 0 0 Z" fill={yellow} transform="translate(30,17)" />
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

      {/* Disclaimer line */}
      <text x="306" y={totalHeight - 8} textAnchor="middle" fill="#666" fontSize="9">
        Securities and advisory services offered through LPL Financial, a registered investment advisor, Member FINRA/SIPC.
      </text>
    </>
  );
}

// ── Mini thumbnail SVGs for the template selector ─────────────

export function TemplateThumbnail({ id, bgColor }: { id: string; bgColor: string }) {
  const c = bgColor || "#23919c";
  const yellow = "#f5c518";
  switch (id) {
    case "classic":
      return (
        <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="60" height="80" fill="white" />
          {/* Big headline */}
          <rect x="5" y="6" width="50" height="7" rx="1" fill="#e00" opacity="0.85" />
          <rect x="8" y="16" width="44" height="4" rx="1" fill="#111" opacity="0.7" />
          <rect x="12" y="22" width="36" height="3" rx="1" fill="#111" opacity="0.5" />
          {/* Center image placeholder */}
          <rect x="10" y="28" width="40" height="22" rx="2" fill="#eee" />
          <circle cx="30" cy="39" r="8" fill="#ddd" />
          {/* Logo area */}
          <rect x="5" y="53" width="20" height="6" rx="1" fill="#ccc" />
          {/* Body text */}
          <rect x="5" y="62" width="50" height="2" rx="1" fill="#ddd" />
          <rect x="5" y="66" width="42" height="2" rx="1" fill="#ddd" />
          {/* Dark footer */}
          <rect y="72" width="60" height="8" fill="#111" />
          <rect x="40" y="73" width="8" height="6" rx="1" fill="white" opacity="0.3" />
          <rect x="5" y="75" width="20" height="2" rx="1" fill={yellow} opacity="0.8" />
        </svg>
      );
    case "bold":
      return (
        <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="60" height="80" fill="white" />
          {/* Large photo top half */}
          <rect width="60" height="38" fill="#bbb" />
          <circle cx="30" cy="19" r="10" fill="#999" />
          {/* White bottom */}
          <rect y="38" width="60" height="42" fill="white" />
          {/* Bold headline */}
          <rect x="5" y="41" width="50" height="5" rx="1" fill="#111" opacity="0.8" />
          <rect x="8" y="48" width="44" height="3" rx="1" fill="#111" opacity="0.5" />
          {/* Bullet points */}
          <circle cx="8" cy="56" r="1.5" fill="#555" />
          <rect x="12" y="54.5" width="30" height="2" rx="1" fill="#ccc" />
          <circle cx="8" cy="61" r="1.5" fill="#555" />
          <rect x="12" y="59.5" width="26" height="2" rx="1" fill="#ccc" />
          {/* Two logos */}
          <rect x="5" y="65" width="20" height="5" rx="1" fill="#ddd" />
          <rect x="35" y="65" width="20" height="5" rx="1" fill="#ddd" />
          {/* Dark footer */}
          <rect y="73" width="60" height="7" fill="#111" />
          <rect x="40" y="74" width="6" height="5" rx="1" fill="white" opacity="0.3" />
          <rect x="5" y="76" width="18" height="1.5" rx="0.75" fill={yellow} opacity="0.8" />
        </svg>
      );
    case "clean":
      return (
        <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="60" height="80" fill="white" />
          {/* Full-width photo header */}
          <rect width="60" height="24" fill="#bbb" />
          {/* Text overlay on photo */}
          <rect x="5" y="6" width="50" height="4" rx="1" fill="white" opacity="0.9" />
          <rect x="10" y="12" width="40" height="3" rx="1" fill="white" opacity="0.7" />
          {/* Centered logo */}
          <rect x="18" y="27" width="24" height="8" rx="2" fill="#ddd" />
          {/* Centered headline */}
          <rect x="5" y="38" width="50" height="4" rx="1" fill="#111" opacity="0.7" />
          <rect x="10" y="44" width="40" height="3" rx="1" fill="#555" opacity="0.5" />
          {/* Body paragraphs */}
          <rect x="5" y="50" width="50" height="2" rx="1" fill="#ccc" />
          <rect x="5" y="54" width="44" height="2" rx="1" fill="#ccc" />
          <rect x="5" y="58" width="48" height="2" rx="1" fill="#ccc" />
          {/* Divider */}
          <rect x="5" y="63" width="50" height="0.5" fill="#eee" />
          {/* Footer logo + QR */}
          <rect x="5" y="66" width="20" height="6" rx="1" fill="#ddd" />
          <rect x="44" y="65" width="10" height="8" rx="1" fill="#ddd" />
          {/* Dark footer */}
          <rect y="75" width="60" height="5" fill="#111" />
        </svg>
      );
    case "event":
      return (
        <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="60" height="80" fill="white" />
          {/* Dark photo header */}
          <rect width="60" height="28" fill="#222" />
          {/* White headline on dark */}
          <rect x="5" y="6" width="50" height="5" rx="1" fill="white" opacity="0.9" />
          <rect x="8" y="13" width="44" height="4" rx="1" fill={yellow} opacity="0.85" />
          <rect x="12" y="19" width="36" height="3" rx="1" fill="white" opacity="0.6" />
          {/* Centered logo */}
          <rect x="18" y="31" width="24" height="8" rx="2" fill="#ddd" />
          {/* Bold subheadline */}
          <rect x="8" y="42" width="44" height="3" rx="1" fill="#111" opacity="0.7" />
          <rect x="12" y="47" width="36" height="2.5" rx="1" fill="#111" opacity="0.5" />
          {/* Calendar icon + text */}
          <rect x="5" y="53" width="6" height="6" rx="1" fill={c} opacity="0.3" />
          <rect x="13" y="54" width="30" height="2" rx="1" fill="#ccc" />
          <rect x="13" y="58" width="24" height="2" rx="1" fill="#ccc" />
          {/* Location */}
          <circle cx="8" cy="65" r="2.5" fill={c} opacity="0.3" />
          <rect x="13" y="63.5" width="22" height="2" rx="1" fill="#ccc" />
          {/* Dark footer */}
          <rect y="72" width="60" height="8" fill="#111" />
          <rect x="40" y="73" width="6" height="5" rx="1" fill="white" opacity="0.3" />
          <rect x="5" y="75" width="18" height="1.5" rx="0.75" fill={yellow} opacity="0.8" />
        </svg>
      );
    default:
      return null;
  }
}

// ── Router ────────────────────────────────────────────────────

export function FlyerPreview(props: FlyerPreviewProps) {
  switch (props.flyerTemplate) {
    case "bold":  return <FlyerBold  {...props} />;
    case "clean": return <FlyerClean {...props} />;
    case "event": return <FlyerEvent {...props} />;
    default:      return <FlyerClassic {...props} />;
  }
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE 1 — Classic  (matches Image 1: "MISSING" style)
// White bg · large bold headline top · center image · body text
// logo bottom-left · dark footer + yellow QR text + arrow + QR
// ══════════════════════════════════════════════════════════════
function FlyerClassic({
  headline, body, bgColor, startDate, planName, planLogo,
  flyerImage, flyerQrUrl, flyerQrDataUrl, meetingTime, meetingLocation,
}: FlyerPreviewProps) {
  const { wrapText } = useFlyerHelpers(startDate, meetingTime);
  const bodyLines = body ? wrapText(body, 72) : [];
  const footerY = 640;

  return (
    <svg
      viewBox="0 0 612 792"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-w-[420px] rounded-xl shadow-sm border"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      {/* White background */}
      <rect width="612" height="792" fill="white" rx="8" />

      {/* Large bold headline — top center */}
      <text
        x="306" y="90"
        textAnchor="middle"
        fill="#cc0000"
        fontSize="72"
        fontWeight="900"
        letterSpacing="-2"
      >
        {truncateText(headline.toUpperCase(), 10)}
      </text>

      {/* Subtitle / body first line — bold black */}
      {bodyLines.length > 0 && (
        <text x="306" y="136" textAnchor="middle" fill="#111" fontSize="22" fontWeight="800" letterSpacing="1">
          {truncateText(bodyLines[0].toUpperCase(), 40)}
        </text>
      )}
      {bodyLines.length > 1 && (
        <text x="306" y="162" textAnchor="middle" fill="#111" fontSize="22" fontWeight="800" letterSpacing="1">
          {truncateText(bodyLines[1].toUpperCase(), 40)}
        </text>
      )}

      {/* Center image — large, prominent */}
      {flyerImage ? (
        <>
          <defs>
            <clipPath id="cl1-img"><rect x="80" y="185" width="452" height="300" rx="4" /></clipPath>
          </defs>
          <g clipPath="url(#cl1-img)">
            <image href={flyerImage} x="80" y="185" width="452" height="300" preserveAspectRatio="xMidYMid slice" />
          </g>
        </>
      ) : (
        <rect x="80" y="185" width="452" height="300" rx="4" fill="#f0f0f0" />
      )}

      {/* Plan logo — left side, vertically centered with image */}
      <DarkFooter
        footerY={footerY}
        totalHeight={792}
        planLogo={planLogo}
        planName={planName}
        flyerQrUrl={flyerQrUrl}
        flyerQrDataUrl={flyerQrDataUrl}
        bgColor={bgColor}
        scanLabel="Scan QR to explore your options"
        urlLabel={flyerQrUrl ? `or visit: ${truncateText(flyerQrUrl, 45)}` : undefined}
      />

      {/* Body text below image */}
      {bodyLines.slice(2).length > 0 ? (
        bodyLines.slice(2, 8).map((line, i) => (
          <text key={i} x="306" y={510 + i * 24} textAnchor="middle" fill="#333" fontSize="14">{line}</text>
        ))
      ) : (
        <>
          <text x="306" y="510" textAnchor="middle" fill="#333" fontSize="15" fontWeight="600">
            {meetingLocation ? `📍 ${meetingLocation}` : "Contact us to learn more"}
          </text>
          <text x="306" y="540" textAnchor="middle" fill="#111" fontSize="18" fontWeight="800">
            PLEASE CONTACT US TO GET STARTED
          </text>
        </>
      )}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE 2 — Bold  (matches Image 2: "Don't Leave This Unfinished")
// Large photo top half · white bottom · bold headline · bullets
// Two logos side by side · dark footer + yellow text + QR + arrow
// ══════════════════════════════════════════════════════════════
function FlyerBold({
  headline, body, bgColor, startDate, planName, planLogo,
  flyerImage, flyerQrUrl, flyerQrDataUrl, meetingTime, flyerSubtitle,
}: FlyerPreviewProps) {
  const { wrapText } = useFlyerHelpers(startDate, meetingTime);
  const bodyLines = body ? wrapText(body, 68) : [];
  const footerY = 640;

  return (
    <svg
      viewBox="0 0 612 792"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-w-[420px] rounded-xl shadow-sm border"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      <defs>
        <clipPath id="b2-photoClip"><rect width="612" height="320" rx="8" /></clipPath>
      </defs>

      {/* White background */}
      <rect width="612" height="792" fill="white" rx="8" />

      {/* Large photo — top half */}
      <g clipPath="url(#b2-photoClip)">
        {flyerImage ? (
          <image href={flyerImage} width="612" height="320" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <rect width="612" height="320" fill="#d0d0d0" />
        )}
      </g>

      {/* Bold headline — below photo */}
      <text x="306" y="368" textAnchor="middle" fill="#111" fontSize="30" fontWeight="900" letterSpacing="-0.5">
        {truncateText(headline, 32)}
      </text>
      {flyerSubtitle && (
        <text x="306" y="400" textAnchor="middle" fill="#444" fontSize="17" fontWeight="500">
          {truncateText(flyerSubtitle, 52)}
        </text>
      )}

      {/* Body as bullet points */}
      {bodyLines.length > 0 ? (
        bodyLines.slice(0, 6).map((line, i) => (
          <g key={i} transform={`translate(80, ${430 + i * 28})`}>
            <circle cx="6" cy="6" r="4" fill={bgColor} />
            <text x="20" y="11" fill="#333" fontSize="14">{line}</text>
          </g>
        ))
      ) : (
        <>
          <g transform="translate(80, 430)">
            <circle cx="6" cy="6" r="4" fill={bgColor} />
            <text x="20" y="11" fill="#333" fontSize="14">Add a beneficiary</text>
          </g>
          <g transform="translate(80, 458)">
            <circle cx="6" cy="6" r="4" fill={bgColor} />
            <text x="20" y="11" fill="#333" fontSize="14">Update an existing one</text>
          </g>
          <g transform="translate(80, 486)">
            <circle cx="6" cy="6" r="4" fill={bgColor} />
            <text x="20" y="11" fill="#333" fontSize="14">Review after major life events</text>
          </g>
        </>
      )}

      {/* Two logos side by side */}
      <LogoRow planLogo={planLogo} planName={planName} y={570} bgColor={bgColor} />

      <DarkFooter
        footerY={footerY}
        totalHeight={792}
        planLogo={undefined}
        planName={planName}
        flyerQrUrl={flyerQrUrl}
        flyerQrDataUrl={flyerQrDataUrl}
        bgColor={bgColor}
        scanLabel="Scan this QR Code or visit:"
        urlLabel={flyerQrUrl ? truncateText(flyerQrUrl, 48) : undefined}
      />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE 3 — Clean  (matches Image 3: "Invest in Yourself")
// Full-width photo header with text overlay · centered logo
// Centered bold headline · body paragraphs · divider
// Footer: logo left + centered QR text + QR right + arrow
// ══════════════════════════════════════════════════════════════
function FlyerClean({
  headline, body, bgColor, startDate, planName, planLogo,
  flyerImage, flyerQrUrl, flyerQrDataUrl, meetingTime, flyerSubtitle,
}: FlyerPreviewProps) {
  const { wrapText } = useFlyerHelpers(startDate, meetingTime);
  const bodyLines = body ? wrapText(body, 72) : [];
  const footerY = 630;

  return (
    <svg
      viewBox="0 0 612 792"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-w-[420px] rounded-xl shadow-sm border"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      <defs>
        <linearGradient id="c3-overlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.65" />
        </linearGradient>
        <clipPath id="c3-photoClip"><rect width="612" height="240" rx="8" /></clipPath>
      </defs>

      {/* White background */}
      <rect width="612" height="792" fill="white" rx="8" />

      {/* Full-width photo header */}
      <g clipPath="url(#c3-photoClip)">
        {flyerImage ? (
          <image href={flyerImage} width="612" height="240" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <rect width="612" height="240" fill="#4a6080" />
        )}
        <rect width="612" height="240" fill="url(#c3-overlay)" />
      </g>

      {/* Text overlay on photo — top-right aligned */}
      <text x="564" y="80" textAnchor="end" fill="white" fontSize="28" fontWeight="800" fontStyle="italic">
        {truncateText(headline, 22)}
      </text>
      {flyerSubtitle && (
        <>
          <text x="564" y="116" textAnchor="end" fill="white" fontSize="22" fontWeight="900" fontStyle="italic">
            {truncateText(flyerSubtitle, 28)}
          </text>
          <text x="564" y="148" textAnchor="end" fill="white" fontSize="22" fontWeight="900" fontStyle="italic">
            {truncateText(flyerSubtitle.slice(28), 28)}
          </text>
        </>
      )}

      {/* Centered plan logo */}
      <CenteredLogo planLogo={planLogo} planName={planName} y={260} />

      {/* Centered bold headline */}
      <text x="306" y="348" textAnchor="middle" fill="#111" fontSize="18" fontWeight="800">
        {truncateText(headline, 52)}
      </text>
      {headline.length > 52 && (
        <text x="306" y="372" textAnchor="middle" fill="#111" fontSize="18" fontWeight="800">
          {truncateText(headline.slice(52), 52)}
        </text>
      )}

      {/* Body paragraphs */}
      {bodyLines.length > 0 ? (
        bodyLines.slice(0, 9).map((line, i) => (
          <text key={i} x="48" y={400 + i * 22} fill="#333" fontSize="13">{line}</text>
        ))
      ) : (
        <>
          <text x="48" y="400" fill="#333" fontSize="13">Join us for this important event.</text>
          <text x="48" y="422" fill="#333" fontSize="13">Details will be shared with registered attendees.</text>
        </>
      )}

      {/* Divider */}
      <line x1="48" y1={footerY - 20} x2="564" y2={footerY - 20} stroke="#e0e0e0" strokeWidth="1" />

      {/* Footer: logo left, QR text center, QR right */}
      <DarkFooter
        footerY={footerY}
        totalHeight={792}
        planLogo={planLogo}
        planName={planName}
        flyerQrUrl={flyerQrUrl}
        flyerQrDataUrl={flyerQrDataUrl}
        bgColor={bgColor}
        scanLabel="Scan QR to visit your participant website"
        urlLabel={flyerQrUrl ? `or visit: ${truncateText(flyerQrUrl, 42)}` : undefined}
      />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE 4 — Event  (matches Image 4: "Transform Your Tomorrow")
// Dark photo header · white headline + yellow subtitle overlay
// Centered logo · bold centered subheadline · calendar icon + dates
// Location icon · centered logo again · dark footer + yellow + QR
// ══════════════════════════════════════════════════════════════
function FlyerEvent({
  headline, body, bgColor, startDate, planName, planLogo,
  flyerImage, flyerQrUrl, flyerQrDataUrl, meetingTime, meetingLocation, flyerSubtitle,
}: FlyerPreviewProps) {
  const { formattedDate, formattedTime, wrapText } = useFlyerHelpers(startDate, meetingTime);
  const bodyLines = body ? wrapText(body, 68) : [];
  const yellow = "#f5c518";
  const footerY = 640;

  return (
    <svg
      viewBox="0 0 612 792"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-w-[420px] rounded-xl shadow-sm border"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      <defs>
        <linearGradient id="e4-overlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.72" />
        </linearGradient>
        <clipPath id="e4-photoClip"><rect width="612" height="260" rx="8" /></clipPath>
      </defs>

      {/* White background */}
      <rect width="612" height="792" fill="white" rx="8" />

      {/* Dark photo header */}
      <g clipPath="url(#e4-photoClip)">
        {flyerImage ? (
          <image href={flyerImage} width="612" height="260" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <rect width="612" height="260" fill="#1a2535" />
        )}
        <rect width="612" height="260" fill="url(#e4-overlay)" />
      </g>

      {/* White headline on dark header */}
      <text x="306" y="80" textAnchor="middle" fill="white" fontSize="32" fontWeight="900" letterSpacing="-0.5">
        {truncateText(headline, 26)}
      </text>
      {headline.length > 26 && (
        <text x="306" y="116" textAnchor="middle" fill="white" fontSize="32" fontWeight="900" letterSpacing="-0.5">
          {truncateText(headline.slice(26), 26)}
        </text>
      )}

      {/* Yellow subtitle on dark header */}
      {flyerSubtitle && (
        <>
          <text x="306" y={headline.length > 26 ? 152 : 120} textAnchor="middle" fill={yellow} fontSize="22" fontWeight="900" fontStyle="italic">
            {truncateText(flyerSubtitle, 30)}
          </text>
          {flyerSubtitle.length > 30 && (
            <text x="306" y={headline.length > 26 ? 178 : 146} textAnchor="middle" fill={yellow} fontSize="22" fontWeight="900" fontStyle="italic">
              {truncateText(flyerSubtitle.slice(30), 30)}
            </text>
          )}
        </>
      )}

      {/* Centered plan logo below header */}
      <CenteredLogo planLogo={planLogo} planName={planName} y={276} />

      {/* Bold centered subheadline */}
      <text x="306" y="360" textAnchor="middle" fill="#111" fontSize="17" fontWeight="800">
        {truncateText(flyerSubtitle || headline, 44)}
      </text>
      {(flyerSubtitle || headline).length > 44 && (
        <text x="306" y="382" textAnchor="middle" fill="#111" fontSize="17" fontWeight="800">
          {truncateText((flyerSubtitle || headline).slice(44), 44)}
        </text>
      )}

      {/* Calendar icon + meeting details */}
      <g transform="translate(60, 408)">
        {/* Calendar icon */}
        <rect width="36" height="36" rx="4" fill={bgColor} opacity="0.15" />
        <rect x="4" y="10" width="28" height="22" rx="2" fill="none" stroke={bgColor} strokeWidth="1.5" />
        <line x1="4" y1="16" x2="32" y2="16" stroke={bgColor} strokeWidth="1.5" />
        <rect x="10" y="4" width="4" height="8" rx="2" fill={bgColor} />
        <rect x="22" y="4" width="4" height="8" rx="2" fill={bgColor} />
        <text x="50" y="14" fill="#111" fontSize="13" fontWeight="700">Group Sessions:</text>
        <text x="50" y="30" fill="#333" fontSize="12">
          {formattedDate ? `${formattedDate}${formattedTime ? ` at ${formattedTime}` : ""}` : "Date & time TBD"}
        </text>
        {bodyLines.slice(0, 3).map((line, i) => (
          <text key={i} x="50" y={46 + i * 18} fill="#333" fontSize="12">{line}</text>
        ))}
      </g>

      {/* Location icon + text */}
      <g transform="translate(60, 510)">
        <circle cx="14" cy="14" r="14" fill={bgColor} opacity="0.15" />
        <text x="14" y="19" textAnchor="middle" fill={bgColor} fontSize="16">📍</text>
        <text x="40" y="14" fill="#111" fontSize="13" fontWeight="700">Where:</text>
        <text x="40" y="30" fill="#333" fontSize="13">{truncateText(meetingLocation || "Virtual via Zoom", 36)}</text>
      </g>

      {/* Centered logo again (advisor logo) */}
      <CenteredLogo planLogo={planLogo} planName={planName} y={560} small />

      <DarkFooter
        footerY={footerY}
        totalHeight={792}
        planLogo={undefined}
        planName={planName}
        flyerQrUrl={flyerQrUrl}
        flyerQrDataUrl={flyerQrDataUrl}
        bgColor={bgColor}
        scanLabel="Scan QR to reserve your spot &amp; learn more!"
        urlLabel={flyerQrUrl ? `or visit: ${truncateText(flyerQrUrl, 44)}` : undefined}
      />
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
      {/* Left logo (advisor) */}
      {resolvedPlanLogo ? (
        <image href={resolvedPlanLogo} x="80" y="0" width="160" height="50" preserveAspectRatio="xMidYMid contain" />
      ) : (
        <text x="160" y="30" textAnchor="middle" fill="#555" fontSize="14" fontWeight="700">{truncateText(planName, 20)}</text>
      )}
      {/* Right logo placeholder (client logo) */}
      <rect x="372" y="5" width="160" height="40" rx="4" fill={bgColor} opacity="0.08" />
      <text x="452" y="30" textAnchor="middle" fill={bgColor} fontSize="13" opacity="0.5">{truncateText(planName, 16)}</text>
    </g>
  );
}