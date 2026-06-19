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
  meetingTime?: string;
  meetingLocation?: string;
}

// ── SVG builder (for re-creating a flyer from saved data) ────────────────────

/**
 * Build a simplified flyer SVG element from saved data.
 * Used by the Edit Marketing Assets section so it can download a previously
 * saved flyer without needing the modal's React FlyerPreview component.
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

  // QR
  const qrG = document.createElementNS(S, "g");
  qrG.setAttribute("transform", "translate(448, 652)");
  qrG.appendChild(rect({ width: "112", height: "112", rx: "4", fill: "white", stroke: c, "stroke-width": "1", "stroke-opacity": "0.25" }));

  if (data.flyerQrUrl) {
    const dots: [number, number, number, number, number?][] = [
      [10, 10, 20, 20, 2], [82, 10, 20, 20, 2], [10, 82, 20, 20, 2], [46, 46, 20, 20, 2],
      [32, 32, 7, 7, 1], [73, 73, 7, 7, 1], [32, 73, 7, 7, 1], [73, 32, 7, 7, 1],
    ];
    dots.forEach(([x, y, w, h, r]) => {
      qrG.appendChild(rect({ x: String(x), y: String(y), width: String(w), height: String(h), rx: String(r ?? 1), fill: c, opacity: w > 10 ? "0.9" : "0.6" }));
    });
  } else {
    qrG.appendChild(rect({ x: "14", y: "14", width: "84", height: "84", rx: "2", fill: "none", stroke: c, "stroke-width": "0.6", "stroke-dasharray": "4,4", opacity: "0.2" }));
  }
  svg.appendChild(qrG);

  return svg;
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
