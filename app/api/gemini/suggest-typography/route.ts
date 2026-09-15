import { NextRequest, NextResponse } from "next/server";
import {
  extractTypographySignals,
  inferThemeFromSignals,
  summarizeSignalsForModel,
  type TypographyThemeSuggestion,
} from "@/lib/typography-extraction";
import { isTypographyThemeId } from "@/lib/typography-themes";

/**
 * Suggest one of the four portal typography themes for a plan, based on the
 * typography of the plan's company website.
 *
 * Mirrors /api/gemini/suggest-colors: deterministic extraction happens locally,
 * then Gemini makes the judgement call. Unlike the color route we degrade to the
 * deterministic mapping instead of failing when the model is unavailable, so
 * the button always produces a usable suggestion.
 */

const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = "gemini-3.5-flash-lite";

const FETCH_TIMEOUT_MS = 12_000;
/** Cap the HTML we scan so a huge page cannot blow up the parse or the prompt. */
const MAX_HTML_BYTES = 1_500_000;

const THEME_CATALOG = [
  {
    id: "classic",
    headline: "serif (Playfair Display)",
    body: "sans-serif (Outfit)",
  },
  {
    id: "modern",
    headline: "sans-serif (Sora)",
    body: "sans-serif (Outfit)",
  },
  {
    id: "editorial",
    headline: "serif (Playfair Display)",
    body: "serif (Lora)",
  },
  {
    id: "contemporary",
    headline: "sans-serif (Sora)",
    body: "serif (Lora)",
  },
] as const;

const SYSTEM_PROMPT = `You are a typography strategist for a financial services platform.

You are given font signals extracted from an organization's website. Choose the ONE portal typography theme that best matches the site's existing typographic character.

Available themes (id → headline font, body font):
${THEME_CATALOG.map((t) => `- ${t.id}: headline ${t.headline}, body ${t.body}`).join("\n")}

Rules:
- Match the site's *headline* personality to the theme headline, and the site's *body copy* to the theme body.
- Serif headings suggest a serif headline theme (classic or editorial).
- Sans-serif headings suggest a sans headline theme (modern or contemporary).
- Serif body copy suggests a serif body theme (editorial or contemporary).
- Prefer the site's actual fonts; if signals conflict or are thin, favour the closest match and lower your confidence.
- NEVER return a theme id other than: classic, modern, editorial, contemporary.
- Return valid JSON ONLY, with no markdown fences or commentary, in exactly this shape:
{"theme":"classic","reason":"one sentence","confidence":"high"}`;

// ── URL safety ───────────────────────────────────────────────────────────────

/** Block loopback / private / link-local hosts so this cannot probe the network. */
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  // IPv6 literals arrive wrapped in brackets, e.g. "[::1]".
  if (h.startsWith("[")) {
    return (
      h.startsWith("[::1]") ||
      h.startsWith("[fc") ||
      h.startsWith("[fd") ||
      h.startsWith("[fe80")
    );
  }
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31)
    );
  }
  return false;
}

function normalizeWebsiteUrl(input: unknown): URL | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname;
    // Require a real domain or IP literal, and refuse internal targets.
    if (!host.includes(".") && !host.startsWith("[")) return null;
    if (isPrivateHost(host)) return null;
    return url;
  } catch {
    return null;
  }
}

/** Fetch the page HTML with a timeout, size cap and a bot-friendly UA. */
async function fetchHtml(url: URL): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PlanTelligenceBot/1.0; +https://plantel.pro)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return "";
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("html") && !contentType.includes("text")) {
      return "";
    }
    const text = await res.text();
    return text.slice(0, MAX_HTML_BYTES);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

// ── Gemini ───────────────────────────────────────────────────────────────────

function parseModelAnswer(raw: string): TypographyThemeSuggestion | null {
  let jsonStr = (raw || "").trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  if (!jsonStr) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    const block = jsonStr.match(/\{[\s\S]*\}/);
    if (!block) return null;
    try {
      parsed = JSON.parse(block[0]);
    } catch {
      return null;
    }
  }

  const themeId = String(parsed?.theme ?? parsed?.id ?? "").trim().toLowerCase();
  if (!isTypographyThemeId(themeId)) return null;

  const confidenceRaw = String(parsed?.confidence ?? "").trim().toLowerCase();
  const confidence: TypographyThemeSuggestion["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : "medium";

  const reason =
    typeof parsed?.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : "";

  return { theme: themeId, reason, confidence, source: "ai" };
}

async function askGemini(
  signalsSummary: ReturnType<typeof summarizeSignalsForModel>,
  organizationName: string,
  siteUrl: string,
): Promise<TypographyThemeSuggestion | null> {
  if (!API_KEY) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const userPrompt = `organization_name:
${organizationName || ""}

website:
${siteUrl}

extracted_font_signals:
${JSON.stringify(signalsSummary, null, 2)}

Choose the single best matching theme.`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return parseModelAnswer(rawText);
  } catch {
    return null;
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { websiteUrl, organizationName } = body || {};

    const url = normalizeWebsiteUrl(websiteUrl);
    if (!url) {
      return NextResponse.json(
        { error: "A valid public company website URL is required" },
        { status: 400 },
      );
    }

    const html = await fetchHtml(url);
    if (!html) {
      const fallback = inferThemeFromSignals({
        fonts: [],
        headingFonts: [],
        bodyFonts: [],
        linkedFonts: [],
        hasSerif: false,
        empty: true,
      });
      return NextResponse.json(
        {
          error:
            "Could not read that website. Check the URL is public and reachable.",
          ...fallback,
        },
        { status: 422 },
      );
    }

    const signals = extractTypographySignals(html);

    // Deterministic reading — also the safety net for the AI answer.
    const heuristic = inferThemeFromSignals(signals);
    const summary = summarizeSignalsForModel(signals);

    // No usable font data: report the default rather than guessing wildly.
    if (signals.empty) {
      return NextResponse.json({
        ...heuristic,
        detected: summary,
      });
    }

    const ai = await askGemini(
      summary,
      typeof organizationName === "string" ? organizationName : "",
      url.toString(),
    );

    const suggestion = ai || heuristic;

    return NextResponse.json({
      theme: suggestion.theme,
      reason: suggestion.reason,
      confidence: suggestion.confidence,
      source: suggestion.source,
      detected: summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
