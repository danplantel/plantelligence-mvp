/**
 * Server-side website technology detection.
 *
 * Given the raw HTML + response headers of a fetched site, classify the site
 * into a category + framework so the color-extraction route can choose the
 * right strategy:
 *
 *   - "cms"          → WordPress (+Elementor/Astra), Shopify, Squarespace,
 *                      Wix, Webflow, HubSpot CMS, Ghost, Drupal, Joomla
 *   - "js-framework" → Next.js, Nuxt/Vue, SvelteKit, Remix, Gatsby, Astro,
 *                      Angular, Vite/CRA
 *   - "static"       → plain HTML/CSS
 *   - "blocked"      → WAF challenge / "Access Denied" / CAPTCHA
 *
 * This is a pure function (no Puppeteer) so it can be unit-tested and reused
 * by both a server-side fast path and an in-browser confirmation pass.
 */

export type SiteTechCategory =
  | "cms"
  | "js-framework"
  | "static"
  | "blocked";

export interface SiteTechDetection {
  category: SiteTechCategory;
  /** Canonical framework id, e.g. "wordpress-elementor", "nextjs", "static-html". */
  framework: string;
  /** Human-readable label, e.g. "WordPress + Elementor". */
  label: string;
  confidence: "high" | "medium" | "low";
  /** Markers matched, for debugging / rollout. */
  signals: string[];
}

/** Headers may be an object of string or string[] (undici header format). */
export type SiteHeadersLike = Record<string, string | string[] | undefined>;

interface DetectionRule {
  framework: string;
  label: string;
  category: SiteTechCategory;
  confidence: "high" | "medium";
  /** Regexes tested (case-insensitively) against the lowercased HTML. */
  markers: RegExp[];
}

