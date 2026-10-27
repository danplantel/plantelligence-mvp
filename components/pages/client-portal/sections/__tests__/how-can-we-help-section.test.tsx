import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HowCanWeHelpSection,
  computeCaretPosition,
  formatPlanGroupIdLabel,
} from "../how-can-we-help-section";
import { HELP_CARD_ORDER } from "@/lib/help-card-defaults";
import type { HelpCardLayoutEntry } from "@/types/benefit";
import type { EffectiveTopic } from "@/types/topic";

/**
 * "How Can We Help You Today?" — the expandable topic grid.
 *
 * Layout contract (see `lib/help-card-layout.ts`): the grid is 4 columns wide;
 * ONE card is primary and spans 2 columns; with the 7-card catalog that gives
 * row 1 = `2/4 + 1/4 + 1/4` and row 2 = `4 × 1/4`. The primary sits at the left
 * or right edge of row 1 only. A card's detail panel opens directly beneath the
 * row it belongs to, and Rollovers & Distributions is open on first paint.
 *
 * The copy is STATIC (`lib/help-card-defaults.ts`); a benefit stores only the
 * layout, so the tests drive `cards` with ids + the primary flag.
 */

let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
});

/** Build a layout in visual order, with `primaryId` at the chosen edge. */
function layoutWith(
  primaryId: string,
  side: "left" | "right" = "left",
  order: string[] = HELP_CARD_ORDER,
): HelpCardLayoutEntry[] {
  const rest = order.filter((id) => id !== primaryId);
  const ids =
    side === "left"
      ? [primaryId, ...rest]
      : [...rest.slice(0, 2), primaryId, ...rest.slice(2)];
  return ids.map((id) =>
    id === primaryId ? { id, primary: true } : { id },
  );
}

function tiles(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-help-card]"),
  );
}

function tile(container: HTMLElement, id: string) {
  const found = container.querySelector<HTMLElement>(`[data-help-card="${id}"]`);
  if (!found) throw new Error(`No tile for ${id}`);
  return found;
}

