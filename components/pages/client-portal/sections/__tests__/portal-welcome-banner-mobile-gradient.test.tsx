import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PortalWelcomeBanner } from "../portal-welcome-banner";

/**
 * The benefit-hub hero's wash on a phone.
 *
 * The hero card is nearly the page's width below `sm`, so its plate read as a
 * hard-edged rectangle floating in the artwork. The landing hero already solved
 * this by moving the wash to a full-bleed, phone-only layer and switching the
 * card's plate off (`portal-hero`); this suite pins the same two rules here:
 *
 *  1. the section paints a gradient across its WHOLE box on phones; and
 *  2. the card paints none of its own below `sm`, so the wash cannot double up.
 */

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
}));

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: () => ({ url: null }),
}));

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: async () => null,
}));

function banner(clientData: Record<string, unknown> = {}) {
  return render(
    <PortalWelcomeBanner
      clientData={{ companyName: "Acme", keyContacts: [], ...clientData }}
      profile={{ name: "Ada Advisor" }}
      category="Retirement"
    />,
  );
}

/** The card's own plate — the only `aria-hidden` child of the hero card. */
function cardPlate() {
  return screen
    .getByTestId("welcome-banner-hero-card")
    .querySelector('[aria-hidden="true"]') as HTMLElement;
}

describe("PortalWelcomeBanner mobile gradient", () => {
  it("washes the whole hero on phones instead of only the card", () => {
    banner({
      employeePortalPreview: {
        heroUseGradient: true,
        heroContainerBlockOpacity: 0.5,
      },
    });

    // Full-bleed: the section's own box, hidden from `sm` up.
    const wash = screen.getByTestId("welcome-banner-mobile-gradient");
    expect(wash.className).toContain("absolute");
    expect(wash.className).toContain("inset-0");
    expect(wash.className).toContain("sm:hidden");
    expect(wash.style.background).toContain("linear-gradient");
    expect(wash.style.background).toContain("0.5");

    // …and the card stops painting its own copy below `sm`, so the two do not
    // stack into a double-dark rectangle around the copy.
    const plate = cardPlate();
    expect(plate.className).toContain("hidden");
    expect(plate.className).toContain("sm:block");
  });

  it("extends the gradient across the hero for a flat-plate plan too", () => {
    // No `heroUseGradient`: the card keeps a flat plate above `sm`, but a phone
    // still gets the gradient — a flat fill stretched over the artwork would
    // black it out.
    banner({ employeePortalPreview: { heroContainerBlockOpacity: 0.4 } });

    const wash = screen.getByTestId("welcome-banner-mobile-gradient");
    expect(wash.className).toContain("sm:hidden");
    expect(wash.style.background).toContain("linear-gradient");
    expect(wash.style.background).toContain("0.4");

    const plate = cardPlate();
    expect(plate.className).toContain("hidden");
    expect(plate.style.backgroundColor).toContain("0.4");
  });

  it("uses the inverted wash colour for a light container", () => {
    banner({
      employeePortalPreview: {
        heroUseGradient: true,
        heroContainerInverted: true,
        heroContainerBlockOpacity: 0.5,
      },
    });

    const wash = screen.getByTestId("welcome-banner-mobile-gradient");
    expect(wash.style.background).toContain("255, 255, 255");
  });
});
