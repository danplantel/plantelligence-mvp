import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContactCategoryBadge } from "@/components/ui/contact-category-badge";

/**
 * The benefit-category tag on a contact card.
 *
 * Two placements, two layouts:
 *
 *  - `collapsed` (default) — the wizard preview's floating tag. Several categories
 *    fold into one "Multiple Categories" pill so the overlay cannot sprawl across
 *    the card it sits on; the list is carried by the aria-label (and the tooltip).
 *  - `pills` — the My Benefits Team cards. One pill per category, so a contact who
 *    covers Retirement, Group Health and Group Life names all three at a glance
 *    instead of asking the advisor to hover.
 */

describe("ContactCategoryBadge collapsed layout", () => {
  it("names a single category directly", () => {
    render(<ContactCategoryBadge categories={["Retirement"]} />);
    expect(screen.getByText("Retirement")).toBeInTheDocument();
    expect(screen.queryByText(/Multiple Categories/)).toBeNull();
  });

  it("folds several into one pill that carries the full list", () => {
    render(
      <ContactCategoryBadge categories={["Retirement", "Group Health"]} />,
    );

    const badge = screen.getByLabelText(
      "Multiple Categories: Retirement, Group Health",
    );
    expect(badge).toHaveTextContent("Multiple Categories");
    // The names are not on screen — that is the point of collapsing them.
    expect(screen.queryByText("Group Health")).toBeNull();
  });

  it("honours a custom multiple label", () => {
    render(
      <ContactCategoryBadge
        categories={["Retirement", "Group Health"]}
        multipleLabel="Several benefits"
      />,
    );
    expect(screen.getByText("Several benefits")).toBeInTheDocument();
  });
});

describe("ContactCategoryBadge pills layout", () => {
  it("renders one pill per category and never says Multiple Categories", () => {
    render(
      <ContactCategoryBadge
        layout="pills"
        categories={["Retirement", "Group Health", "Group Life"]}
      />,
    );

    expect(screen.getByText("Retirement")).toBeInTheDocument();
    expect(screen.queryByText(/Multiple Categories/)).toBeNull();
    expect(
      screen.getByText("Retirement").closest("[data-category-count]"),
    ).toHaveAttribute("data-category-count", "3");
  });

  it("wears the short pill labels, keeping the full name on hover", () => {
    render(
      <ContactCategoryBadge
        layout="pills"
        categories={["Group Health", "Group Life"]}
      />,
    );

    // A pill has room for one word: "Group" is implied by the benefit itself.
    expect(screen.getByText("Health")).toHaveAttribute("title", "Group Health");
    expect(screen.getByText("Life")).toHaveAttribute("title", "Group Life");
    expect(screen.queryByText("Group Health")).toBeNull();
  });

  it("leaves canonical names the short label map does not cover", () => {
    render(
      <ContactCategoryBadge layout="pills" categories={["Other Benefits"]} />,
    );
    expect(screen.getByText("Other Benefits")).toBeInTheDocument();
  });

  it("keeps a single category as its own pill", () => {
    render(<ContactCategoryBadge layout="pills" categories={["Retirement"]} />);
    expect(screen.getByText("Retirement")).toBeInTheDocument();
  });

  it("drops blanks and repeats before rendering pills", () => {
    render(
      <ContactCategoryBadge
        layout="pills"
        categories={["Retirement", " ", "Retirement", null, "Group Health"]}
      />,
    );

    const row = screen
      .getByText("Retirement")
      .closest("[data-category-count]")!;
    expect(row).toHaveAttribute("data-category-count", "2");
    expect(within(row as HTMLElement).getAllByText("Retirement")).toHaveLength(
      1,
    );
    expect(within(row as HTMLElement).getByText("Health")).toBeInTheDocument();
  });

  it("renders nothing when the contact has no category", () => {
    const { container } = render(
      <ContactCategoryBadge layout="pills" categories={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