describe("HowCanWeHelpSection layout", () => {
  it("titles the section in gray-900, not the brand colour", () => {
    render(<HowCanWeHelpSection brandColor="#123456" />);

    const heading = screen.getByRole("heading", {
      name: "How Can We Help You Today?",
    });

    expect(heading.className).toContain("text-gray-900");
    expect(heading.getAttribute("style")).toBeNull();
  });

  it("exposes the anchor the header's Login button scrolls to", () => {
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(container.querySelector("section")).toHaveAttribute(
      "id",
      "how-can-we-help",
    );
  });

  it("fills the viewport", () => {
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(container.querySelector("section")).toHaveClass("min-h-screen");
  });

  it("renders the seven catalog cards in the default order", () => {
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(tiles(container).map((element) => element.dataset.helpCard)).toEqual([
      "account-access",
      "rollovers-distributions",
      "beneficiaries",
      "financial-planning",
      "social-security",
      "medicare",
      "savings",
    ]);
  });

  it("gives the primary card the 2/4 slot and every other card one column", () => {
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    const [primary, ...narrow] = tiles(container);
    expect(primary).toHaveAttribute("data-help-card", "account-access");
    expect(primary.className).toContain("col-span-2");
    expect(
      narrow.every((element) => !element.className.includes("col-span-2")),
    ).toBe(true);
  });

  it("does not render a card the advisor switched off", () => {
    const hidden = layoutWith("account-access", "left").map((entry) =>
      entry.id === "medicare" ? { ...entry, enabled: false } : entry,
    );
    const { container } = render(
      <HowCanWeHelpSection clientId="plan-1" cards={hidden} />,
    );

    expect(
      container.querySelector('[data-help-card="medicare"]'),
    ).not.toBeInTheDocument();
    expect(tiles(container).map((element) => element.dataset.helpCard)).toEqual(
      HELP_CARD_ORDER.filter((id) => id !== "medicare"),
    );
  });

  it("follows the saved order, not the catalog order", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={layoutWith("account-access", "left", [
          "account-access",
          "savings",
          "medicare",
          "social-security",
          "financial-planning",
          "beneficiaries",
          "rollovers-distributions",
        ])}
      />,
    );

    expect(tiles(container).map((element) => element.dataset.helpCard)).toEqual([
      "account-access",
      "savings",
      "medicare",
      "social-security",
      "financial-planning",
      "beneficiaries",
      "rollovers-distributions",
    ]);
  });

  it("can put the primary at the right edge of row 1", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={layoutWith("account-access", "right")}
      />,
    );

    const rendered = tiles(container);
    // Row 1 is the first three tiles; the primary is the last of them.
    expect(rendered[2]).toHaveAttribute("data-help-card", "account-access");
    expect(rendered[2].className).toContain("col-span-2");
    expect(rendered[0].className).not.toContain("col-span-2");
    expect(rendered[1].className).not.toContain("col-span-2");
  });

  it("lets a topic card be the primary and demotes Account Access to 1/4", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={layoutWith("rollovers-distributions")}
      />,
    );

    const primary = tile(container, "rollovers-distributions");
    expect(primary.className).toContain("col-span-2");

    const account = tile(container, "account-access");
    expect(account.className).not.toContain("col-span-2");
    expect(account.className).toContain("bg-white");
  });

  it("ignores copy stored on legacy card objects (the catalog owns the text)", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[
          // A legacy row: full card objects with old copy.
          {
            id: "account-access",
            title: "Chapter 1",
            paragraphs: ["Chapter 1 body."],
            cta: "",
            primary: true,
          } as any,
          {
            id: "rollovers-distributions",
            title: "Chapter 2",
            paragraphs: ["Chapter 2 body."],
            cta: "",
          } as any,
        ]}
      />,
    );

    expect(
      within(tile(container, "account-access")).getByRole("heading", {
        name: "Account Access",
      }),
    ).toBeInTheDocument();
    expect(
      within(tile(container, "rollovers-distributions")).getByRole("heading", {
        name: "Rollovers & Distributions",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chapter 1")).not.toBeInTheDocument();
  });

  it("fills [Benefit Category] with the hub's category", () => {
    render(<HowCanWeHelpSection clientId="plan-1" category="Retirement" />);

    expect(
      screen.getByRole("heading", { name: "Retirement Account Access" }),
    ).toBeInTheDocument();
  });

  it("drops the token rather than showing a placeholder when no category is known", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(
      screen.getByRole("heading", { name: "Account Access" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\[Benefit Category\]/)).not.toBeInTheDocument();
  });
});

