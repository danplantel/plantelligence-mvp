/**
 * Structural equality for the portal panels' drafts.
 *
 * An editor's "Unsaved changes" badge must follow the DRAFT, not the act of
 * touching a control: changing a value and then changing it back has to clear the
 * badge, and re-selecting the theme that was already saved is not a change at all.
 * Each panel therefore keeps a snapshot of what it loaded and compares the current
 * draft with it.
 *
 * `JSON.stringify` is not enough: the same value reaches a draft through different
 * routes (an API payload, a fresh object built in a card, an upload result), so key
 * order differs. This walks the structure instead. `undefined` and a missing key
 * are equal (both mean "not set"), which is what makes a cleared optional field
 * compare clean.
 */
export function sameDraft(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((value, index) => sameDraft(value, b[index]));
  }

  if (typeof a !== "object" || typeof b !== "object") {
    // Numbers, strings, booleans — and anything exotic (functions, DOM nodes)
    // only ever equal by identity, which the first line already answered.
    return false;
  }

  // Only plain records are walked; a Date/File never equals a different instance.
  if (
    Object.getPrototypeOf(a) !== Object.prototype &&
    Object.getPrototypeOf(a) !== null
  ) {
    return false;
  }
  if (
    Object.getPrototypeOf(b) !== Object.prototype &&
    Object.getPrototypeOf(b) !== null
  ) {
    return false;
  }

  const recordA = a as Record<string, unknown>;
  const recordB = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(recordA), ...Object.keys(recordB)]);

  for (const key of keys) {
    const valueA = recordA[key];
    const valueB = recordB[key];
    // A key whose value is `undefined` is absent, on either side.
    if (valueA === undefined && valueB === undefined) continue;
    if (!sameDraft(valueA, valueB)) return false;
  }

  return true;
}
