import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GEMINI_API_KEY || "";

const SYSTEM_PROMPT = `You are a document naming assistant. Your job is to read a PDF document and produce a concise, human-readable name that captures what the document actually is.

CRITICAL RULES FOR NAMING:
- Read the document carefully. Identify the document type and key details from its content.
- For invoices: include the vendor name and/or subject (e.g. "Invoice - Fidelity Investments Q1 2025" or "Invoice - Paychex Admin Fees")
- For government forms: name the form type (e.g. "IRS Form 5500 Filing", "ERISA Bond 2025")
- For certificates, permits, licenses: include what it certifies
- For plan documents: include company/plan name and document type
- The "Category" field is just metadata about where this was uploaded — do NOT let it dictate the name.
- Be descriptive but concise. Include key identifying details from the document.
- Maximum 60 characters.
- Use Title Case.
- Do NOT include file extensions.
- Return ONLY the name. No quotes, no markdown, no explanation.

DOCUMENT EXPIRATION RULES
PlanTelligence should assign a suggested review or expiration date to uploaded documents based on document type.
The expiration date is not a legal determination. It is an administrative reminder to help advisors and plan sponsors keep Benefits Hub materials current.

CRITICAL RULES:
- Do not label documents as legally expired unless the document itself contains an expiration date.
- Do not imply that a document is compliant, current, approved, or legally valid.
- Use "Review Date" as the preferred admin-facing label.
- Use "Expiration Date" only if the document itself states an actual expiration date or the user manually sets one.
- Allow users to override the suggested date.
- Allow users to mark a document as "No Expiration / Review Manually."

DEFAULT REVIEW DATE LOGIC:

1 YEAR DEFAULT REVIEW
Use a 1-year review date for documents that are usually annual, plan-year-specific, open-enrollment-specific, rate-specific, or notice-based.
Examples:
- Open Enrollment Guide
- Annual Enrollment Guide
- Benefits Guide with a stated plan year
- Health Benefits Guide
- Medical Rate Sheet
- Dental Rate Sheet
- Vision Rate Sheet
- Premium Rate Sheet
- Summary of Benefits and Coverage
- Safe Harbor Notice
- Automatic Enrollment Notice
- Auto-Escalation Notice
- QDIA Notice
- Participant Fee Disclosure
- Summary Annual Report
- Annual Notice
- Medicare Part D Notice
- Wellness Program Calendar
- Provider Directory
- Carrier Contact Sheet
- Meeting Flyer
- Enrollment Campaign Flyer

Suggested review date:
Upload date + 1 year
If the document clearly states a plan year, benefit year, or coverage year, set the review date to the end of that year or 1 year from upload, whichever is more appropriate based on visible document text.

3 YEAR DEFAULT REVIEW
Use a 3-year review date for core plan documents, certificates, coverage documents, and foundational documents that may remain valid for multiple years but should still be reviewed periodically.
Examples:
- Summary Plan Description
- Plan Document
- Adoption Agreement
- Summary of Material Modifications
- Evidence of Coverage
- Certificate of Coverage
- Life Insurance Certificate
- Disability Insurance Certificate
- Group Policy Certificate
- Plan Highlights
- Investment Options
- Online Services
- Beneficiary Designation Form
- Incoming Rollover Form
- Distribution Request Form
- Loan Information
- Hardship Withdrawal Form
- Evidence of Insurability Form
- Claims Form
- Medical Enrollment Form
- Life Insurance Beneficiary Form
- Waiver Form

Suggested review date:
Upload date + 3 years

NO DEFAULT EXPIRATION / MANUAL REVIEW
Use no automatic expiration for generic evergreen education, wellness resources, or custom benefit content that does not appear tied to a specific plan year, carrier year, rate period, or legal notice cycle.
Examples:
- Financial Wellness Guide
- Retirement Education Guide
- General Savings Tips
- Wellness Program Overview
- Mental Health Resources
- Employee Assistance Program Overview
- Fitness Program Overview
- How to Use Your Benefits
- Frequently Asked Questions
- Generic Educational Flyer

Suggested review status:
No Expiration / Review Manually

DOCUMENT-STATED DATE RULE
If the document clearly states an expiration date, coverage end date, plan year end, renewal date, or effective-through date, use that date instead of the default rule.
Examples:
- "Coverage Period: 01/01/2026 - 12/31/2026" should suggest 12/31/2026.
- "Effective Through December 31, 2026" should suggest 12/31/2026.
- "Rates Effective January 1, 2026 through December 31, 2026" should suggest 12/31/2026.
- If the document only states an effective date with no end date, do not treat that as an expiration date. Use the document type default instead.

ADMIN STATUS LABELS:
- Current
- Review Soon
- Review Needed
- Archived

Suggested status timing:
- Current: more than 60 days before review date
- Review Soon: within 60 days of review date
- Review Needed: review date has passed
- Archived: user manually archives the document

ADMIN DISCLAIMER:
Suggested review dates are organizational reminders only. Please review all materials for accuracy before publishing or continuing to display them.`;

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { pdfText, pdfBase64, originalFileName, category } = body;

    const model = "gemini-2.5-flash-lite";
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
