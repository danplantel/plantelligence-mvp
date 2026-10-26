import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FAQSection } from "@/components/faq-section";
import {
  onColor,
  PORTAL_DEFAULT_PRIMARY,
  PORTAL_DEFAULT_SECONDARY,
  resolvePortalPalette,
} from "../portal-palette";

/**
 * The portal's colour contract, asserted against the PLAN's data.
 *
 * The whole point is that these come from the plan: an advisor picks two colours
 * in Edit Plan → Branding, and every surface has to paint those — never a static
 * default. The defaults exist only for a plan that stored nothing at all, which is
 * why they are asserted last and named as fallbacks.
 */

/** The shape `GET /api/clients/[id]` returns, cut down to what matters here. */
const plan = {
  id: "plan-1",
  companyName: "Acme Corp",
  brandColor: "#0FB879",
  secondaryColor: "#C89B5B",
};

describe("resolvePortalPalette — the plan's colours", () => {
  it("paints the plan's stored primary and secondary", () => {
    const palette = resolvePortalPalette(plan);

    expect(palette.primary).toBe("#0FB879");
    expect(palette.secondary).toBe("#C89B5B");
    // Neither is the fallback: the plan's choices win outright.
    expect(palette.primary).not.toBe(PORTAL_DEFAULT_PRIMARY);
    expect(palette.secondary).not.toBe(PORTAL_DEFAULT_SECONDARY);
  });

  it("follows the plan when its colours change", () => {
    expect(
      resolvePortalPalette({ ...plan, brandColor: "#7C3AED" }).primary,
    ).toBe("#7C3AED");
    expect(
      resolvePortalPalette({ ...plan, secondaryColor: "#F59E0B" }).secondary,
    ).toBe("#F59E0B");
  });

  it("keeps the plan's colour when only the other one is missing", () => {
    // A half-set palette must not be thrown away wholesale.
    const onlyPrimary = resolvePortalPalette({
      brandColor: "#123456",
      secondaryColor: "",
    });
    expect(onlyPrimary.primary).toBe("#123456");
    expect(onlyPrimary.secondary).toBe(PORTAL_DEFAULT_SECONDARY);

    const onlySecondary = resolvePortalPalette({
      brandColor: undefined,
      secondaryColor: "#654321",
    });
    expect(onlySecondary.primary).toBe(PORTAL_DEFAULT_PRIMARY);
    expect(onlySecondary.secondary).toBe("#654321");
  });

  it("trims a colour the plan stored with whitespace", () => {
    expect(
      resolvePortalPalette({ ...plan, brandColor: "  #123456  " }).primary,
    ).toBe("#123456");
  });

  it("only falls back when the plan stored nothing", () => {
    for (const input of [undefined, null, {}, { brandColor: " ", secondaryColor: "" }]) {
      expect(resolvePortalPalette(input as never)).toMatchObject({
        primary: PORTAL_DEFAULT_PRIMARY,
        secondary: PORTAL_DEFAULT_SECONDARY,
      });
    }
  });
});

describe("resolvePortalPalette — legible foregrounds for the plan's colours", () => {
  it("derives the on-colours from the plan's palette", () => {
    const darkNavy = resolvePortalPalette({
      brandColor: "#1F3A60",
      secondaryColor: "#E6C47A",
    });
    expect(darkNavy.onPrimary).toBe("#ffffff");
    // White on that gold is ~1.6:1 — the audit's contrast bug.
    expect(darkNavy.onSecondary).toBe("#111827");

    const paleGold = resolvePortalPalette({
      brandColor: "#F7E7A1",
      secondaryColor: "#0D315F",
    });
    expect(paleGold.onPrimary).toBe("#111827");
    expect(paleGold.onSecondary).toBe("#ffffff");
  });

  it("returns white rather than throwing on an unparseable colour", () => {
    expect(onColor("not-a-colour")).toBe("#ffffff");
  });
});

describe("a portal surface paints the plan's palette, not a static one", () => {
  const faqs = [{ id: "faq-1", question: "Ready?", answer: "Yes." }];

  it("uses the plan's brand colour for the section heading", () => {
    const palette = resolvePortalPalette(plan);

    render(
      <FAQSection
        brandColor={palette.primary}
        secondaryColor={palette.secondary}
        faqs={faqs}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveStyle({
      color: "#0FB879",
    });
  });

  it("paints a second plan's colours — not the first plan's, not the default", () => {
    const other = resolvePortalPalette({
      brandColor: "#7C3AED",
      secondaryColor: "#F59E0B",
    });

    render(
      <FAQSection
        brandColor={other.primary}
        secondaryColor={other.secondary}
        faqs={faqs}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveStyle({
      color: "#7C3AED",
    });
  });
});
