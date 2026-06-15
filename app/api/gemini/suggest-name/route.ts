import { NextRequest, NextResponse } from "next/server";

const API_KEY = "AQ.Ab8RN6JuXvpetka66XF09lwV8aa0oE-HfF0kcm63BHzXh5IAqg";

const SYSTEM_PROMPT = `You are a document naming assistant. Suggest a concise, descriptive document name (max 60 chars, Title Case). Return ONLY the name, nothing else.`;

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { pdfText, originalFileName, category } = body;

    const contentForPrompt =
      pdfText && pdfText.trim().length > 50
        ? pdfText.substring(0, 1500)
        : `Filename: ${originalFileName}`;

    const userPrompt = `Category: ${category}\nOriginal filename: ${originalFileName}\n\nDocument content:\n${contentForPrompt}`;

    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    console.log(`[gemini-api] Calling ${model} for: ${originalFileName}`);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      }),
    });

    const responseText = await response.text();
    console.log(`[gemini-api] ${model} status: ${response.status}, body preview: ${responseText.substring(0, 200)}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Gemini error ${response.status}: ${responseText.substring(0, 100)}` },
        { status: response.status },
      );
    }

    const data = JSON.parse(responseText);
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText.trim()) {
      return NextResponse.json({ suggestedName: "" });
    }

    const cleaned = rawText.trim().replace(/^["']|["']$/g, "").replace(/\n/g, " ").substring(0, 60).trim();
    return NextResponse.json({ suggestedName: cleaned || "" });
  } catch (error: any) {
    console.error("[gemini-api] Error:", error?.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
