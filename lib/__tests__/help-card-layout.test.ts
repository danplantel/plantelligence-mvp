import { describe, expect, it } from "vitest";

import {
  HELP_CARD_ORDER,
  fillHelpCardTokens,
  helpCardCategoryLabel,
} from "@/lib/help-card-defaults";
import {
  HELP_CARD_MAX_VISIBLE,
  clampHelpCards,
  defaultHelpCardLayout,
  helpCardFirstRowSize,
  helpCardPrimaryId,
  helpCardRowSpans,
  helpCardMaxSpan,
  helpCardRowSizes,
  helpCardSide,
  isHelpCardEnabled,
  moveHelpCard,
  normalizeHelpCardColumns,
  normalizeHelpCardLayout,
  resolveHelpCardRows,
  setHelpCardEnabled,
  setHelpCardPrimary,
  setHelpCardSide,
} from "@/lib/help-card-layout";

/**
 * The "How Can We Help You Today?" layout rules.
 *
 * Three columns, divided between the cards of each row so no row is ever left
 * short: the 7-card catalog gives a 2-wide primary plus one 1-wide card, then a
 * row of three, then a short row of two, while a lone card owns the whole row.
 * The stored array order IS the visual order.
 */

function ids(layout: { id: string }[]): string[] {
  return layout.map((entry) => entry.id);
}

/**
 * The "cards per row" choice: 3 (the classic grid, default) or 4.
 *
 * With 4 across the grid has four columns but NO card may run wider than two —
 * the Primary included — so the Primary's row holds one standard card fewer than
 * the grid has columns, and a lone card in a short row keeps half the row empty
 * instead of becoming a banner. Either layout is capped at eight cards.
 */
