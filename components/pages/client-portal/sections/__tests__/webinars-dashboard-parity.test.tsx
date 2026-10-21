import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WebinarsDashboard } from "../webinars-dashboard";

/**
 * `WebinarsDashboard` is a thin wrapper around `WebinarsSection` for the News &
 * Events route.
 *
 * It used to import `HaveQuestionsSection` and `DocumentsSection` without ever
 * rendering them, which made it look like this route showed documents and
 * support contacts. It does not — those live on the benefit hubs.
 */

const mocks = vi.hoisted(() => ({
  props: null as any,
}));

vi.mock("@/components/pages/client-portal/sections/webinars-section", () => ({
  WebinarsSection: (props: any) => {
    mocks.props = props;
    return <div data-testid="webinars-section" />;
  },
}));

describe("WebinarsDashboard", () => {
  it("forwards only the webinar props", () => {
    render(
      <WebinarsDashboard
        brandColor="#123456"
        secondaryColor="#654321"
        clientId="plan-1"
        enableEditing
      />,
    );

    expect(mocks.props).toEqual({
      brandColor: "#123456",
      secondaryColor: "#654321",
      clientId: "plan-1",
    });
  });

  it("does not render documents or support contacts on this route", () => {
    render(<WebinarsDashboard clientId="plan-1" />);

    expect(screen.queryByText(/Documents/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Have Questions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/How can we help/i)).not.toBeInTheDocument();
  });

  it("renders exactly one section", () => {
    const { container } = render(<WebinarsDashboard clientId="plan-1" />);

    expect(
      container.querySelectorAll("[data-testid='webinars-section']"),
    ).toHaveLength(1);
  });
});
