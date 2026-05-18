/**
 * Two-letter monogram from a display name: first token + last token initials.
 * Single-word names use up to two characters (e.g. "Madonna" → "MA").
 */
export function getNameMonogram(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "?";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }

  const token = parts[0] ?? trimmed;
  if (token.length >= 2) return token.slice(0, 2).toUpperCase();
  return token.toUpperCase();
}