describe("HowCanWeHelpSection tiles", () => {
  it("shows a card's body text on the tile", () => {
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(
      within(tile(container, "rollovers-distributions")).getByText(
        "Changing jobs? Compare your 4 options side by side.",
      ),
    ).toBeInTheDocument();
    expect(
      within(tile(container, "beneficiaries")).getByText(
        "Update your 401(k) and life insurance beneficiaries in one place.",
      ),
    ).toBeInTheDocument();
  });

  it("shows body text on the second row too", () => {
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    for (const [id, body] of [
      ["financial-planning", "Exclusive benefits for [Company Name] plan participants."],
      ["social-security", "See how your claiming age changes your monthly benefit."],
      ["medicare", "How Medicare works with your employer coverage, and when to enroll."],
      ["savings", "See how your contribution rate shapes your retirement income."],
    ] as const) {
      expect(within(tile(container, id)).getByText(body)).toBeInTheDocument();
    }
  });

  it("gives every card the same height floor", () => {
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    for (const element of tiles(container)) {
      expect(element.className).toContain("min-h-[180px]");
      expect(element.className).toContain("lg:min-h-[210px]");
    }
  });

  it("paints standard tiles white with a primary-coloured Learn more button", () => {
    const { container } = render(
      <HowCanWeHelpSection clientId="plan-1" brandColor="#654321" />,
    );

    // The primary Account Access tile carries the Register / Login CTA instead.
    const standardTiles = tiles(container).filter(
      (element) => element.dataset.helpCard !== "account-access",
    );

    expect(standardTiles).toHaveLength(6);
    for (const element of standardTiles) {
      expect(element.className).toContain("bg-white");
      // The open card reads "Showing Below"; every other tile "Learn more".
      const button = within(element).getByRole("button", {
        name: /Learn more|Showing Below/,
      });
      expect(button).toHaveStyle({ backgroundColor: "#654321" });
    }
  });

  it("fills the primary tile with the plan colour and inverts its button", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        brandColor="#654321"
        cards={layoutWith("rollovers-distributions")}
      />,
    );

    const primary = tile(container, "rollovers-distributions");
    expect(primary).toHaveStyle({ backgroundColor: "#654321" });
    // Inverse: the readable colour (white here) as the fill, the brand as the label.
    const button = within(primary).getByRole("button", {
      name: /Learn more|Showing Below/,
    });
    expect(button).toHaveStyle({ backgroundColor: "#ffffff", color: "#654321" });
  });

  it("tells the reader the open card's content is below", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    // Rollovers is open on first paint.
    expect(
      within(tile(container, "rollovers-distributions")).getByRole("button", {
        name: /Showing Below/,
      }),
    ).toBeInTheDocument();

    await user.click(tile(container, "medicare"));

    expect(
      within(tile(container, "medicare")).getByRole("button", {
        name: /Showing Below/,
      }),
    ).toBeInTheDocument();
    expect(
      within(tile(container, "rollovers-distributions")).getByRole("button", {
        name: /Learn more/,
      }),
    ).toBeInTheDocument();
  });
});

/**
 * The Account Access card is the Insurance Benefits Access & Materials hero,
 * condensed: plan / group ID, provider, feature list and the Register / Login
 * destination. It never opens a panel.
 */
describe("HowCanWeHelpSection account access card", () => {
  it("wears the inverse button while it is the primary tile", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Retirement"
        brandColor="#654321"
      />,
    );

    const account = tile(container, "account-access");
    const button = within(account).getByRole("button", {
      name: /Register or Login Here/,
    });

    expect(account).toHaveStyle({ backgroundColor: "#654321" });
    expect(button).toHaveStyle({ backgroundColor: "#ffffff", color: "#654321" });
    expect(
      within(account).queryByRole("button", { name: /Learn more/ }),
    ).not.toBeInTheDocument();
  });

  it("wears the brand button when another card is primary", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        brandColor="#654321"
        cards={layoutWith("rollovers-distributions")}
      />,
    );

    const account = tile(container, "account-access");
    const button = within(account).getByRole("button", {
      name: /Register or Login Here/,
    });

    expect(button).toHaveStyle({ backgroundColor: "#654321" });
  });

  it("opens the plan's login URL in a new tab", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        accountAccessHref="https://portal.example.com/login"
      />,
    );

    await user.click(
      within(tile(container, "account-access")).getByRole("button", {
        name: /Register or Login Here/,
      }),
    );

    expect(openSpy).toHaveBeenCalledWith(
      "https://portal.example.com/login",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("never opens a detail panel", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        accountAccessHref="https://portal.example.com/login"
      />,
    );

    await user.click(tile(container, "account-access"));

    expect(
      screen.queryByRole("region", { name: /Account Access/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the plan / group ID and the administering provider", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        planIdLabel="PLAN / GROUP ID: 1234-5678"
        provider={{
          companyName: "Empower Retirement",
          contactName: "Dana Reed",
          phone: "8005551212",
        }}
      />,
    );

    const account = tile(container, "account-access");
    expect(
      within(account).getByText("PLAN / GROUP ID: 1234-5678"),
    ).toBeInTheDocument();
    expect(within(account).getByText(/Administered by/)).toBeInTheDocument();
    expect(
      within(account).getByText("Empower Retirement"),
    ).toBeInTheDocument();
    expect(within(account).getByText(/Dana Reed/)).toBeInTheDocument();
  });

  it("lists what the login unlocks, like the hero", () => {
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    const account = tile(container, "account-access");
    for (const bullet of [
      "See coverage",
      "Get ID cards",
      "Make changes",
      "Update dependents",
    ]) {
      expect(within(account).getByText(bullet)).toBeInTheDocument();
    }
  });

  it("is inert, like the hero, when the plan has no login URL", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    await user.click(
      within(tile(container, "account-access")).getByRole("button", {
        name: /Register or Login Here/,
      }),
    );

    expect(openSpy).not.toHaveBeenCalled();
  });

  it("hides the plan / group ID line when the benefit has none", () => {
    const { container } = render(
      <HowCanWeHelpSection clientId="plan-1" category="Retirement" />,
    );

    expect(
      within(tile(container, "account-access")).queryByText(/PLAN \/ GROUP ID/),
    ).not.toBeInTheDocument();
  });
});

