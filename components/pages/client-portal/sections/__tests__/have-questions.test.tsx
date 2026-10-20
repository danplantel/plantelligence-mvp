import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HaveQuestions } from "../have-questions";

/**
 * `HaveQuestions` is the last band on every hub page: the category's support
 * people as cards.
 *
 * The hub pages pass the same resolved contacts to `FAQSection` (which ignores
 * them) and to this component (which renders them), so this is where a
 * participant actually sees who to call. The details worth pinning are the
 * contact affordances: `mailto:` for the email, a digits-only `tel:` link for
 * the phone, designation acronyms only, and nothing at all when there is no one
 * to show.
 */

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@/config/onboarding/designations", () => ({
  designationAcronym: (value: string) => value.split(/\s+/)[0].toUpperCase(),
}));

function contact(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    title: "Ada Advisor",
    description: "Retirement specialist",
    email: "ada@acme.test",
    phone: "305-555-0100",
    ...overrides,
  };
}

describe("HaveQuestions", () => {
  it("renders nothing without contacts", () => {
    const { container } = render(<HaveQuestions contacts={[]} />);

    expect(container).toBeEmptyDOMElement();
    expect(render(<HaveQuestions />).container).toBeEmptyDOMElement();
  });

  it("renders the heading and one card per contact", () => {
    render(
      <HaveQuestions
        contacts={[
          contact(),
          contact({
            id: "c2",
            title: "Grace Guide",
            description: "Health specialist",
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Have Questions?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada Advisor")).toBeInTheDocument();
    expect(screen.getByText("Grace Guide")).toBeInTheDocument();
    expect(screen.getByText("Retirement specialist")).toBeInTheDocument();
    expect(screen.getByText("Health specialist")).toBeInTheDocument();
  });

  it("links the email and a digits-only phone number", () => {
    render(<HaveQuestions contacts={[contact()]} />);

    expect(
      screen.getByRole("link", { name: /ada@acme\.test/ }),
    ).toHaveAttribute("href", "mailto:ada@acme.test");
    expect(screen.getByRole("link", { name: /305-555-0100/ })).toHaveAttribute(
      "href",
      "tel:3055550100",
    );
  });

  it("omits the rows a contact does not have", () => {
    render(<HaveQuestions contacts={[contact({ email: "", phone: "" })]} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Ada Advisor")).toBeInTheDocument();
  });

  it("renders designations as acronyms and filters blanks", () => {
    render(
      <HaveQuestions
        contacts={[
          contact({
            designations: ["Certified Financial Planner", "  ", "AIF"],
          }),
        ]}
      />,
    );

    expect(screen.getByText("CERTIFIED")).toBeInTheDocument();
    expect(screen.getByText("AIF")).toBeInTheDocument();
    expect(
      screen.queryByText("Certified Financial Planner"),
    ).not.toBeInTheDocument();
  });

  it("renders no designation row when every value is blank", () => {
    render(
      <HaveQuestions contacts={[contact({ designations: ["", "  "] })]} />,
    );

    expect(screen.queryByText("CERTIFIED")).not.toBeInTheDocument();
  });

  it("shows the headshot when there is one and a glyph otherwise", () => {
    const { container } = render(
      <HaveQuestions
        contacts={[contact({ headshot: "https://cdn.test/a.png" })]}
      />,
    );
    expect(screen.getByAltText("Ada Advisor")).toHaveAttribute(
      "src",
      "https://cdn.test/a.png",
    );

    container.remove();
    const second = render(<HaveQuestions contacts={[contact()]} />);
    expect(second.container.querySelector("img")).toBeNull();
  });

  it("paints the avatar with the brand colour and the name with the accent", () => {
    render(
      <HaveQuestions
        contacts={[contact()]}
        brandColor="#123456"
        secondaryColor="#654321"
      />,
    );

    expect(screen.getByText("Ada Advisor").closest("h3")).toHaveStyle({
      color: "#654321",
    });
  });
});
