import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DesignationChip } from "@/components/pages/my-benefits-team/designation-chip";

describe("DesignationChip", () => {
  it("shows only the acronym on the card", () => {
    render(<DesignationChip value="CFP" className="chip" />);

    expect(screen.getByText("CFP®")).toBeInTheDocument();
    // The full name lives behind the hover, not on the card itself.
    expect(
      screen.queryByText("CFP® — Certified Financial Planner"),
    ).not.toBeInTheDocument();
  });

  it("expands the acronym on hover, acronym first", async () => {
    const user = userEvent.setup();
    render(<DesignationChip value="CFP" className="chip" />);

    await user.hover(screen.getByText("CFP®"));

    // Radix renders the tooltip's accessible copy with `role="tooltip"`.
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "CFP® — Certified Financial Planner",
    );
  });

  it("keeps a free-text designation as typed", async () => {
    const user = userEvent.setup();
    render(<DesignationChip value="Board Certified" className="chip" />);

    await user.hover(screen.getByText("Board Certified"));

    // The same words, with no invented expansion or mark.
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Board Certified",
    );
  });

  it("keeps the hint on a single line", async () => {
    const user = userEvent.setup();
    render(<DesignationChip value="CFP" className="chip" />);

    await user.hover(screen.getByText("CFP®"));

    // Radix's styled surface is the tooltip's parent; `whitespace-nowrap` keeps
    // "CFP® — Certified Financial Planner" from wrapping onto a second line.
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.parentElement?.className).toContain("whitespace-nowrap");
  });

  it("is reachable without a pointer", () => {
    render(<DesignationChip value="AIF" className="chip" />);

    // Focusable, so a keyboard user can read the credential too.
    expect(screen.getByText("AIF®")).toHaveAttribute("tabindex", "0");
  });
});
