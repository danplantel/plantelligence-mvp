import { describe, expect, it } from "vitest";

import { sameDraft } from "@/lib/portal-draft-compare";

/**
 * The comparison behind every panel header's "Unsaved changes" badge.
 *
 * A draft reaches the same value through different routes (an API payload, an
 * object built in a card, an upload result), so equality cannot rely on key order.
 * A cleared optional field must also read as equal to its absence — otherwise a
 * field emptied back to its original state would leave the badge on.
 */

describe("sameDraft", () => {
  it("ignores key order", () => {
    expect(
      sameDraft({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }),
    ).toBe(true);
  });

  it("treats an undefined value and a missing key as the same", () => {
    expect(sameDraft({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });

  it("compares arrays by value, in order", () => {
    expect(sameDraft([1, { a: 2 }], [1, { a: 2 }])).toBe(true);
    expect(sameDraft([1, 2], [2, 1])).toBe(false);
    expect(sameDraft([1], [1, 2])).toBe(false);
  });

  it("sees a nested change", () => {
    expect(
      sameDraft(
        { hero: { url: "a.png", fileName: "a.png" } },
        { hero: { url: "a.png", fileName: "b.png" } },
      ),
    ).toBe(false);
  });

  it("never equates a record with a different kind of value", () => {
    expect(sameDraft({ a: 1 }, "a")).toBe(false);
    expect(sameDraft({ a: 1 }, [1])).toBe(false);
    expect(sameDraft(null, {})).toBe(false);
    expect(sameDraft(null, null)).toBe(true);
  });
});
