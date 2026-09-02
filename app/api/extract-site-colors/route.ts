/**
 * POST /api/extract-site-colors
 *
 * Server-side endpoint that uses Puppeteer to load a company's website
 * and extract brand colors from computed styles of key elements:
 *   1. Primary CTA / button backgrounds (highest weight)
 *   2. Navigation bar backgrounds
 *   3. Active/hover link colors
 *
 * Returns a weighted list of candidate colors for cross-checking with
 * logo-extracted colors.
 *
 * Request:  POST { url: string }
 * Response: { success: true, data: { primary: string, secondary: string, candidates: SiteColorCandidate[], confidence: number } }
 *
 * ── Vercel Strategy ──
 * On Vercel (Pro, 250 MB limit): uses @sparticuz/chromium as the Chromium
 * binary provider.  puppeteer-core is bundled normally; @sparticuz/chromium
 * is externalized via serverExternalPackages so its bin/ directory stays
 * intact.  Local dev uses the full puppeteer package's bundled Chrome
 * (loaded via require() to avoid bundling it into Vercel's build).
 */

import { NextRequest, NextResponse } from "next/server";
import type { Browser, LaunchOptions } from "puppeteer-core";
import {
  detectSiteTech,
  mergeDetections,
  type SiteTechDetection,
} from "@/lib/site-tech-detection";

const isVercel = !!process.env.VERCEL;

/**
 * Resolve Puppeteer launch options based on environment.
 *
 * Vercel   → @sparticuz/chromium (externalized package, bin/ preserved)
 * Local    → full puppeteer package (bundled Chrome via npx puppeteer
 *            browsers install), falling back to system Chrome.
 *
 * Using require() for the local fallback prevents webpack from bundling
 * the ~400 MB puppeteer package into the Vercel deployment.
 */
async function resolveLaunchOptions(): Promise<LaunchOptions & { puppeteer: typeof import("puppeteer-core") }> {
  if (isVercel) {
    const [puppeteer, chromium] = await Promise.all([
      import("puppeteer-core"),
      import("@sparticuz/chromium"),
    ]);

    // The postinstall script copies node_modules/@sparticuz/chromium/bin/
    // to chromium-bin/ at the project root.  We pass this as the explicit
    // input path so chromium.executablePath() finds the .br files even
    // when Vercel strips them from node_modules.
    const binPath = "chromium-bin/";

    return {
      puppeteer,
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(binPath),
      headless: true,
    };
  }

  // ── Local development ───────────────────────────────────────────────
  const puppeteer = await import("puppeteer-core");

  // Try the full puppeteer package for its bundled Chrome path.
  // require() avoids webpack static analysis on Vercel.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { executablePath } = require("puppeteer") as { executablePath: () => string };
    return {
      puppeteer,
      headless: true,
      executablePath: executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    };
  } catch {
    // puppeteer full package unavailable — try system Chrome
    return {
      puppeteer,
      headless: true,
      channel: "chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    };
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SiteColorCandidate {
  hex: string;
  source: "button" | "nav" | "link" | "heading" | "other";
  selector: string;
  weight: number; // 0–1, higher = stronger brand signal
  property: string; // CSS property name (e.g., "background-color")
}

interface SiteExtractionResult {
  primary: string | null;
  secondary: string | null;
  candidates: SiteColorCandidate[];
  confidence: number; // 0–1
  weakExtraction: boolean;
  url: string;
  /** Detected website technology (category + framework), for diagnostics/rollout. */
  detectedType?: SiteTechDetection | null;
  /** True when the site appears to block automated access (challenge page). */
  blocked?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.3; // Below this, extraction is considered "weak"

// ── Platform global color detection (server-side, reliable) ─────────────────

function isNeutralHex(hex: string): boolean {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  if (maxDiff <= 25) return true; // grays
  const brightness = (r + g + b) / 3;
  if (brightness > 245 || brightness < 12) return true;
  return false;
}

interface RawSiteResponse {
  ok: boolean;
  status: number;
  html: string;
  headers: Record<string, string>;
  /** Final URL after following redirects (used to resolve relative stylesheets). */
  finalUrl: string;
}

/**
 * Fetch the target site's raw HTML + response headers once. Used both for
 * technology detection and (via fetchPlatformGlobalColors) token extraction, so
 * the route only performs a single HTML request.
 */
async function fetchRawSite(url: string): Promise<RawSiteResponse> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const html = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      html,
      headers,
      finalUrl: res.url || url,
    };
  } catch {
    return { ok: false, status: 0, html: "", headers: {}, finalUrl: url };
  }
}

