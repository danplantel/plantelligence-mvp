"use client";

/**
 * Response shape returned by the Gemini suggest-name API route.
 */
export interface SuggestNameResult {
  display_title: string;
  description: string;
  canonical_document_type: string | null;
  display_document_type: string;
  uses_custom_document_type: boolean;
  selected_category: string;
  detected_category: string;
  subcategory: string;
  provider: string | null;
  plan_option: string | null;
  document_year: number | null;
  language: string;
  document_completion_status: string;
  is_combined_document: boolean;
  combined_document_types: string[];
  category_mismatch: boolean;
  contains_potential_personal_information: boolean;
  publish_status: string;
  confidence: number;
  needs_review: boolean;
  review_reason: string | null;
}

/**
 * Calls the server-side Gemini API route to analyze a benefits document.
 * Sends the raw PDF file (as base64 data URL) so Gemini can read it directly,
 * which handles both text-based and image-based/scanned PDFs.
 * Returns the full structured analysis result.
 */
export async function suggestDocumentName(
  pdfText: string,
  originalFileName: string,
  category: string,
  /** Optional base64 data URL of the PDF file for Gemini vision reading */
  pdfBase64?: string,
  /** Optional custom category name override */
  customCategoryName?: string | null,
  /** Optional per-category document type library JSON */
  availableDocumentTypes?: Record<string, unknown>,
): Promise<SuggestNameResult> {
  const defaultResult: SuggestNameResult = {
    display_title: "",
    description: "",
    canonical_document_type: null,
    display_document_type: "",
    uses_custom_document_type: false,
    selected_category: category || "",
    detected_category: "",
    subcategory: "",
    provider: null,
    plan_option: null,
    document_year: null,
    language: "en",
    document_completion_status: "informational",
    is_combined_document: false,
    combined_document_types: [],
    category_mismatch: false,
    contains_potential_personal_information: false,
    publish_status: "draft",
    confidence: 0.00,
    needs_review: true,
    review_reason: null,
  };

  try {
    const body: Record<string, unknown> = {
      originalFileName,
      selectedCategory: category,
    };

    if (customCategoryName !== undefined) {
      body.customCategoryName = customCategoryName;
    }

    if (availableDocumentTypes !== undefined) {
      body.availableDocumentTypes = availableDocumentTypes;
    }

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
      return defaultResult;
    }

    const data = await response.json();

    // If the response includes the structured result, return it — but always
    // normalize display_title to a plain string so a malformed payload (object
    // or JSON-encoded string) can never leak the raw JSON into a name field.
    if (data && typeof data === "object" && data.display_title !== undefined) {
      return {
        ...(data as SuggestNameResult),
        display_title:
          typeof data.display_title === "string" ? data.display_title : "",
      };
    }

    // Fallback: if the old format is returned (just suggestedName), map it
    if (data.suggestedName) {
      return {
        ...defaultResult,
        display_title: data.suggestedName,
      };
    }

    return defaultResult;
  } catch (error: any) {
    console.error("[gemini-suggest] Failed:", error?.message || error);
    return defaultResult;
  }
}

/** Small delay helper for sequential processing */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Input shape for batch document name suggestion.
 */
export interface SuggestNameInput {
  pdfText: string;
  originalFileName: string;
  category: string;
  pdfBase64?: string;
  customCategoryName?: string | null;
  availableDocumentTypes?: Record<string, unknown>;
}

/**
 * Batch version — processes documents sequentially with a delay
 * to stay within free tier rate limits (no parallel calls).
 * Returns the full structured result for each document.
 */
export async function suggestDocumentNamesBatch(
  docs: SuggestNameInput[],
): Promise<SuggestNameResult[]> {
  const results: SuggestNameResult[] = [];

  for (const doc of docs) {
    const result = await suggestDocumentName(
      doc.pdfText,
      doc.originalFileName,
      doc.category,
      doc.pdfBase64,
      doc.customCategoryName,
      doc.availableDocumentTypes,
    );
    results.push(result);
    // 1.5s delay between requests to avoid rate limiting
    await delay(1500);
  }

  return results;
}
