/**
 * AI copy generation for flyers. Uses OpenAI Chat Completions when OPENAI_API_KEY is set;
 * otherwise returns deterministic fallback copy (still valid for dev/tests).
 */

import type { FlyerMode } from "./flyer-modes";
import { FLYER_MODE_LABELS } from "./flyer-modes";
import type { FlyerBrandSnapshot } from "./flyer-brand";

export type GenerateFlyerCopyInput = {
  mode: FlyerMode;
  /** Optional JSON from UI (category, dates, meeting fields, …) */
  modeOptions?: Record<string, unknown> | null;
  brand: FlyerBrandSnapshot;
  /** Extra user instructions */
  userHint?: string | null;
};

export type GenerateFlyerCopyResult = {
  headline: string;
  body: string;
  cta: string;
  aiModel: string | null;
  aiPromptVersion: string;
};

const PROMPT_VERSION = "flyer-copy-v1";

function fallbackCopy(input: GenerateFlyerCopyInput): GenerateFlyerCopyResult {
  const sponsor = input.brand.sponsor.companyName;
  const label = FLYER_MODE_LABELS[input.mode];

  return {
    headline: `${label}`,
    body: `${sponsor}: everything you need for your benefits — documents, contacts, and updates — is in one place. Scan the QR code or visit your Benefits Hub online.`,
    cta: "Visit your Benefits Hub",
    aiModel: null,
    aiPromptVersion: PROMPT_VERSION,
  };
}

function optionsSummary(options: Record<string, unknown> | null | undefined): string {
  if (!options || Object.keys(options).length === 0) return "";
  try {
    return JSON.stringify(options);
  } catch {
    return "";
  }
}

export async function generateFlyerCopy(
  input: GenerateFlyerCopyInput,
): Promise<GenerateFlyerCopyResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return fallbackCopy(input);
  }

  const modeLabel = FLYER_MODE_LABELS[input.mode];
  const sponsorName = input.brand.sponsor.companyName;
  const orgLine = [
    input.brand.organization.company,
    input.brand.organization.name,
  ]
    .filter(Boolean)
    .join(" · ");

  const userMessages = [
    `Flyer mode: ${input.mode} (${modeLabel}).`,
    `Plan sponsor / employer: ${sponsorName}.`,
    `Broker organization context: ${orgLine}.`,
    `Mode options JSON: ${optionsSummary(input.modeOptions ?? undefined)}.`,
    input.userHint?.trim()
      ? `Additional instructions from user: ${input.userHint.trim()}`
      : "",
    `Return JSON only with keys headline, body, cta (strings).`,
    `Headline max ~90 chars; body ~400 chars max; CTA short button label.`,
    `Tone: professional, compliant, encouraging; no guarantees or investment advice.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_FLYER_MODEL ?? "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write concise benefits communication for employers. Output valid JSON only.",
          },
          { role: "user", content: userMessages },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[generateFlyerCopy] OpenAI error", res.status, errText);
      return fallbackCopy(input);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return fallbackCopy(input);
    }

    const parsed = JSON.parse(raw) as {
      headline?: string;
      body?: string;
      cta?: string;
    };

    const headline = String(parsed.headline ?? "").trim() || fallbackCopy(input).headline;
    const body = String(parsed.body ?? "").trim() || fallbackCopy(input).body;
    const cta = String(parsed.cta ?? "").trim() || fallbackCopy(input).cta;

    return {
      headline,
      body,
      cta,
      aiModel: process.env.OPENAI_FLYER_MODEL ?? "gpt-4o-mini",
      aiPromptVersion: PROMPT_VERSION,
    };
  } catch (e) {
    console.error("[generateFlyerCopy]", e);
    return fallbackCopy(input);
  }
}
