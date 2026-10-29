import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketingPage } from "@/components/marketing/marketing-page";

function renderPage(isSignedIn = false) {
  return render(
    <MarketingPage
      appOrigin="https://plantel.pro"
      marketingOrigin="https://plantel.ai"
      isSignedIn={isSignedIn}
    />,
  );
}

describe("MarketingPage", () => {
  it("renders the hero and every anchor destination", () => {
    renderPage();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Every benefit");
    expect(heading).toHaveTextContent("one clear story");

    for (const anchor of ["#features", "#portal", "#communications", "#team", "#faq"]) {
      expect(document.querySelector(anchor)).not.toBeNull();
    }
  });

  it("sends primary calls to action into the app origin", () => {
    renderPage();

    const signInLinks = screen.getAllByRole("link", { name: "Sign in" });
    expect(signInLinks.length).toBeGreaterThan(0);
    for (const link of signInLinks) {
      expect(link).toHaveAttribute("href", "https://plantel.pro/signin");
    }

    expect(
      screen.getByRole("link", { name: /explore the platform/i }),
    ).toHaveAttribute("href", "#features");
  });

  it("has one h1, real landmarks, and no skipped heading levels", () => {
    renderPage();

    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    );
    expect(headings.filter((node) => node.tagName === "H1")).toHaveLength(1);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    // The skip link targets `#main`, and `tabIndex={-1}` is what lets it move
    // focus there rather than only scroll the page.
    expect(main).toHaveAttribute("id", "main");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();

    // Footer link groups are named navigation landmarks, not anonymous lists.
    expect(
      screen.getByRole("navigation", { name: "Platform" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Account" }),
    ).toBeInTheDocument();

    let previousLevel = 0;
    for (const heading of headings) {
      const level = Number(heading.tagName.slice(1));
      expect(level).toBeLessThanOrEqual(previousLevel + 1);
      previousLevel = level;
    }
  });

  it("publishes FAQ structured data", () => {
    renderPage();

    const script = document.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();

    const structuredData = JSON.parse(script?.textContent || "[]");
    expect(
      structuredData.some(
        (entry: { "@type"?: string }) => entry["@type"] === "FAQPage",
      ),
    ).toBe(true);
    expect(
      structuredData.some(
        (entry: { "@type"?: string }) =>
          entry["@type"] === "SoftwareApplication",
      ),
    ).toBe(true);
  });
});
