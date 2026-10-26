import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  BenefitsVideoSection,
  essentialsTitleFor,
} from "../benefits-video-section";

/**
 * Per-category default headline and subhead.
 *
 * The hub pages only pass a title/subtitle when the plan wrote one
 * (`journeyHeader` / `journeySubtitle`); otherwise the section supplies the copy for
 * its category, so the four hubs (and the Custom hub, stored under "Company / Plan
 * Sponsor") no longer repeat the strings — or drift from each other.
 */

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src?: unknown }) => (
    <img alt={alt ?? ""} src={typeof src === "string" ? src : ""} />
  ),
}));

// The rail itself is covered by `video-carousel.test.tsx`; here it only has to
// arrive with the right placement (and only when a placement is passed), and to
// hand a picked video up to the section.
vi.mock("../video-carousel", () => ({
  VideoCarousel: ({
    placement,
    title,
    onSelect,
    activeId,
  }: {
    placement: string;
    title?: string;
    onSelect?: (replay: unknown) => void;
    activeId?: string | number | null;
  }) => (
    <div
      data-testid="video-carousel"
      data-placement={placement}
      data-title={title}
      data-active-id={activeId ?? ""}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={() =>
            onSelect({
              id: "w1",
              title: "Retirement Basics",
              videoUrl: "https://youtu.be/abcdefghijk",
            })
          }
        >
          Play webinar
        </button>
      ) : null}
    </div>
  ),
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

/**
 * "Schedule with <name>" either opens the contact's scheduling URL or, on the hub
 * pages, scrolls to the "Have Questions?" band where that contact's card lives.
 */
describe("BenefitsVideoSection schedule CTA", () => {
  const contacts = [
    { fullName: "Dana Reed", schedulingUrl: "https://cal.test" },
  ];

  it("calls the handler instead of opening the scheduling URL", async () => {
    const user = userEvent.setup();
    const onScheduleClick = vi.fn();
    render(
      <BenefitsVideoSection
        category="Retirement"
        keyContacts={contacts}
        onScheduleClick={onScheduleClick}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /schedule with dana/i }),
    );

    expect(onScheduleClick).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("link", { name: /schedule with dana/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the scheduling link when no handler is given", () => {
    render(
      <BenefitsVideoSection category="Retirement" keyContacts={contacts} />,
    );

    expect(
      screen.getByRole("link", { name: /schedule with dana/i }),
    ).toHaveAttribute("href", "https://cal.test");
  });
});

/**
 * "Watch Now" only exists to start the plan video. Without one there is nothing
 * to start, so it is dropped rather than shown in a disabled state.
 */
describe("BenefitsVideoSection Watch Now CTA", () => {
  it("hides Watch Now when there is no video", () => {
    render(<BenefitsVideoSection category="Retirement" />);

    expect(
      screen.queryByRole("button", { name: /watch now/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Watch Now once a video is present", () => {
    render(
      <BenefitsVideoSection
        category="Retirement"
        planVideoUrl="https://cdn.test/video.mp4"
      />,
    );

    expect(
      screen.getByRole("button", { name: /watch now/i }),
    ).toBeInTheDocument();
  });

  it("keeps the schedule CTA when there is no video", () => {
    render(
      <BenefitsVideoSection
        category="Retirement"
        keyContacts={[{ fullName: "Dana Reed", schedulingUrl: "https://cal.test" }]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /watch now/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /schedule with dana/i }),
    ).toBeInTheDocument();
  });
});

/**
 * With no video the right-hand panel is a still image: the plan's own "Default
 * Image" (upload / gallery pick) when it has one, otherwise the category's stock
 * image. The poster is ignored — it describes a video that isn't there.
 */
describe("BenefitsVideoSection default image", () => {
  /** The rendered right-column image. */
  function panelImage(): HTMLImageElement {
    return screen.getByRole("img", {
      name: "Category placeholder image",
    }) as HTMLImageElement;
  }

  it("paints the plan's own default image", () => {
    render(
      <BenefitsVideoSection
        category="Retirement"
        planVideoFallbackImage="https://cdn.test/fallback.jpg"
      />,
    );

    expect(panelImage().src).toBe("https://cdn.test/fallback.jpg");
  });

  it("falls back to the category's stock image", () => {
    render(<BenefitsVideoSection category="Group Health" />);

    expect(panelImage().src).toContain("photo-1576091160399");
  });

  it("resolves a stored R2 key through the image proxy", () => {
    render(
      <BenefitsVideoSection
        category="Retirement"
        planVideoFallbackImage="benefits/plan-1/fallback.png"
      />,
    );

    expect(panelImage().src).toContain(
      "/api/r2/object?key=benefits%2Fplan-1%2Ffallback.png",
    );
  });

  it("ignores a stale poster, so the chosen image still shows", () => {
    render(
      <BenefitsVideoSection
        category="Retirement"
        planVideoFallbackImage="https://cdn.test/fallback.jpg"
        videoThumbnail="https://cdn.test/poster.jpg"
      />,
    );

    expect(panelImage().src).toBe("https://cdn.test/fallback.jpg");
  });
});

describe("BenefitsVideoSection webinars rail", () => {
  it("closes the section with the page's webinar rail when a placement is passed", () => {
    render(
      <BenefitsVideoSection category="Retirement" webinarsPlacement="retirement" />,
    );

    expect(screen.getByTestId("video-carousel")).toHaveAttribute(
      "data-placement",
      "retirement",
    );
  });

  it("renders no rail without a placement", () => {
    render(<BenefitsVideoSection category="Retirement" />);

    expect(screen.queryByTestId("video-carousel")).not.toBeInTheDocument();
  });
});

describe("BenefitsVideoSection videos rail heading", () => {
  it("names the row after the benefit", () => {
    render(
      <BenefitsVideoSection category="Retirement" webinarsPlacement="retirement" />,
    );

    expect(screen.getByTestId("video-carousel")).toHaveAttribute(
      "data-title",
      "Retirement Essentials",
    );
  });

  it("spells out the Custom hub's storage key", () => {
    // "Company / Plan Sponsor" is how the Custom hub is stored, not a heading.
    render(
      <BenefitsVideoSection
        category="Company / Plan Sponsor"
        webinarsPlacement="retirement"
      />,
    );

    expect(screen.getByTestId("video-carousel")).toHaveAttribute(
      "data-title",
      "Plan Essentials",
    );
  });

  it("falls back when there is no category yet", () => {
    render(<BenefitsVideoSection webinarsPlacement="retirement" />);

    expect(screen.getByTestId("video-carousel")).toHaveAttribute(
      "data-title",
      "Benefit Essentials",
    );
  });

  it("builds the heading as <category> Essentials", () => {
    expect(essentialsTitleFor("Retirement")).toBe("Retirement Essentials");
    expect(essentialsTitleFor("Group Health")).toBe("Group Health Essentials");
    expect(essentialsTitleFor("Group Life")).toBe("Group Life Essentials");
    expect(essentialsTitleFor("  ")).toBe("Benefit Essentials");
    expect(essentialsTitleFor(undefined)).toBe("Benefit Essentials");
  });
});

describe("BenefitsVideoSection webinar player", () => {
  it("replaces the two-column intro with the picked video", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BenefitsVideoSection
        category="Retirement"
        webinarsPlacement="retirement"
        clientId="plan-1"
      />,
    );

    // Resting state: the intro is laid out, no player.
    expect(screen.getByTestId("journey-intro").className).not.toContain(
      "hidden",
    );
    expect(screen.queryByTestId("video-player-stage")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /play webinar/i }));

    // The whole two-column top half is gone — heading, copy, CTAs and all.
    expect(screen.getByTestId("journey-intro").className).toContain("hidden");
    expect(screen.getByTestId("video-player-stage")).toBeInTheDocument();
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/abcdefghijk",
    );
    // The rail stays, marking the video it is playing.
    expect(screen.getByTestId("video-carousel")).toHaveAttribute(
      "data-active-id",
      "w1",
    );
  });

  it("runs the player full-bleed across the section's padding", async () => {
    const user = userEvent.setup();
    render(
      <BenefitsVideoSection category="Retirement" webinarsPlacement="retirement" />,
    );

    await user.click(screen.getByRole("button", { name: /play webinar/i }));

    const stage = screen.getByTestId("video-player-stage");
    // Full width of the parent, padding included: the negative margin cancels the
    // section's `px-*` and the width adds it back on both sides.
    expect(stage.className).toContain("-mx-4");
    expect(stage.className).toContain("w-[calc(100%+2rem)]");
    expect(stage.className).toContain("lg:-mx-8");
    expect(stage.className).toContain("lg:w-[calc(100%+4rem)]");
  });

  it("puts the two-column intro back when the X is pressed", async () => {
    const user = userEvent.setup();
    render(
      <BenefitsVideoSection category="Retirement" webinarsPlacement="retirement" />,
    );

    await user.click(screen.getByRole("button", { name: /play webinar/i }));
    await user.click(screen.getByRole("button", { name: /close video/i }));

    expect(screen.queryByTestId("video-player-stage")).not.toBeInTheDocument();
    expect(screen.getByTestId("journey-intro").className).not.toContain(
      "hidden",
    );
    expect(screen.getByTestId("video-carousel")).toHaveAttribute(
      "data-active-id",
      "",
    );
  });

  it("keeps the plan's own video silent while a webinar plays", async () => {
    const user = userEvent.setup();
    const pause = vi.fn();
    // jsdom implements no media playback: stand in for the element's `pause`, the
    // one thing the section calls when the player takes over.
    const original = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = pause;

    try {
      render(
        <BenefitsVideoSection
          category="Retirement"
          planVideoUrl="https://cdn.test/plan.mp4"
          webinarsPlacement="retirement"
        />,
      );

      await user.click(screen.getByRole("button", { name: /play webinar/i }));

      expect(pause).toHaveBeenCalled();
    } finally {
      HTMLMediaElement.prototype.pause = original;
    }
  });
});
