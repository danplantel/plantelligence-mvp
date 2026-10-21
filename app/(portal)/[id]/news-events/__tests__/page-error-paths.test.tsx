import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewsEventsPage from "../page";

/**
 * `NewsEventsPage` with malformed plan data.
 *
 * The portal context hands over whatever the API returned, unvalidated. A
 * non-string banner used to throw on `.trim()` and blank the whole route; a
 * missing id is normal for an unsaved plan and must simply disable the two
 * client-scoped reads.
 */

const mocks = vi.hoisted(() => ({
  clientData: null as any,
  brandingInput: undefined as string | null | undefined,
  brandingUrl: null as string | null,
  headerProps: null as any,
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
});

describe("NewsEventsPage malformed data", () => {
  it("does not crash on a non-string banner and passes nothing to the hook", () => {
    mocks.clientData.secondaryBannerImg = 123;
    mocks.brandingUrl = null;

    expect(() => render(<NewsEventsPage />)).not.toThrow();
    expect(mocks.brandingInput).toBeNull();
    expect(mocks.headerProps.backgroundImage).toBeUndefined();
  });

  it("ignores an object-valued banner", () => {
    mocks.clientData.secondaryBannerImg = { url: "org/header.webp" };

    render(<NewsEventsPage />);

    expect(mocks.brandingInput).toBeNull();
  });

  it("passes an undefined client id through to both lists when the plan has none", () => {
    delete mocks.clientData.id;

    render(<NewsEventsPage />);

    expect(mocks.postsProps.clientId).toBeUndefined();
    expect(mocks.webinarsProps.clientId).toBeUndefined();
    expect(screen.getByTestId("news-post-list")).toBeInTheDocument();
  });

  it("passes an empty id through unchanged", () => {
    mocks.clientData.id = "";

    render(<NewsEventsPage />);

    expect(mocks.postsProps.clientId).toBe("");
    expect(mocks.webinarsProps.clientId).toBe("");
  });

  it("falls back to the portal defaults with no plan data at all", () => {
    mocks.clientData = null;
    mocks.brandingUrl = null;

    render(<NewsEventsPage />);

    expect(mocks.postsProps).toMatchObject({
      brandColor: "#1F3A60",
      secondaryColor: "#6B7280",
      clientId: undefined,
    });
    expect(mocks.headerProps.backgroundImage).toBeUndefined();
  });
});
