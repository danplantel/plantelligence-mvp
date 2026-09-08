/**
 * Normalization helpers for PDF text extracted with pdf-parse (pdf.js).
 *
 * BACKGROUND
 * Some benefits PDFs — e.g. ADP "Your Plan Highlights" booklets — are written with
 * a text matrix that pdf.js decodes by reversing every text line character-by-character.
 * The extracted text then reads like gibberish ("ytilibigil" for "Eligibility",
 * "sgnivas" for "savings"). Two downstream consumers are fooled by that artifact:
 *
 *   • `franc`-based language detection classifies the reversed English text as Spanish
 *     (`franc(raw, { only: ["eng", "spa"] })` returns `"spa"`), so English documents
 *     get labelled as Spanish — the bug this file fixes.
 *   • keyword category detection cannot match its word list, and the Gemini
 *     `document_text` input is garbled, which also skews the model's language guess.
 *
 * `normalizePdfText` detects that reversal artifact and un-reverses each line so that
 * language, category, and Gemini inputs all see the real English/Spanish words.
 */

/** Characters that almost never appear in English benefits documents but are
 *  common in Spanish (also captures ¿ and ¡ used only by Spanish punctuation). */
const SPANISH_ACCENT_RE = /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/g;

const ENGLISH_FUNCTION_WORDS = [
  "the", "and", "of", "to", "in", "is", "are", "you", "your", "for", "with",
  "on", "that", "this", "will", "not", "be", "from", "have", "has", "by", "or",
  "as", "an", "it", "we", "they", "he", "she", "his", "her", "their", "there",
  "which", "when", "was", "were", "would", "should", "can", "may", "if", "at",
  "about", "into", "out", "over", "after", "before", "each", "any", "some",
  "more", "than", "also", "only", "other", "such", "these", "those", "what",
  "how", "why", "because", "during", "without", "our", "them",
];

const SPANISH_FUNCTION_WORDS = [
  "de", "la", "el", "que", "y", "los", "se", "del", "las", "un", "una",
  "por", "con", "para", "en", "es", "son", "su", "sus", "al", "lo", "le",
  "como", "pero", "más", "mas", "este", "esta", "esto", "ese", "esa", "está",
  "están", "no", "si", "ya", "también", "cuando", "qué", "sobre", "entre",
  "desde", "hasta", "durante", "sin", "cada", "cual", "mucho", "mucha", "muy",
  "solo", "otro", "otros", "otra", "mi", "tu", "te", "me", "nos", "les", "hay",
  "todo", "toda", "todos", "todas", "ser", "estar", "usted", "favor", "tener",
];

const ENGLISH_DOMAIN_WORDS = [
  "plan", "plans", "retirement", "benefit", "benefits", "contribution",
  "contributions", "account", "accounts", "enrollment", "summary", "description",
  "coverage", "insurance", "service", "services", "year", "years", "rollover",
  "investment", "investments", "savings", "distribution", "distributions",
  "withdrawal", "withdrawals", "participant", "participants", "employer",
  "employee", "employees", "eligibility", "form", "forms", "notice", "notices",
  "disclosure", "disclosures", "option", "options", "vesting", "salary",
  "company", "match", "matches", "work", "pay", "payment", "information",
];

const SPANISH_DOMAIN_WORDS = [
  "plan", "planes", "jubilación", "beneficio", "beneficios", "aportación",
  "aportaciones", "cuenta", "cuentas", "inscripción", "resumen", "descripción",
  "cobertura", "seguro", "seguros", "servicio", "servicios", "año", "años",
  "retiro", "inversión", "inversiones", "ahorro", "ahorros", "distribución",
  "distribuciones", "participante", "participantes", "empleador", "empleados",
  "elegibilidad", "formulario", "formularios", "aviso", "avisos", "opciones",
  "opción", "solicitud", "documento", "empresa", "salario", "compañía",
  "información", "trabajo", "pago", "pagos",
];

/** Combined vocabulary used to score how "word-like" a piece of text is. */
const WORD_SCORE_LIST: string[] = Array.from(
  new Set([
    ...ENGLISH_FUNCTION_WORDS,
    ...SPANISH_FUNCTION_WORDS,
    ...ENGLISH_DOMAIN_WORDS,
    ...SPANISH_DOMAIN_WORDS,
  ]),
);

function countWordMatches(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const word of words) {
    // \b treats accented characters as non-word in JS, so a trailing \b after an
    // accented char never matches; use it only for plain-ASCII words and rely on
    // the surrounding whitespace/punctuation for accented ones.
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundary = /^[a-z]+$/.test(word) ? "\\b" : "";
    const re = new RegExp(`${boundary}${escaped}${boundary}`, "g");
    const matches = lower.match(re);
    if (matches) score += matches.length;
  }
  return score;
}

/** Reverse every line of a string character-by-character. */
export function reverseEveryLine(text: string): string {
  return text
    .split("\n")
    .map((line) => line.split("").reverse().join(""))
    .join("\n");
}

/**
 * pdf-parse returns some PDFs (ADP plan-highlight booklets, etc.) with every line
 * reversed character-by-character. Returns a de-reversed copy when that artifact is
 * detected, otherwise returns the input unchanged. Idempotent for normal text.
 */
export function normalizePdfText(text: string | null | undefined): string {
  const source = text ?? "";
  if (!source.trim()) return source;
  // Not enough content to make a reliable call — leave it alone.
  if (source.length < 60) return source;

  const reversed = reverseEveryLine(source);
  const sourceScore = countWordMatches(source, WORD_SCORE_LIST);
  const reversedScore = countWordMatches(reversed, WORD_SCORE_LIST);

  // The artifact reverses real words into non-words, so the de-reversed text has
  // far more recognizable English/Spanish tokens than the raw extract. Only flip
  // when the margin is large enough that a normally-extracted PDF can't false-positive.
  if (reversedScore >= 12 && reversedScore >= sourceScore * 2) {
    return reversed;
  }
  return source;
}

export type EnEsLanguage = "en" | "es";

/**
 * Dependency-free English/Spanish detector used to sanity-check text that is already
 * in readable form (normalizePdfText output). Prefer it for short/ambiguous text too;
 * it returns "es" only when the evidence for Spanish is clear (Spanish function-word
 * density or Spanish-only accented characters), otherwise defaults to "en".
 */
export function detectEnEsLanguage(
  text: string | null | undefined,
): EnEsLanguage {
  const source = (text ?? "").trim();
  if (!source) return "en";

  const enScore = countWordMatches(
    source,
    [...ENGLISH_FUNCTION_WORDS, ...ENGLISH_DOMAIN_WORDS],
  );
  const esScore = countWordMatches(
    source,
    [...SPANISH_FUNCTION_WORDS, ...SPANISH_DOMAIN_WORDS],
  );
  const esChars = (source.match(SPANISH_ACCENT_RE) || []).length;

  if (esScore >= 6 && esScore >= enScore * 1.5) return "es";
  if (enScore >= 6 && enScore >= esScore * 1.5) return "en";
  // Ambiguous word counts — let Spanish-only characters break the tie.
  if (esChars >= 2) return "es";
  if (esScore > 0 && enScore === 0) return "es";
  return "en";
}
