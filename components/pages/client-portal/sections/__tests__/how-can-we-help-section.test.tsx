import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  HowCanWeHelpSection,
  type HelpCardData,
} from "../how-can-we-help-section";

/**
 * "How Can We Help You Today?" — the card row under the hub welcome banner.
 *
 * Each card is authored in the Benefits wizard, so the section has to cope with
 * three shapes of CTA: a portal-relative path (navigates in-app, prefixed with
 * the plan), an external address (new tab, scheme added when missing), and an
 * anchor/mailto/tel (handled in place). A card with no CTA still reserves the
 * button slot so every card keeps the same height.
 *
 * With no cards configured it falls back to the three defaults — whose CTAs are
 * deliberately empty, so nothing renders a button nobody wrote.
 */

function card(overrides: Partial<HelpCardData> = {}): HelpCardData {
  return {
    id: "card-1",
    title: "Financial Planning",
    paragraphs: ["A paragraph about planning."],
    cta: "Learn more",
    ...overrides,
  };
}

describe("HowCanWeHelpSection", () => {
  it("renders the three fallback cards when none are configured", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(
      screen.getByRole("heading", { name: "How Can We Help You Today?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Access My Retirement Account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Financial Planning" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Rollovers & Distributions" }),
    ).toBeInTheDocument();
  });

  it("hides the CTA slot for the fallback cards, which have no copy", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the cards it was given instead of the defaults", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[
          card(),
          card({ id: "card-2", title: "Rollovers", paragraphs: ["Second."] }),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Financial Planning" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Rollovers" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Access My Retirement Account" }),
    ).not.toBeInTheDocument();
  });

  it("renders the bold intro and every paragraph", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[
          card({
            introBold: "Transitioning?",
            paragraphs: ["First paragraph.", "Second paragraph."],
          }),
        ]}
      />,
    );

    expect(screen.getByText("Transitioning?")).toBeInTheDocument();
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
  });

  it("prefixes an internal CTA with the plan path", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[card({ href: "/retirement" })]}
      />,
    );

    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "/plan-1/retirement",
    );
  });

  it("opens an external CTA in a new tab and adds the scheme", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[card({ href: "acme.test/planning" })]}
      />,
    );

    const link = screen.getByRole("link", { name: "Learn more" });
    expect(link).toHaveAttribute("href", "https://acme.test/planning");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps an anchor, mailto or tel in place", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[card({ href: "mailto:help@acme.test" })]}
      />,
    );

    const link = screen.getByRole("link", { name: "Learn more" });
    expect(link).toHaveAttribute("href", "mailto:help@acme.test");
    expect(link).not.toHaveAttribute("target");
  });

  it("renders an inert button when the CTA has no href", () => {
    render(<HowCanWeHelpSection clientId="plan-1" cards={[card()]} />);

    expect(
      screen.getByRole("button", { name: "Learn more" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("reports the card that was clicked in edit mode", async () => {
    const user = userEvent.setup();
    const onCardEdit = vi.fn();
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[card({ id: "rollovers" })]}
        onCardEdit={onCardEdit}
      />,
    );

    await user.click(
      screen.getByRole("heading", { name: "Financial Planning" }),
    );

    expect(onCardEdit).toHaveBeenCalledWith("rollovers");
  });
});