/**
 * Extract the platform's declared brand palette (e.g. Elementor
 * --e-global-color-* tokens) from the site's HTML + same-origin stylesheets.
 * Runs server-side with Node fetch, avoiding the browser CORS / CSSOM quirks.
 * When `htmlOverride` is provided (the route already fetched it for detection)
 * the site is not fetched again.
 *
 * Elementor's declared "primary" is often black/gray/white (a neutral), so we
 * promote its "secondary" to primary and its "accent" to secondary — matching
 * how a human reads the brand (e.g. navy primary + gold secondary).
 */
async function fetchPlatformGlobalColors(
  url: string,
  htmlOverride?: string,
  baseUrl?: string,
): Promise<{ primary: string | null; secondary: string | null; colors: string[] }> {
  const colors: string[] = [];
  let primary: string | null = null;
  let secondary: string | null = null;
  let accent: string | null = null;

  const register = (name: string, hex: string) => {
    const upper = hex.toUpperCase();
    if (!/^#[0-9a-fA-F]{6}$/.test(upper) || isNeutralHex(upper)) return;
    if (/^primary$|color-0$/.test(name)) primary = primary || upper;
    else if (/^secondary$|color-1$/.test(name)) secondary = secondary || upper;
    else if (/^accent$/.test(name)) accent = accent || upper;
    if (!colors.includes(upper)) colors.push(upper);
  };

  const tokenRe =
    /--e-global-color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g;

  const resolveBase = baseUrl || url;

  try {
    let html = htmlOverride || "";
    if (!htmlOverride) {
      const htmlRes = await fetch(url, { redirect: "follow" });
      if (htmlRes.ok) html = await htmlRes.text();
    }

    if (html) {
      // Inline <style> / server-rendered CSS in the HTML.
      let m: RegExpExecArray | null;
      while ((m = tokenRe.exec(html)) !== null) register(m[1], m[2]);
      tokenRe.lastIndex = 0;

      // Same-origin stylesheet URLs (Elementor kit + combined CSS).
      const sheetUrls = new Set<string>();
      const linkRe = /<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi;
      let lm: RegExpExecArray | null;
      while ((lm = linkRe.exec(html)) !== null) {
        try {
          sheetUrls.add(new URL(lm[1], resolveBase).href);
        } catch {}
      }

      for (const sheetUrl of sheetUrls) {
        try {
          const cssRes = await fetch(sheetUrl, { redirect: "follow" });
          if (!cssRes.ok) continue;
          const css = await cssRes.text();
          let cm: RegExpExecArray | null;
          while ((cm = tokenRe.exec(css)) !== null) register(cm[1], cm[2]);
          tokenRe.lastIndex = 0;
        } catch {}
      }
    }
  } catch {}

  // If the declared primary was neutral (black/gray/white), promote secondary
  // to primary; use accent as the secondary.
  const platformPrimary = primary || secondary || null;
  const platformSecondary =
    accent || (secondary && secondary !== platformPrimary ? secondary : null);

  return { primary: platformPrimary, secondary: platformSecondary, colors };
}

// ── Main Extraction Logic (runs inside Puppeteer page context) ──────────────

function buildExtractionScript() {
  return `
    (async () => {
      // Helper: parse any CSS color to hex
      function parseToHex(colorStr) {
        if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
        // Handle CSS gradients (linear-gradient / radial-gradient): extract the
        // first color stop — gradients are common on buttons/CTAs and were
        // previously skipped entirely.
        if (typeof colorStr === 'string' && /gradient/i.test(colorStr)) {
          const first = colorStr.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
          if (!first) return null;
          colorStr = first[0];
        }
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = colorStr;
        const computed = ctx.fillStyle;
        if (computed.startsWith('#')) {
          return computed.length === 4
            ? '#' + computed[1] + computed[1] + computed[2] + computed[2] + computed[3] + computed[3]
            : computed;
        }
        // rgb(r, g, b) or rgba(r, g, b, a)
        const match = computed.match(/^rgba?\\(([^)]+)\\)$/);
        if (!match) return null;
        const parts = match[1].split(',').map(Number);
        const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
        return '#' + toHex(parts[0]) + toHex(parts[1]) + toHex(parts[2]);
      }

      function isNeutral(hex) {
        if (!hex) return true;
        const neutral = ['#ffffff','#000000','#333333','#666666','#999999','#cccccc','#eeeeee','#dddddd','#f5f5f5','#fafafa'];
        if (neutral.includes(hex.toLowerCase())) return true;
        // Check if it's a gray (R≈G≈B with small variance)
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        const maxDiff = Math.max(Math.abs(r-g), Math.abs(g-b), Math.abs(r-b));
        // Grays (R≈G≈B within ~25) are neutrals — almost always backgrounds,
        // borders, or text, never brand colors. Covers light, mid, and dark
        // grays (e.g. Tailwind gray-400..gray-800, #6B7280 slate gray) that
        // the previous light/dark-only check let through and which were then
        // snapped to the Slate Gray preset by the client safety pass.
        if (maxDiff <= 25) return true;
        // Very light / very dark colors are effectively neutral regardless of tint.
        const brightness = (r + g + b) / 3;
        if (brightness > 245) return true;
        if (brightness < 12) return true;
        return false;
      }

      function isDistinctColor(hex, existingHexes, minDist) {
        // Simple RGB distance check
        const r1 = parseInt(hex.slice(1,3), 16);
        const g1 = parseInt(hex.slice(3,5), 16);
        const b1 = parseInt(hex.slice(5,7), 16);
        for (const existing of existingHexes) {
          const r2 = parseInt(existing.slice(1,3), 16);
          const g2 = parseInt(existing.slice(3,5), 16);
          const b2 = parseInt(existing.slice(5,7), 16);
          const dist = Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
          if (dist < minDist) return false;
        }
        return true;
      }

      const candidates = [];
      const seenColors = new Set();

      // 1. Scan buttons / CTAs (highest priority)
      const buttons = document.querySelectorAll('button, [role="button"], a.btn, .btn, .button, [class*="cta"], [class*="CTA"], input[type="submit"], .wp-block-button__link');
      for (const btn of buttons) {
        const style = window.getComputedStyle(btn);
        const bg = parseToHex(style.backgroundColor);
        const color = parseToHex(style.color);
        if (bg && !isNeutral(bg) && !seenColors.has(bg)) {
          seenColors.add(bg);
          candidates.push({
            hex: bg.toUpperCase(),
            source: 'button',
            selector: btn.tagName + (btn.className ? '.' + btn.className.split(' ').slice(0,3).join('.') : ''),
            weight: 1.0,
            property: 'background-color'
          });
        }
        // Also capture text color on buttons (sometimes brand uses colored text on neutral bg)
        if (color && !isNeutral(color) && !seenColors.has(color)) {
          seenColors.add(color);
          candidates.push({
            hex: color.toUpperCase(),
            source: 'button',
            selector: btn.tagName + (btn.className ? '.' + btn.className.split(' ').slice(0,3).join('.') : ''),
            weight: 0.7,
            property: 'color'
          });
        }
      }

      // 2. Scan navigation bars
      const navSelectors = ['nav', 'header', '[role="navigation"]', '.navbar', '.nav', '.header', '#header', '.site-header', '.main-nav', '.top-bar'];
      for (const sel of navSelectors) {
        const navs = document.querySelectorAll(sel);
        for (const nav of navs) {
          const style = window.getComputedStyle(nav);
          const bg = parseToHex(style.backgroundColor);
          if (bg && !isNeutral(bg) && !seenColors.has(bg)) {
            seenColors.add(bg);
            candidates.push({
              hex: bg.toUpperCase(),
              source: 'nav',
              selector: sel,
              weight: 0.8,
              property: 'background-color'
            });
          }
        }
      }

      // 3. Scan active/hover link colors
      const links = document.querySelectorAll('a');
      for (const link of links) {
        const style = window.getComputedStyle(link);
        const color = parseToHex(style.color);
        // Check if link has :hover or :active styling by looking at class names
        const hasActiveClass = link.classList.contains('active') || link.classList.contains('current');
        if (color && !isNeutral(color) && !seenColors.has(color)) {
          const weight = hasActiveClass ? 0.6 : 0.3;
          seenColors.add(color);
          candidates.push({
            hex: color.toUpperCase(),
            source: 'link',
            selector: 'a' + (link.className ? '.' + link.className.split(' ').slice(0,2).join('.') : ''),
            weight: weight,
            property: 'color'
          });
        }
      }

      // 4. Scan heading colors (weak signal but can help)
      const headings = document.querySelectorAll('h1, h2, h3');
      for (const h of headings) {
        const style = window.getComputedStyle(h);
        const color = parseToHex(style.color);
        if (color && !isNeutral(color) && !seenColors.has(color)) {
          seenColors.add(color);
          candidates.push({
            hex: color.toUpperCase(),
            source: 'heading',
            selector: h.tagName,
            weight: 0.4,
            property: 'color'
          });
        }
      }

      // 5. Also check for CSS custom properties (design tokens)
      const rootStyles = window.getComputedStyle(document.documentElement);
      const brandProps = ['--primary-color', '--brand-color', '--accent-color', '--color-primary', '--theme-color', '--btn-bg', '--button-bg', '--nav-bg'];
      for (const prop of brandProps) {
        const val = rootStyles.getPropertyValue(prop).trim();
        if (val) {
          const hex = parseToHex(val);
          if (hex && !isNeutral(hex) && !seenColors.has(hex)) {
            seenColors.add(hex);
            candidates.push({
              hex: hex.toUpperCase(),
              source: 'other',
              selector: ':root ' + prop,
              weight: 0.9,
              property: prop
            });
          }
        }
      }

      // 5b. Platform global brand colors (WordPress / Elementor / Squarespace).
      // Elementor defines its palette as --e-global-color-* custom properties
      // (including per-kit hashed names like --e-global-color-f34948a) that do
      // NOT always live on :root. Read them from inline <style> tags and
      // same-origin stylesheets, then treat them as authoritative high-weight
      // candidates. This captures the actual declared brand colors (e.g. navy
      // primary + gold secondary) that element-level scans miss.
      let platformPrimary = null;
      let platformSecondary = null;

      const registerGlobalColor = (name, hex) => {
        if (!hex || isNeutral(hex)) return;
        const upper = hex.toUpperCase();
        if (!platformPrimary && /^(primary|color-0|ast-global-color-0)$/i.test(name)) {
          platformPrimary = upper;
        } else if (!platformSecondary && /^(secondary|accent|color-1|ast-global-color-1)$/i.test(name)) {
          platformSecondary = upper;
        }
        if (!seenColors.has(upper)) {
          seenColors.add(upper);
          candidates.push({
            hex: upper,
            source: 'other',
            selector: ':root --e-global-color-' + name,
            weight: 1.5,
            property: '--e-global-color-' + name
          });
        }
      };

      // (a) Inline <style> tags — Elementor kit CSS is often injected here.
      const globalVarRe = /--e-global-color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g;
      for (const tag of document.querySelectorAll('style')) {
        const text = tag.textContent || '';
        let m;
        while ((m = globalVarRe.exec(text)) !== null) {
          registerGlobalColor(m[1], parseToHex(m[2]));
        }
      }

      // (b) Stylesheets — the combined/optimized CSS is same-origin & readable.
      try {
        for (const sheet of document.styleSheets) {
          let rules;
          try { rules = sheet.cssRules; } catch { continue; }
          const walk = (ruleList) => {
            for (const rule of ruleList) {
              if (rule.cssRules) walk(rule.cssRules);
              if (!rule.style) continue;
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (prop && prop.indexOf('--e-global-color-') === 0) {
                  registerGlobalColor(
                    prop.slice('--e-global-color-'.length),
                    parseToHex(rule.style.getPropertyValue(prop)),
                  );
                }
              }
            }
          };
          walk(rules);
        }
      } catch {}

      // (b2) Fetch same-origin stylesheet text — most reliable for minified
      // combined CSS that the CSSOM may not expose cleanly.
      const seenSheetUrls = new Set();
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        const href = link.href || '';
        if (!href || seenSheetUrls.has(href)) continue;
        seenSheetUrls.add(href);
        try {
          const res = await fetch(href);
          if (!res.ok) continue;
          const cssText = await res.text();
          const fetchRe = /--e-global-color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g;
          let fm;
          while ((fm = fetchRe.exec(cssText)) !== null) {
            registerGlobalColor(fm[1], parseToHex(fm[2]));
          }
        } catch {}
      }

      // (c) Fallback: resolved computed styles for common theme tokens.
      const namedTokens = [
        ['--e-global-color-primary', 'primary'],
        ['--e-global-color-secondary', 'secondary'],
        ['--e-global-color-accent', 'accent'],
        ['--ast-global-color-0', 'ast-global-color-0'],
        ['--ast-global-color-1', 'ast-global-color-1'],
        ['--wp--preset--color--primary', 'primary'],
        ['--wp--preset--color--secondary', 'secondary']
      ];
      for (const root of [document.documentElement, document.body]) {
        const ps = window.getComputedStyle(root);
        for (const pair of namedTokens) {
          const val = ps.getPropertyValue(pair[0]).trim();
          if (val) registerGlobalColor(pair[1], parseToHex(val));
        }
      }

      // 6. Scan inline SVG fills/strokes — icons often carry the accent /
      // secondary brand color and were previously invisible to extraction.
      const svgEls = document.querySelectorAll('svg, svg path, svg rect, svg circle, svg polygon, svg g');
      for (const el of svgEls) {
        const style = window.getComputedStyle(el);
        const fill = parseToHex(style.fill);
        const stroke = parseToHex(style.stroke);
        for (const c of [fill, stroke]) {
          if (c && !isNeutral(c) && !seenColors.has(c)) {
            seenColors.add(c);
            candidates.push({
              hex: c.toUpperCase(),
              source: 'other',
              selector: el.tagName,
              weight: 0.5,
              property: 'fill/stroke'
            });
          }
        }
      }

      return {
        candidates: candidates,
        platformPrimary: platformPrimary,
        platformSecondary: platformSecondary
      };
    })()
  `;
}

// ── Result Processing (server-side) ──────────────────────────────────────────

function processCandidates(
  candidates: SiteColorCandidate[],
  platformPrimary?: string | null,
  platformSecondary?: string | null,
): SiteExtractionResult {
  if (candidates.length === 0) {
    return {
      primary: null,
      secondary: null,
      candidates: [],
      confidence: 0,
      weakExtraction: true,
      url: "",
    };
  }

  // Group by hex and accumulate weights
  const colorMap = new Map<string, SiteColorCandidate & { totalWeight: number; count: number }>();

  for (const c of candidates) {
    const key = c.hex.toUpperCase();
    if (colorMap.has(key)) {
      const existing = colorMap.get(key)!;
      existing.totalWeight += c.weight;
      existing.count += 1;
      // Keep the highest-weight source description
      if (c.weight > existing.weight) {
        existing.source = c.source;
        existing.selector = c.selector;
      }
    } else {
      colorMap.set(key, { ...c, totalWeight: c.weight, count: 1 });
    }
  }

  // Sort by total weight descending
  const sorted = Array.from(colorMap.values()).sort((a, b) => b.totalWeight - a.totalWeight);

  const rgbDistance = (a: string, b: string): number => {
    const r1 = parseInt(a.slice(1, 3), 16);
    const g1 = parseInt(a.slice(3, 5), 16);
    const b1 = parseInt(a.slice(5, 7), 16);
    const r2 = parseInt(b.slice(1, 3), 16);
    const g2 = parseInt(b.slice(3, 5), 16);
    const b2 = parseInt(b.slice(5, 7), 16);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  };

  // Filter distinct colors (at least 35 RGB distance apart)
  const distinct: typeof sorted = [];
  for (const entry of sorted) {
    if (distinct.every((d) => rgbDistance(entry.hex, d.hex) >= 35)) {
      distinct.push(entry);
    }
  }

  // Primary = platform-declared primary if available, else highest weighted.
  const primary = platformPrimary || distinct[0]?.hex || null;
  // Secondary = platform-declared secondary if available and distinct, else
  // the second highest weighted distinct color.
  let secondary =
    platformSecondary && platformSecondary !== primary
      ? platformSecondary
      : distinct[1]?.hex || null;

  // If only one distinct color survived, look for the nearest different hue
  // among all candidates so we never return the primary twice.
  if (!secondary && primary) {
    for (const entry of sorted) {
      if (entry.hex !== primary && rgbDistance(entry.hex, primary) >= 25) {
        secondary = entry.hex;
        break;
      }
    }
  }

  // Confidence based on total weight and number of candidates
  const maxPossibleWeight = 5.0; // Rough estimate of what "strong" looks like
  const rawConfidence = Math.min(sorted[0]?.totalWeight || 0, maxPossibleWeight) / maxPossibleWeight;

  // Boost confidence if we found multiple corroborating signals
  const signalBoost = Math.min((distinct.length - 1) * 0.1, 0.3);
  const confidence = Math.min(rawConfidence + signalBoost, 1.0);

  return {
    primary,
    secondary,
    candidates: sorted.slice(0, 10).map(({ totalWeight, count, ...rest }) => rest),
    confidence: Math.round(confidence * 100) / 100,
    weakExtraction: confidence < CONFIDENCE_THRESHOLD || distinct.length < 2,
    url: "",
  };
}

// ── Puppeteer Browser Singleton ──────────────────────────────────────────────

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;
let browserLastUsed = 0;
const BROWSER_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function getBrowser(): Promise<Browser> {
  const now = Date.now();

  // Close stale browser after idle timeout
  if (browserInstance && now - browserLastUsed > BROWSER_IDLE_TIMEOUT_MS) {
    try {
      await browserInstance.close();
    } catch {}
    browserInstance = null;
    browserLaunchPromise = null;
  }

  // Return existing connected browser
  if (browserInstance?.connected) {
    browserLastUsed = now;
    return browserInstance;
  }

  // If there's an in-flight launch, wait for it
  if (browserLaunchPromise) {
    try {
      const browser = await browserLaunchPromise;
      browserLastUsed = now;
      return browser;
    } catch {
      // Launch failed — reset and try again below
      browserLaunchPromise = null;
      browserInstance = null;
    }
  }

  // Fresh launch — uses @sparticuz/chromium on Vercel, puppeteer's
  // bundled Chrome (or system Chrome) in local development.
  browserLaunchPromise = (async () => {
    const { puppeteer, ...opts } = await resolveLaunchOptions();
    const launched = await puppeteer.default.launch(opts);

    // Handle unexpected disconnects
    launched.on("disconnected", () => {
      browserInstance = null;
      browserLaunchPromise = null;
    });

    browserInstance = launched;
    browserLastUsed = now;
    return launched;
  })();

  try {
    return await browserLaunchPromise;
  } catch (err) {
    // Reset on failure so next call retries
    browserLaunchPromise = null;
    browserInstance = null;
    throw err;
  }
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawUrl = body?.url?.trim();

    if (!rawUrl) {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 },
      );
    }

    // Normalize URL: ensure it has a protocol
    let url = rawUrl;
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" },
        { status: 400 },
      );
    }

    // Detect the site's technology stack from its raw HTML + headers BEFORE
    // launching the browser so navigation/extraction can be tailored to the
    // site type (e.g. extra hydration time for JS frameworks).
    const rawSite = await fetchRawSite(url);
    const serverDetection = detectSiteTech(
      rawSite.html,
      rawSite.headers,
      rawSite.finalUrl,
    );
    console.log(
      `Site tech detection for ${url}: ${serverDetection.framework} (${serverDetection.category}, confidence=${serverDetection.confidence})`,
    );

    let browser: Browser | null = null;
    let page = null;

    try {
      browser = await getBrowser();
      page = await browser.newPage();

      // Block unnecessary resources to speed up page load
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const resourceType = req.resourceType();
        if (
          resourceType === "image" ||
          resourceType === "media" ||
          resourceType === "font" ||
          resourceType === "websocket"
        ) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Set a reasonable viewport
      await page.setViewport({ width: 1440, height: 900 });

      // Set a user agent to avoid being blocked
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );

      // Navigate with timeout — use 'networkidle0' is ideal but can be slow;
      // 'domcontentloaded' is fast but may miss late-loading styles.
      // Use 'networkidle2' as a balanced compromise (no more than 2 network
      // connections for 500ms), with a fallback timeout.
      try {
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 20000,
        });
      } catch (navErr: any) {
        // If navigation times out, try to proceed with whatever loaded
        console.warn(
          `Site navigation warning for ${url}: ${navErr.message}. Proceeding with partial load.`,
        );
      }

      // Allow late styles/hydration to settle. JS frameworks (Next/Nuxt/
      // SvelteKit/etc.) need extra time to hydrate before computed styles
      // reflect the real brand palette.
      const isJsFramework = serverDetection.category === "js-framework";
      await new Promise((resolve) =>
        setTimeout(resolve, isJsFramework ? 2500 : 1200),
      );

      // Run extraction script in page context
      const extracted = (await page.evaluate(buildExtractionScript())) as {
        candidates: SiteColorCandidate[];
        platformPrimary?: string | null;
        platformSecondary?: string | null;
      };
      const candidates: SiteColorCandidate[] =
        extracted?.candidates || [];
      const pagePlatformPrimary = extracted?.platformPrimary || null;
      const pagePlatformSecondary = extracted?.platformSecondary || null;

      // Confirm detection from the rendered DOM — client-side frameworks can
      // inject markers (e.g. __NEXT_DATA__) that aren't in the raw server HTML.
      const pageHtml = await page.content();
      const pageDetection = detectSiteTech(pageHtml, {}, url);
      const detectedType = mergeDetections(serverDetection, pageDetection);

      // Server-side platform color detection (reliable; no CORS/CSSOM quirks).
      // Reuses the HTML fetched for detection to avoid a second request.
      const platform = await fetchPlatformGlobalColors(
        url,
        rawSite.html,
        rawSite.finalUrl,
      );
      const platformPrimary = platform.primary || pagePlatformPrimary;
      const platformSecondary =
        platform.secondary || pagePlatformSecondary;

      // Surface the declared palette as high-weight candidates too.
      for (const color of platform.colors) {
        if (!candidates.some((c) => c.hex === color)) {
          candidates.push({
            hex: color,
            source: "other",
            selector: ":root --e-global-color",
            weight: 1.5,
            property: "global-color",
          });
        }
      }

      // Process results
      const result = processCandidates(
        candidates,
        platformPrimary,
        platformSecondary,
      );
      result.url = url;
      result.detectedType = detectedType;
      result.blocked = detectedType.category === "blocked";

      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error(
        "Site color extraction failed for URL:",
        url,
        "\nError:",
        err.message,
      );

      // Return a graceful failure — the client-side orchestrator will
      // fall back to logo-only extraction.
      return NextResponse.json(
        {
          success: false,
          error: "Failed to extract colors from website",
          details:
            process.env.NODE_ENV === "development"
              ? err.message
              : "The website could not be reached or analyzed.",
        },
        { status: 500 },
      );
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {}
      }
      // Don't close the browser — keep it warm for subsequent requests
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
