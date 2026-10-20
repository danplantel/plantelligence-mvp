import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Footer } from "../footer";

/**
 * `Footer` is the portal's trust bar: the three-column block, the disclosures
 * and the copyright. The portal layout resolves the disclaimer text and passes
 * it here, so this suite is about what the footer does with that text — the
 * part the layout cannot see:
 *
 *  - placeholders are resolved **again** (the layout already did once);
 *  - the PlanTelligence copyright is appended on output only, exactly once;
 *  - blank lines become paragraphs and single newlines become `<br>`;
 *  - `disclosureNode` replaces the disclosures entirely, which is how the
 *    disclosure editors embed a textarea inside the real footer;
 *  - the text colour follows the light-surface rule, not maximum contrast.
 */

const COPYRIGHT = /©\s*2026\s*PlanTelligence®?\.\s*All rights reserved\./;

function renderFooter(
  props: Partial<React.ComponentProps<typeof Footer>> = {},
) {
  const { container } = render(<Footer brandColor="#1F3A60" {...props} />);
  const footer = container.querySelector("footer") as HTMLElement;
  return { container, footer };
}

describe("Footer content", () => {
  it("renders the trust bar and quick links", () => {
    renderFooter();

    expect(screen.getByText("Benefits Hub")).toBeInTheDocument();
    expect(screen.getByText("Quick Links")).toBeInTheDocument();
    for (const label of [
      "Benefits Overview",
      "Plan Materials",
      "Schedule Appointment",
      "Contact Support",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("Contact Information")).toBeInTheDocument();
  });

  it("resolves organization and company placeholders", () => {
    renderFooter({
      disclosuresText:
        "Prepared by [Organization Name] for [Company Name] participants.",
      organizationName: "Acme Advisory",
      companyName: "Northwind",
    });

    expect(
      screen.getByText("Prepared by Acme Advisory for Northwind participants."),
    ).toBeInTheDocument();
  });

  it("renders blank-line paragraphs and single-line breaks", () => {
    renderFooter({
      disclosuresText: "First paragraph\nstill first\n\nSecond paragraph",
    });

    const first = screen.getByText("First paragraphstill first");
    expect(first.querySelectorAll("br")).toHaveLength(1);
    expect(screen.getByText("Second paragraph")).toBeInTheDocument();
  });

  it("appends the copyright line once", () => {
    const { container } = renderFooter({ disclosuresText: "Footer text" });

    const matches =
      container.innerHTML.match(/©\s*2026\s*PlanTelligence®?\./g) ?? [];
    expect(matches).toHaveLength(1);
    expect(container.innerHTML).toMatch(COPYRIGHT);
  });

  it("does not double the copyright when the stored text already has it", () => {
    const { container } = renderFooter({
      disclosuresText:
        "Footer text\n\n© 2026 PlanTelligence®. All rights reserved.",
    });

    const matches =
      container.innerHTML.match(/©\s*2026\s*PlanTelligence®?\./g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("lets an editor replace the disclosures entirely", () => {
    renderFooter({
      disclosuresText: "Stored disclaimer",
      disclosureNode: <textarea aria-label="Disclosure editor" />,
    });

    expect(
      screen.getByRole("textbox", { name: "Disclosure editor" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Stored disclaimer")).not.toBeInTheDocument();
  });

  it("falls back to the platform disclosures when none are supplied", () => {
    renderFooter({ organizationName: "Acme Advisory" });

    expect(screen.getAllByText(/LPL Financial/).length).toBeGreaterThan(0);
    expect(screen.getByText("®Acme Advisory")).toBeInTheDocument();
  });

  it("uses the built-in advisor name when no organization is given", () => {
    renderFooter();

    expect(
      screen.getAllByText(/Lighthouse Financial Advisors/).length,
    ).toBeGreaterThan(0);
  });

  it("names the organization in the copyright", () => {
    renderFooter({ organizationName: "Acme Advisory" });

    expect(
      screen.getByText(/© 2024 Acme Advisory\. All rights reserved\./),
    ).toBeInTheDocument();
  });
});

describe("Footer colour", () => {
  it("paints the brand colour and keeps white text on it", () => {
    const { footer } = renderFooter({ brandColor: "#1F3A60" });

    expect(footer.style.background).toMatch(/#1F3A60|rgb\(31, 58, 96\)/);
    expect(footer.style.color).toBe("rgb(255, 255, 255)");
  });

  it("switches to dark text on a light surface", () => {
    const { footer } = renderFooter({ brandColor: "#FAFAF6" });

    expect(footer.style.color).toBe("rgb(0, 0, 0)");
  });

  it("keeps white text on a bright brand colour", () => {
    // Deliberate: `lightSurfaceTextColor` treats a saturated amber as a colour,
    // not a light surface, even though maximum contrast would pick black.
    const { footer } = renderFooter({ brandColor: "#FFD700" });

    expect(footer.style.color).toBe("rgb(255, 255, 255)");
  });

  it("honours an explicit text colour", () => {
    const { footer } = renderFooter({ textColor: "#123456" });

    expect(footer.style.color).toBe("rgb(18, 52, 86)");
  });
});
