import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UpcomingWebinarCard, type UpcomingWebinar } from "../videos-card-section";

/**
 * `UpcomingWebinarCard` — one scheduled (or past) plan meeting.
 *
 * The card is a small state machine over three inputs: `isPast`, the
 * registration/join link, and the replay link. Those decide whether the footer
 * is a live CTA, a disabled button, or the "Replay not available" note; every
 * other field only adds a detail row.
 */

function renderCard(
  webinar: Partial<UpcomingWebinar> = {},
  secondaryColor?: string,
) {
  const props: UpcomingWebinar = {
    title: "Plan Review",
    date: "05/10/2026",
    ...webinar,
  };
  return render(
    <UpcomingWebinarCard webinar={props} secondaryColor={secondaryColor} />,
  );
}

function accentBar(container: HTMLElement) {
  return container.querySelector(".h-2") as HTMLElement;
}

describe("UpcomingWebinarCard labels", () => {
  it("shows the session's own title", () => {
    renderCard({ title: "Open Enrollment Q&A" });

    expect(
      screen.getByRole("heading", { level: 3, name: "Open Enrollment Q&A" }),
    ).toBeInTheDocument();
  });

  it('defaults the format label to "Group Sessions"', () => {
    renderCard();

    expect(screen.getByText("Group Sessions")).toBeInTheDocument();
  });

  it("uses the meeting type as the format label", () => {
    renderCard({ format: "Webinar" });

    expect(screen.getByText("Webinar")).toBeInTheDocument();
  });

  it("shows the advisor's description when there is one", () => {
    renderCard({ description: "We will walk through the new plan." });

    expect(
      screen.getByText("We will walk through the new plan."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/What we’ll cover/)).not.toBeInTheDocument();
  });

  it("falls back to the generic agenda when there is no description", () => {
    renderCard({ description: "   " });

    expect(screen.getByText(/What we’ll cover:/)).toBeInTheDocument();
    expect(
      screen.getByText("Plan features and investment options"),
    ).toBeInTheDocument();
  });
});

describe("UpcomingWebinarCard detail rows", () => {
  it("renders every optional detail", () => {
    renderCard({
      date: "05/10/2026",
      time: "2:30 PM (EST)",
      duration: "1 hour",
      meetingFormat: "Virtual",
      platform: "Zoom",
      language: "Spanish",
      location: "123 Main St",
    });

    expect(screen.getByText("05/10/2026")).toBeInTheDocument();
    expect(screen.getByText("2:30 PM (EST)")).toBeInTheDocument();
    expect(screen.getByText("1 hour")).toBeInTheDocument();
    expect(screen.getByText("Virtual · Zoom")).toBeInTheDocument();
    expect(screen.getByText("Spanish")).toBeInTheDocument();
    expect(screen.getByText("123 Main St")).toBeInTheDocument();
  });

  it("omits the rows it has no data for", () => {
    renderCard({ date: "" });

    expect(screen.queryByText("Duration")).not.toBeInTheDocument();
    expect(screen.queryByText("Language")).not.toBeInTheDocument();
    expect(screen.queryByText("Format")).not.toBeInTheDocument();
    expect(screen.queryByText("Start Time")).not.toBeInTheDocument();
  });
});

describe("UpcomingWebinarCard CTAs", () => {
  it("links a registration URL in a new tab", () => {
    renderCard({ registrationLink: "https://register.test/abc" });

    const link = screen.getByRole("link", {
      name: /Register for this Session/i,
    });
    expect(link).toHaveAttribute("href", "https://register.test/abc");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to the join link when there is no registration URL", () => {
    renderCard({ link: "https://meet.test/abc" });

    expect(
      screen.getByRole("link", { name: /Register for this Session/i }),
    ).toHaveAttribute("href", "https://meet.test/abc");
  });

  it("disables Register when the link is not a web URL", () => {
    renderCard({ registrationLink: "not-a-url" });

    expect(
      screen.getByRole("button", { name: /Register for this Session/i }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: /Register for this Session/i }),
    ).not.toBeInTheDocument();
  });

  it("offers the replay for a past meeting", () => {
    renderCard({ isPast: true, replayLink: "https://replay.test/abc" });

    expect(screen.getByRole("link", { name: /Watch replay/i })).toHaveAttribute(
      "href",
      "https://replay.test/abc",
    );
    expect(
      screen.queryByText(/Register for this Session/i),
    ).not.toBeInTheDocument();
  });

  it("says the replay is unavailable when a past meeting has no replay link", () => {
    renderCard({ isPast: true });

    expect(screen.getByText("Replay not available")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("ignores a non-http replay link", () => {
    renderCard({ isPast: true, replayLink: "replay.test/abc" });

    expect(screen.getByText("Replay not available")).toBeInTheDocument();
  });
});

describe("UpcomingWebinarCard accent", () => {
  it("defaults the accent to the portal gold", () => {
    const { container } = renderCard();

    expect(accentBar(container)).toHaveStyle({ backgroundColor: "#C9A961" });
  });

  it("uses the plan's secondary colour when supplied", () => {
    const { container } = renderCard({}, "#654321");

    expect(accentBar(container)).toHaveStyle({ backgroundColor: "#654321" });
  });
});
