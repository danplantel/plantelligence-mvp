/**
 * Client-side flyer PDF generation.
 *
 * Captures the SVG flyer as an Image (at print resolution), draws it to a
 * canvas, and embeds it into a letter-size PDF via jsPDF.
 *
 * Both the Modal and the Edit Marketing Assets section use this same helper
 * so the PDF always matches the on-screen preview exactly.
 */

import jsPDF from "jspdf";
import type { FlyerPreviewProps } from "@/components/pages/marketing/flyer-templates";

// ── Data shape (shared between modal & marketing page) ───────────────────────

export interface FlyerPdfData {
  headline: string;
  body: string;
  startDate: string;
  bgColor: string;
  planName: string;
  planLogo?: string;
  flyerSubtitle?: string;
  flyerImage?: string;
  flyerQrUrl?: string;
  /** Pre-generated QR code data URL (from QR.io or local) — takes precedence over flyerQrUrl */
  flyerQrDataUrl?: string;
  meetingTime?: string;
  meetingLocation?: string;
}

// ── SVG builder (for re-creating a flyer from saved data) ────────────────────

/**
 * Render the actual FlyerPreview React component into a hidden DOM container,
 * extract the resulting SVG, and return it. This guarantees the PDF matches
 * the on-screen template exactly — unlike buildFlyerSvgFromData which produces
 * a generic layout that ignores the template, image positioning, disclaimer,
 * organization logo, language, and other fields.
 *
 * Used by the Edit Marketing Assets section so a previously saved flyer can be
 * downloaded as a PDF that matches what the advisor sees in the modal preview.
 */
export async function renderFlyerPreviewToSvg(
  props: FlyerPreviewProps,
): Promise<SVGSVGElement> {
  const [{ createRoot }, { FlyerPreview }, React] = await Promise.all([
    import("react-dom/client"),
    import("@/components/pages/marketing/flyer-templates"),
    import("react"),
  ]);

  return new Promise((resolve, reject) => {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "612px";
    document.body.appendChild(container);

    const root = createRoot(container);

    // Strip decorative Tailwind classes so the SVG uses its intrinsic size
    // (viewBox) rather than CSS-constrained dimensions in the hidden container.
    const cleanProps = { ...props, className: "w-full h-auto" };
    root.render(React.createElement(FlyerPreview, cleanProps as any));

    // Poll for the SVG after React commits the render. We use rAF chaining
    // to let React flush, then retry up to ~3 s for the SVG to appear.
    let attempts = 0;
    const maxAttempts = 30;

    const checkForSvg = () => {
      const svg = container.querySelector("svg");
      if (svg) {
        const clone = svg.cloneNode(true) as SVGSVGElement;
        root.unmount();
        document.body.removeChild(container);
        resolve(clone);
      } else if (++attempts < maxAttempts) {
        requestAnimationFrame(checkForSvg);
      } else {
        root.unmount();
        document.body.removeChild(container);
        reject(new Error("FlyerPreview did not render an SVG element"));
      }
    };

    // Double rAF ensures React has committed the initial render before we poll.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        checkForSvg();
      });
    });
  });
}

/**
 * Build a simplified flyer SVG element from saved data.
 * @deprecated Prefer {@link renderFlyerPreviewToSvg} which renders the actual
 *   FlyerPreview React component so the PDF matches the template the advisor
 *   selected. This function produces a generic layout that does not reflect
 *   any of the real flyer templates and is only kept as a fallback.
 */
