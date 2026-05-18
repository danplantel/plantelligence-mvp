/** Suggested display names when saving a plan as new (avoid duplicate). */
export function suggestPlanNameAlternatives(base: string): string[] {
  const t = (base || "").trim();
  if (!t) return ["New Plan", "New Plan (2)"];
  return [`${t} Copy`, `${t} (2)`, `${t} — Copy`];
}
