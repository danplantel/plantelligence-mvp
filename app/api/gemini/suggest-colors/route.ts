import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GEMINI_API_KEY || "";

const SYSTEM_PROMPT = `You are a brand color strategist for a financial services platform.

Given color extractions from an organization's logo and website, recommend THREE distinct primary and secondary brand color pairs. Each pair is a different, viable brand direction so the user can choose the option that best fits their brand.

Rules:
- All colors must be corporate-appropriate and work on white backgrounds.
- For each pair, the primary color should be the strongest, most recognizable brand color (commonly used for buttons, headers, and emphasis).
- The secondary color should complement the primary (used for accents and links) and must be clearly distinct from the primary.
- The three pairs must be clearly different from one another (different primary hues and overall directions).
- Prefer the organization's actual brand hues. Do NOT pick gray, white, or black unless the brand genuinely uses them as its primary identity.
- Return valid JSON ONLY, with no markdown fences or commentary, in exactly this shape:
{"suggestions":[{"primary":"#RRGGBB","secondary":"#RRGGBB"},{"primary":"#RRGGBB","secondary":"#RRGGBB"},{"primary":"#RRGGBB","secondary":"#RRGGBB"}]}`;

function isValidHex(value: unknown): value is string {
  return typeof value === "string" && /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

function normalizeHex(value: unknown): string {
  const v = String(value ?? "").trim();
  return v.startsWith("#") ? v.toUpperCase() : `#${v.toUpperCase()}`;
}

interface ColorPair {
  primary: string;
  secondary: string;
}

function parseSuggestions(parsed: unknown): ColorPair[] | null {
  const raw = Array.isArray((parsed as { suggestions?: unknown })?.suggestions)
    ? (parsed as { suggestions: unknown[] }).suggestions
    : null;
  if (!raw || raw.length !== 3) return null;

  const suggestions: ColorPair[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const record = item as {
      primary?: unknown;
      secondary?: unknown;
      primaryColor?: unknown;
      secondaryColor?: unknown;
    };
    const rawPrimary = record?.primary ?? record?.primaryColor;
    const rawSecondary = record?.secondary ?? record?.secondaryColor;
    if (!isValidHex(rawPrimary) || !isValidHex(rawSecondary)) return null;

    const primary = normalizeHex(rawPrimary);
    const secondary = normalizeHex(rawSecondary);
    if (primary === secondary) return null;
    if (seen.has(primary)) return null;
    seen.add(primary);

    suggestions.push({ primary, secondary });
  }

  return suggestions;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      logoPrimary,
      logoSecondary,
      websitePrimary,
      websiteSecondary,
      organizationName,
    } = body || {};

    const logo = isValidHex(logoPrimary)
      ? {
          primary: normalizeHex(logoPrimary),
          secondary: isValidHex(logoSecondary)
            ? normalizeHex(logoSecondary)
            : null,
        }
      : null;

    const website = isValidHex(websitePrimary)
      ? {
          primary: normalizeHex(websitePrimary),
          secondary: isValidHex(websiteSecondary)
            ? normalizeHex(websiteSecondary)
            : null,
        }
      : null;

    if (!logo && !website) {
      return NextResponse.json(
        { error: "At least one color source is required" },
        { status: 400 },
      );
    }

    if (!API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key is not configured" },
        { status: 503 },
      );
    }

    const model = "gemini-3.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    const userPrompt = `organization_name:
${organizationName || ""}

logo_colors:
${JSON.stringify(logo)}

website_colors:
${JSON.stringify(website)}

Recommend three distinct primary and secondary brand color pairs.`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Gemini error ${response.status}: ${text.substring(0, 100)}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let jsonStr = rawText.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const block = jsonStr.match(/\{[\s\S]*\}/);
      if (!block) {
        return NextResponse.json(
          { error: "Failed to parse AI response" },
          { status: 502 },
        );
      }
      parsed = JSON.parse(block[0]);
    }

    const suggestions = parseSuggestions(parsed);
    if (!suggestions) {
      return NextResponse.json(
        { error: "AI did not return three distinct color suggestions" },
        { status: 502 },
      );
    }

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