describe("cards per row", () => {
  it("normalizes any stored value to 3 or 4", () => {
    expect(normalizeHelpCardColumns(4)).toBe(4);
    expect(normalizeHelpCardColumns("4")).toBe(4);
    expect(normalizeHelpCardColumns(3)).toBe(3);
    expect(normalizeHelpCardColumns(5)).toBe(3);
    expect(normalizeHelpCardColumns(null)).toBe(3);
    expect(normalizeHelpCardColumns(undefined)).toBe(3);
  });

  it("gives the Primary's row one standard card fewer than the column count", () => {
    expect(helpCardFirstRowSize(7, 3)).toBe(2);
    expect(helpCardFirstRowSize(7, 4)).toBe(3);
    expect(helpCardFirstRowSize(2, 4)).toBe(2);
    expect(helpCardFirstRowSize(1, 4)).toBe(1);
  });

  it("never lets a card exceed two columns with 4 across", () => {
    expect(helpCardRowSpans(3, 4, 0, helpCardMaxSpan(4))).toEqual([2, 1, 1]);
    expect(helpCardRowSpans(2, 4, 0, helpCardMaxSpan(4))).toEqual([2, 2]);
  });

  it("never lets a card fill its row in the 3-column grid either", () => {
    expect(helpCardRowSpans(3, 3, 0, helpCardMaxSpan(3))).toEqual([1, 1, 1]);
    expect(helpCardRowSpans(2, 3, 0, helpCardMaxSpan(3))).toEqual([2, 1]);
  });

  it("makes a lone card three columns wide, in either grid", () => {
    // The ONE exception to the two-column cap: a section holding a single card.
    expect(helpCardRowSpans(1, 3, 0, 3)).toEqual([3]);
    expect(helpCardRowSpans(1, 4, 0, 3)).toEqual([3]);
  });

  it("fills every row, whatever the card count", () => {
    const spansOf = (count: number, columns: 3 | 4) =>
      helpCardRowSizes(count, columns).map((size) => {
        const spans = helpCardRowSpans(size, columns, 0, helpCardMaxSpan(columns));
        return spans.reduce((sum, span) => sum + span, 0);
      });

    for (const columns of [3, 4] as const) {
      // A single card is the documented exception (three columns wide).
      for (let count = 2; count <= 8; count += 1) {
        expect(spansOf(count, columns).every((sum) => sum === columns)).toBe(
          true,
        );
      }
    }
  });

  it("turns four cards into two rows of two with 4 across", () => {
    expect(helpCardRowSizes(4, 4)).toEqual([2, 2]);
    expect(helpCardRowSpans(2, 4, 0, helpCardMaxSpan(4))).toEqual([2, 2]);
  });

  it("keeps a 3-across set full without a full-length card", () => {
    expect(helpCardRowSizes(3, 3)).toEqual([3]);
    expect(helpCardRowSizes(6, 3)).toEqual([2, 2, 2]);
    expect(helpCardRowSizes(8, 3)).toEqual([2, 3, 3]);
  });

  it("packs the seven-card catalog as 2 + 3 + 2, or 3 + 4 with 4 across", () => {
    const layout = defaultHelpCardLayout();

    expect(
      resolveHelpCardRows(layout, undefined, 3).map((row) => row.length),
    ).toEqual([2, 3, 2]);
    expect(
      resolveHelpCardRows(layout, undefined, 4).map((row) => row.length),
    ).toEqual([3, 4]);
  });

  it("makes the first four of eight cards two columns each with 4 across", () => {
    // 2+2 / 2+2 / 1+1+1+1, so the first four cards are each half a row.
    expect(helpCardRowSizes(8, 4)).toEqual([2, 2, 4]);
    expect(helpCardRowSpans(2, 4, 0, helpCardMaxSpan(4))).toEqual([2, 2]);
    expect(helpCardRowSpans(4, 4, 0, helpCardMaxSpan(4))).toEqual([
      1, 1, 1, 1,
    ]);
  });

  it("keeps the Primary-row packing for fewer than eight cards", () => {
    expect(helpCardRowSizes(7, 4)).toEqual([3, 4]);
    expect(helpCardRowSizes(6, 4)).toEqual([3, 3]);
    // 3 across is untouched by the eight-card rule.
    expect(helpCardRowSizes(8, 3)).toEqual([2, 3, 3]);
    expect(helpCardRowSizes(7, 3)).toEqual([2, 3, 2]);
  });

  it("puts a right-edge primary in the last slot of its row", () => {
    const base = defaultHelpCardLayout();

    // 3 across: row 1 holds two cards, so "right" is index 1.
    expect(setHelpCardSide(base, "right", { columns: 3 })[1]).toEqual({
      id: "account-access",
      primary: true,
    });
    // 4 across: row 1 holds three cards, so "right" is index 2.
    expect(setHelpCardSide(base, "right", { columns: 4 })[2]).toEqual({
      id: "account-access",
      primary: true,
    });
  });

  it("still caps either layout at eight cards", () => {
    expect(HELP_CARD_MAX_VISIBLE).toBe(8);
  });
});

