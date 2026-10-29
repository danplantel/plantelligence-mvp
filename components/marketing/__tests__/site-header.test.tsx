import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketingHeader } from "@/components/marketing/site-header";

describe("MarketingHeader", () => {
  it("points the account links at the app origin", () => {
    render(<MarketingHeader appOrigin="https://plantel.pro" isSignedIn={false} />);

    const signInLinks = screen.getAllByRole("link", { name: "Sign in" });
    expect(signInLinks.length).toBeGreaterThan(0);
    for (const link of signInLinks) {
      expect(link).toHaveAttribute("href", "https://plantel.pro/signin");
    }

    const dashboardLinks = screen.getAllByRole("link", {
      name: "Go to dashboard",
    });
    expect(dashboardLinks.length).toBeGreaterThan(0);
    for (const link of dashboardLinks) {
      expect(link).toHaveAttribute("href", "https://plantel.pro/dashboard");
    }
  });

  it("swaps the primary label when a same-host session exists", () => {
    render(<MarketingHeader appOrigin="https://plantel.pro" isSignedIn />);

    const dashboardLinks = screen.getAllByRole("link", {
      name: "Go to dashboard",
    });
    expect(
      dashboardLinks.some(
        (link) => link.getAttribute("href") === "https://plantel.pro/dashboard",
      ),
    ).toBe(true);
  });

  it("opens and closes the mobile navigation", () => {
    render(<MarketingHeader appOrigin="https://plantel.pro" isSignedIn={false} />);

    const openButton = screen.getByRole("button", { name: "Open menu" });
    expect(openButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(openButton);

    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("navigation", { name: "Marketing mobile" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));

    expect(openButton).toHaveAttribute("aria-expanded", "false");
  });

  it("moves focus into the mobile panel and restores it on Escape", () => {
    render(<MarketingHeader appOrigin="https://plantel.pro" isSignedIn={false} />);

    const openButton = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(openButton);

    const panel = screen.getByRole("navigation", {
      name: "Marketing mobile",
    });
    const firstLink = panel.querySelector("a");
    expect(firstLink).not.toBeNull();
    expect(document.activeElement).toBe(firstLink);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Open menu" }),
    );
  });

  it("keeps Tab inside the open mobile panel", () => {
    render(<MarketingHeader appOrigin="https://plantel.pro" isSignedIn={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const panel = document.getElementById("marketing-mobile-nav");
    expect(panel).not.toBeNull();

    const focusable = Array.from(
      panel!.querySelectorAll<HTMLElement>("a[href], button"),
    );
    expect(focusable.length).toBeGreaterThan(0);

    const toggle = screen.getByRole("button", { name: "Close menu" });
    const last = focusable[focusable.length - 1];

    // Forward from the last panel item wraps back to the menu toggle, which
    // sits above the panel and closes it.
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(toggle);

    // Backwards from the toggle wraps to the last item in the panel.
    toggle.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("exposes a labelled mobile navigation target", () => {
    render(<MarketingHeader appOrigin="https://plantel.pro" isSignedIn={false} />);

    const openButton = screen.getByRole("button", { name: "Open menu" });
    expect(openButton).toHaveAttribute("aria-controls", "marketing-mobile-nav");
    expect(document.getElementById("marketing-mobile-nav")).not.toBeNull();
  });
});
