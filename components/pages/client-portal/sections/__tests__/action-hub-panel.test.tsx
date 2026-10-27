import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionHubPanel } from "@/components/pages/client-portal/sections/action-hub-panel";
import type { ActionHubRow } from "@/types/topic";

/**
 * TF-5 · the participant's Action Hub panel.
 *
 * The DECISION (which rows survive, and whether the panel collapses to one link) is
 * covered by `lib/topics/__tests__/action-hub.test.ts`. What is asserted here is what
 * a participant actually gets: nothing at all when there is no destination, one button
 * when there is one, and a row per benefit when there are several.
 */

function row(overrides: Partial<ActionHubRow> = {}): ActionHubRow {
  return {
    location: "retirement",
    label: "Retirement",
    href: "https://voya.test/beneficiaries",
    external: true,
    source: "provider",
    ...overrides,
  };
}

const BRAND = "#0F3D2E";

describe("ActionHubPanel", () => {
  it("renders nothing at all when there is no destination", () => {
    const { container } = render(
      <ActionHubPanel rows={[]} brandColor={BRAND} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when rows are absent", () => {
    const { container } = render(<ActionHubPanel brandColor={BRAND} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("links straight at the only row, labelled by the topic's CTA", () => {
    render(
      <ActionHubPanel
        rows={[row()]}
        brandColor={BRAND}
        ctaLabel="Update my beneficiaries"
      />,
    );

    const link = screen.getByRole("link", { name: /update my beneficiaries/i });
    expect(link).toHaveAttribute("href", "https://voya.test/beneficiaries");
    expect(link).toHaveAttribute("target", "_blank");
    // No panel: a single row must not become a one-item chooser.
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("falls back to the row's own label when the topic has no CTA", () => {
    render(<ActionHubPanel rows={[row()]} brandColor={BRAND} />);

    expect(screen.getByRole("link", { name: /retirement/i })).toBeInTheDocument();
  });

  it("lists one row per benefit as soon as there is a choice", () => {
    render(
      <ActionHubPanel
        rows={[
          row(),
          row({
            location: "group_life",
            label: "Group Life",
            href: "https://metlife.test/beneficiaries",
          }),
        ]}
        brandColor={BRAND}
        ctaLabel="Update my beneficiaries"
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Retirement",
      "Group Life",
    ]);
    expect(links[1]).toHaveAttribute("href", "https://metlife.test/beneficiaries");
  });

  it("prefixes an in-portal destination with the plan slug", () => {
    render(
      <ActionHubPanel
        rows={[row({ href: "/life-insurance", external: false })]}
        brandColor={BRAND}
        basePath="/acme"
      />,
    );

    const link = screen.getByRole("link", { name: /retirement/i });
    expect(link).toHaveAttribute("href", "/acme/life-insurance");
    // Staying in the portal means staying in the tab.
    expect(link).not.toHaveAttribute("target");
  });

  it("does not double the prefix on a path that already carries it", () => {
    render(
      <ActionHubPanel
        rows={[row({ href: "/acme/life-insurance", external: false })]}
        brandColor={BRAND}
        basePath="/acme"
      />,
    );

    expect(screen.getByRole("link", { name: /retirement/i })).toHaveAttribute(
      "href",
      "/acme/life-insurance",
    );
  });

  it("opens a mailto: row without a new tab", () => {
    render(
      <ActionHubPanel
        rows={[row({ href: "mailto:help@voya.test", external: false })]}
        brandColor={BRAND}
      />,
    );

    const link = screen.getByRole("link", { name: /retirement/i });
    expect(link).toHaveAttribute("href", "mailto:help@voya.test");
    expect(link).not.toHaveAttribute("target");
  });
});
