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

      {/* Yellow scan text */}
      <text x="40" y={arrowMidY - 18} fill={yellow} fontSize="14" fontWeight="700">
        {scanLabel}
      </text>
      {urlLabel && (
        <text x="40" y={arrowMidY} fill={yellow} fontSize="12" fontWeight="400">
          {urlLabel}
        </text>
      )}

      {/* Curved arrow pointing right toward QR */}
      <path
        d={`M ${arrowEndX - 80} ${arrowMidY + 10} Q ${arrowEndX - 40} ${arrowMidY + 30} ${arrowEndX} ${arrowMidY}`}
        fill="none"
        stroke={yellow}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Arrowhead */}
      <polygon
        points={`${arrowEndX},${arrowMidY} ${arrowEndX - 12},${arrowMidY - 8} ${arrowEndX - 10},${arrowMidY + 8}`}
        fill={yellow}
      />

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
        scanLabel="Scan this QR code to explore your options"
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
        scanLabel="Scan this QR code to visit your participant website"
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
        scanLabel="Scan this QR code to reserve your spot &amp; learn more!"
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