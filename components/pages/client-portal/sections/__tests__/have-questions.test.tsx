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
  // Mirrors the real component: an image only when there is a source, the
  // placeholder slot otherwise.
  Headshot: ({ src, alt }: { src?: string | null; alt: string }) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} />
    ) : null,
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

  it("exposes the anchor the journey section's Schedule button scrolls to", () => {
    const { container } = render(<HaveQuestions contacts={[contact()]} />);

    expect(container.querySelector("section")).toHaveAttribute(
      "id",
      "have-questions",
    );
  });

  it("sits on a light grey band and renders the shared contact cards", () => {
    const { container } = render(
      <HaveQuestions
        contacts={[contact()]}
        appointmentLink="https://cal.test"
      />,
    );

    // Matches the FAQ panel above it, so the two read as one closing pair.
    const section = container.querySelector("section") as HTMLElement;
    expect(section.className).toContain("bg-gray-100");
    expect(section.className).toContain("border-y");
    expect(section.className).not.toContain("bg-white");

    // The card's identity block is the shared one — its own role line included.
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Ada Advisor",
    );
    // The plan's appointment link does NOT create a CTA on its own.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("centres the cards in the row whatever the count", () => {
    // One, two or three contacts used to sit at the start of a four-column grid.
    // The row centres its cards instead, while each card keeps the width a fourth
    // (or a half on tablets) would have given it.
    [1, 2, 3, 4].forEach((count) => {
      const { container, unmount } = render(
        <HaveQuestions
          contacts={Array.from({ length: count }, (_, index) =>
            contact({
              id: `c${index}`,
              title: `Advisor ${index}`,
              name: `Advisor ${index}`,
            }),
          )}
        />,
      );

      const row = container.querySelector(".flex.flex-wrap") as HTMLElement;
      expect(row.className).toContain("justify-center");
      expect(row.children).toHaveLength(count);

      Array.from(row.children).forEach((column) => {
        expect(column.className).toContain("w-full");
        expect(column.className).toContain(
          "sm:w-[calc((100%-1.5rem)/2)]",
        );
        expect(column.className).toContain(
          "lg:w-[calc((100%-4.5rem)/4)]",
        );
      });

      unmount();
    });
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
    // The shared card formats the number and dials it with a country code.
    expect(
      screen.getByRole("link", { name: /\(305\) 555-0100/ }),
    ).toHaveAttribute("href", "tel:+13055550100");
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

  it("shows the headshot when there is one", () => {
    const { container } = render(
      <HaveQuestions
        contacts={[contact({ headshot: "https://cdn.test/a.png" })]}
      />,
    );
    expect(screen.getByAltText("Avatar")).toHaveAttribute(
      "src",
      "https://cdn.test/a.png",
    );

    container.remove();
    // No headshot → the card draws its placeholder instead of an image.
    const second = render(<HaveQuestions contacts={[contact()]} />);
    expect(second.container.querySelector("img")).toBeNull();
  });

  it("paints the name in the brand colour", () => {
    render(
      <HaveQuestions
        contacts={[contact()]}
        brandColor="#123456"
        secondaryColor="#654321"
      />,
    );

    // The shared card titles the name in the plan's brand colour.
    expect(screen.getByText("Ada Advisor").closest("h3")).toHaveStyle({
      color: "#123456",
    });
  });

  it("draws exactly the CTA the advisor configured — and none without one", () => {
    const { container } = render(
      <HaveQuestions
        contacts={[
          contact({
            enableContactButton: true,
            contactButtonType: "calendar",
            schedulingUrl: "https://book.test/ada",
          }),
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Schedule Appt." }),
    ).toBeInTheDocument();
    container.remove();

    // A different configured type draws that type.
    const second = render(
      <HaveQuestions
        contacts={[
          contact({
            enableContactButton: true,
            contactButtonType: "phone",
            phone: "305-555-0100",
          }),
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Call Now" }),
    ).toBeInTheDocument();
    second.container.remove();

    // A contact with an email and a phone but NO configured CTA draws no button.
    // Inferring one put "Call Now" on every card the advisor never touched.
    render(
      <HaveQuestions
        contacts={[
          contact({ phone: "305-555-0100", email: "a@b.test" }),
        ]}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the plan's company logo on a plan-level contact card", () => {
    // The plan sponsor's own people carry no company and no category, so their
    // card is the plan's — it must still show the plan's logo.
    const { container } = render(
      <HaveQuestions
        contacts={[contact({ companyName: "", companyLogo: "", benefitsCategories: [] })]}
        companyName="Acme Sponsor LLC"
        companyLogo="https://cdn.test/plan-logo.png"
      />,
    );

    expect(screen.getByText("Acme Sponsor LLC")).toBeInTheDocument();
    expect(
      container.querySelector('[src="https://cdn.test/plan-logo.png"]'),
    ).not.toBeNull();
  });
});
