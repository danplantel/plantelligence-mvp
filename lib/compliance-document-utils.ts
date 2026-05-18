"use client";

import { Document, BenefitsCategory } from "@/types/new-client-wizard";
import { franc } from "franc";

export type DocumentLanguage = "EN" | "ES";

/**
 * Extract text from PDF file (works with base64 string from FileReader)
 * Використовує API route на бекенді для витягування тексту (без проблем з worker)
 */
export const extractTextFromPDF = async (fileData: string): Promise<string> => {
  try {
    // Do not call API for R2-stored or placeholder content; endpoint expects inline base64 only
    if (
      !fileData ||
      fileData === "r2:stored" ||
      fileData.startsWith("org/") ||
      (fileData.length < 100 && !fileData.startsWith("data:"))
    ) {
      return "";
    }

    const response = await fetch("/api/extract-pdf-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileBase64: fileData }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ [extractTextFromPDF] API error:", errorData);
      return "";
    }

    const data = await response.json();
    const extractedText = data.text || "";

    if (extractedText.length > 0) {
    } else {
    }

    return extractedText;
  } catch (error) {
    console.error("❌ [extractTextFromPDF] Error:", error);
    return "";
  }
};

// --- Languages and words for detection ---
const spanishMarkers = ["[es]", "(es)", " español", "spanish", "español", "espanol", "castellano", "hispano"];
const englishMarkers = ["[en]", "(en)", " english", "ingles", "inglés"];
const distinctiveSpanishWords = ["aquí", "puedes", "guía", "jubilación", "descripción", "información", "participante", "inscripción", "formulario", "folleto", "notificación", "solicitud"];
const distinctiveEnglishWords = ["summary", "disclosure", "enrollment", "beneficiary", "rollover", "contribution", "vesting", "distribution", "withdrawal", "qualified", "default", "investment", "alternative", "notice", "booklet", "highlights", "description", "information", "participant", "form", "application"];
const commonSpanishWords = ["ver", "video", "completa", "opciones", "plan", "documento", "resumen", "beneficios", "seguro", "vida", "salud", "bienestar"];

export const guessLanguageFromDocument = async (doc: Document): Promise<DocumentLanguage> => {
  const nameSource = `${doc.name} ${doc.originalFileName ?? ""}`.toLowerCase();
  const descriptionSource = (doc.shortDescription ?? "").toLowerCase();
  const fullSource = `${nameSource} ${descriptionSource}`;

  if (spanishMarkers.some((m) => nameSource.includes(m))) return "ES";
  if (englishMarkers.some((m) => nameSource.includes(m))) return "EN";

  let pdfText = "";
  const hasPdfContent =
    doc.file &&
    doc.originalFileName?.toLowerCase().endsWith(".pdf") &&
    (doc.file.startsWith("data:application/pdf") || doc.file.startsWith("data:") || (doc.file.length > 200 && !doc.file.startsWith("org/") && doc.file !== "r2:stored"));
  if (hasPdfContent) {
    pdfText = await extractTextFromPDF(doc.file);
  }

  if (pdfText.length >= 50) {
    const textToAnalyze = pdfText.substring(0, 2000).trim();
    if (textToAnalyze.length >= 20) {
      try {
        const detectedLang = franc(textToAnalyze, { only: ["eng", "spa"] } as any);
        if (detectedLang === "spa") return "ES";
        if (detectedLang === "eng") return "EN";
        const detectedLangFallback = franc(textToAnalyze);
        if (detectedLangFallback === "spa") return "ES";
        if (detectedLangFallback === "eng") return "EN";
      } catch { }
      if (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(textToAnalyze)) return "ES";
    }
  }

  const hasSpanishCharacters = /[áéíóúñüÁÉÍÓÚÑÜ]/.test(fullSource);
  let spanishScore = 0, englishScore = 0;

  distinctiveSpanishWords.forEach((w) => { if (nameSource.includes(w)) spanishScore += 2; });
  distinctiveEnglishWords.forEach((w) => { if (nameSource.includes(w)) englishScore += 2; });
  distinctiveSpanishWords.forEach((w) => { if (descriptionSource.includes(w)) spanishScore += 1; });
  distinctiveEnglishWords.forEach((w) => { if (descriptionSource.includes(w)) englishScore += 1; });
  if (spanishScore > 0) commonSpanishWords.forEach((w) => { if (nameSource.includes(w)) spanishScore += 1; });
  if (hasSpanishCharacters) spanishScore += 3;

  if (spanishScore > englishScore && spanishScore > 0) return "ES";
  if (englishScore > spanishScore && englishScore > 0) return "EN";
  if (hasSpanishCharacters) return "ES";
  return "EN";
};

