import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { HowCanWeHelpSection } from "../how-can-we-help-section";
import { ACCOUNT_ACCESS_CARD_ID } from "@/lib/help-card-defaults";
import type { EffectiveTopic } from "@/types/topic";

/**
 * The Featured grid, driven by PLACEMENTS instead of the static catalog (TF-2).
 *
 * What changes when `topics` is supplied:
 *  - the tiles are the plan's featured topics, in placement order;
 *  - Account Access is still the primary, synthesised from the catalog, because it
 *    is not a topic until TF-9;
 *  - the legacy `cards` layout is ignored.
 *
 * Card WIDTH is a property of the row, not of the card: each row's four columns are
 * divided between whatever cards it holds, so the grid never trails off into white
 * space. A plan with one featured topic therefore gets two half-width cards, and a
 * plan with four gets a full-width Account Access row above four quarter tiles.
 *
 * Everything else — the caret, inline expansion, the Rollovers body — is unchanged and
 * covered by the original suite.
 */

function featured(
  slug: string,
  title: string,
  overrides: Partial<EffectiveTopic> = {},
): EffectiveTopic {
  return {
    topicId: `topic-${slug}`,
    placementId: `placement-${slug}`,
    slug,
    location: "retirement",
    displayMode: "featured",
    title,
    bodyBlocks: [{ type: "quick_answer", text: `${title} answer.` }],
    tags: [],
    isActionHub: false,
    groupId: null,
    sortOrder: 0,
    ...overrides,
  };
}

function tiles(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-help-card]"),
  );
}

afterEach(() => {
  window.history.replaceState(null, "", "/acme/retirement");
});

describe("HowCanWeHelpSection with placements", () => {
  it("renders the plan's featured topics instead of the catalog", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Retirement"
        topics={[
          featured("sys.financial-planning", "Financial Planning"),
          featured("sys.plan-materials", "Plan Materials"),
        ]}
      />,
    );

    const order = tiles(container).map((tile) =>
      tile.getAttribute("data-help-card"),
    );

    expect(order).toEqual([
      ACCOUNT_ACCESS_CARD_ID,
      "sys.financial-planning",
      "sys.plan-materials",
    ]);
    // A catalog card the plan does not place must not appear.
    expect(container.querySelector('[data-help-card="medicare"]')).toBeNull();
  });

  it("splits a two-card row between Account Access and the topic", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Retirement"
        topics={[featured("sys.financial-planning", "Financial Planning")]}
      />,
    );

    const access = container.querySelector<HTMLElement>(
      `[data-help-card="${ACCOUNT_ACCESS_CARD_ID}"]`,
    );
    const topic = container.querySelector<HTMLElement>(
      '[data-help-card="sys.financial-planning"]',
    );

    // Two cards, four columns: half each, so the row reaches the right edge.
    expect(access?.className).toContain("col-span-2");
    expect(topic?.className).toContain("col-span-2");
  });

  it("renders the advisor's saved card layout instead of the placements", () => {
    // Section 6 arranged five cards and hid the rest. The plan ALSO has featured
    // placements — but the portal must render the layout the preview showed, not a
    // longer placement-driven grid that re-flows the primary to 2/4.
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Retirement"
        cards={[
          { id: ACCOUNT_ACCESS_CARD_ID, primary: true },
          { id: "financial-planning" },
          { id: "beneficiaries" },
          { id: "social-security" },
          { id: "savings" },
          // Hidden in Section 6 — the layout keeps their slots, the grid drops them.
          { id: "rollovers-distributions", enabled: false },
          { id: "medicare", enabled: false },
        ]}
        topics={[
          featured("sys.rollovers-distributions", "Rollovers & Distributions"),
          featured("sys.plan-materials", "Plan Materials"),
        ]}
      />,
    );

    expect(
      tiles(container).map((tile) => tile.getAttribute("data-help-card")),
    ).toEqual([
      ACCOUNT_ACCESS_CARD_ID,
      "financial-planning",
      "beneficiaries",
      "social-security",
      "savings",
    ]);
    // Five cards, so the primary owns row 1 alone at full width — the shape the
    // editor showed.
    expect(tiles(container)[0].className).toContain("lg:col-span-4");
  });

  it("gives Account Access the whole first row when that is what fills it", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Retirement"
        topics={[
          featured("sys.financial-planning", "Financial Planning"),
          featured("sys.plan-materials", "Plan Materials"),
          featured("sys.beneficiaries", "Update My Beneficiaries"),
          featured("sys.rollovers-distributions", "Rollovers & Distributions"),
        ]}
      />,
    );

    // Five cards: the primary takes row 1 alone at full width, and the other four
    // take one column each beneath it. Neither row is left with a gap.
    const access = container.querySelector<HTMLElement>(
      `[data-help-card="${ACCOUNT_ACCESS_CARD_ID}"]`,
    );
    expect(access?.className).toContain("lg:col-span-4");

    // One grid element per row, in DOM order.
    const rowGrids = Array.from(
      new Set(
        Array.from(container.querySelectorAll("[data-help-card]")).map(
          (element) => element.parentElement as HTMLElement,
        ),
      ),
    );
    expect(rowGrids).toHaveLength(2);
    expect(rowGrids[0].querySelectorAll("[data-help-card]")).toHaveLength(1);

    const secondRow = Array.from(
      rowGrids[1].querySelectorAll<HTMLElement>("[data-help-card]"),
    );
    expect(secondRow).toHaveLength(4);
    secondRow.forEach((rowTile) => {
      expect(rowTile.className).toContain("col-span-1");
      expect(rowTile.className).not.toContain("lg:col-span-2");
    });
  });

  it("shows the topic's summary on the tile, not the catalog copy", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Retirement"
        topics={[
          featured("sys.financial-planning", "Financial Planning", {
            summary: "A planning process built around your goals.",
          }),
        ]}
      />,
    );

    expect(
      screen.getByText("A planning process built around your goals."),
    ).toBeInTheDocument();
  });

  it("falls back to the saved legacy layout when no placements are supplied", () => {
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Retirement"
        cards={[{ id: ACCOUNT_ACCESS_CARD_ID, primary: true }, { id: "medicare" }]}
      />,
    );

    expect(
      container.querySelector('[data-help-card="medicare"]'),
    ).not.toBeNull();
  });

  it("opens the topic named in the URL hash", async () => {
    window.history.replaceState(
      null,
      "",
      "/acme/retirement#financial-planning",
    );

    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Retirement"
        topics={[
          featured("sys.rollovers-distributions", "Rollovers & Distributions"),
          featured("sys.financial-planning", "Financial Planning"),
        ]}
      />,
    );

    // Rollovers is open by default; the deep link moves the panel to the named topic.
    expect(
      await screen.findByRole("region", { name: "Financial Planning" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Rollovers & Distributions" }),
    ).not.toBeInTheDocument();
  });

  it("writes the opened topic's slug into the URL, without the namespace", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HowCanWeHelpSection
        clientId="plan-1"
        category="Retirement"
        topics={[featured("sys.financial-planning", "Financial Planning")]}
      />,
    );

    const tile = container.querySelector<HTMLElement>(
      '[data-help-card="sys.financial-planning"]',
    );
    if (!tile) throw new Error("No financial-planning tile");
    await user.click(tile);

    expect(window.location.hash).toBe("#financial-planning");
  });
});