describe("normalizeHelpCardLayout", () => {
  it("returns the whole catalog with Account Access primary on the left", () => {
    const layout = defaultHelpCardLayout();

    expect(ids(layout)).toEqual(HELP_CARD_ORDER);
    expect(layout[0]).toEqual({ id: "account-access", primary: true });
    expect(layout.filter((entry) => entry.primary)).toHaveLength(1);
    expect(helpCardSide(layout)).toBe("left");
  });

  it("defaults Retirement to Account Access plus five visible topics", () => {
    const layout = defaultHelpCardLayout("Retirement");

    // The catalog still lists every card, so the editor can switch the match
    // card on; it is simply not visible on the portal until then.
    expect(ids(layout)).toEqual([
      "account-access",
      "enroll-change-contributions",
      "employer-match-vesting",
      "manage-investments",
      "beneficiaries",
      "leaving-retiring",
      "financial-planning",
    ]);
    expect(
      isHelpCardEnabled(
        layout.find((entry) => entry.id === "employer-match-vesting"),
      ),
    ).toBe(false);

    expect(
      resolveHelpCardRows(layout, "Retirement")
        .flat()
        .map((card) => card.id),
    ).toEqual([
      "account-access",
      "enroll-change-contributions",
      "manage-investments",
      "beneficiaries",
      "leaving-retiring",
      "financial-planning",
    ]);
  });

  it("defaults Group Health to Account Access plus the five Featured topics", () => {
    const layout = defaultHelpCardLayout("Group Health");

    expect(ids(layout)).toEqual([
      "account-access",
      "understand-coverage",
      "find-care-providers",
      "claims-bills-costs",
      "add-remove-dependent",
      "hsa-fsa-resources",
    ]);
    expect(layout.every((entry) => isHelpCardEnabled(entry))).toBe(true);

    expect(
      resolveHelpCardRows(layout, "Group Health")
        .flat()
        .map((card) => card.id),
    ).toEqual([
      "account-access",
      "understand-coverage",
      "find-care-providers",
      "claims-bills-costs",
      "add-remove-dependent",
      "hsa-fsa-resources",
    ]);
  });

  it("defaults Group Life to Account Access plus the five Featured topics", () => {
    const layout = defaultHelpCardLayout("Group Life");

    expect(ids(layout)).toEqual([
      "account-access",
      "review-my-coverage",
      "beneficiaries",
      "change-or-add-coverage",
      "file-a-claim",
      "disability-benefits",
    ]);
    expect(layout.every((entry) => isHelpCardEnabled(entry))).toBe(true);

    expect(
      resolveHelpCardRows(layout, "Group Life")
        .flat()
        .map((card) => card.id),
    ).toEqual([
      "account-access",
      "review-my-coverage",
      "beneficiaries",
      "change-or-add-coverage",
      "file-a-claim",
      "disability-benefits",
    ]);
  });

  it("keeps a stored primary and treats index 1 as the right edge", () => {
    const layout = normalizeHelpCardLayout([
      { id: "rollovers-distributions" },
      { id: "account-access", primary: true },
      { id: "beneficiaries" },
      { id: "financial-planning" },
    ]);

    expect(layout[1]).toEqual({ id: "account-access", primary: true });
    expect(helpCardSide(layout)).toBe("right");
    expect(helpCardPrimaryId(layout)).toBe("account-access");
  });

  it("pulls a primary stored off row 1 back onto row 1", () => {
    const layout = normalizeHelpCardLayout([
      { id: "rollovers-distributions" },
      { id: "beneficiaries" },
      { id: "savings" },
      { id: "account-access", primary: true },
    ]);

    // Row 1 holds two cards, so the far edge is index 1 — never index 3.
    expect(layout[1]).toEqual({ id: "account-access", primary: true });
    expect(helpCardSide(layout)).toBe("right");
  });

  it("appends catalog cards that are missing and drops unknown ones", () => {
    const layout = normalizeHelpCardLayout([
      { id: "savings", primary: true },
      { id: "not-a-card" },
      { id: "savings" },
    ]);

    expect(ids(layout)).toHaveLength(HELP_CARD_ORDER.length);
    expect(ids(layout)[0]).toBe("savings");
    expect(ids(layout)).not.toContain("not-a-card");
    expect(new Set(ids(layout)).size).toBe(HELP_CARD_ORDER.length);
  });

  it("accepts legacy full card objects but stores only id + primary", () => {
    const layout = normalizeHelpCardLayout([
      {
        id: "account-access",
        title: "Old title",
        paragraphs: ["Old body"],
        cta: "",
        primary: true,
      } as any,
    ]);

    expect(layout[0]).toEqual({ id: "account-access", primary: true });
    expect(layout.some((entry) => "title" in entry)).toBe(false);
  });

  it("clears extra primary flags", () => {
    const layout = normalizeHelpCardLayout([
      { id: "account-access", primary: true },
      { id: "savings", primary: true },
    ]);

    expect(layout.filter((entry) => entry.primary)).toHaveLength(1);
    expect(layout.find((entry) => entry.primary)?.id).toBe("account-access");
  });
});

describe("setHelpCardPrimary", () => {
  it("swaps the primary, keeping the current edge", () => {
    const left = setHelpCardPrimary(defaultHelpCardLayout(), "medicare");
    expect(left[0]).toEqual({ id: "medicare", primary: true });
    expect(left.filter((entry) => entry.primary)).toHaveLength(1);

    const right = setHelpCardPrimary(defaultHelpCardLayout(), "medicare");
    const flipped = setHelpCardSide(right, "right");
    const swapped = setHelpCardPrimary(flipped, "savings");
    expect(swapped[1]).toEqual({ id: "savings", primary: true });
    expect(helpCardSide(swapped)).toBe("right");
  });
});