export const detectDocumentType = (fileName: string): string => {
  const nameLower = fileName.toLowerCase();
  if (nameLower.includes("spd") || nameLower.includes("summary plan description") || nameLower.includes("plan highlights")) return "SPD";
  if (nameLower.includes("sbc") || nameLower.includes("summary of benefits")) return "SBC";
  if (nameLower.includes("enrollment")) return "Enrollment";
  if (nameLower.includes("qdia")) return "QDIA";
  if (nameLower.includes("fee disclosure")) return "Fee Disclosure";
  if (nameLower.includes("beneficiary")) return "Beneficiary";
  return "Document";
};

/** Weights: filename matches (wf) vs body-only (wb). Cap repeats so 50× "health" does not steal the category. */
const DOC_CAT_REPEAT_CAP = 6;
const DOC_CAT_MARGIN_FOR_HIGH_CONF = 22;
const DOC_CAT_MIN_RAW_FOR_NARROW = 20;
const DOC_CAT_MIN_RAW_FOR_ANY = 14;
/** When extracted PDF text is at least this long, category is driven mainly by body (stable across renames). */
const DOC_CAT_MIN_BODY_CHARS_TRUST = 420;
/** How much filename-only keyword hits blend in when body is trusted (low = more stable across filenames). */
const DOC_CAT_FILENAME_BLEND_WHEN_BODY_RICH = 0.26;
const DOC_CAT_BODY_SLICE_MAX = 16000;

type KeywordWeight = { t: string; wf: number; wb: number };

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip noisy filename suffixes so "SPD (1).pdf" and "spd_final.pdf" score similarly. */
function normalizeHintFilename(raw: string): string {
  let s = (raw || "").toLowerCase().replace(/\s+/g, " ").trim();
  s = s.replace(/\.(pdf|docx?)$/i, "");
  s = s.replace(/\s*\(\d+\)\s*$/g, "").replace(/\s*-\s*copy\s*$/i, "");
  s = s.replace(/\b_copy\b|\bcopy\b|\bfinal\b|\bv\d+\b|\brev\s*\d+\b/gi, " ");
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, " ");
  s = s.replace(/\b20\d{2}[-_/]?\d{2}[-_/]?\d{2}\b/g, " ");
  s = s.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

function normalizePdfBodyForCategory(raw: string): string {
  const t = (raw || "").toLowerCase().replace(/\s+/g, " ").trim();
  return t.length > DOC_CAT_BODY_SLICE_MAX
    ? t.slice(0, DOC_CAT_BODY_SLICE_MAX)
    : t;
}

