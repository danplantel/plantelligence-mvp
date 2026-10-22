import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HowCanWeHelpSection,
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
      const button = within(element).getByRole("button", { name: /Learn more/ });
      expect(button).toHaveStyle({ backgroundColor: "#654321" });
    }
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
});

describe("HowCanWeHelpSection expansion", () => {
  it("opens Rollovers beneath the first row on first paint", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(
      screen.getByRole("region", { name: "Rollovers & Distributions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Transitioning to a new employer?"),
    ).toBeInTheDocument();
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
      within(tile(container, "two")).getByRole("button", { name: /Learn more/ }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});

describe("HowCanWeHelpSection CTAs", () => {
  it("prefixes an internal link with the plan path", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[card({ cta: "Learn more", href: "/retirement" })]}
      />,
    );

    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "/plan-1/retirement",
    );
  });

  it("opens an external link in a new tab and adds the scheme", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[card({ cta: "Visit", href: "acme.test/planning" })]}
      />,
    );

    const link = screen.getByRole("link", { name: "Visit" });
    expect(link).toHaveAttribute("href", "https://acme.test/planning");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders an inert button when the CTA has no link", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[card({ cta: "Learn more" })]}
      />,
    );

    // Scoped to the panel: the tile has its own "Learn more" button.
    const panel = screen.getByRole("region", {
      name: "Rollovers & Distributions",
    });
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
