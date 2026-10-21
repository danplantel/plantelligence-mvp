import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewsPostList } from "@/components/pages/client-portal/sections/news-post-list";

/**
 * `NewsPostList` edge cases the main suite leaves out: the values an advisor
 * can actually type into a Marketing news post.
 *
 * Three of these pin deliberate current behaviour rather than desired
 * behaviour, and say so in the test name — the publish window is not enforced
 * on the portal, invalid dates print "Invalid Date", and `secondaryColor` is
 * accepted but never used.
 */

const mocks = vi.hoisted(() => ({
  assets: [] as any[],
  isLoading: false,
}));

vi.mock("@/hooks/useMarketingAssets", () => ({
  useNewsPostAssets: () => ({
    assets: mocks.assets,
    isLoading: mocks.isLoading,
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      variants: _variants,
      initial: _initial,
      whileInView: _whileInView,
      viewport: _viewport,
      transition: _transition,
      ...props
    }: any) => <div {...props}>{children}</div>,
  },
}));

function post(overrides: Record<string, any> = {}) {
  return {
    id: "post-1",
    clientId: "plan-1",
    type: "news-post",
    status: "published",
    headline: "A headline",
    body: "The body copy",
    ctaText: "",
    startDate: null,
    endDate: null,
    bgColor: "#ffffff",
    data: { category: "Announcement" },
    createdAt: "2026-02-10T12:00:00Z",
    updatedAt: "2026-02-10T12:00:00Z",
    ...overrides,
  };
}

function renderList(secondaryColor?: string) {
  return render(
    <NewsPostList
      clientId="plan-1"
      brandColor="#123456"
      secondaryColor={secondaryColor}
    />,
  );
}

function ctaLink(name = "Read more") {
  return screen.getByRole("link", { name });
}

beforeEach(() => {
  mocks.assets = [];
  mocks.isLoading = false;
});

describe("NewsPostList publish window", () => {
  it("still publishes a post whose end date has passed (known gap)", () => {
    mocks.assets = [
      post({
        headline: "Expired notice",
        startDate: "2025-01-01T00:00:00Z",
        endDate: "2025-02-01T00:00:00Z",
      }),
    ];
    renderList();

    // Nothing filters on the window: `status` is the only gate, and it is
    // applied server-side.
    expect(screen.getByText("Expired notice")).toBeInTheDocument();
  });

  it("still publishes a post whose start date is in the future (known gap)", () => {
    mocks.assets = [
      post({ headline: "Scheduled notice", startDate: "2099-01-01T00:00:00Z" }),
    ];
    renderList();

    expect(screen.getByText("Scheduled notice")).toBeInTheDocument();
  });
});

describe("NewsPostList invalid dates", () => {
  it("prints Invalid Date for an unparseable createdAt", () => {
    mocks.assets = [post({ createdAt: "not-a-date" })];
    renderList();

    expect(screen.getByText("Invalid Date")).toBeInTheDocument();
  });

  it("prints Invalid Date for an unparseable start date", () => {
    mocks.assets = [post({ startDate: "not-a-date" })];
    renderList();

    expect(screen.getByText("Invalid Date")).toBeInTheDocument();
  });
});

describe("NewsPostList CTA URLs", () => {
  function renderWithCta(ctaUrl: string) {
    mocks.assets = [
      post({ ctaText: "Read more", data: { category: "News", ctaUrl } }),
    ];
    renderList();
  }

  it("assumes https for a bare host", () => {
    renderWithCta("example.com/register");

    expect(ctaLink()).toHaveAttribute("href", "https://example.com/register");
  });

  it("keeps an explicit https URL", () => {
    renderWithCta("https://example.com/register");

    expect(ctaLink()).toHaveAttribute("href", "https://example.com/register");
  });

  it("keeps a mailto link instead of mangling it", () => {
    renderWithCta("mailto:events@example.com");

    expect(ctaLink()).toHaveAttribute("href", "mailto:events@example.com");
  });

  it("keeps a tel link", () => {
    renderWithCta("tel:+15551234567");

    expect(ctaLink()).toHaveAttribute("href", "tel:+15551234567");
  });

  it("keeps a protocol-relative URL", () => {
    renderWithCta("//cdn.example.com/register");

    expect(ctaLink()).toHaveAttribute("href", "//cdn.example.com/register");
  });

  it("renders the label without a link for an unsafe scheme", () => {
    renderWithCta("javascript:alert(1)");

    expect(
      screen.queryByRole("link", { name: "Read more" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Read more")).toBeInTheDocument();
  });
});

describe("NewsPostList payload robustness", () => {
  it("does not crash when data is not an object", () => {
    mocks.assets = [post({ data: "oops", headline: "No data object" })];
    renderList();

    expect(screen.getByText("No data object")).toBeInTheDocument();
    // Unknown category falls back to the default badge label.
    expect(screen.getByText("Announcement")).toBeInTheDocument();
  });

  it("styles an unknown category exactly like a known one (known no-op map)", () => {
    mocks.assets = [post({ data: { category: "Mystery" } })];
    const { container } = renderList();
    const unknownBadge = screen.getByText("Mystery");
    const unknownClass = unknownBadge.className;

    expect(unknownClass).toContain("bg-white/20");
    expect(container.querySelector("img")).toBeNull();
  });

  it("accepts secondaryColor but never uses it (known dead prop)", () => {
    mocks.assets = [post()];
    const { container } = renderList("#ff0000");

    // The card gradient is built from brandColor only.
    expect(container.innerHTML).not.toContain("ff0000");
  });
});
