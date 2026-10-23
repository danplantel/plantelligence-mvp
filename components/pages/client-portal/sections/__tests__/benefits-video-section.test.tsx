import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BenefitsVideoSection } from "../benefits-video-section";

/**
 * Per-category default headline and subhead.
 *
 * The hub pages only pass a title/subtitle when the plan wrote one
 * (`journeyHeader` / `journeySubtitle`); otherwise the section supplies the copy for
 * its category, so the four hubs (and the Custom hub, stored under "Company / Plan
 * Sponsor") no longer repeat the strings — or drift from each other.
 */

vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ""} />,
}));

const DEFAULTS: Record<string, [string, string]> = {
  Retirement: [
    "Your Retirement Journey Starts Here",
    "Build your financial future with confidence.",
  ],
  "Group Health": [
    "Get the Most From Your Health Plan",
    "Care, coverage, and costs, explained.",
  ],
  "Group Life": [
    "Protect What Matters Most",
    "Coverage for you and the people who count on you.",
  ],
  "Company / Plan Sponsor": [
    "Everything You Need, Explained",
    "Quick videos on the benefits and resources available to you.",
  ],
};

describe("BenefitsVideoSection default copy", () => {
  it.each(Object.entries(DEFAULTS))(
    "uses the %s defaults when no copy is passed",
    (category, [title, subtitle]) => {
      render(<BenefitsVideoSection category={category} />);

      expect(
        screen.getByRole("heading", { level: 1, name: title }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: subtitle }),
      ).toBeInTheDocument();
    },
  );

  it("falls back to the Retirement copy for an unknown category", () => {
    render(<BenefitsVideoSection category="Pet Insurance" />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: DEFAULTS.Retirement[0],
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: DEFAULTS.Retirement[1],
      }),
    ).toBeInTheDocument();
  });

  it("prefers the plan's own headline and subhead", () => {
    render(
      <BenefitsVideoSection
        category="Group Life"
        mainTitle="Our Own Headline"
        subtitle="Our own subhead."
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Our Own Headline" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Our own subhead." }),
    ).toBeInTheDocument();
  });

  it("hides the video label when there is no video", () => {
    render(<BenefitsVideoSection category="Retirement" />);

    expect(screen.queryByText("This benefit")).not.toBeInTheDocument();
    // The runtime sits in the same row, so it goes too.
    expect(screen.queryByText("--:--")).not.toBeInTheDocument();
  });

  it("shows the video label once a video is present", () => {
    render(
      <BenefitsVideoSection
        category="Retirement"
        planVideoUrl="https://cdn.test/video.mp4"
      />,
    );

    expect(screen.getByText("This benefit")).toBeInTheDocument();
  });

  it("hides the label for a blank label value, even with a video", () => {
    render(
      <BenefitsVideoSection
        category="Retirement"
        planVideoUrl="https://cdn.test/video.mp4"
        videoLabel="   "
      />,
    );

    expect(screen.queryByText("This benefit")).not.toBeInTheDocument();
  });

  it("treats blank copy as unset", () => {
    render(
      <BenefitsVideoSection
        category="Group Health"
        mainTitle="   "
        subtitle=""
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: DEFAULTS["Group Health"][0],
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: DEFAULTS["Group Health"][1],
      }),
    ).toBeInTheDocument();
  });
});
