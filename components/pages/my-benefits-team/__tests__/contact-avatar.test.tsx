import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContactAvatar } from "../contact-avatar";

/**
 * `ContactAvatar` is the small circular slot on every contact card.
 *
 * It has two shapes: a person's headshot (with `teamImage` as a legacy
 * fallback and initials as the last resort), or — for a Team / Support Line
 * contact — the company logo, falling back to the advisor-chosen support icon.
 */

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ src, alt, fallback }: any) => (
    <div data-testid="headshot" data-src={src ?? ""} data-alt={alt}>
      {src ? null : fallback}
    </div>
  ),
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ src, alt, className }: any) => (
    <img
      data-testid="branding-image"
      src={src}
      alt={alt}
      className={className}
    />
  ),
}));

vi.mock("@/lib/support-icons", () => ({
  getSupportIcon: () => (props: any) => (
    <span data-testid="support-icon" {...props} />
  ),
}));

describe("ContactAvatar for a person", () => {
  it("draws the headshot when there is one", () => {
    render(
      <ContactAvatar
        contact={{ name: "Ada Lovelace", headshot: "org/ada.png" }}
      />,
    );

    expect(screen.getByTestId("headshot")).toHaveAttribute(
      "data-src",
      "org/ada.png",
    );
    expect(screen.getByTestId("headshot")).toHaveAttribute(
      "data-alt",
      "Avatar",
    );
  });

  it("falls back to the legacy team image", () => {
    render(
      <ContactAvatar
        contact={{ name: "Ada Lovelace", teamImage: "org/team.png" }}
      />,
    );

    expect(screen.getByTestId("headshot")).toHaveAttribute(
      "data-src",
      "org/team.png",
    );
  });

  it("shows the person's initials when there is no image", () => {
    render(<ContactAvatar contact={{ name: "Ada Lovelace" }} />);

    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("shows NA when the contact has no name either", () => {
    render(<ContactAvatar contact={{}} />);

    expect(screen.getByText("NA")).toBeInTheDocument();
  });
});

describe("ContactAvatar for a Team / Support Line contact", () => {
  it("shows the company logo in the avatar slot", () => {
    render(
      <ContactAvatar
        contact={{
          contactType: "team_support",
          name: "Acme Service Desk",
          companyLogo: "org/logo.png",
          headshot: "org/ignored.png",
        }}
      />,
    );

    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "src",
      "org/logo.png",
    );
    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "alt",
      "Company logo",
    );
    // A support line has no person headshot.
    expect(screen.queryByTestId("headshot")).not.toBeInTheDocument();
  });

  it("falls back to the legacy logo field", () => {
    render(
      <ContactAvatar
        contact={{ contactType: "team_support", logo: "org/old.png" }}
      />,
    );

    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "src",
      "org/old.png",
    );
  });

  it("shows the chosen support icon when there is no logo", () => {
    render(
      <ContactAvatar
        contact={{ contactType: "team_support", supportIcon: "headset" }}
      />,
    );

    expect(screen.getByTestId("support-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("branding-image")).not.toBeInTheDocument();
  });
});