const RULES: DetectionRule[] = [
  // ── WordPress page builders (must be checked before generic WordPress) ──
  {
    framework: "wordpress-elementor",
    label: "WordPress + Elementor",
    category: "cms",
    confidence: "high",
    markers: [
      /--e-global-color-/,
      /data-elementor-type/,
      /elementor-kit-/,
      /elementor-pro\//,
    ],
  },
  {
    framework: "wordpress-astra",
    label: "WordPress + Astra",
    category: "cms",
    confidence: "high",
    markers: [/--ast-global-color-/],
  },

  // ── JS frameworks / SPAs ─────────────────────────────────────────────────
  {
    framework: "nextjs",
    label: "Next.js",
    category: "js-framework",
    confidence: "high",
    markers: [/__next_data__/, /\/_next\/static\//, /id="__next"/],
  },
  {
    framework: "nuxt",
    label: "Nuxt",
    category: "js-framework",
    confidence: "high",
    markers: [/window\.__nuxt__/, /__nuxt__/],
  },
  {
    framework: "sveltekit",
    label: "SvelteKit",
    category: "js-framework",
    confidence: "high",
    markers: [/__sveltekit/, /data-sveltekit-/],
  },
  {
    framework: "remix",
    label: "Remix",
    category: "js-framework",
    confidence: "high",
    markers: [/__remixcontext/, /_remixmanifest/],
  },
  {
    framework: "gatsby",
    label: "Gatsby",
    category: "js-framework",
    confidence: "medium",
    markers: [/id="___gatsby"/, /\.gatsby\./],
  },
  {
    framework: "astro",
    label: "Astro",
    category: "js-framework",
    confidence: "medium",
    markers: [/astro-island/, /data-astro-/],
  },
  {
    framework: "angular",
    label: "Angular",
    category: "js-framework",
    confidence: "high",
    markers: [/ng-version=/, /<app-root/, /ng-app=/],
  },
  {
    framework: "vue",
    label: "Vue.js",
    category: "js-framework",
    confidence: "medium",
    markers: [/data-server-rendered/, /data-v-/, /id="app"[^>]*class[^>]*vite/],
  },
  {
    framework: "vite-spa",
    label: "Vite SPA",
    category: "js-framework",
    confidence: "medium",
    markers: [/\/@vite\/client/, /\/assets\/index-[a-z0-9]+\.js/],
  },
  {
    framework: "react-cra",
    label: "React (CRA)",
    category: "js-framework",
    confidence: "medium",
    markers: [/id="root"[^>]*>\s*<script[^>]*src="\/static\/js/, /\/static\/js\/main\./],
  },

  // ── CMS platforms ────────────────────────────────────────────────────────
  {
    framework: "shopify",
    label: "Shopify",
    category: "cms",
    confidence: "high",
    markers: [/cdn\.shopify\.com/, /myshopify\.com/, /shopify\.theme/],
  },
  {
    framework: "squarespace",
    label: "Squarespace",
    category: "cms",
    confidence: "high",
    markers: [/static\.squarespace\.com/, /squarespace/i, /squarespace-css/],
  },
  {
    framework: "wix",
    label: "Wix",
    category: "cms",
    confidence: "high",
    markers: [/wixstatic\.com/, /x-wix-renderer/, /wix\.com\/[\w-]+\/wix/i],
  },
  {
    framework: "webflow",
    label: "Webflow",
    category: "cms",
    confidence: "high",
    markers: [/data-wf-/, /w-webflow/, /webflow\.com\/asset/],
  },
  {
    framework: "hubspot",
    label: "HubSpot CMS",
    category: "cms",
    confidence: "high",
    markers: [/hs-scripts/, /hbspt\./, /hubspot/],
  },
  {
    framework: "ghost",
    label: "Ghost",
    category: "cms",
    confidence: "medium",
    markers: [/\/ghost\/api/, /ghost-sdk/, /generator[^>]*content="ghost/i],
  },
  {
    framework: "drupal",
    label: "Drupal",
    category: "cms",
    confidence: "high",
    markers: [/\/sites\/default\/files\//, /\/sites\/all\/themes\//],
  },
  {
    framework: "joomla",
    label: "Joomla",
    category: "cms",
    confidence: "high",
    markers: [/joomla/i, /\/media\/system\/js\//],
  },
  {
    framework: "wordpress",
    label: "WordPress",
    category: "cms",
    confidence: "medium",
    markers: [/wp-content\//, /wp-includes\//, /\/wp-json\//],
  },
];

/** Strong "this page is a bot challenge" markers, in priority order. */
const BLOCKED_MARKERS: Array<{ label: string; re: RegExp }> = [
  { label: "access-denied", re: /access denied/i },
  { label: "challenge-page", re: /just a moment|checking your browser/i },
  { label: "cloudflare-challenge", re: /cf-challenge|challenge-platform|turnstile/i },
  { label: "captcha", re: /captcha/i },
  { label: "js-cookies-required", re: /enable javascript and cookies to continue/i },
];

/** Normalize header values to a single lowercase string. */
function headerValue(
  headers: SiteHeadersLike | undefined,
  name: string,
): string {
  const v = headers?.[name];
  if (Array.isArray(v)) return v.join(",").toLowerCase();
  return String(v || "").toLowerCase();
}

/**
 * Classify a site from its raw HTML (and optional response headers).
 */
export function detectSiteTech(
  html: string,
  headers?: SiteHeadersLike,
  url?: string,
): SiteTechDetection {
  const signals: string[] = [];
  const raw = String(html || "");
  const low = raw.toLowerCase();

  // 1) Blocked / WAF challenge.
  for (const m of BLOCKED_MARKERS) {
    if (m.re.test(low)) {
      signals.push(m.label);
      // Only report "blocked" confidently when the page is actually a challenge
      // shell (short body) — avoids misclassifying a normal page that merely
      // mentions "captcha"/"access denied" in its copy.
      const looksLikeShell = low.length > 0 && low.length < 20000;
      if (looksLikeShell) {
        return {
          category: "blocked",
          framework: "blocked",
          label: m.label,
          confidence: "high",
          signals,
        };
      }
    }
  }

  // 2) Header-only hints (supporting, not authoritative).
  const poweredBy = headerValue(headers, "x-powered-by");
  if (/next\.js/i.test(poweredBy)) signals.push("x-powered-by: nextjs");
  else if (/express/i.test(poweredBy)) signals.push("x-powered-by: express");
  if (/^shopify/i.test(headerValue(headers, "x-shopify-stage"))) {
    signals.push("x-shopify-stage");
  }

  // 3) Framework / CMS rules — first match wins (rules are priority-ordered).
  for (const rule of RULES) {
    const matched: string[] = [];
    for (const re of rule.markers) {
      if (re.test(low)) matched.push(re.source);
    }
    if (matched.length === 0) continue;

    signals.push(`rule:${rule.framework}`);
    return {
      category: rule.category,
      framework: rule.framework,
      label: rule.label,
      confidence: rule.confidence,
      signals,
    };
  }

  // 4) No framework markers found.
  return {
    category: "static",
    framework: "static-html",
    label: "Static HTML/CSS",
    confidence: "low",
    signals,
  };
}

/**
 * Merge a server-side detection with an in-browser one. Prefer whichever found
 * a concrete (non-static, non-blocked) framework; otherwise fall back to the
 * blocked/static result from the more authoritative source.
 */
export function mergeDetections(
  server: SiteTechDetection,
  page?: SiteTechDetection,
): SiteTechDetection {
  if (!page) return server;

  const concrete = (d: SiteTechDetection) =>
    d.framework !== "static-html" && d.framework !== "blocked";

  if (concrete(server)) return server;
  if (concrete(page)) return page;

  // Both generic — a blocked signal is more informative than "static".
  if (server.category === "blocked") return server;
  if (page.category === "blocked") return page;
  return server;
}
