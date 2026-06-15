"use client";

/**
 * Calls the server-side Gemini API route to suggest a human-readable document name.
 * Sends the raw PDF file (as base64 data URL) so Gemini can read it directly,
 * which handles both text-based and image-based/scanned PDFs.
 */
export async function suggestDocumentName(
  pdfText: string,
  originalFileName: string,
  category: string,
  /** Optional base64 data URL of the PDF file for Gemini vision reading */
  pdfBase64?: string,
): Promise<string> {
  try {
    const body: Record<string, string> = {
      originalFileName,
      category,
    };

    // Prefer sending the raw PDF file so Gemini can read it via vision
    if (pdfBase64 && pdfBase64.startsWith("data:") && pdfBase64.length > 100) {
      body.pdfBase64 = pdfBase64;
    } else if (pdfText && pdfText.trim().length > 50) {
      body.pdfText = pdfText.substring(0, 1500);
    }

    const response = await fetch("/api/gemini/suggest-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(
        "[gemini-suggest] API route returned",
        response.status,
      );
      return "";
    }

    const data = await response.json();
    return data.suggestedName || "";
  } catch (error: any) {
    console.error("[gemini-suggest] Failed:", error?.message || error);
    return "";
  }
}

/** Small delay helper for sequential processing */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Batch version — processes documents sequentially with a delay
 * to stay within free tier rate limits (no parallel calls).
 */
export async function suggestDocumentNamesBatch(
  docs: Array<{ pdfText: string; originalFileName: string; category: string; pdfBase64?: string }>,
): Promise<string[]> {
  const results: string[] = [];

  for (const doc of docs) {
    const suggestedName = await suggestDocumentName(
      doc.pdfText,
      doc.originalFileName,
      doc.category,
      doc.pdfBase64,
    );
    results.push(suggestedName);
    // 1.5s delay between requests to avoid rate limiting
    await delay(1500);
  }

  return results;
}
