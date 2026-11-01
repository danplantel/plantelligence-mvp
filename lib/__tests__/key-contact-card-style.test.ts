import { describe, expect, it } from "vitest";

import {
  isHighlightedKeyContactStyle,
  normalizeKeyContactCardStyle,
} from "@/lib/key-contact-card-style";

/**
 * The "Have Questions?" key contact card style.
 *
 * Two values are meaningful; everything else — a row saved before the column
 * existed, a value from another release, null, garbage — has to read as the
 * default card. A benefit must always render its contacts, so this narrows rather
 * than throws.
 */

describe("normalizeKeyContactCardStyle", () => {
  it("recognises the highlighted style", () => {
    expect(normalizeKeyContactCardStyle("highlighted")).toBe("highlighted");
    // Stored values can carry stray whitespace from a hand-edited row.
    expect(normalizeKeyContactCardStyle(" highlighted ")).toBe("highlighted");
  });

  it("reads everything else as the default card", () => {
    for (const value of [
      "default",
      "",
      "   ",
      null,
      undefined,
      1,
      {},
      ["highlighted"],
      "Highlighted",
      "inverted",
    ]) {
      expect(normalizeKeyContactCardStyle(value)).toBe("default");
    }
  });
});

describe("isHighlightedKeyContactStyle", () => {
  it("is true only for the highlighted value", () => {
    expect(isHighlightedKeyContactStyle("highlighted")).toBe(true);
    expect(isHighlightedKeyContactStyle("default")).toBe(false);
    expect(isHighlightedKeyContactStyle(undefined)).toBe(false);
  });
});
