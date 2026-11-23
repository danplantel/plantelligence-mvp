import React from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HelpCardLayoutEditor } from "../help-card-layout-editor";
import { HELP_CARD_ORDER } from "@/lib/help-card-defaults";
import {
  defaultHelpCardLayout,
  setHelpCardEnabled,
  setHelpCardSide,
} from "@/lib/help-card-layout";
import type { HelpCardContent, HelpCardLayoutEntry } from "@/types/benefit";

/**
 * Section 4's card-layout control.
 *
 * Copy is static; the editor only changes the layout: one sortable list of all
 * cards (the primary is pinned), a single Primary selection, and the Left/Right
 * control for which row-1 edge it occupies.
 */

function row(id: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    `[data-help-layout-card="${id}"]`,
  );
  if (!found) throw new Error(`No layout row for ${id}`);
  return found;
}

function layoutOf(onChange: ReturnType<typeof vi.fn>): HelpCardLayoutEntry[] {
  return onChange.mock.calls[0][0] as HelpCardLayoutEntry[];
}

describe("HelpCardLayoutEditor", () => {
  it("lists all seven cards in order with exactly one primary", () => {
    render(<HelpCardLayoutEditor onChange={() => {}} />);

    const rows = Array.from(
      document.querySelectorAll<HTMLElement>("[data-help-layout-card]"),
    );
    expect(rows.map((element) => element.dataset.helpLayoutCard)).toEqual(
      HELP_CARD_ORDER,
    );

    const primaries = rows.filter(
      (element) => element.dataset.primary === "true",
    );
    expect(primaries).toHaveLength(1);
    expect(primaries[0].dataset.helpLayoutCard).toBe("account-access");

    // The slot mirror shows the same seven cards.
    expect(
      screen.getByTestId("help-card-slot-preview").children,
    ).toHaveLength(HELP_CARD_ORDER.length);
  });

  it("gives every row a drag handle, the primary included", () => {
    render(<HelpCardLayoutEditor onChange={() => {}} />);

    // The primary is draggable too: dropping it on another card hands over primary
    // status, so its row carries the same handle as the standards.
    expect(
      within(row("account-access")).getByRole("button", {
        name: /Reorder/,
      }),
    ).toBeInTheDocument();
    expect(
      within(row("savings")).getByRole("button", { name: /Reorder/ }),
    ).toBeInTheDocument();
  });

  it("makes another card primary, keeping it on the left", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HelpCardLayoutEditor onChange={onChange} />);

    await user.click(
      within(row("rollovers-distributions")).getByRole("button", {
        name: "Make primary",
      }),
    );

    const layout = layoutOf(onChange);
    expect(layout[0]).toEqual({
      id: "rollovers-distributions",
      primary: true,
    });
    expect(layout.filter((entry) => entry.primary)).toHaveLength(1);
  });

  it("moves the primary to the right edge of row 1", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HelpCardLayoutEditor onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /^right$/i }));

    const layout = layoutOf(onChange);
    // Row 1 holds two cards, so the right edge is the second slot.
    expect(layout[1]).toEqual({ id: "account-access", primary: true });
    expect(layout.filter((entry) => entry.primary)).toHaveLength(1);
  });

  it("puts a right-edge primary in the last slot of a four-across row", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <HelpCardLayoutEditor
        onChange={onChange}
        columns={4}
        onColumnsChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^right$/i }));

    // Row 1 holds three cards with 4 across, so the right edge is slot 2.
    const layout = layoutOf(onChange);
    expect(layout[2]).toEqual({ id: "account-access", primary: true });
  });

  it("labels the Left/Right control as the Primary card's positioning", () => {
    render(<HelpCardLayoutEditor onChange={() => {}} />);

    // The two buttons sat on their own with no caption, so what they moved was a
    // guess; the label names it.
    const label = screen.getByText("Primary Card Positioning");
    const group = label.parentElement as HTMLElement;
    expect(within(group).getByRole("button", { name: /^left$/i })).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: /^right$/i }),
    ).toBeInTheDocument();
  });

  it("drops the positioning control when the primary owns its whole row", () => {
    const solo: HelpCardContent[] = [
      { id: "account-access", title: "Account Access", paragraphs: [], cta: "" },
    ];
    render(<HelpCardLayoutEditor catalog={solo} onChange={() => {}} />);

    // One card fills the row: there is no edge to choose, so neither the
    // control nor its label is drawn.
    expect(
      screen.queryByText("Primary Card Positioning"),
    ).not.toBeInTheDocument();
  });

  it("offers 3 or 4 cards per row and reports the choice", async () => {
    const user = userEvent.setup();
    const onColumnsChange = vi.fn();
    render(
      <HelpCardLayoutEditor
        onChange={() => {}}
        columns={3}
        onColumnsChange={onColumnsChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: "3 cards per row" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "4 cards per row" }));

    expect(onColumnsChange).toHaveBeenCalledWith(4);
    // The choice is separate from the layout: nothing about the card order moved.
    expect(onColumnsChange).toHaveBeenCalledTimes(1);
  });

  it("draws the slot mirror with four columns, capped at two per card", () => {
    render(
      <HelpCardLayoutEditor
        onChange={() => {}}
        columns={4}
        onColumnsChange={() => {}}
      />,
    );

    const mirror = screen.getByTestId("help-card-slot-preview");
    expect(mirror).toHaveAttribute("data-columns", "4");
    expect(mirror.className).toContain("grid-cols-4");

    // With 4 across the Primary takes 2 of the 4 columns and no card — not even
    // in a short row — runs wider than that.
    for (const cell of Array.from(mirror.children) as HTMLElement[]) {
      expect(cell.className).not.toContain("col-span-3");
      expect(cell.className).not.toContain("col-span-4");
    }
    const first = mirror.children[0] as HTMLElement;
    expect(first.className).toContain("col-span-2");
  });

  it("makes the preview tiles draggable, a shade darker than the Primary", () => {
    render(<HelpCardLayoutEditor onChange={() => {}} />);

    // The preview is named, and says what the advisor can do with it.
    expect(screen.getByText("Card Layout Preview")).toBeInTheDocument();
    expect(screen.getByText("Drag to reorder")).toBeInTheDocument();

    const mirror = screen.getByTestId("help-card-slot-preview");
    const tiles = Array.from(mirror.children) as HTMLElement[];
    const primaryTile = tiles.find(
      (tile) => tile.dataset.mirrorCard === "account-access",
    );
    expect(primaryTile?.className).toContain("bg-blue-600");

    // Every other card is a drag handle in its own right, filled a shade darker
    // than the preview so the accent Primary still stands out.
    const standards = tiles.filter(
      (tile) => tile.dataset.mirrorCard !== "account-access",
    );
    expect(standards).toHaveLength(HELP_CARD_ORDER.length - 1);
    for (const tile of standards) {
      expect(tile.className).toContain("cursor-grab");
      expect(tile.className).toContain("bg-muted");
      expect(tile.className).not.toContain("bg-white");
      // A grip icon, so the tile LOOKS like something you can pick up.
      expect(tile.querySelector("svg")).not.toBeNull();
    }

    // The Primary is pinned: dropping ON it promotes another card, but it cannot
    // itself be dragged.
    expect(primaryTile?.className).not.toContain("cursor-grab");
  });

  it("leaves the preview read-only when Quick Access owns the order", () => {
    render(<HelpCardLayoutEditor allowReorder={false} onChange={() => {}} />);

    const mirror = screen.getByTestId("help-card-slot-preview");
    for (const tile of Array.from(mirror.children) as HTMLElement[]) {
      expect(tile.className).not.toContain("cursor-grab");
    }
    // No drag hint either — nothing here can be picked up.
    expect(screen.queryByText("Drag to reorder")).not.toBeInTheDocument();
  });

  it("mirrors two half-width rows when eight cards use 4 across", () => {
    const catalog: HelpCardContent[] = Array.from({ length: 8 }, (_, index) => ({
      id: `card-${index + 1}`,
      title: `Card ${index + 1}`,
      paragraphs: [],
      cta: "",
    }));

    render(
      <HelpCardLayoutEditor
        onChange={() => {}}
        catalog={catalog}
        columns={4}
        onColumnsChange={() => {}}
      />,
    );

    const mirror = screen.getByTestId("help-card-slot-preview");
    const cells = Array.from(mirror.children) as HTMLElement[];
    expect(cells).toHaveLength(8);
    // 2+2 / 2+2 / 1+1+1+1: the first four cards are each two columns wide.
    expect(
      cells
        .slice(0, 4)
        .every((cell) => cell.className.includes("col-span-2")),
    ).toBe(true);
    expect(
      cells
        .slice(4)
        .every((cell) => cell.className.includes("col-span-1")),
    ).toBe(true);
  });

  it("counts the visible cards above the list", () => {
    const { rerender } = render(<HelpCardLayoutEditor onChange={() => {}} />);
    expect(screen.getByTestId("help-card-layout-count")).toHaveTextContent(
      "7/8",
    );

    const hidden = setHelpCardEnabled(defaultHelpCardLayout(), "savings", false);
    rerender(<HelpCardLayoutEditor value={hidden} onChange={() => {}} />);
    expect(screen.getByTestId("help-card-layout-count")).toHaveTextContent(
      "6/8",
    );
  });

  it("offers Move to Quick Answers per placement card, never for Account Access", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(
      <HelpCardLayoutEditor onChange={() => {}} onMoveToQuickAnswers={onMove} />,
    );

    // Account Access is synthesised from the catalog, not a placement.
    expect(
      within(row("account-access")).queryByRole("button", {
        name: "Move to Quick Answers",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      within(row("savings")).getByRole("button", {
        name: "Move to Quick Answers",
      }),
    );
    expect(onMove).toHaveBeenCalledWith("savings");
  });

  it("hides Move to Quick Answers when the host has no board", () => {
    render(<HelpCardLayoutEditor onChange={() => {}} />);

    expect(
      screen.queryByRole("button", { name: "Move to Quick Answers" }),
    ).not.toBeInTheDocument();
  });

  it("hides the cards-per-row control when the host cannot store it", () => {
    render(<HelpCardLayoutEditor onChange={() => {}} />);

    expect(
      screen.queryByRole("button", { name: "4 cards per row" }),
    ).not.toBeInTheDocument();
  });

  it("fills [Benefit Category] with the benefit being edited", () => {
    render(
      <HelpCardLayoutEditor category="Retirement" onChange={() => {}} />,
    );

    expect(
      within(row("account-access")).getByText("Retirement Account Access"),
    ).toBeInTheDocument();
    // The slot mirror shows the same resolved title.
    expect(
      within(screen.getByTestId("help-card-slot-preview")).getByText(
        "Retirement Account Access",
      ),
    ).toBeInTheDocument();
  });

  it("gives every card a show/hide checkbox, ticked by default", () => {
    render(<HelpCardLayoutEditor onChange={() => {}} />);

    const boxes = screen.getAllByRole("checkbox");

    expect(boxes).toHaveLength(HELP_CARD_ORDER.length);
    expect(
      boxes.every((box) => box.getAttribute("aria-checked") === "true"),
    ).toBe(true);
  });

  it("unticking a card hides it without moving it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HelpCardLayoutEditor onChange={onChange} />);

    await user.click(within(row("medicare")).getByRole("checkbox"));

    const layout = layoutOf(onChange);
    expect(layout.map((entry) => entry.id)).toEqual(HELP_CARD_ORDER);
    expect(layout.find((entry) => entry.id === "medicare")).toEqual({
      id: "medicare",
      enabled: false,
    });
  });

  it("leaves a hidden card out of the slot mirror and marks its row", () => {
    render(
      <HelpCardLayoutEditor
        value={setHelpCardEnabled(defaultHelpCardLayout(), "medicare", false)}
        onChange={() => {}}
      />,
    );

    // The mirror shows exactly what the hub will render.
    expect(screen.getByTestId("help-card-slot-preview").children).toHaveLength(
      HELP_CARD_ORDER.length - 1,
    );
    expect(within(row("medicare")).getByText(/Hidden/)).toBeInTheDocument();
  });

  it("hides the Left/Right control when the primary fills row 1", () => {
    // A lone visible card owns the whole row, where it spans all three columns —
    // there is no edge left to choose.
    const loneCard = HELP_CARD_ORDER.filter(
      (id) => id !== "account-access",
    ).reduce(
      (layout, id) => setHelpCardEnabled(layout, id, false),
      defaultHelpCardLayout(),
    );
    render(<HelpCardLayoutEditor value={loneCard} onChange={() => {}} />);

    expect(
      screen.queryByRole("button", { name: /^left$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^right$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(row("account-access")).getByText(/Row 1 · 3\/3 wide · Primary/),
    ).toBeInTheDocument();
  });

  it("keeps the Left/Right control while row 1 holds more than the primary", () => {
    render(<HelpCardLayoutEditor onChange={() => {}} />);

    expect(screen.getByRole("button", { name: /^left$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^right$/i }),
    ).toBeInTheDocument();
  });

  it("draws a stored right-edge primary as the second row-1 card", () => {
    render(
      <HelpCardLayoutEditor
        value={setHelpCardSide(defaultHelpCardLayout(), "right")}
        onChange={() => {}}
      />,
    );

    const rows = Array.from(
      document.querySelectorAll<HTMLElement>("[data-help-layout-card]"),
    );
    expect(rows[1].dataset.helpLayoutCard).toBe("account-access");
    expect(rows[1].dataset.primary).toBe("true");
    expect(within(rows[1]).getByText(/Row 1 · 2\/3 wide · Primary/)).toBeInTheDocument();
  });
});

