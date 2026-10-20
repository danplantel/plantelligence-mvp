import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewsEventsPage from "../page";

/**
 * Portal News & Events page.
 *
 * The portal context, the branding-url hook and the three rendered sections are
 * mocked, so these tests assert the page's own composition: which sections it
 * mounts, which plan/brand values it forwards, and how the header background is
 * resolved.
 */

const mocks = vi.hoisted(() => ({
  clientData: null as any,
  brandingInput: undefined as string | null | undefined,
  brandingUrl: null as string | null,
  headerProps: null as any,
  postsProps: null as any,
  webinarsProps: null as any,
  resourcesRendered: false,
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({ clientData: mocks.clientData }),
}));

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: (input: string | null | undefined) => {
    mocks.brandingInput = input;
    return { url: mocks.brandingUrl };
  },
}));

vi.mock("@/components/pages/client-portal/sections/news-events-header", () => ({
  NewsEventsHeader: (props: any) => {
    mocks.headerProps = props;
    return <div data-testid="news-events-header" />;
  },
}));

vi.mock("@/components/pages/client-portal/sections/news-post-list", () => ({
  NewsPostList: (props: any) => {
    mocks.postsProps = props;
    return <div data-testid="news-post-list" />;
  },
}));

vi.mock("@/components/pages/client-portal/sections/webinars-dashboard", () => ({
  WebinarsDashboard: (props: any) => {
    mocks.webinarsProps = props;
    return <div data-testid="webinars-dashboard" />;
  },
}));

vi.mock(
  "@/components/pages/client-portal/sections/news-events-resources",
  () => ({
    NewsEventsResources: () => {
      mocks.resourcesRendered = true;
      return <div data-testid="news-events-resources" />;
    },
  }),
);

function renderPage() {
  return render(<NewsEventsPage />);
}

beforeEach(() => {
  mocks.clientData = {
    id: "plan-1",
    brandColor: "#123456",
    secondaryColor: "#654321",
    secondaryBannerImg: "org/plan-1/header.webp",
  };
  mocks.brandingInput = undefined;
  mocks.brandingUrl = "https://cdn.test/header.webp";
  mocks.headerProps = null;
  mocks.postsProps = null;
  mocks.webinarsProps = null;
  mocks.resourcesRendered = false;
});

describe("NewsEventsPage", () => {
  it("renders the header, news posts and webinars", () => {
    renderPage();

    expect(screen.getByTestId("news-events-header")).toBeInTheDocument();
    expect(screen.getByTestId("news-post-list")).toBeInTheDocument();
    expect(screen.getByTestId("webinars-dashboard")).toBeInTheDocument();
  });

  it("does not render the commented-out resources section", () => {
    renderPage();

    expect(
      screen.queryByTestId("news-events-resources"),
    ).not.toBeInTheDocument();
    expect(mocks.resourcesRendered).toBe(false);
  });

  it("forwards the plan's colors and id to both sections", () => {
    renderPage();

    expect(mocks.postsProps).toEqual({
      clientId: "plan-1",
      brandColor: "#123456",
      secondaryColor: "#654321",
    });
    expect(mocks.webinarsProps).toEqual({
      clientId: "plan-1",
      brandColor: "#123456",
      secondaryColor: "#654321",
    });
  });

  it("falls back to the portal default colors without client data", () => {
    mocks.clientData = null;
    renderPage();

    expect(mocks.postsProps).toEqual({
      clientId: undefined,
      brandColor: "#1F3A60",
      secondaryColor: "#6B7280",
    });
    expect(mocks.webinarsProps).toEqual({
      clientId: undefined,
      brandColor: "#1F3A60",
      secondaryColor: "#6B7280",
    });
  });

  it("fills each missing color independently", () => {
    mocks.clientData = { id: "plan-1", brandColor: "", secondaryColor: "" };
    renderPage();

    expect(mocks.postsProps.brandColor).toBe("#1F3A60");
    expect(mocks.postsProps.secondaryColor).toBe("#6B7280");
  });

  it("passes the stored secondary banner to the branding resolver", () => {
    renderPage();

    expect(mocks.brandingInput).toBe("org/plan-1/header.webp");
  });

  it("trims the stored banner before resolving it", () => {
    mocks.clientData.secondaryBannerImg = "  https://cdn.test/banner.png  ";
    renderPage();

    expect(mocks.brandingInput).toBe("https://cdn.test/banner.png");
  });

  it("passes null when no secondary banner is stored", () => {
    mocks.clientData.secondaryBannerImg = "";
    renderPage();

    expect(mocks.brandingInput).toBeNull();
  });

  it("passes null for a whitespace-only banner", () => {
    mocks.clientData.secondaryBannerImg = "   ";
    renderPage();

    expect(mocks.brandingInput).toBeNull();
  });

  it("hands the resolved URL to the header", () => {
    mocks.brandingUrl = "https://cdn.test/resolved.webp";
    renderPage();

    expect(mocks.headerProps).toEqual({
      backgroundImage: "https://cdn.test/resolved.webp",
    });
  });

  it("leaves the header on its bundled default when no URL resolves", () => {
    mocks.brandingUrl = null;
    renderPage();

    expect(mocks.headerProps).toEqual({ backgroundImage: undefined });
  });

  it("renders the page on the white portal surface", () => {
    const { container } = renderPage();

    expect(container.firstElementChild).toHaveClass("bg-white");
    expect(container.querySelector("main")).toBeInTheDocument();
  });
});
