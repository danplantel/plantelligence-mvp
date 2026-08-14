import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GEMINI_API_KEY || "";

const SYSTEM_PROMPT = `You are the PlanTelligence Benefits Document Naming Engine.

Analyze one employee benefits PDF and return a standardized employee-facing title, description, classification, and review status.

The title and description will appear on a shared Benefits Hub.

INPUTS

original_file_name:
{{ORIGINAL_FILE_NAME}}

selected_category:
{{SELECTED_CATEGORY}}

custom_category_name:
{{CUSTOM_CATEGORY_NAME_OR_NULL}}

document_text:
{{DOCUMENT_TEXT}}

available_document_types:
{{CATEGORY_SPECIFIC_DOCUMENT_TYPE_JSON}}

TASK

1. Read the PDF content and determine its primary purpose.
2. Identify the detected benefits category:
   Retirement, Group Health, Group Life, Other, or Unknown.
3. Compare the document against available_document_types.
4. Use the exact canonical type when there is a clear match.
5. If no canonical type accurately fits, create a concise custom document type.
6. Do not force an inaccurate canonical match.
7. Generate an employee-facing display title.
8. Generate a short description explaining what the document contains or allows the employee to do.
9. Identify whether the document is informational, a blank form, a partially completed form, or a completed form.
10. Flag category mismatches, unreadable documents, unrelated merged documents, and potential participant-specific information.

SOURCE PRIORITY

Use evidence in this order:

1. PDF content
2. Formal document heading
3. Title page
4. Table of contents and major section headings
5. Form instructions
6. Effective-date language
7. Original filename

The filename is a secondary clue only.

TITLE RULES

Use this format when applicable:

[Document Type] - [Plan or Coverage Option]

Include the plan option only when clearly supported and useful.

Do NOT include the document year in the display_title. The year belongs in the document_year field only, never in the title.

Do not include:

- Employer name
- Advisor name
- Internal file name
- Group, policy, contract, or form number
- Revision code
- Upload date
- The word PDF
- Any year or date (e.g., "2021", "2023", "2024")

Do not treat a target-date fund year, copyright year, or form revision year as the document year.

Keep the title concise and under 75 characters when practical.

DESCRIPTION RULES

Write one plain-language sentence under 140 characters when practical.

Use:

- "Use this form to..." for forms
- "Explains..." for notices
- "Summarizes..." for summaries
- "Instructions for..." for instructions
- "Lists..." for lists
- "Shows..." for reports

Describe the document's actual purpose.

Do not use generic filler such as:

- Important plan information
- Complete guide to your benefits
- Learn more about your plan
- Information about this document

Do not promise eligibility, approval, payment, coverage, or benefits.

CUSTOM DOCUMENT TYPES

The provided document-type library is preferred but not exhaustive.

When no canonical type accurately fits:

- Create a clear noun-based document type.
- Set uses_custom_document_type to true.
- Set canonical_document_type to null.
- Do not use vague titles when the document's purpose is clear.

Examples:

- Telehealth Benefits Guide
- Roth Contribution Guide
- Critical Illness Insurance Summary
- Retirement Planning Worksheet

CATEGORY MISMATCH

The selected category is context, not unquestionable truth.

If the PDF clearly belongs to another category:

- Return the detected category.
- Set category_mismatch to true.
- Set needs_review to true.
- Do not force the selected category.

PRIVACY REVIEW

Shared Benefits Hub documents should not contain completed participant-specific information.

Blank forms are allowed and should not be flagged merely because they contain fields for names, Social Security numbers, beneficiaries, signatures, or addresses.

Flag the document only when fields appear completed or individualized information appears present.

Do not reproduce any personal information in the output.

COMBINED DOCUMENTS

If related documents were intentionally combined into one packet, create an accurate packet title.

If unrelated documents appear merged, set needs_review to true and recommend separating them.

CONFIDENCE

Return a confidence score from 0.00 to 1.00.

Set needs_review to true when:

- Confidence is below 0.75
- The category conflicts with the user's selection
- The file appears unreadable
- Potential participant-specific information is present
- Unrelated documents appear merged
- The purpose cannot be identified reliably

Return valid JSON only:

{
  "display_title": "",
  "description": "",
  "canonical_document_type": null,
  "display_document_type": "",
  "uses_custom_document_type": false,
  "selected_category": "",
  "detected_category": "",
  "subcategory": "",
  "provider": null,
  "plan_option": null,
  "document_year": null,
  "language": "en",
  "document_completion_status": "informational",
  "is_combined_document": false,
  "combined_document_types": [],
  "category_mismatch": false,
  "contains_potential_personal_information": false,
  "publish_status": "ready",
  "confidence": 0.00,
  "needs_review": false,
  "review_reason": null
}`;

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const {
      pdfText,
      pdfBase64,
      originalFileName,
      selectedCategory,
      customCategoryName,
      availableDocumentTypes,
    } = body;

    const model = "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    // Build the user prompt with the input values substituted into the template format
    const userPrompt = `original_file_name:
${originalFileName || ""}

selected_category:
${selectedCategory || ""}

custom_category_name:
${customCategoryName ?? null}

document_text:
${pdfText || ""}

available_document_types:
${JSON.stringify(availableDocumentTypes || {})}`;

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
      // pdfText is already included in the userPrompt above, but we still need to ensure
      // the document_text field in the prompt is populated
      console.log(`[gemini-api] Sending text-only (${pdfText.length} chars) for: ${originalFileName}`);
    }

    // Increase maxOutputTokens to handle the full structured JSON response
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts }],
        // Force structured JSON output and give the model enough tokens for the
        // full payload so it never returns truncated/prose responses that the
        // JSON parser then fails on.
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: "application/json" },
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
      return NextResponse.json({
        display_title: "",
        description: "",
        canonical_document_type: null,
        display_document_type: "",
        uses_custom_document_type: false,
        selected_category: selectedCategory || "",
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
        publish_status: "ready",
        confidence: 0.00,
        needs_review: true,
        review_reason: "Empty response from Gemini",
      });
    }

    // Extract JSON from the response — the prompt instructs Gemini to return valid JSON only
    // but it may be wrapped in markdown code fences
    let jsonStr = rawText.trim();
    // Remove markdown code fences if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, try to find a JSON block in the response
      const fallbackMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (fallbackMatch) {
        try {
          result = JSON.parse(fallbackMatch[0]);
        } catch {
          console.error("[gemini-api] Failed to parse JSON from response:", jsonStr.substring(0, 300));
          return NextResponse.json({
            // Never surface raw Gemini prose as a title — the upload flow keeps
            // the original filename as the fallback document name instead.
            display_title: "",
            description: "",
            canonical_document_type: null,
            display_document_type: "",
            uses_custom_document_type: false,
            selected_category: selectedCategory || "",
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
            review_reason: "Failed to parse structured response from Gemini",
          });
        }
      } else {
        console.error("[gemini-api] No JSON found in response:", jsonStr.substring(0, 300));
        return NextResponse.json({
          display_title: "",
          description: "",
          canonical_document_type: null,
          display_document_type: "",
          uses_custom_document_type: false,
          selected_category: selectedCategory || "",
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
          review_reason: "Failed to parse structured response from Gemini",
        });
      }
    }

    // Validate required fields
    const validated = {
      display_title: result.display_title || "",
      description: result.description || "",
      canonical_document_type: result.canonical_document_type ?? null,
      display_document_type: result.display_document_type || "",
      uses_custom_document_type: typeof result.uses_custom_document_type === "boolean" ? result.uses_custom_document_type : false,
      selected_category: result.selected_category || selectedCategory || "",
      detected_category: result.detected_category || "",
      subcategory: result.subcategory || "",
      provider: result.provider ?? null,
      plan_option: result.plan_option ?? null,
      document_year: result.document_year ?? null,
      language: result.language || "en",
      document_completion_status: result.document_completion_status || "informational",
      is_combined_document: typeof result.is_combined_document === "boolean" ? result.is_combined_document : false,
      combined_document_types: Array.isArray(result.combined_document_types) ? result.combined_document_types : [],
      category_mismatch: typeof result.category_mismatch === "boolean" ? result.category_mismatch : false,
      contains_potential_personal_information: typeof result.contains_potential_personal_information === "boolean" ? result.contains_potential_personal_information : false,
      publish_status: result.publish_status || "draft",
      confidence: typeof result.confidence === "number" ? result.confidence : 0.00,
      needs_review: typeof result.needs_review === "boolean" ? result.needs_review : true,
      review_reason: result.review_reason ?? null,
    };

    return NextResponse.json(validated);
  } catch (error: any) {
    console.error("[gemini-api] Error:", error?.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