/**
 * The Plan / Group ID the benefit editor writes. Hub pages and the Step 2 preview
 * both format it with this helper and hand the result to the card AND the Access &
 * Materials hero, so the two can never disagree.
 */
describe("formatPlanGroupIdLabel", () => {
  it("prefixes the value the way the hero prints it", () => {
    expect(formatPlanGroupIdLabel("1234-5678")).toBe(
      "PLAN / GROUP ID: 1234-5678",
    );
  });

  it("trims the stored value", () => {
    expect(formatPlanGroupIdLabel("  1234-5678  ")).toBe(
      "PLAN / GROUP ID: 1234-5678",
    );
  });

  it("returns nothing for an unset value", () => {
    expect(formatPlanGroupIdLabel(undefined)).toBe("");
    expect(formatPlanGroupIdLabel(null)).toBe("");
    expect(formatPlanGroupIdLabel("   ")).toBe("");
  });

  it("drops the [Not Set] placeholder", () => {
    expect(formatPlanGroupIdLabel("[Not Set]")).toBe("");
    expect(formatPlanGroupIdLabel("PLAN / GROUP ID: [Not Set]")).toBe("");
  });
});

/**
 * The caret's position, as percentages of the grid container.
 *
 * Percentages are layout units, so the New / Edit Benefit preview — which renders
 * this section inside `transform: scale(<1>)` — cannot displace the caret, and no
 * scale has to be read at runtime.
 */
describe("computeCaretPosition", () => {
  it("centres on the card and the panel's top border", () => {
    expect(
      computeCaretPosition({
        containerRect: { left: 0, top: 0, width: 1000, height: 1000 },
        tileRect: { left: 100, width: 200 },
        panelRect: { top: 400 },
      }),
    ).toEqual({ xPercent: 20, yPercent: 40 });
  });

  it("is identical in a scaled preview", () => {
    // The same layout rendered at 0.5 scale: the rects halve, the ratios do not.
    expect(
      computeCaretPosition({
        containerRect: { left: 50, top: 20, width: 500, height: 500 },
        tileRect: { left: 150, width: 100 },
        panelRect: { top: 220 },
      }),
    ).toEqual({ xPercent: 30, yPercent: 40 });
  });

  it("falls back to the centre when the container is not measurable", () => {
    expect(
      computeCaretPosition({
        containerRect: { left: 0, top: 0, width: 0, height: 0 },
        tileRect: { left: 10, width: 20 },
        panelRect: { top: 40 },
      }),
    ).toEqual({ xPercent: 50, yPercent: 0 });
  });

  it("writes percentages onto the caret, so a scaled preview cannot shift it", () => {
    // Every rect reports HALF the layout, as a `transform: scale(0.5)` preview
    // would: 1000px of layout rendered as 500px.
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);
    const caret = screen.getByTestId("help-card-caret");
    const grid = caret.parentElement as HTMLElement;
    const openTile = tile(container, "rollovers-distributions");
    const panel = screen
      .getByRole("region", { name: /Rollovers & Distributions/ })
      .closest('[id^="help-card-"]') as HTMLElement;

    grid.getBoundingClientRect = () =>
      ({ left: 50, top: 20, width: 500, height: 500 }) as DOMRect;
    openTile.getBoundingClientRect = () =>
      ({ left: 150, top: 0, width: 100, height: 100 }) as DOMRect;
    panel.getBoundingClientRect = () =>
      ({ left: 0, top: 220, width: 500, height: 300 }) as DOMRect;

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // tile centre 200 − grid left 50 = 150 → 150/500 = 30%; panel 220 − 20 = 40%.
    expect(caret.style.left).toBe("30%");
    expect(caret.style.top).toBe("40%");
    expect(caret.style.opacity).toBe("1");
  });
});

