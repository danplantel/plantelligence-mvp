import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * News & Events' hero background carries a blue edit affordance.
 *
 * The hero is the plan's "Page Image Header" and it is edited in Section 1 of this
 * page's panel; the button opens the panel already scrolled to it. A participant
 * sees nothing.
 */

const mocks = vi.hoisted(() => ({
  portal: {
    clientData: {
      id: "plan-1",
      brandColor: "#1F3A60",
      secondaryColor: "#6B7280",
      secondaryBannerImg: "",
    } as Record<string, any>,
  },
  editing: {
    value: null as null | { canEdit: boolean; focusSection: (id: string) => void },
  },
  focusSection: vi.fn(),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => mocks.portal,
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => mocks.editing.value,
}));

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: () => ({ url: null }),
}));

vi.mock("@/components/pages/client-portal/sections/news-events-header", () => ({
  NewsEventsHeader: ({ backgroundImage }: { backgroundImage?: string }) => (
    <div data-testid="news-header" data-background={backgroundImage ?? ""} />
  ),
}));

vi.mock("@/components/pages/client-portal/sections/news-post-list", () => ({
  NewsPostList: () => <div data-testid="news-posts" />,
}));

vi.mock("@/components/pages/client-portal/sections/webinars-dashboard", () => ({
  WebinarsDashboard: () => <div data-testid="webinars" />,
}));

vi.mock("@/components/pages/client-portal/sections/news-events-resources", () => ({
  NewsEventsResources: () => <div data-testid="resources" />,
}));

import NewsEventsPage from "../page";

describe("NewsEventsPage — hero edit affordance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.value = { canEdit: true, focusSection: mocks.focusSection };
  });

  it("opens the panel on the hero background section", async () => {
    const user = userEvent.setup();
    render(<NewsEventsPage />);

    await user.click(
      screen.getByRole("button", { name: "Edit hero background" }),
    );

    expect(mocks.focusSection).toHaveBeenCalledWith("news-events-hero");
  });

  it("keeps the affordance off a participant's screen", () => {
    mocks.editing.value = null;
    render(<NewsEventsPage />);

    expect(
      screen.queryByRole("button", { name: "Edit hero background" }),
    ).not.toBeInTheDocument();
  });

  it("still renders the page underneath", () => {
    render(<NewsEventsPage />);

    expect(screen.getByTestId("news-header")).toBeInTheDocument();
    expect(screen.getByTestId("news-posts")).toBeInTheDocument();
    expect(screen.getByTestId("webinars")).toBeInTheDocument();
  });
});
