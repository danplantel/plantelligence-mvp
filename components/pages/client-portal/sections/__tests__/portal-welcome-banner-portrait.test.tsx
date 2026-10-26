import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PortalWelcomeBanner } from "../portal-welcome-banner";

/**
 * The banner's circular portrait.
 *
 * Three rules, and they are the whole contract:
 *
 *  1. the KEY CONTACT HEADSHOT is the default;
 *  2. an image the advisor chose — passed by the Editing Panel, or stored on the
 *     plan as `heroPortraitImage` — replaces it;
 *  3. with neither, the frame shows its own placeholder. The old per-category
 *     "Inner Header Image" stock photos are gone.
 */

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: () => ({ url: null }),
}));

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: async () => null,
}));

const keyContacts = [
  {
    fullName: "Dana Reed",
    name: "Dana Reed",
    headshot: "https://cdn.test/dana.png",
  },
];

function banner(props: Record<string, unknown> = {}, clientData = {}) {
  return render(
    <PortalWelcomeBanner
      clientData={{ companyName: "Acme", keyContacts, ...clientData }}
      profile={{ name: "Ada Advisor" }}
      category="Retirement"
      {...props}
    />,
  );
}

/** The portrait <img> — the background layer is `alt=""`, so this is unambiguous. */
function portrait() {
  return screen.getByAltText("Dana Reed");
}

describe("PortalWelcomeBanner portrait", () => {
  it("shows the key contact headshot by default", () => {
    banner();

    expect(portrait()).toHaveAttribute("src", "https://cdn.test/dana.png");
  });

  it("draws a chosen image instead of the headshot", () => {
    banner({ portraitImage: "https://cdn.test/chosen.png" });

    expect(portrait()).toHaveAttribute("src", "https://cdn.test/chosen.png");
  });

  it("uses the portrait stored on the plan when no prop is passed", () => {
    banner({}, { heroPortraitImage: "https://cdn.test/plan.png" });

    expect(portrait()).toHaveAttribute("src", "https://cdn.test/plan.png");
  });

  it("prefers the prop over the plan's stored portrait", () => {
    banner(
      { portraitImage: "https://cdn.test/chosen.png" },
      { heroPortraitImage: "https://cdn.test/plan.png" },
    );

    expect(portrait()).toHaveAttribute("src", "https://cdn.test/chosen.png");
  });

  it("falls back to the frame's placeholder, not a stock inner-header image", () => {
    render(
      <PortalWelcomeBanner
        clientData={{ companyName: "Acme", keyContacts: [] }}
        profile={{ name: "Ada Advisor" }}
        category="Retirement"
      />,
    );

    expect(screen.queryByAltText("Dana Reed")).not.toBeInTheDocument();
    expect(screen.getByText("BENEFITS LOGO")).toBeInTheDocument();
  });

  it("wears the typography theme's corner treatment", () => {
    banner();

    // The hero card is the banner's biggest surface. It reads `--portal-radius`
    // — the variable the theme publishes and every `rounded-*` utility uses —
    // so a sharp theme squares it off and a round theme curves it.
    const heroCard = screen.getByTestId("welcome-banner-hero-card");

    expect(heroCard.style.borderRadius).toContain("--portal-radius");
  });
});