export function buildFlyerSvgFromData(
  data: FlyerPdfData,
  resolvedLogo?: string | null,
): SVGSVGElement {
  const S = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(S, "svg");
  svg.setAttribute("viewBox", "0 0 612 792");
  svg.setAttribute("width", "612");
  svg.setAttribute("height", "792");

  const c = data.bgColor || "#23919c";

  // ── Helpers ──
  const rect = (attrs: Record<string, string>) => {
    const el = document.createElementNS(S, "rect");
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  const txt = (x: string, y: string, content: string, fill: string, fontSize: string, fontWeight?: string) => {
    const el = document.createElementNS(S, "text");
    el.setAttribute("x", x);
    el.setAttribute("y", y);
    el.setAttribute("fill", fill);
    el.setAttribute("font-size", fontSize);
    el.setAttribute("font-family", "system-ui, -apple-system, sans-serif");
    if (fontWeight) el.setAttribute("font-weight", fontWeight);
    el.textContent = content;
    return el;
  };

  // White background
  svg.appendChild(rect({ width: "612", height: "792", fill: "white", rx: "8" }));

  // Header area
  svg.appendChild(rect({ y: "0", width: "612", height: "200", fill: c, opacity: "0.08" }));

  if (data.flyerImage) {
    const img = document.createElementNS(S, "image");
    img.setAttribute("href", data.flyerImage);
    img.setAttribute("width", "612");
    img.setAttribute("height", "200");
    img.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.appendChild(img);
  }

  // Overlay
  svg.appendChild(rect({ y: "130", width: "612", height: "70", fill: "#000", opacity: "0.4" }));

  // Headline
  svg.appendChild(txt("50", "165", data.headline.slice(0, 30), "white", "34", "800"));

  // Subtitle
  if (data.flyerSubtitle) {
    svg.appendChild(txt("50", "190", data.flyerSubtitle.slice(0, 45), "white", "16", "500"));
  }

  // Event info card
  svg.appendChild(rect({ x: "40", y: "240", width: "532", height: "130", rx: "12", fill: c, opacity: "0.04" }));
  svg.appendChild(rect({ x: "40", y: "240", width: "532", height: "130", rx: "12", fill: "none", stroke: c, "stroke-width": "1", "stroke-opacity": "0.12" }));

  // Date
  svg.appendChild(txt("74", "289", "\uD83D\uDCC5", c, "15"));
  svg.appendChild(txt("104", "289", data.startDate ? formatDateSimple(data.startDate) : "Date TBD", "#333", "16", "700"));

  // Time
  svg.appendChild(txt("74", "329", "\uD83D\uDD50", c, "15"));
  svg.appendChild(txt("104", "329", data.meetingTime || "Time TBD", "#555", "15"));

  // Divider
  svg.appendChild(rect({ x: "330", y: "255", width: "1", height: "100", fill: c, opacity: "0.1" }));

  // Location
  svg.appendChild(txt("364", "289", "\uD83D\uDCCD", c, "15"));
  svg.appendChild(txt("394", "289", data.meetingLocation || "Format TBD", "#333", "15", "600"));

  // Description
  svg.appendChild(txt("50", "420", "ABOUT THIS EVENT", c, "18", "700"));
  svg.appendChild(rect({ x: "50", y: "430", width: "50", height: "3.5", rx: "1.75", fill: c }));

  const bodyText = data.body || "Join us for this important event. Details will be shared with registered attendees.";
  const bodyLines = wrapText(bodyText, 85).slice(0, 8);
  bodyLines.forEach((line, i) => {
    svg.appendChild(txt("50", String(455 + i * 22), line, "#444", "13"));
  });

  // Footer
  svg.appendChild(rect({ y: "640", width: "612", height: "152", fill: c, opacity: "0.06" }));

  // Logo
  if (resolvedLogo) {
    const g = document.createElementNS(S, "g");
    g.setAttribute("transform", "translate(48, 668)");
    g.appendChild(rect({ width: "100", height: "36", rx: "4", fill: "white", opacity: "0.95" }));
    const logoImg = document.createElementNS(S, "image");
    logoImg.setAttribute("href", resolvedLogo);
    logoImg.setAttribute("x", "5");
    logoImg.setAttribute("y", "5");
    logoImg.setAttribute("width", "90");
    logoImg.setAttribute("height", "26");
    logoImg.setAttribute("preserveAspectRatio", "xMidYMid contain");
    g.appendChild(logoImg);
    svg.appendChild(g);
  }

  svg.appendChild(txt("50", "724", `Presented by ${data.planName} \u00B7 Benefits Team`, c, "16", "600"));
  svg.appendChild(txt("50", "748", "Questions? Contact your plan administrator", "#999", "14"));

  // QR code — uses pre-generated data URL when available, falls back to api.qrserver.com
  const qrG = document.createElementNS(S, "g");
  qrG.setAttribute("transform", "translate(448, 652)");
  qrG.appendChild(rect({ width: "112", height: "112", rx: "4", fill: "white", stroke: c, "stroke-width": "1", "stroke-opacity": "0.25" }));

  const qrImageUrl = data.flyerQrDataUrl
    || (data.flyerQrUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=112x112&data=${encodeURIComponent(data.flyerQrUrl)}`
      : null);

  if (qrImageUrl) {
    const qrImg = document.createElementNS(S, "image");
    qrImg.setAttribute("href", qrImageUrl);
    qrImg.setAttribute("x", "4");
    qrImg.setAttribute("y", "4");
    qrImg.setAttribute("width", "104");
    qrImg.setAttribute("height", "104");
    qrImg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    qrG.appendChild(qrImg);
  } else {
    qrG.appendChild(rect({ x: "14", y: "14", width: "84", height: "84", rx: "2", fill: "none", stroke: c, "stroke-width": "0.6", "stroke-dasharray": "4,4", opacity: "0.2" }));
  }
  svg.appendChild(qrG);

  return svg;
}

// ── Font embedding ───────────────────────────────────────────────────────────

/**
 * Font families used by the flyer templates. Browsers block external resources
 * (including Google Fonts `@import`) when an SVG is loaded as `<img>` for PDF
 * rasterisation, so we fetch the Google Fonts CSS and rewrite every font file
 * URL to a base64 data URL. The resulting `@font-face` rules are self-contained
 * and render correctly when the SVG is painted to the canvas.
 */
const FLYER_FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400..900&display=swap";

async function fetchEmbeddedFlyerFontCss(): Promise<string> {
  try {
    const res = await fetch(FLYER_FONT_CSS_URL);
    if (!res.ok) return "";
    const css = await res.text();
    const urlMatches = Array.from(css.matchAll(/url\((https:\/\/[^)]+)\)/g));
    const replacements: Array<{ from: string; to: string }> = [];
    for (const m of urlMatches) {
      try {
        const fontRes = await fetch(m[1]);
        if (!fontRes.ok) continue;
        const blob = await fontRes.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve("");
          reader.readAsDataURL(blob);
        });
        if (dataUrl) replacements.push({ from: m[0], to: `url(${dataUrl})` });
      } catch {
        // skip a failed font — the flyer will fall back to system-ui
      }
    }
    let result = css;
    for (const r of replacements) result = result.replace(r.from, r.to);
    return result;
  } catch {
    return "";
  }
}

// ── SVG serialisation ────────────────────────────────────────────────────────

/**
 * Serialise a live DOM SVG element to a data URL so it can be loaded as an
 * `<img>` and painted onto a canvas.
 *
 * The original SVG uses CSS classes (`w-full h-auto max-w-[420px]`) that are
 * meaningless in a standalone SVG context, so we strip them and set explicit
 * pixel dimensions matching the viewBox.
 *
 * External images (logo, flyer image) are embedded as inline data URLs so they
 * render correctly when the SVG is loaded from a blob — browsers block loading
 * sub-resources from SVG-as-img, which caused the company logo to go missing.
 */
export async function svgElementToDataUrl(svgEl: SVGSVGElement): Promise<string> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  // Strip Tailwind / CSS class styling that only works inside the React app
  clone.removeAttribute("class");
  clone.removeAttribute("style");

  // Set explicit intrinsic size from the viewBox so the Image loads correctly
  const vb = (clone.getAttribute("viewBox") || "0 0 612 792").split(/\s+/);
  clone.setAttribute("width", vb[2] || "612");
  clone.setAttribute("height", vb[3] || "792");

  // Flatten any inline font-family style into an attribute (safe for SVG-as-img)
  const fontFamily = "system-ui, -apple-system, sans-serif";
  clone.setAttribute("style", `font-family:${fontFamily}`);

  // Remove opacity on <image> elements so they render fully opaque in the canvas
  clone.querySelectorAll("image").forEach((img) => {
    img.removeAttribute("opacity");
  });

  // ── Embed external images as inline data URLs ──
  // SVG loaded via <img src="data:..."> cannot fetch sub-resources; we must
  // inline every image so the logo, flyer image etc. are present in the PDF.
  const imageEls = Array.from(clone.querySelectorAll("image"));
  await Promise.all(
    imageEls.map(async (img) => {
      const href = img.getAttribute("href") || img.getAttribute("xlink:href");
      if (!href || href.startsWith("data:")) return; // already inlined
      try {
        const dataUrl = await fetchAsDataUrl(href);
        img.setAttribute("href", dataUrl);
        img.removeAttribute("xlink:href"); // avoid duplicate references
      } catch {
        // image fails to fetch — leave the original href; will either
        // render as a broken image or be skipped entirely.
      }
    }),
  );

  // ── Embed flyer fonts as base64 @font-face ──
  // The on-screen templates load Bebas Neue / Montserrat via a Google Fonts
  // `@import`, which is blocked when the SVG is loaded as <img>. Injecting a
  // `<defs><style>` with data-URL @font-face keeps the template fonts in the PDF.
  const fontCss = await fetchEmbeddedFlyerFontCss();
  if (fontCss) {
    const S = "http://www.w3.org/2000/svg";
    let defs = clone.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(S, "defs");
      clone.insertBefore(defs, clone.firstChild);
    }
    const styleEl = document.createElementNS(S, "style");
    styleEl.setAttribute("type", "text/css");
    styleEl.textContent = fontCss;
    defs.appendChild(styleEl);
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  return URL.createObjectURL(blob);
}

/** Fetch a URL (same-origin or CORS-allowed) and return it as a data URL. */
async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── PDF generation ───────────────────────────────────────────────────────────

/**
 * Load an SVG data URL into an off-screen Image, draw it to a canvas at print
 * resolution, then return a letter-size PDF blob.
 *
 * @param svgDataUrl – data URL returned by `svgElementToDataUrl`
 * @param scale      – pixel-density multiplier (≈ 300 DPI / 72 DPI ≈ 4.17)
 */
export async function generateFlyerPdfBlob(
  svgDataUrl: string,
  scale = 4.17,
): Promise<Blob> {
  const img = await loadImage(svgDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);
  return pdf.output("blob");
}

/**
 * One-shot: serialise an SVG element -> PDF blob -> trigger browser download.
 */
export async function downloadFlyerPdf(
  svgEl: SVGSVGElement,
  fileName: string,
): Promise<void> {
  const dataUrl = await svgElementToDataUrl(svgEl);
  const blob = await generateFlyerPdfBlob(dataUrl);
  triggerDownload(blob, fileName);
}

/** Convert a Blob to a base64 data URL. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Ensure the QR code image is available as an inline data URL so it renders
 * reliably when the flyer SVG is rasterised into a PDF.
 *
 * - If `qrDataUrl` is already a `data:` URL, use it as-is.
 * - If `qrDataUrl` is a URL (e.g. a QR.io image URL that may be cross-origin
 *   or expired), fetch it and inline it as a data URL.
 * - If no usable data URL exists, fall back to generating one from `qrUrl`
 *   via api.qrserver.com.
 *
 * This is needed because when an SVG is loaded as an <img> for canvas/PDF
 * rasterisation, the browser blocks external sub-resources — so any image
 * that isn't inlined as a data URL is silently dropped from the PDF.
 */
export async function resolveQrImageDataUrl(
  qrDataUrl: string,
  qrUrl: string,
): Promise<string> {
  // Already an inline data URL — nothing to do.
  if (qrDataUrl && qrDataUrl.startsWith("data:")) return qrDataUrl;

  // It's a remote URL (e.g. QR.io image URL) — fetch and inline it.
  if (qrDataUrl) {
    try {
      const res = await fetch(qrDataUrl);
      if (res.ok) return await blobToDataUrl(await res.blob());
    } catch {
      // fall through to the qrserver fallback below
    }
  }

  // No usable data URL — generate one from the original link.
  if (qrUrl) {
    try {
      const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrUrl)}`;
      const res = await fetch(fallbackUrl);
      if (res.ok) return await blobToDataUrl(await res.blob());
    } catch {
      // ignore — return the original value as-is
    }
  }

  return qrDataUrl || "";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Format a date string to a human-readable format. */
function formatDateSimple(d: string): string {
  try {
    const clean = d.split("T")[0].split(" ")[0];
    const parsed = new Date(clean + "T12:00:00");
    if (isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

/** Wrap text to fit within ≈85 chars per line. */
function wrapText(text: string, maxChars: number): string[] {
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
