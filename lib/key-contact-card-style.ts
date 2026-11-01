/**
 * key-contact-card-style — how a benefit's "Have Questions?" key contact is drawn.
 *
 * The section closes every Benefit Hub with that benefit's support people. Its key
 * contact can wear either:
 *
 *  - `default` — the neutral card the rest of the row uses (a white card with the
 *    plan's colours in its text and CTA);
 *  - `highlighted` — the card is filled with the plan's PRIMARY colour and
 *    everything on it switches to the readable colour for that fill, which is the
 *    treatment the primary card in "How Can We Help You Today?" uses. It makes the
 *    person the page features stand out from the rest of the row.
 *
 * The advisor picks it in Section 8 of the benefit editor; the value lives on the
 * Benefit row (`keyContactCardStyle`) so each benefit can differ. Unknown values
 * (a row saved before this existed, a newer client's value, null) read as
 * `default` — the card every hub has always drawn.
 */

export type KeyContactCardStyle = "default" | "highlighted";

/** Every style, in the order the editor offers them. */
export const KEY_CONTACT_CARD_STYLES: readonly KeyContactCardStyle[] = [
  "default",
  "highlighted",
] as const;

/**
 * Narrow a stored value to a style the cards understand. Anything unrecognised —
 * null, "", a number, a value from another release — is the default style, never
 * an error, because a benefit must always render its contacts.
 */
export function normalizeKeyContactCardStyle(
  value: unknown,
): KeyContactCardStyle {
  return typeof value === "string" && value.trim() === "highlighted"
    ? "highlighted"
    : "default";
}

/** True when the key contact's card should wear the filled, inverted treatment. */
export function isHighlightedKeyContactStyle(value: unknown): boolean {
  return normalizeKeyContactCardStyle(value) === "highlighted";
}
