import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewsEventsPage from "../page";

/**
 * News & Events page with the REAL header.
 *
 * The page-level suite stubs the header; this one keeps it mounted so the
 * default-background path and heading are proven end to end.
 */

const mocks = vi.hoisted(() => ({
  clientData: undefined as any,
  brandingInput: undefined as string | null | undefined,
  brandingUrl: null as string | null,
  postsProps: null as any,
  webinarsProps: null as any,
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

beforeEach(() => {
  mocks.clientData = undefined;
  mocks.brandingInput = undefined;
  mocks.brandingUrl = null;
  mocks.postsProps = null;
  mocks.webinarsProps = null;
});

describe("NewsEventsPage integration", () => {
  it("renders the real header's bundled background when nothing resolves", () => {
    render(<NewsEventsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "News & Events" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Audience at event" }),
    ).toHaveAttribute("src", "/news-events-default-bg.webp");
  });

  it("renders a resolved header background", () => {
    mocks.brandingUrl = "https://cdn.test/resolved.webp";
    render(<NewsEventsPage />);

    expect(
      screen.getByRole("img", { name: "Audience at event" }),
    ).toHaveAttribute("src", "https://cdn.test/resolved.webp");
  });

  it("passes an absolute banner URL through to the resolver", () => {
    mocks.clientData = {
      id: "plan-1",
      secondaryBannerImg: "https://cdn.test/absolute.webp",
    };
    render(<NewsEventsPage />);

    expect(mocks.brandingInput).toBe("https://cdn.test/absolute.webp");
  });

  it("passes a data URL through to the resolver", () => {
    mocks.clientData = {
      id: "plan-1",
      secondaryBannerImg: "data:image/png;base64,abc",
    };
    render(<NewsEventsPage />);

    expect(mocks.brandingInput).toBe("data:image/png;base64,abc");
  });

  it("uses the portal defaults when the context has no client data", () => {
    render(<NewsEventsPage />);

    expect(mocks.postsProps).toMatchObject({
      clientId: undefined,
      brandColor: "#1F3A60",
      secondaryColor: "#6B7280",
    });
    expect(mocks.webinarsProps).toMatchObject({
      clientId: undefined,
      brandColor: "#1F3A60",
      secondaryColor: "#6B7280",
    });
  });

  it("falls back only for the missing brand color", () => {
    mocks.clientData = { id: "plan-1", secondaryColor: "#654321" };
    render(<NewsEventsPage />);

    expect(mocks.postsProps.brandColor).toBe("#1F3A60");
    expect(mocks.postsProps.secondaryColor).toBe("#654321");
  });

  it("falls back only for the missing secondary color", () => {
    mocks.clientData = { id: "plan-1", brandColor: "#123456" };
    render(<NewsEventsPage />);

    expect(mocks.postsProps.brandColor).toBe("#123456");
    expect(mocks.postsProps.secondaryColor).toBe("#6B7280");
  });

  it("renders exactly one h1", () => {
    render(<NewsEventsPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