describe("setHelpCardSide", () => {
  it("moves the primary between the two row-1 edges", () => {
    const right = setHelpCardSide(defaultHelpCardLayout(), "right");
    expect(right[1]).toEqual({ id: "account-access", primary: true });
    expect(helpCardSide(right)).toBe("right");

    const left = setHelpCardSide(right, "left");
    expect(left[0]).toEqual({ id: "account-access", primary: true });
    expect(helpCardSide(left)).toBe("left");
  });
});

describe("moveHelpCard", () => {
  it("reorders the standard cards across the row boundary", () => {
    const layout = defaultHelpCardLayout();
    // Move Savings (row 2) up into row 1, after the primary.
    const moved = moveHelpCard(layout, "savings", "rollovers-distributions");

    expect(ids(moved).slice(0, 3)).toEqual([
      "account-access",
      "savings",
      "rollovers-distributions",
    ]);
    // The primary is untouched.
    expect(moved[0]).toEqual({ id: "account-access", primary: true });
  });

  it("keeps a right-edge primary pinned", () => {
    const layout = setHelpCardSide(defaultHelpCardLayout(), "right");
    // Standards in a right-edge layout: [rollovers, beneficiaries, financial,
    // social, medicare, savings]. Moving savings onto beneficiaries inserts it at
    // that position, but row 1 keeps only the single standard slot beside the
    // primary, so rollovers stays first and the primary stays last.
    const moved = moveHelpCard(layout, "savings", "beneficiaries");

    expect(moved[1]).toEqual({ id: "account-access", primary: true });
    expect(ids(moved)[0]).toBe("rollovers-distributions");
    expect(ids(moved)[2]).toBe("savings");
  });

  it("ignores dragging the primary itself", () => {
    const layout = defaultHelpCardLayout();

    expect(ids(moveHelpCard(layout, "account-access", "savings"))).toEqual(
      ids(layout),
    );
  });

  it("promotes the card dropped on a LEFT-edge primary", () => {
    const promoted = moveHelpCard(
      defaultHelpCardLayout(),
      "savings",
      "account-access",
    );

    // The dropped card takes the primary slot; Account Access slides into the
    // place Savings came from (the front of the standard order).
    expect(promoted[0]).toEqual({ id: "savings", primary: true });
    expect(promoted[1]).toEqual({ id: "account-access" });
    expect(promoted.filter((entry) => entry.primary)).toHaveLength(1);
    expect(helpCardSide(promoted)).toBe("left");
  });

  it("promotes the card dropped on a RIGHT-edge primary", () => {
    const right = setHelpCardSide(defaultHelpCardLayout(), "right");
    const promoted = moveHelpCard(right, "savings", "account-access");

    expect(promoted[1]).toEqual({ id: "savings", primary: true });
    expect(promoted[2]).toEqual({ id: "account-access" });
    expect(promoted.filter((entry) => entry.primary)).toHaveLength(1);
    expect(helpCardSide(promoted)).toBe("right");
  });
});

describe("catalog token helpers", () => {
  it("fills [Benefit Category] with the category being edited", () => {
    expect(
      fillHelpCardTokens("[Benefit Category] Account Access", "Retirement"),
    ).toBe("Retirement Account Access");
  });

  it("drops the token when there is no category yet", () => {
    expect(fillHelpCardTokens("[Benefit Category] Account Access")).toBe(
      "Account Access",
    );
  });

  it("labels the Custom hub with the advisor's own benefit name", () => {
    expect(helpCardCategoryLabel("Custom", "Acme Wellness")).toBe(
      "Acme Wellness",
    );
    // The storage label is a placeholder, not a name.
    expect(
      helpCardCategoryLabel("Company / Plan Sponsor", "Company / Plan Sponsor"),
    ).toBe("Custom");
    expect(helpCardCategoryLabel(undefined)).toBeUndefined();
  });
});

