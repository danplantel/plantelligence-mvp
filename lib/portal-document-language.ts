/**
 * Hub document lists (retirement accordion, etc.) filter with doc.language === "EN" | "ES".
 * Prisma/JSON may return null, lowercase, or other variants — normalize before filter.
 */
export type PortalDocumentLanguage = "EN" | "ES";

export function normalizePortalDocumentLanguage(
  raw: string | null | undefined,
  fallback: PortalDocumentLanguage = "EN",
): PortalDocumentLanguage {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  const lower = s.toLowerCase();
  if (lower === "es" || lower === "español" || lower === "espanol") {
    return "ES";
  }
  if (
    lower === "en" ||
    lower === "english" ||
    lower === "en-us" ||
    lower === "en_us"
  ) {
    return "EN";
  }
  if (lower.startsWith("es") && s.length <= 3) {
    return "ES";
  }
  if (lower.startsWith("en") && s.length <= 3) {
    return "EN";
  }
  return fallback;
}
