import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrimaryVisual } from "../primary-visual";

/**
 * `PrimaryVisual` fills the large circular slot on `PrimaryContactCard`.
 *
 * It mirrors `ContactAvatar` with one difference worth pinning: it never reads
 * the legacy `teamImage` field, so a contact migrated with only a team image
 * falls back to initials on this card while `ContactAvatar` still shows the
 * image.
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

describe("PrimaryVisual for a person", () => {
  it("draws the headshot", () => {
    render(
      <PrimaryVisual
        contact={{ name: "Ada Lovelace", headshot: "org/ada.png" }}
      />,
    );

    expect(screen.getByTestId("headshot")).toHaveAttribute(
      "data-src",
      "org/ada.png",
    );
    expect(screen.getByTestId("headshot")).toHaveAttribute("data-alt", "Photo");
  });

  it("shows initials when there is no headshot", () => {
    render(<PrimaryVisual contact={{ name: "Ada Lovelace" }} />);

    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("ignores the legacy team image", () => {
    // The prop type has no `teamImage`, but stored rows can still carry one.
    render(
      <PrimaryVisual
        contact={{ name: "Ada Lovelace", teamImage: "org/team.png" } as any}
      />,
    );

    expect(screen.getByTestId("headshot")).toHaveAttribute("data-src", "");
    expect(screen.getByText("AL")).toBeInTheDocument();
  });
});

describe("PrimaryVisual for a Team / Support Line contact", () => {
  it("shows the company logo in the large slot", () => {
    render(
      <PrimaryVisual
        contact={{ contactType: "team_support", companyLogo: "org/logo.png" }}
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
    expect(screen.queryByTestId("headshot")).not.toBeInTheDocument();
  });

  it("falls back to the legacy logo field", () => {
    render(
      <PrimaryVisual
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
      <PrimaryVisual
        contact={{ contactType: "team_support", supportIcon: "headset" }}
      />,
    );

    expect(screen.getByTestId("support-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("branding-image")).not.toBeInTheDocument();
  });
});
