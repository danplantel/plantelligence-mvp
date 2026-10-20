import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalHero } from "../portal-hero";
import { PortalMission } from "../portal-mission";

/**
 * `PortalHero` and `PortalMission` share one contract: the landing page's first
 * two sections, each of which becomes an *editable target* when the Preview
 * tab passes a click handler.
 *
 * That is the behaviour worth pinning — a heading is plain text for an employee
 * and `role="button"` (with Enter/Space support) for an advisor previewing the
 * plan. The copy fallbacks matter too: the hero names the company, the mission
 * falls back to platform copy, and neither may render an empty section.
 *
 * `useBrandingImageUrl` is stubbed so the background resolution is not part of
 * these assertions; it has its own concerns (R2 keys vs plain URLs).
 */

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: (raw: string | null) => ({ url: raw, loading: false }),
}));

vi.mock("@/lib/branding-image-url", () => ({
  isR2BrandingKey: () => false,
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

function renderMission(
  props: Partial<React.ComponentProps<typeof PortalMission>> = {},
) {
  return render(<PortalMission {...props} />);
}

function renderHero(
  props: Partial<React.ComponentProps<typeof PortalHero>> = {},
) {
  return render(<PortalHero {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollBy = vi.fn();
  window.scrollTo = vi.fn();
});

describe("PortalMission", () => {
  it("renders the plan's mission copy", () => {
    renderMission({
      company: { missionHeadline: "Our mission", missionBody: "Do good work" },
    });

    expect(
      screen.getByRole("heading", { name: "Our mission" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Do good work")).toBeInTheDocument();
  });

  it("falls back to platform copy rather than an empty section", () => {
    renderMission({ company: {} });

    expect(
      screen.getByRole("heading", {
        name: "We care about people. We value teamwork. We deliver results.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/At Company Name/)).toBeInTheDocument();
  });

  it("makes the headline an editable button in preview", async () => {
    const user = userEvent.setup();
    const onMissionHeadlineClick = vi.fn();
    renderMission({
      company: { missionHeadline: "Our mission" },
      onMissionHeadlineClick,
    });

    const headline = screen.getByRole("button", { name: "Our mission" });
    expect(headline).toHaveAttribute("tabindex", "0");

    await user.click(headline);
    expect(onMissionHeadlineClick).toHaveBeenCalledTimes(1);
  });

  it("activates the headline from the keyboard", async () => {
    const user = userEvent.setup();
    const onMissionHeadlineClick = vi.fn();
    renderMission({
      company: { missionHeadline: "Our mission" },
      onMissionHeadlineClick,
    });

    const headline = screen.getByRole("button", { name: "Our mission" });
    headline.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onMissionHeadlineClick).toHaveBeenCalledTimes(2);
  });

  it("routes a body click to the body handler only", async () => {
    const user = userEvent.setup();
    const onMissionHeadlineClick = vi.fn();
    const onMissionBodyClick = vi.fn();
    renderMission({
      company: { missionHeadline: "Our mission", missionBody: "Do good work" },
      onMissionHeadlineClick,
      onMissionBodyClick,
    });

    await user.click(screen.getByRole("button", { name: "Do good work" }));

    expect(onMissionBodyClick).toHaveBeenCalledTimes(1);
    expect(onMissionHeadlineClick).not.toHaveBeenCalled();
  });

  it("stays plain text when no handlers are supplied", () => {
    renderMission({
      company: { missionHeadline: "Our mission", missionBody: "Do good work" },
    });

    expect(screen.queryByRole("button", { name: "Our mission" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Do good work" })).toBeNull();
  });

  it("renders the plan's thumbnail or a stock photo", () => {
    const { unmount } = renderMission({
      company: { thumbnailImg: "https://cdn.test/team.png" },
    });
    expect(screen.getByAltText("Team collaboration")).toHaveAttribute(
      "src",
      "https://cdn.test/team.png",
    );
    unmount();

    renderMission({ company: {} });
    expect(
      screen.getByAltText("Team collaboration").getAttribute("src"),
    ).toMatch(/unsplash/);
  });

  it("scrolls the page from the explore button", async () => {
    const user = userEvent.setup();
    renderMission({ company: {} });

    await user.click(
      screen.getByRole("button", { name: "Explore your benefits" }),
    );

    expect(window.scrollBy).toHaveBeenCalled();
  });
});

describe("PortalHero", () => {
  it("welcomes the participant by company name", () => {
    renderHero({ companyData: { companyName: "Acme" } });

    // The headline colours the company name in its own span, so the text is
    // split across nodes — assert the heading's whole content.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Welcome to the Acme Benefits Hub!",
    );
  });

  it("renders the saved headline and description", () => {
    renderHero({
      companyData: { companyName: "Acme" },
      heroTitle: "Your benefits, simplified",
      heroDescription: "Everything in one place",
    });

    expect(screen.getByText("Your benefits, simplified")).toBeInTheDocument();
    expect(screen.getByText("Everything in one place")).toBeInTheDocument();
    expect(
      screen.queryByText("Welcome to the Acme Benefits Hub!"),
    ).not.toBeInTheDocument();
  });

  it("falls back to a placeholder description", () => {
    renderHero({ companyData: { companyName: "Acme" } });

    expect(screen.getByText("--------")).toBeInTheDocument();
  });

  it("makes the headline and description editable in preview", async () => {
    const user = userEvent.setup();
    const onHeroTitleClick = vi.fn();
    const onHeroDescriptionClick = vi.fn();
    renderHero({
      companyData: { companyName: "Acme" },
      heroTitle: "Your benefits",
      heroDescription: "All of them",
      onHeroTitleClick,
      onHeroDescriptionClick,
    });

    await user.click(screen.getByRole("button", { name: "Your benefits" }));
    await user.click(screen.getByRole("button", { name: "All of them" }));

    expect(onHeroTitleClick).toHaveBeenCalledTimes(1);
    expect(onHeroDescriptionClick).toHaveBeenCalledTimes(1);
  });

  it("stays plain text when the preview passes no handlers", () => {
    renderHero({
      companyData: { companyName: "Acme" },
      heroTitle: "Your benefits",
      heroDescription: "All of them",
    });

    expect(screen.queryByRole("button", { name: "Your benefits" })).toBeNull();
    expect(screen.queryByRole("button", { name: "All of them" })).toBeNull();
  });

  it("scrolls down when the mission section is not on the page", async () => {
    const user = userEvent.setup();
    renderHero({ companyData: { companyName: "Acme" } });

    await user.click(screen.getByLabelText("Scroll to mission section"));

    // Without a #portal-mission sibling the hero falls back to a fixed scroll.
    expect(window.scrollBy).toHaveBeenCalledWith({
      top: 300,
      behavior: "smooth",
    });
  });

  it("scrolls to the mission section when it exists", async () => {
    const user = userEvent.setup();
    const mission = document.createElement("section");
    mission.id = "portal-mission";
    document.body.appendChild(mission);
    renderHero({ companyData: { companyName: "Acme" } });

    await user.click(screen.getByLabelText("Scroll to mission section"));

    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );

    mission.remove();
  });

  it("offers the benefits question search", () => {
    renderHero({ companyData: { companyName: "Acme" } });

    expect(
      screen.getByRole("searchbox", {
        name: "Ask a question or search for your benefits",
      }),
    ).toBeInTheDocument();
  });
});