describe("resolveHelpCardRows", () => {
  it("splits row 1 (primary + 1) from rows of three", () => {
    const rows = resolveHelpCardRows(undefined);

    expect(rows).toHaveLength(3);
    expect(rows[0].map((card) => card.id)).toEqual([
      "account-access",
      "rollovers-distributions",
    ]);
    expect(rows[1].map((card) => card.id)).toEqual([
      "beneficiaries",
      "financial-planning",
      "social-security",
    ]);
    expect(rows[2].map((card) => card.id)).toEqual(["medicare", "savings"]);
  });

  it("carries the static catalog copy and the primary flag", () => {
    const [firstRow] = resolveHelpCardRows(undefined);

    expect(firstRow[0]).toMatchObject({
      id: "account-access",
      title: "[Benefit Category] Account Access",
      primary: true,
    });
    expect(firstRow[1]).toMatchObject({
      id: "rollovers-distributions",
      title: "Rollovers & Distributions",
      primary: false,
    });
    expect(firstRow[1].paragraphs.length).toBeGreaterThan(0);
  });

  it("puts a right-edge primary last in row 1", () => {
    const [firstRow] = resolveHelpCardRows(
      setHelpCardSide(defaultHelpCardLayout(), "right"),
    );

    expect(firstRow.map((card) => card.id)).toEqual([
      "rollovers-distributions",
      "account-access",
    ]);
    expect(firstRow[1].primary).toBe(true);
  });
});

describe("hidden cards", () => {
  it("treats a missing flag as enabled", () => {
    const layout = defaultHelpCardLayout();

    expect(layout.every((entry) => isHelpCardEnabled(entry))).toBe(true);
    // Nothing is written until a card is actually switched off, so a layout
    // saved before the checkbox existed keeps rendering every card.
    expect(layout.some((entry) => "enabled" in entry)).toBe(false);
  });

  it("hides a card in place and shows it again where it was", () => {
    const layout = defaultHelpCardLayout();
    const hidden = setHelpCardEnabled(layout, "medicare", false);

    expect(ids(hidden)).toEqual(ids(layout));
    expect(hidden.find((entry) => entry.id === "medicare")).toEqual({
      id: "medicare",
      enabled: false,
    });
    // The primary and the edge are untouched.
    expect(helpCardPrimaryId(hidden)).toBe("account-access");
    expect(helpCardSide(hidden)).toBe("left");

    const shown = setHelpCardEnabled(hidden, "medicare", true);

    expect(ids(shown)).toEqual(ids(layout));
    expect(shown.find((entry) => entry.id === "medicare")).toEqual({
      id: "medicare",
    });
  });

  it("keeps the flag through promotion, reordering and side flips", () => {
    const hidden = setHelpCardEnabled(
      defaultHelpCardLayout(),
      "savings",
      false,
    );
    const savings = (layout: ReturnType<typeof defaultHelpCardLayout>) =>
      layout.find((entry) => entry.id === "savings");

    expect(savings(setHelpCardPrimary(hidden, "beneficiaries"))).toEqual({
      id: "savings",
      enabled: false,
    });
    expect(savings(moveHelpCard(hidden, "medicare", "social-security"))).toEqual(
      { id: "savings", enabled: false },
    );
    expect(savings(setHelpCardSide(hidden, "right"))).toEqual({
      id: "savings",
      enabled: false,
    });
  });

  it("drops a hidden card from the rendered rows", () => {
    const rows = resolveHelpCardRows(
      setHelpCardEnabled(defaultHelpCardLayout(), "beneficiaries", false),
    );
    const rendered = rows.flat().map((card) => card.id);

    expect(rendered).not.toContain("beneficiaries");
    expect(rendered).toHaveLength(HELP_CARD_ORDER.length - 1);
    // The primary still leads row 1.
    expect(rows[0][0]).toMatchObject({ id: "account-access", primary: true });
  });

  it("packs three to a row when the primary itself is hidden", () => {
    const rows = resolveHelpCardRows(
      setHelpCardEnabled(defaultHelpCardLayout(), "account-access", false),
    );

    // No wide card to lay out around → a plain 3-column grid.
    expect(rows[0].map((card) => card.id)).toEqual([
      "rollovers-distributions",
      "beneficiaries",
      "financial-planning",
    ]);
    expect(rows.every((row) => row.length <= 3)).toBe(true);
    expect(rows.flat().some((card) => card.primary)).toBe(false);
  });
});

