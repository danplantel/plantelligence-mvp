"use client";

/**
 * Calls the server-side Gemini API route to suggest a human-readable document name
 * based on extracted PDF text + original filename + category.
 */
export async function suggestDocumentName(
  pdfText: string,
  originalFileName: string,
  category: string,
): Promise<string> {
  try {
    // Trim PDF text to 1500 chars to stay well within free tier token limits
    const trimmedText =
      pdfText && pdfText.trim().length > 50
        ? pdfText.substring(0, 1500)
        : "";

    const response = await fetch("/api/gemini/suggest-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfText: trimmedText,
        originalFileName,
        category,
      }),
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
  docs: Array<{ pdfText: string; originalFileName: string; category: string }>,
): Promise<string[]> {
  const results: string[] = [];

  for (const doc of docs) {
    const suggestedName = await suggestDocumentName(
      doc.pdfText,
      doc.originalFileName,
      doc.category,
    );
    results.push(suggestedName);
    // 1.5s delay between requests to avoid rate limiting
    await delay(1500);
  }

  return results;
}
