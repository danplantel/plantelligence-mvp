import { NextRequest, NextResponse } from "next/server";

const API_KEY = "AQ.Ab8RN6JuXvpetka66XF09lwV8aa0oE-HfF0kcm63BHzXh5IAqg";

const SYSTEM_PROMPT = `You are a document naming assistant. Your job is to read a PDF document and produce a concise, human-readable name that captures what the document actually is.

CRITICAL RULES:
- Read the document carefully. Identify the document type and key details from its content.
- For invoices: include the vendor name and/or subject (e.g. "Invoice 0268 - Comics and Art" or "Invoice - Acme Supplies")
- For government forms: name the form type (e.g. "Kenya eTA Application", "IRS W-9 Form")
- For certificates, permits, licenses: include what it certifies
- For plan documents: include company/plan name and document type
- The "Category" field is just metadata about where this was uploaded — do NOT let it dictate the name.
- Be descriptive but concise. Include key identifying details from the document.
- Maximum 60 characters.
- Use Title Case.
- Do NOT include file extensions.
- Return ONLY the name. No quotes, no markdown, no explanation.`;

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { pdfText, pdfBase64, originalFileName, category } = body;

    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    const userPrompt = `Category (metadata only): ${category}\nOriginal filename: ${originalFileName}`;

    // Build parts: text prompt + optional PDF file
    const parts: Array<Record<string, unknown>> = [{ text: userPrompt }];

    if (pdfBase64 && typeof pdfBase64 === "string" && pdfBase64.startsWith("data:") && pdfBase64.length > 200) {
      // Strip the data URL prefix to get raw base64
      const base64Data = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
      parts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: base64Data,
        },
      });
      console.log(`[gemini-api] Sending PDF file (${Math.round(base64Data.length / 1024)}KB) for: ${originalFileName}`);
    } else if (pdfText && typeof pdfText === "string" && pdfText.trim().length > 0) {
      parts.push({ text: `\n\nDocument text content:\n${pdfText.substring(0, 2000)}` });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts }],
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
