import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HowCanWeHelpSection } from "../how-can-we-help-section";

/**
 * "How Can We Help You Today?" — currently heading only.
 *
 * The three-card body and its editor were removed together for a redesign (see the
 * module doc), so this suite pins the part that must NOT change while that work
 * happens: every portal surface still renders the section with its heading, in the
 * plan's brand colour, and the card/CTA props still type-check at the call sites.
 */
describe("HowCanWeHelpSection", () => {
  it("renders the section heading", () => {
    render(<HowCanWeHelpSection clientId="plan-1" />);

    expect(
      screen.getByRole("heading", { name: "How Can We Help You Today?" }),
    ).toBeInTheDocument();
  });

  it("uses the plan's brand colour on the heading", () => {
    render(<HowCanWeHelpSection brandColor="#123456" />);

    expect(
      screen.getByRole("heading", { name: "How Can We Help You Today?" }),
    ).toHaveStyle({ color: "#123456" });
  });

  it("renders no cards while the body is rebuilt", () => {
    render(
      <HowCanWeHelpSection
        clientId="plan-1"
        cards={[
          {
            id: "card-1",
            title: "Financial Planning",
            paragraphs: ["A paragraph about planning."],
            cta: "Learn more",
          },
        ]}
        onCardEdit={() => {}}
      />,
    );

    expect(screen.queryByText("Financial Planning")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