/**
 * On a plan driven by placements, the Featured list in Quick Access is what decides
 * which cards exist. This control has to list exactly those cards — never a catalog
 * card the advisor has since demoted — and leave membership and order to Quick Access.
 */
describe("HelpCardLayoutEditor with the plan's own cards", () => {
  const catalog: HelpCardContent[] = [
    {
      id: "account-access",
      title: "[Benefit Category] Account Access",
      paragraphs: ["Your plan's login."],
      cta: "",
    },
    {
      id: "find-care-providers",
      title: "Find Care",
      paragraphs: [],
      cta: "",
    },
    {
      id: "mental-health-care",
      title: "Mental Health Care",
      paragraphs: [],
      cta: "",
    },
  ];

  it("lists the plan's cards, dropping a stale stored id", () => {
    render(
      <HelpCardLayoutEditor
        catalog={catalog}
        // The stored layout still names a card that is no longer Featured.
        value={[
          { id: "account-access", primary: true },
          { id: "savings" },
          { id: "find-care-providers" },
        ]}
        onChange={() => {}}
      />,
    );

    const rows = Array.from(
      document.querySelectorAll<HTMLElement>("[data-help-layout-card]"),
    );
    expect(rows.map((element) => element.dataset.helpLayoutCard)).toEqual([
      "account-access",
      "find-care-providers",
      "mental-health-care",
    ]);
  });

  it("leaves membership and order to Quick Access", () => {
    render(
      <HelpCardLayoutEditor
        catalog={catalog}
        onChange={() => {}}
        showEnabledToggle={false}
        allowReorder={false}
      />,
    );

    // No show/hide switch, and no drag handle on any row.
    expect(document.querySelectorAll('[data-testid^="help-card-enabled-"]')).toHaveLength(
      0,
    );
    expect(
      screen.queryByRole("button", { name: /Reorder/ }),
    ).not.toBeInTheDocument();
    // Choosing the primary is still this control's job.
    expect(
      within(row("find-care-providers")).getByRole("button", {
        name: "Make primary",
      }),
    ).toBeInTheDocument();
  });

  it("makes a promoted card primary", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <HelpCardLayoutEditor
        catalog={catalog}
        onChange={onChange}
        showEnabledToggle={false}
        allowReorder={false}
      />,
    );

    await user.click(
      within(row("mental-health-care")).getByRole("button", {
        name: "Make primary",
      }),
    );

    const layout = layoutOf(onChange);
    expect(layout.find((entry) => entry.primary)?.id).toBe("mental-health-care");
    expect(layout.map((entry) => entry.id)).toContain("find-care-providers");
  });
});
