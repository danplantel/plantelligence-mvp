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
 */

import { NextRequest, NextResponse } from "next/server";
import type { Browser, LaunchOptions } from "puppeteer-core";

// Vercel serverless doesn't include Chrome.  @sparticuz/chromium provides a
// Lambda-compatible Chromium binary.  Locally we use the full puppeteer
// package which bundles its own Chrome.

let _puppeteerCore: typeof import("puppeteer-core") | null = null;
let _chromium: typeof import("@sparticuz/chromium").default | null = null;

const isVercel = !!process.env.VERCEL;

async function resolveLaunchOptions(): Promise<LaunchOptions> {
  if (isVercel) {
    // ── Vercel / serverless ────────────────────────────────────────────
    if (!_chromium) {
      _chromium = (await import("@sparticuz/chromium")).default;
    }
    if (!_puppeteerCore) {
      _puppeteerCore = await import("puppeteer-core");
    }
    return {
      args: _chromium.args,
      executablePath: await _chromium.executablePath(),
      headless: true,
    };
  }

  // ── Local development ───────────────────────────────────────────────
  // Try the full puppeteer package (bundled Chrome via npx puppeteer browsers install)
  try {
    const puppeteerFull = await import("puppeteer");
    if (!_puppeteerCore) {
      _puppeteerCore = puppeteerFull as unknown as typeof import("puppeteer-core");
    }
    return {
      headless: true,
      executablePath: (puppeteerFull as any).default?.executablePath?.() ?? puppeteerFull.executablePath?.(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    };
  } catch {
    // puppeteer not available — fall back to puppeteer-core with system Chrome
    if (!_puppeteerCore) {
      _puppeteerCore = await import("puppeteer-core");
    }
    return {
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

async function launchBrowser(): Promise<Browser> {
  const opts = await resolveLaunchOptions();
  if (!_puppeteerCore) {
    _puppeteerCore = await import("puppeteer-core");
  }
  return _puppeteerCore.default.launch(opts);
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
}

// ── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.3; // Below this, extraction is considered "weak"

// ── Main Extraction Logic (runs inside Puppeteer page context) ──────────────

function buildExtractionScript() {
  return `
    (() => {
      // Helper: parse any CSS color to hex
      function parseToHex(colorStr) {
        if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
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
        // Pure grays (all values within 10 of each other) or very light/dark
        if (maxDiff <= 10 && r > 200) return true; // Light gray
        if (maxDiff <= 10 && r < 50) return true;  // Dark gray
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

      return candidates;
    })()
  `;
}

// ── Result Processing (server-side) ──────────────────────────────────────────

function processCandidates(candidates: SiteColorCandidate[]): SiteExtractionResult {
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

  // Filter distinct colors (at least 50 RGB distance apart)
  const distinct: typeof sorted = [];
  for (const entry of sorted) {
    const isDistinct = distinct.every((d) => {
      const r1 = parseInt(entry.hex.slice(1, 3), 16);
      const g1 = parseInt(entry.hex.slice(3, 5), 16);
      const b1 = parseInt(entry.hex.slice(5, 7), 16);
      const r2 = parseInt(d.hex.slice(1, 3), 16);
      const g2 = parseInt(d.hex.slice(3, 5), 16);
      const b2 = parseInt(d.hex.slice(5, 7), 16);
      return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) >= 50;
    });
    if (isDistinct) {
      distinct.push(entry);
    }
  }

  // Primary = highest weighted
  const primary = distinct[0]?.hex || null;
  // Secondary = second highest weighted (distinct from primary)
  const secondary = distinct[1]?.hex || null;

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

  // Fresh launch — uses @sparticuz/chromium on Vercel, puppeteer's bundled
  // Chrome (or system Chrome) in local development.
  browserLaunchPromise = (async () => {
    const launched = await launchBrowser();

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

      // Small extra wait for any late style computations
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Run extraction script in page context
      const candidates = (await page.evaluate(
        buildExtractionScript(),
      )) as SiteColorCandidate[];

      // Process results
      const result = processCandidates(candidates);
      result.url = url;

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
