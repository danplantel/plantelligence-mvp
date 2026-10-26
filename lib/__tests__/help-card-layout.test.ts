import { describe, expect, it } from "vitest";

import {
  HELP_CARD_ORDER,
  fillHelpCardTokens,
  helpCardCategoryLabel,
} from "@/lib/help-card-defaults";
import {
  defaultHelpCardLayout,
  helpCardPrimaryId,
  helpCardSide,
  moveHelpCard,
  normalizeHelpCardLayout,
  resolveHelpCardRows,
  setHelpCardPrimary,
  setHelpCardSide,
} from "@/lib/help-card-layout";

/**
 * The "How Can We Help You Today?" layout rules.
 *
 * One primary (2 of 4 columns) at the LEFT or RIGHT edge of row 1; every other
 * card is 1/4. The stored array order IS the visual order: indices 0–2 are row 1,
 * 3–6 are row 2.
 */

function ids(layout: { id: string }[]): string[] {
  return layout.map((entry) => entry.id);
}

describe("normalizeHelpCardLayout", () => {
  it("returns the whole catalog with Account Access primary on the left", () => {
    const layout = defaultHelpCardLayout();

    expect(ids(layout)).toEqual(HELP_CARD_ORDER);
    expect(layout[0]).toEqual({ id: "account-access", primary: true });
    expect(layout.filter((entry) => entry.primary)).toHaveLength(1);
    expect(helpCardSide(layout)).toBe("left");
  });

  it("keeps a stored primary and treats index 2 as the right edge", () => {
    const layout = normalizeHelpCardLayout([
      { id: "rollovers-distributions" },
      { id: "beneficiaries" },
      { id: "account-access", primary: true },
      { id: "financial-planning" },
    ]);

    expect(layout[2]).toEqual({ id: "account-access", primary: true });
    expect(helpCardSide(layout)).toBe("right");
    expect(helpCardPrimaryId(layout)).toBe("account-access");
  });

  it("treats a primary stored anywhere else as the left edge", () => {
    const layout = normalizeHelpCardLayout([
      { id: "rollovers-distributions" },
      { id: "account-access", primary: true },
    ]);

    expect(layout[0]).toEqual({ id: "account-access", primary: true });
    expect(helpCardSide(layout)).toBe("left");
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
    expect(swapped[2]).toEqual({ id: "savings", primary: true });
    expect(helpCardSide(swapped)).toBe("right");
  });
});

describe("setHelpCardSide", () => {
  it("moves the primary between the two row-1 edges", () => {
    const right = setHelpCardSide(defaultHelpCardLayout(), "right");
    expect(right[2]).toEqual({ id: "account-access", primary: true });
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
    // social, medicare, savings]. Moving savings onto beneficiaries inserts it
    // at that position, so row 1's two standard slots become rollovers + savings.
    const moved = moveHelpCard(layout, "savings", "beneficiaries");

    expect(moved[2]).toEqual({ id: "account-access", primary: true });
    expect(ids(moved).slice(0, 2)).toEqual([
      "rollovers-distributions",
      "savings",
    ]);
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

    expect(promoted[2]).toEqual({ id: "savings", primary: true });
    expect(promoted[3]).toEqual({ id: "account-access" });
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
  it("splits row 1 (primary + 2) from row 2 (4)", () => {
    const rows = resolveHelpCardRows(undefined);

    expect(rows).toHaveLength(2);
    expect(rows[0].map((card) => card.id)).toEqual([
      "account-access",
      "rollovers-distributions",
      "beneficiaries",
    ]);
    expect(rows[1].map((card) => card.id)).toEqual([
      "financial-planning",
      "social-security",
      "medicare",
      "savings",
    ]);
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
      "beneficiaries",
      "account-access",
    ]);
    expect(firstRow[2].primary).toBe(true);
  });
});
