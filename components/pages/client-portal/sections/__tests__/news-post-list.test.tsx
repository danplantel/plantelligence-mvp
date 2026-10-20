import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewsPostList } from "@/components/pages/client-portal/sections/news-post-list";

const mocks = vi.hoisted(() => ({
  assets: [] as any[],
  isLoading: false,
  hookClientId: undefined as string | undefined,
}));

vi.mock("@/hooks/useMarketingAssets", () => ({
  useNewsPostAssets: (clientId?: string) => {
    mocks.hookClientId = clientId;
    return { assets: mocks.assets, isLoading: mocks.isLoading };
  },
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

function renderList(clientId: string | undefined = "plan-1") {
  return render(<NewsPostList clientId={clientId} brandColor="#123456" />);
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

beforeEach(() => {
  mocks.assets = [];
  mocks.isLoading = false;
  mocks.hookClientId = undefined;
});

describe("NewsPostList", () => {
  it("shows the pulse skeleton while loading", () => {
    mocks.isLoading = true;
    const { container } = renderList();

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("Announcements")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no posts", () => {
    const { container } = renderList();

    expect(container).toBeEmptyDOMElement();
  });

  it("sorts posts by createdAt descending", () => {
    mocks.assets = [
      post({ id: "old", headline: "Old", createdAt: "2026-01-01T00:00:00Z" }),
      post({ id: "new", headline: "New", createdAt: "2026-03-01T00:00:00Z" }),
      post({ id: "mid", headline: "Mid", createdAt: "2026-02-01T00:00:00Z" }),
    ];
    renderList();

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["New", "Mid", "Old"]);
  });

  it("falls back to Announcement for a blank headline", () => {
    mocks.assets = [post({ headline: "  " })];
    renderList();

    expect(
      screen.getByRole("heading", { level: 3, name: "Announcement" }),
    ).toBeInTheDocument();
  });

  it("renders the category badge and subtitle", () => {
    mocks.assets = [
      post({
        data: { category: "News", flyerSubtitle: "A short subtitle" },
      }),
    ];
    renderList();

    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("A short subtitle")).toBeInTheDocument();
  });

  it("renders the body copy", () => {
    mocks.assets = [post({ body: "Full body copy" })];
    renderList();

    expect(screen.getByText("Full body copy")).toBeInTheDocument();
  });

  it("renders the created date", () => {
    mocks.assets = [post({ createdAt: "2026-02-10T12:00:00Z" })];
    renderList();

    expect(screen.getByText(dateLabel("2026-02-10T12:00:00Z"))).toBeInTheDocument();
  });

  it("renders a start-end date range", () => {
    mocks.assets = [
      post({ startDate: "2026-03-01", endDate: "2026-03-05" }),
    ];
    renderList();

    expect(
      screen.getByText(
        `${dateLabel("2026-03-01")} - ${dateLabel("2026-03-05")}`,
      ),
    ).toBeInTheDocument();
  });

  it("omits the range separator for a start-only window", () => {
    mocks.assets = [post({ startDate: "2026-03-01", endDate: null })];
    renderList();

    expect(screen.getByText(dateLabel("2026-03-01"))).toBeInTheDocument();
    expect(screen.queryByText(/ - /)).not.toBeInTheDocument();
  });

  it("maps a known background image id to its public path", () => {
    mocks.assets = [post({ data: { bgImage: "bg_02" } })];
    const { container } = renderList();

    expect(
      container.querySelector(
        'img[src="/news-post-bg-images/news_post_bg_image_02.webp"]',
      ),
    ).toBeInTheDocument();
  });

  it("uses the brand gradient for an unknown background image", () => {
    mocks.assets = [post({ data: { bgImage: "unknown" } })];
    const { container } = renderList();

    expect(container.querySelector("img")).toBeNull();
    const card = container.querySelector(".group") as HTMLElement;
    expect(card.style.background).toContain("#123456");
  });

  it("renders a CTA link and normalizes a bare URL", () => {
    mocks.assets = [
      post({ ctaText: "Learn more", data: { ctaUrl: "example.com" } }),
    ];
    renderList();

    const link = screen.getByRole("link", { name: /Learn more/ });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("preserves an explicit https CTA URL", () => {
    mocks.assets = [
      post({
        ctaText: "Register",
        data: { ctaUrl: "https://example.com/register" },
      }),
    ];
    renderList();

    expect(screen.getByRole("link", { name: /Register/ })).toHaveAttribute(
      "href",
      "https://example.com/register",
    );
  });

  it("renders CTA text without a URL as a non-link", () => {
    mocks.assets = [post({ ctaText: "Coming soon", data: {} })];
    renderList();

    const label = screen.getByText("Coming soon");
    expect(label.closest("a")).toBeNull();
    expect(label.closest("span")).not.toBeNull();
  });

  it("renders no CTA when no text is configured", () => {
    mocks.assets = [post({ ctaText: "" })];
    renderList();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("applies the brand color to the section heading", () => {
    mocks.assets = [post()];
    renderList();

    expect(screen.getByRole("heading", { level: 2 })).toHaveStyle({
      color: "#123456",
    });
  });

  it("handles a null data payload without crashing", () => {
    mocks.assets = [post({ data: null, headline: "" })];
    renderList();

    expect(screen.getByText("Announcements")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Announcement" }),
    ).toBeInTheDocument();
  });

  it("passes the client id to the hook", () => {
    mocks.assets = [post()];
    renderList("plan-9");

    expect(mocks.hookClientId).toBe("plan-9");
  });

  it("passes undefined when there is no client id", () => {
    mocks.assets = [post()];
    renderList(undefined);

    expect(mocks.hookClientId).toBeUndefined();
  });
});
