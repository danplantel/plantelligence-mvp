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

  it("pins the primary (no drag handle) and lets the standards be reordered", () => {
    render(<HelpCardLayoutEditor onChange={() => {}} />);

    expect(
      within(row("account-access")).queryByRole("button", {
        name: /Reorder/,
      }),
    ).not.toBeInTheDocument();
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
    expect(layout[2]).toEqual({ id: "account-access", primary: true });
    expect(layout.filter((entry) => entry.primary)).toHaveLength(1);
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
    // Five visible cards leave the primary alone in row 1, where it spans all
    // four columns — there is no edge left to choose.
    const fiveCards = setHelpCardEnabled(
      setHelpCardEnabled(defaultHelpCardLayout(), "medicare", false),
      "savings",
      false,
    );
    render(<HelpCardLayoutEditor value={fiveCards} onChange={() => {}} />);

    expect(
      screen.queryByRole("button", { name: /^left$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^right$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(row("account-access")).getByText(/Row 1 · 4\/4 wide · Primary/),
    ).toBeInTheDocument();
  });

  it("keeps the Left/Right control while row 1 holds more than the primary", () => {
    render(<HelpCardLayoutEditor onChange={() => {}} />);

    expect(screen.getByRole("button", { name: /^left$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^right$/i }),
    ).toBeInTheDocument();
  });

  it("draws a stored right-edge primary as the third row-1 card", () => {
    render(
      <HelpCardLayoutEditor
        value={setHelpCardSide(defaultHelpCardLayout(), "right")}
        onChange={() => {}}
      />,
    );

    const rows = Array.from(
      document.querySelectorAll<HTMLElement>("[data-help-layout-card]"),
    );
    expect(rows[2].dataset.helpLayoutCard).toBe("account-access");
    expect(rows[2].dataset.primary).toBe("true");
    expect(within(rows[2]).getByText(/Row 1 · 2\/4 wide · Primary/)).toBeInTheDocument();
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
