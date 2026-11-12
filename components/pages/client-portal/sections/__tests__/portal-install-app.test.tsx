import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalInstallApp } from "../portal-install-app";

/**
 * `PortalInstallApp` — the portal's install chrome.
 *
 * The visible bar is browser-specific and covered by hand; these tests pin the
 * head metadata that decides what the INSTALLED app is called and which icon it
 * gets. Both must follow the plan, not the platform.
 */

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "acme" }),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({
    clientData: { companyName: "Team Seat LLC" },
  }),
}));

vi.mock("@/lib/pwa/install-prompt", () => ({
  isStandaloneDisplay: () => false,
  readInstallEnvironment: () => ({
    isIOS: false,
    isAndroid: false,
    isIOSBrowserOtherThanSafari: false,
  }),
  subscribeToInstallPrompt: () => () => {},
  promptForInstall: vi.fn(async () => "unavailable"),
}));

const SELECTORS = [
  'link[rel="manifest"]',
  'link[rel="apple-touch-icon"]',
  'meta[name="apple-mobile-web-app-title"]',
  'meta[name="application-name"]',
] as const;

function clearInstallMetadata() {
  for (const selector of SELECTORS) {
    document.head.querySelectorAll(selector).forEach((node) => node.remove());
  }
}

function metaContent(name: string) {
  return document.head
    .querySelector(`meta[name="${name}"]`)
    ?.getAttribute("content");
}

describe("PortalInstallApp metadata", () => {
  beforeEach(() => {
    clearInstallMetadata();
  });

  it("points the manifest and touch icon at this plan", async () => {
    render(<PortalInstallApp />);

    await waitFor(() => {
      expect(
        document.head
          .querySelector('link[rel="manifest"]')
          ?.getAttribute("href"),
      ).toBe("/api/pwa/manifest?slug=acme&name=Team%20Seat%20LLC");
    });

    expect(
      document.head
        .querySelector('link[rel="apple-touch-icon"]')
        ?.getAttribute("href"),
    ).toBe("/api/pwa/icon?slug=acme&size=192");
  });

  it("names the installed app with the full company name", async () => {
    render(<PortalInstallApp />);

    await waitFor(() =>
      expect(metaContent("apple-mobile-web-app-title")).toBe("Team Seat LLC"),
    );
    expect(metaContent("application-name")).toBe("Team Seat LLC");
  });

  it("restores the app-level metadata on unmount", async () => {
    const { unmount } = render(<PortalInstallApp />);

    await waitFor(() =>
      expect(metaContent("application-name")).toBe("Team Seat LLC"),
    );

    unmount();

    for (const selector of SELECTORS) {
      expect(document.head.querySelector(selector)).toBeNull();
    }
  });
});

describe("PortalInstallApp chatbot offset", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.style.removeProperty("--portal-install-inset");
  });

  it("publishes the bar's lift and clears it when dismissed", async () => {
    const user = userEvent.setup();
    render(<PortalInstallApp />);

    const dismiss = await screen.findByRole("button", {
      name: "Dismiss the app download prompt",
    });
    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue(
          "--portal-install-inset",
        ),
      ).toBe("4.5rem"),
    );

    await user.click(dismiss);

    // The chatbot's FAB and sheet include this value, so they settle into the space
    // the dismissed prompt leaves behind.
    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue(
          "--portal-install-inset",
        ),
      ).toBe("0rem"),
    );
  });
});
