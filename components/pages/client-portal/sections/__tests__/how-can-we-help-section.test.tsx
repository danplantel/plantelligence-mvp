import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HowCanWeHelpSection,
  computeCaretPosition,
  formatPlanGroupIdLabel,
  type HelpCardData,
} from "../how-can-we-help-section";

/**
 * "How Can We Help You Today?" — the expandable topic grid.
 *
 * Layout contract: the section fills the viewport, row 1 is `2/4 + 1/4 + 1/4`
 * (Account Access is the wide slot), later rows are `4 × 1/4`, and a card's detail
 * panel opens directly beneath the row it belongs to. Rollovers & Distributions is
 * open on first paint, and the topic tiles end in a secondary-coloured "Learn more"
 * Button.
 *
 * The wide Account Access card is NOT a topic tile: it mirrors the Insurance Benefits
 * Access & Materials hero — plan / group ID, the administering provider, and the
 * Register / Login CTA — and never opens a panel.
 */

let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
});

function card(overrides: Partial<HelpCardData> = {}): HelpCardData {
  return {
    id: "rollovers-distributions",
    title: "Rollovers & Distributions",
    paragraphs: ["Rollover paragraph."],
    cta: "",
    ...overrides,
  };
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
  it("renders the heading in the plan's brand colour", () => {
    render(<HowCanWeHelpSection brandColor="#123456" />);

    expect(
      screen.getByRole("heading", { name: "How Can We Help You Today?" }),
    ).toHaveStyle({ color: "#123456" });
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

  it("renders the seven topics in grid order", () => {
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

  it("gives the first tile the wide 2/4 slot and the rest a single column", () => {
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    const [wide, ...narrow] = tiles(container);
    expect(wide.className).toContain("col-span-2");
    expect(narrow.every((element) => !element.className.includes("col-span-2"))).toBe(
      true,
    );
  });

  it("fills [Benefit Category] with the hub's category in the wide slot", () => {
    const { container } = render(
      <HowCanWeHelpSection clientId="plan-1" category="Retirement" />,
    );

    expect(
      within(tiles(container)[0]).getByRole("heading", {
        name: "Retirement Account Access",
      }),
    ).toBeInTheDocument();
  });

  it("drops the token rather than showing a placeholder when no category is known", () => {
    const { container } = render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(
      within(tiles(container)[0]).getByRole("heading", {
        name: "Account Access",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\[Benefit Category\]/)).not.toBeInTheDocument();
  });

  it("fills the token in an advisor-configured card too", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Group Health"
        cards={[
          card({
            id: "account-access",
            title: "[Benefit Category] Account Access",
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Group Health Account Access" }),
    ).toBeInTheDocument();
  });

  it("shows the given cards instead of the fallbacks", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[
          card({ id: "a", title: "First" }),
          card({ id: "b", title: "Second" }),
          card({ id: "c", title: "Third" }),
          card({ id: "d", title: "Fourth" }),
        ]}
      />,
    );

    expect(tiles(container)).toHaveLength(4);
    expect(screen.queryByText(/Account Access/)).not.toBeInTheDocument();
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

  it("leaves a tile without body text to its title only", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[
          card({ id: "account-access", title: "Account Access" }),
          card({ id: "plain", title: "Plain", body: undefined }),
        ]}
      />,
    );

    const plainTile = tile(container, "plain");
    expect(
      within(plainTile).getByRole("heading", { name: "Plain" }),
    ).toBeInTheDocument();
    // No body line — only the heading and the Learn more button live in the tile.
    expect(plainTile.querySelectorAll("p").length).toBe(0);
  });

  it("gives every topic tile a secondary-coloured Learn more button", () => {
    const { container } = render(
      <HowCanWeHelpSection clientId="plan-1" secondaryColor="#654321" />,
    );

    // The wide Account Access card carries the Register / Login CTA instead.
    const topicTiles = tiles(container).filter(
      (element) => element.dataset.helpCard !== "account-access",
    );

    expect(topicTiles).toHaveLength(6);
    for (const element of topicTiles) {
      // The open card reads "Showing Below"; every other tile reads "Learn more".
      const button = within(element).getByRole("button", {
        name: /Learn more|Showing Below/,
      });
      expect(button).toHaveStyle({ backgroundColor: "#654321" });
    }
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
 * The wide card is the Insurance Benefits Access & Materials hero, condensed: the
 * same plan / group ID, provider, feature list and Register / Login destination.
 */
describe("HowCanWeHelpSection account access card", () => {
  it("offers a Register or Login Here button instead of Learn more", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Retirement"
        secondaryColor="#654321"
      />,
    );

    const account = tile(container, "account-access");
    const button = within(account).getByRole("button", {
      name: /Register or Login Here/,
    });

    expect(button).toHaveStyle({ backgroundColor: "#654321" });
    expect(
      within(account).queryByRole("button", { name: /Learn more/ }),
    ).not.toBeInTheDocument();
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
      <HowCanWeHelpSection
        clientId="plan-1"
        // The first card is always the wide Account Access card, so the topic under
        // test has to be one of the later tiles.
        cards={[
          card({ id: "account-access", title: "Account Access" }),
          card({ id: "rollovers-distributions" }),
        ]}
        onCardEdit={onCardEdit}
      />,
    );

    await user.click(tile(container, "rollovers-distributions"));

    expect(onCardEdit).toHaveBeenCalledWith("rollovers-distributions");
  });

  it("marks the open tile with aria-expanded", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[
          card({ id: "account-access", title: "Account Access" }),
          card({ id: "one", title: "One" }),
          card({ id: "two", title: "Two" }),
        ]}
      />,
    );

    const firstButton = within(tile(container, "one")).getByRole("button", {
      name: /Learn more/,
    });
    expect(firstButton).toHaveAttribute("aria-expanded", "false");

    await user.click(tile(container, "two"));

    expect(
      within(tile(container, "two")).getByRole("button", {
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

describe("HowCanWeHelpSection CTAs", () => {
  /** Opens a non-Rollovers topic, whose panel still renders the card's own CTA. */
  async function openFinancialPlanning(overrides: Partial<HelpCardData> = {}) {
    const user = userEvent.setup();
    const utils = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[
          card({ id: "account-access", title: "Account Access" }),
          card({
            id: "financial-planning",
            title: "Financial Planning",
            ...overrides,
          }),
        ]}
      />,
    );
    await user.click(tile(utils.container, "financial-planning"));
    return utils;
  }

  it("prefixes an internal link with the plan path", async () => {
    await openFinancialPlanning({ cta: "Learn more", href: "/retirement" });

    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "/plan-1/retirement",
    );
  });

  it("opens an external link in a new tab and adds the scheme", async () => {
    await openFinancialPlanning({ cta: "Visit", href: "acme.test/planning" });

    const link = screen.getByRole("link", { name: "Visit" });
    expect(link).toHaveAttribute("href", "https://acme.test/planning");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders an inert button when the CTA has no link", async () => {
    await openFinancialPlanning({ cta: "Learn more" });

    // Scoped to the panel: the tile has its own "Learn more" button.
    const panel = screen.getByRole("region", { name: "Financial Planning" });
    expect(
      within(panel).getByRole("button", { name: "Learn more" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("draws no panel CTA when the card has no button text", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