/**
 * Rows must always reach the right edge — the grid cannot trail off into white
 * space just because a plan shows fewer cards than the catalog does.
 */
describe("helpCardFirstRowSize", () => {
  it("gives row 1 to the primary, then fills rows of three", () => {
    expect(helpCardFirstRowSize(0)).toBe(0);
    // A lone card owns the whole row.
    expect(helpCardFirstRowSize(1)).toBe(1);
    // Otherwise row 1 is the primary plus one standard card, which is what keeps
    // the primary visibly the wide one.
    expect(helpCardFirstRowSize(2)).toBe(2);
    expect(helpCardFirstRowSize(3)).toBe(2);
    expect(helpCardFirstRowSize(4)).toBe(2);
    expect(helpCardFirstRowSize(5)).toBe(2);
    expect(helpCardFirstRowSize(6)).toBe(2);
    expect(helpCardFirstRowSize(7)).toBe(2);
    expect(helpCardFirstRowSize(8)).toBe(2);
    expect(helpCardFirstRowSize(9)).toBe(2);
  });
});

describe("helpCardRowSpans", () => {
  it("divides the three columns so every row adds up to three", () => {
    expect(helpCardRowSpans(0)).toEqual([]);
    expect(helpCardRowSpans(1)).toEqual([3]);
    expect(helpCardRowSpans(2)).toEqual([2, 1]);
    expect(helpCardRowSpans(3)).toEqual([1, 1, 1]);
  });

  it("hands the extra column to the row's primary", () => {
    // A primary at the RIGHT edge of row 1 stays the wide card.
    expect(helpCardRowSpans(2, 3, 1)).toEqual([1, 2]);
    expect(helpCardRowSpans(2, 3, 0)).toEqual([2, 1]);
  });

  it("never gives a card fewer than one column", () => {
    for (const rowSize of [1, 2, 3]) {
      const spans = helpCardRowSpans(rowSize);
      expect(spans.every((span) => span >= 1)).toBe(true);
      expect(spans.reduce((total, span) => total + span, 0)).toBe(3);
    }
  });
});

describe("resolveHelpCardRows with a short card set", () => {
  it("keeps every row full when the catalog is cut down to five cards", () => {
    let layout = defaultHelpCardLayout();
    for (const id of ["social-security", "medicare"]) {
      layout = setHelpCardEnabled(layout, id, false);
    }

    const rows = resolveHelpCardRows(layout);

    // 2 + 3, and the short last row widens its cards to reach the right edge.
    expect(rows.map((row) => row.length)).toEqual([2, 3]);
    expect(rows[0][0]).toMatchObject({ id: "account-access", primary: true });
  });

  it("keeps every row full at six cards", () => {
    const rows = resolveHelpCardRows(
      setHelpCardEnabled(defaultHelpCardLayout(), "savings", false),
    );

    // 2 + 2 + 2: the lone tail card is folded back in, so no row ends short.
    expect(rows.map((row) => row.length)).toEqual([2, 2, 2]);
  });
});

describe("clampHelpCards", () => {
  it("shows at most eight cards, in the order the advisor arranged", () => {
    const cards = Array.from({ length: 11 }, (_, index) => `card-${index}`);

    expect(HELP_CARD_MAX_VISIBLE).toBe(8);
    // Eight is exactly the primary's row of two plus two rows of three.
    expect(clampHelpCards(cards)).toHaveLength(8);
    expect(clampHelpCards(cards)).toEqual(cards.slice(0, 8));
    expect(clampHelpCards(cards.slice(0, 3))).toHaveLength(3);
    expect(clampHelpCards([])).toEqual([]);
  });
});