function tallyCategory(
  fileNameLower: string,
  sourceLower: string,
  terms: KeywordWeight[],
): number {
  let score = 0;
  for (const { t, wf, wb } of terms) {
    const inner = escapeRx(t);
    let pattern: string;
    if (t.toLowerCase() === "spd") {
      // Match "foo_spd.pdf" (underscore); avoid \b which treats _ as word char in JS)
      pattern = "(?:^|[^a-z])spd(?:[^a-z]|$)";
    } else {
      // Avoid "std" → "standard", "ltd" → "limited", etc.
      const useWordBoundary =
        !/[(\s]/.test(t) && t.length <= 5 && !/\d{3,}/.test(t);
      pattern = useWordBoundary ? `\\b${inner}\\b` : inner;
    }
    const re = new RegExp(pattern, "gi");
    const matches = sourceLower.match(re);
    if (!matches?.length) continue;
    const n = Math.min(matches.length, DOC_CAT_REPEAT_CAP);
    const inFile = fileNameLower.includes(t.toLowerCase());
    score += n * (inFile ? wf : wb);
  }
  return score;
}

function pickTopTwo(
  r: number,
  h: number,
  l: number,
): [
  { cat: BenefitsCategory; score: number },
  { cat: BenefitsCategory; score: number },
] {
  const row: { cat: BenefitsCategory; score: number }[] = [
    { cat: "Retirement", score: r },
    { cat: "Group Health", score: h },
    { cat: "Group Life", score: l },
  ];
  row.sort((a, b) => b.score - a.score);
  return [row[0]!, row[1]!];
}

/**
 * Keyword-based document category with conflict handling (e.g. "beneficiary" on 401(k) forms).
 * Returns best-guess category; confidence < 70 when ambiguous so UI does not auto-apply blindly.
 */
export const analyzeDocumentCategory = (
  fileName: string,
  pdfText?: string,
): { category: BenefitsCategory; confidence: number } => {
  const fn = normalizeHintFilename(fileName);
  const body = normalizePdfBodyForCategory(pdfText || "");
  const bodyRich = body.length >= DOC_CAT_MIN_BODY_CHARS_TRUST;
  const combined = `${fn} ${body}`.trim();

  const retirementTerms: KeywordWeight[] = [
    { t: "401(k)", wf: 52, wb: 14 },
    { t: "401k", wf: 50, wb: 14 },
    { t: "403(b)", wf: 52, wb: 14 },
    { t: "403b", wf: 48, wb: 12 },
    { t: "457(b)", wf: 48, wb: 12 },
    { t: "457 plan", wf: 42, wb: 12 },
    { t: "summary plan description", wf: 55, wb: 15 },
    { t: "spd", wf: 38, wb: 10 },
    { t: "qdia", wf: 48, wb: 14 },
    { t: "rollover", wf: 32, wb: 9 },
    { t: "pension", wf: 36, wb: 10 },
    { t: "vesting", wf: 34, wb: 9 },
    { t: "distribution", wf: 28, wb: 8 },
    { t: "defined contribution", wf: 42, wb: 12 },
  ];

  const healthTerms: KeywordWeight[] = [
    { t: "summary of benefits and coverage", wf: 58, wb: 16 },
    { t: "summary of benefits", wf: 44, wb: 12 },
    { t: "sbc", wf: 36, wb: 10 },
    { t: "medical plan", wf: 46, wb: 12 },
    { t: "prescription drug", wf: 40, wb: 11 },
    { t: "copay", wf: 34, wb: 9 },
    { t: "deductible", wf: 34, wb: 9 },
    { t: "hsa", wf: 38, wb: 10 },
    { t: "fsa", wf: 34, wb: 9 },
    { t: "dental", wf: 40, wb: 11 },
    { t: "vision", wf: 38, wb: 10 },
    { t: "medical", wf: 32, wb: 8 },
    { t: "pharmacy", wf: 30, wb: 8 },
    { t: "doctor", wf: 22, wb: 6 },
    { t: "rx", wf: 20, wb: 5 },
    { t: "health insurance", wf: 46, wb: 12 },
    { t: "health care", wf: 38, wb: 10 },
    { t: "health", wf: 14, wb: 4 },
    { t: "plan year", wf: 18, wb: 5 },
  ];

  const lifeTerms: KeywordWeight[] = [
    { t: "life insurance", wf: 56, wb: 15 },
    { t: "group life insurance", wf: 58, wb: 16 },
    { t: "group life", wf: 46, wb: 12 },
    { t: "ad&d", wf: 50, wb: 14 },
    { t: "accidental death", wf: 44, wb: 12 },
    { t: "evidence of insurability", wf: 52, wb: 14 },
    { t: "voluntary life", wf: 46, wb: 12 },
    { t: "term life", wf: 44, wb: 12 },
    { t: "whole life", wf: 42, wb: 11 },
    { t: "death benefit", wf: 40, wb: 11 },
    { t: "basic life", wf: 42, wb: 11 },
    { t: "supplemental life", wf: 44, wb: 12 },
    { t: "beneficiary designation", wf: 36, wb: 10 },
    { t: "coverage amount", wf: 28, wb: 7 },
    { t: "beneficiary", wf: 20, wb: 5 },
    { t: "long-term disability", wf: 40, wb: 11 },
    { t: "short-term disability", wf: 40, wb: 11 },
    { t: "std/ltd", wf: 38, wb: 10 },
    { t: "ltd", wf: 22, wb: 6 },
    { t: "std", wf: 18, wb: 5 },
  ];

  let r: number;
  let h: number;
  let l: number;

  if (bodyRich) {
    const rBody = tallyCategory("", body, retirementTerms);
    const hBody = tallyCategory("", body, healthTerms);
    const lBody = tallyCategory("", body, lifeTerms);
    const rFn = tallyCategory(fn, fn, retirementTerms);
    const hFn = tallyCategory(fn, fn, healthTerms);
    const lFn = tallyCategory(fn, fn, lifeTerms);
    const b = DOC_CAT_FILENAME_BLEND_WHEN_BODY_RICH;
    r = rBody + rFn * b;
    h = hBody + hFn * b;
    l = lBody + lFn * b;
  } else {
    r = tallyCategory(fn, combined, retirementTerms);
    h = tallyCategory(fn, combined, healthTerms);
    l = tallyCategory(fn, combined, lifeTerms);
  }

  const strongSource = bodyRich ? body : combined;

  const retirementStrong =
    /401\s*\(k\)|401k|403\s*\(b\)|summary plan description|qdia|defined contribution|457\s*\(b\)|457 plan/i.test(
      strongSource,
    ) ||
    /(?:^|[^a-z])spd(?:[^a-z]|$)/i.test(`${strongSource} ${fn}`) ||
    fn.includes("spd");
  const lifeStrong =
    /life insurance|group life|ad\s*&\s*d|accidental death|evidence of insurability|voluntary life|term life|death benefit|basic life|supplemental life|long-term disability|short-term disability/i.test(
      strongSource,
    );
  const healthStrong =
    /summary of benefits|summary of benefits and coverage|\bsbc\b|medical plan|health insurance|prescription drug|dental|vision plan|hsa\b|fsa\b/i.test(
      strongSource,
    );

  // "Beneficiary" on retirement enrollment/SPD should not flip category to Group Life.
  if (retirementStrong && !lifeStrong) {
    l *= 0.42;
  }

  // SPD / retirement-heavy doc: weak standalone "health" hits should not dominate.
  if (retirementStrong && h > 0 && !healthStrong && r >= h * 0.7) {
    h *= 0.55;
  }

  // Clear health doc: stray life hits from generic words get damped.
  if (healthStrong && !lifeStrong && l > 0 && h >= l * 1.35) {
    l *= 0.38;
  }

  // Body-rich but only generic "health"/"plan" noise (no healthStrong): avoid flipping to Group Health.
  if (bodyRich && !healthStrong && h > 0 && h <= r * 1.15 && h <= l * 1.25 && !retirementStrong) {
    h *= 0.72;
  }

  // Life "beneficiary" without real life product language: damp when retirement dominates body.
  if (bodyRich && retirementStrong && !lifeStrong && l > 0 && r > l * 1.2) {
    l *= 0.5;
  }

  const [top, second] = pickTopTwo(r, h, l);

  if (top.score < DOC_CAT_MIN_RAW_FOR_ANY) {
    return { category: "Other Benefits", confidence: Math.min(42, Math.round(top.score * 2.2)) };
  }

  let confidence = Math.round(Math.min(100, 48 + top.score * 0.32));

  const margin = top.score - second.score;
  if (margin < DOC_CAT_MARGIN_FOR_HIGH_CONF) {
    confidence = Math.min(confidence, bodyRich ? 60 : 62);
  }
  if (top.score < DOC_CAT_MIN_RAW_FOR_NARROW && margin < DOC_CAT_MARGIN_FOR_HIGH_CONF + 8) {
    confidence = Math.min(confidence, bodyRich ? 56 : 58);
  }

  // Same-ish scores with trusted body: stay conservative so UI does not auto-apply a noisy winner.
  if (bodyRich && margin < 10 && top.score < 55) {
    confidence = Math.min(confidence, 52);
  }

  // Strong, consistent body signal with a clear leader: allow higher confidence (stable auto-apply).
  if (bodyRich && margin >= DOC_CAT_MARGIN_FOR_HIGH_CONF + 6 && top.score >= 38) {
    if (top.cat === "Retirement" && retirementStrong) {
      confidence = Math.max(confidence, 74);
    }
    if (top.cat === "Group Health" && healthStrong) {
      confidence = Math.max(confidence, 74);
    }
    if (top.cat === "Group Life" && lifeStrong) {
      confidence = Math.max(confidence, 74);
    }
  }

  return { category: top.cat, confidence };
};

export const detectBenefitsCategory = (fileName: string): string => {
  return analyzeDocumentCategory(fileName).category;
};


export const getDocumentDescription = (doc: Document): string => {
  if (doc.shortDescription?.trim()) return doc.shortDescription.trim();
  const fileName = doc.originalFileName || doc.name;
  const docType = detectDocumentType(fileName);
  switch (docType) {
    case "SPD": return "Comprehensive plan benefits and features";
    case "SBC": return "Summary of benefits and coverage information";
    case "Enrollment": return "Complete guide to your retirement plan options";
    case "QDIA": return "Qualified Default Investment Alternative information";
    case "Fee Disclosure": return "Participant fee disclosure and plan expenses";
    case "Beneficiary": return "Beneficiary designation form and instructions";
    default: return "Complete guide to your retirement plan options";
  }
};

/** Build viewable file URL for R2-stored documents (signed URL redirect path). */
function documentFileForDisplay(doc: any): string {
  const key = doc.storageKey ?? (doc.file?.startsWith("org/") ? doc.file : null);
  if (key && typeof key === "string") {
    return `/api/r2/signed-url?key=${encodeURIComponent(key)}&redirect=1`;
  }
  return doc.file || doc.fileUrl || doc.fileData || "";
}

export const convertToDocumentFormat = async (doc: any, index = 0, fallbackIdPrefix = "doc"): Promise<Document> => {
  const fileValue = documentFileForDisplay(doc) || doc.file || doc.fileData || "";
  const baseDocument: Document = {
    id: doc.id || `${fallbackIdPrefix}-${Date.now()}-${index}`,
    name: doc.name || doc.title || doc.fileName || `Document ${index + 1}`,
    file: fileValue,
    type: (doc.type as Document["type"]) || "other",
    size: doc.size || 0,
    status: (doc.status as Document["status"]) || "success",
    shortDescription: doc.shortDescription || doc.description,
    originalFileName: doc.originalFileName || doc.fileName,
    ...(doc.storageKey && { storageKey: doc.storageKey }),
  };

  const hasExistingLanguage = doc.language === "ES" || doc.language === "EN";

  // Perform auto-detection (skip PDF extraction when file is R2 key / "r2:stored" - no inline content)
  let pdfText = "";
  const hasPdfContent =
    baseDocument.file &&
    baseDocument.originalFileName?.toLowerCase().endsWith(".pdf") &&
    (baseDocument.file.startsWith("data:application/pdf") || baseDocument.file.startsWith("data:") || (baseDocument.file.length > 200 && !baseDocument.file.startsWith("org/") && baseDocument.file !== "r2:stored"));
  if (hasPdfContent) {
    pdfText = await extractTextFromPDF(baseDocument.file);
  }

  const { category: suggestedCategory, confidence } = analyzeDocumentCategory(
    baseDocument.originalFileName || baseDocument.name,
    pdfText
  );

  return {
    ...baseDocument,
    language: hasExistingLanguage ? doc.language : await guessLanguageFromDocument(baseDocument),
    expirationDate: doc.expirationDate,
    category: doc.category || (confidence >= 70 ? suggestedCategory : undefined),
    categorySuggested: suggestedCategory,
    categoryConfidence: confidence,
  };
};