describe("HowCanWeHelpSection expansion", () => {
  it("opens Rollovers beneath the first row on first paint", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(
      screen.getByRole("region", { name: "Rollovers & Distributions" }),
    ).toBeInTheDocument();
    // Rollovers renders its own body rather than the generic paragraph copy.
    expect(
      screen.getByRole("heading", {
        name: "Changing jobs? You have 4 options",
      }),
    ).toBeInTheDocument();
  });

  it("renders a second-row panel right below the phone line it belongs to", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    // Financial Planning is the first of the two cards sharing row 2's first phone
    // line, so the panel goes between that pair and the next pair.
    await user.click(tile(container, "financial-planning"));

    const grid = tile(container, "financial-planning").parentElement;
    expect(grid).not.toBeNull();
    const children = Array.from(grid!.children);
    const panel = screen
      .getByRole("region", { name: "Financial Planning" })
      .closest('[id^="help-card-"]');
    const panelIndex = children.indexOf(panel as Element);

    expect(panelIndex).toBeGreaterThan(-1);
    expect(children[panelIndex - 1]).toBe(tile(container, "social-security"));
    expect(children[panelIndex + 1]).toBe(tile(container, "medicare"));
  });

  it("puts a last-pair second-row panel after those cards", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    await user.click(tile(container, "savings"));

    const grid = tile(container, "savings").parentElement;
    const children = Array.from(grid!.children);
    const panel = screen
      .getByRole("region", { name: "How Much Should I Save?" })
      .closest('[id^="help-card-"]');

    expect(children[children.length - 1]).toBe(panel);
  });

  it("marks a second-row panel to move below the whole row on desktop", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    await user.click(tile(container, "financial-planning"));

    const panel = screen
      .getByRole("region", { name: "Financial Planning" })
      .closest('[id^="help-card-"]') as HTMLElement;

    expect(panel.className).toContain("col-span-2");
    expect(panel.className).toContain("lg:order-last");
  });

  it("keeps one caret that follows the selected card", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    const caret = screen.getByTestId("help-card-caret");
    expect(caret).toHaveAttribute("aria-hidden", "true");
    // The caret takes the same brand border as the open card and its panel.
    expect(caret.getAttribute("style")).toMatch(/rgb\(0,\s*43,\s*91\)/);

    await user.click(tile(container, "financial-planning"));

    // The SAME node is reused — that is what lets framer-motion animate it from
    // one card to the next instead of a new caret appearing in a new place.
    expect(screen.getByTestId("help-card-caret")).toBe(caret);
    expect(
      screen.getByRole("region", { name: "Financial Planning" }),
    ).toBeInTheDocument();
  });

  it("marks the panel's own border with the brand colour", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    const panel = screen.getByRole("region", {
      name: "Rollovers & Distributions",
    });
    expect(panel.getAttribute("style")).toMatch(/rgb\(0,\s*43,\s*91\)/);
  });

  it("moves the panel to the card that was clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    await user.click(tile(container, "financial-planning"));

    expect(
      screen.getByRole("region", { name: "Financial Planning" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Rollovers & Distributions" }),
    ).not.toBeInTheDocument();
  });

  it("takes the brand ring off the card that was open", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    // Rollovers is the default-open card, so it wears the ring on first paint.
    expect(
      tile(container, "rollovers-distributions").querySelector(
        "[data-help-card-ring]",
      ),
    ).not.toBeNull();

    await user.click(tile(container, "financial-planning"));

    // Only the newly opened card may look active: the ring is a child node, so it
    // is genuinely unmounted rather than left behind as a stale inline shadow.
    expect(
      tile(container, "rollovers-distributions").querySelector(
        "[data-help-card-ring]",
      ),
    ).toBeNull();
    expect(
      tile(container, "financial-planning").querySelector(
        "[data-help-card-ring]",
      ),
    ).not.toBeNull();
    expect(
      tile(container, "rollovers-distributions").getAttribute("style") ?? "",
    ).not.toMatch(/box-shadow/);
  });

  it("closes the open card's ring when it is clicked again", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    await user.click(tile(container, "rollovers-distributions"));

    expect(
      tile(container, "rollovers-distributions").querySelector(
        "[data-help-card-ring]",
      ),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Rollovers & Distributions" }),
    ).not.toBeInTheDocument();
  });

  it("opens a card when its Learn more button is pressed", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    await user.click(
      within(tile(container, "medicare")).getByRole("button", {
        name: /Learn more/,
      }),
    );

    expect(
      screen.getByRole("region", { name: "Turning 65: Medicare" }),
    ).toBeInTheDocument();
  });

  it("opens a primary topic card too", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={layoutWith("financial-planning")}
      />,
    );

    // Rollovers is still the card open on first paint, so this click opens the
    // primary topic rather than toggling it shut.
    await user.click(tile(container, "financial-planning"));

    expect(
      screen.getByRole("region", { name: "Financial Planning" }),
    ).toBeInTheDocument();
  });

  it("closes the panel when the open card is clicked again", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    await user.click(tile(container, "rollovers-distributions"));

    expect(
      screen.queryByRole("region", { name: "Rollovers & Distributions" }),
    ).not.toBeInTheDocument();
  });

  it("closes the panel from its own close button", async () => {
    const user = userEvent.setup();
    render(<HowCanWeHelpSection clientId="plan-1" />);

    await user.click(
      screen.getByRole("button", { name: "Close Rollovers & Distributions" }),
    );

    expect(
      screen.queryByRole("region", { name: "Rollovers & Distributions" }),
    ).not.toBeInTheDocument();
  });

  it("reports the clicked card to an edit host", async () => {
    const user = userEvent.setup();
    const onCardEdit = vi.fn();
    const { container } = render(
      <HowCanWeHelpSection clientId="plan-1" onCardEdit={onCardEdit} />,
    );

    await user.click(tile(container, "rollovers-distributions"));

    expect(onCardEdit).toHaveBeenCalledWith("rollovers-distributions");
  });

  it("marks the open tile with aria-expanded", async () => {
    const user = userEvent.setup();
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    const firstButton = within(tile(container, "savings")).getByRole("button", {
      name: /Learn more/,
    });
    expect(firstButton).toHaveAttribute("aria-expanded", "false");

    await user.click(tile(container, "medicare"));

    expect(
      within(tile(container, "medicare")).getByRole("button", {
        name: /Showing Below/,
      }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});

/**
 * Rollovers & Distributions has its own panel body: the four options, the pros and
 * cons of the selected option, and the "talk it through" CTA. It is open on first
 * paint, so most of these assertions need no interaction.
 */
describe("HowCanWeHelpSection rollovers panel", () => {
  it("lists the four options in order, numbered 01–04", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    const options = within(
      screen.getByTestId("rollover-options"),
    ).getAllByRole("button");

    expect(options).toHaveLength(4);
    [
      ["New Employer Plan", "01"],
      ["Roll Into an IRA", "02"],
      ["Leave It in the Old Plan", "03"],
      ["Cash Out", "04"],
    ].forEach(([title, number], index) => {
      expect(options[index]).toHaveTextContent(title);
      expect(options[index]).toHaveTextContent(number);
    });
  });

  it("hides the pros and cons until an option is selected", async () => {
    const user = userEvent.setup();
    render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(screen.queryByTestId("rollover-detail")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Roll Into an IRA/ }));

    const detail = screen.getByTestId("rollover-detail");
    expect(within(detail).getByText("Pros")).toBeInTheDocument();
    expect(within(detail).getByText("Cons")).toBeInTheDocument();
    expect(
      within(detail).getByText(/widest choice of investments/),
    ).toBeInTheDocument();
  });

  it("closes the pros and cons when the selected option is clicked again", async () => {
    const user = userEvent.setup();
    render(<HowCanWeHelpSection clientId="plan-1" />);

    const option = screen.getByRole("button", { name: /Cash Out/ });
    await user.click(option);
    expect(screen.getByTestId("rollover-detail")).toBeInTheDocument();

    await user.click(option);
    expect(screen.queryByTestId("rollover-detail")).not.toBeInTheDocument();
  });

  it("offers a free call with the banner's key contact", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(
      screen.getByRole("button", { name: "Talk through my options" }),
    ).toBeInTheDocument();
    // No portal provider in this test, so the fallback copy is used.
    expect(
      screen.getByText("Free call with your advisor"),
    ).toBeInTheDocument();
  });

  it("scrolls to the Have Questions band from Talk through my options", async () => {
    const user = userEvent.setup();
    const support = document.createElement("section");
    support.id = "have-questions";
    support.scrollIntoView = vi.fn();
    document.body.appendChild(support);

    render(<HowCanWeHelpSection clientId="plan-1" />);

    await user.click(
      screen.getByRole("button", { name: "Talk through my options" }),
    );

    expect(support.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    // It must no longer open the plan's appointment link.
    expect(openSpy).not.toHaveBeenCalled();

    support.remove();
  });
});

describe("HowCanWeHelpSection panel CTAs", () => {
  it("draws no panel CTA for the static catalog (every card has no button text)", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    // The catalog ships `cta: ""`, so panels show copy only. A CTA is drawn only
    // for a catalog card that sets one.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Rollovers & Distributions" }),
      ).queryByRole("link"),
    ).not.toBeInTheDocument();
  });

  it("draws the Rollovers CTA once when the topic repeats the label", () => {
    // The library seeds this topic's `cta.label` as the very same string the
    // Rollovers body prints in its own footer, so the panel must suppress one of
    // them — otherwise a portal plan shows two identical buttons, while the
    // catalog-driven preview (no `cta`) shows one.
    const rollovers: EffectiveTopic = {
      topicId: "topic-rollovers",
      placementId: "placement-rollovers",
      slug: "rollovers-distributions",
      location: "retirement",
      displayMode: "featured",
      title: "Rollovers & Distributions",
      bodyBlocks: [],
      tags: [],
      isActionHub: false,
      cta: {
        label: "Talk through my options",
        actionType: "external_url",
        destination: "https://example.com/schedule",
      },
      sortOrder: 0,
    };

    render(<HowCanWeHelpSection clientId="plan-1" topics={[rollovers]} />);

    expect(
      screen.getAllByRole("button", { name: "Talk through my options" }),
    ).toHaveLength(1);
    // The suppressed one is the generic `cta` link, not the footer button.
    expect(
      screen.queryByRole("link", { name: "Talk through my options" }),
    ).not.toBeInTheDocument();
    // The footer button keeps the "free call" line that identifies its owner.
    expect(screen.getByText("Free call with your advisor")).toBeInTheDocument();
  });
});
