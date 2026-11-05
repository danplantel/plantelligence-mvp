import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Where the published pop-up sits.
 *
 * It is a viewport dialog — drawn outside the scaled replica, so it is not
 * shrunk by the Editing Panel or the Comments rail — but it is confined to the
 * PORTAL's column: the Editing Panel publishes its width as
 * `--portal-editor-inset`, the rails publish theirs on the right, and the
 * overlay uses both as its insets. A participant sees neither panel, and the
 * advisor should not have their own panels dimmed by a participant-facing
 * dialog.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/plan-1" }));

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: () => ({ url: null }),
}));

const popUps = vi.hoisted(() => ({
  assets: [
    {
      id: "pop-1",
      type: "pop-up",
      status: "Published",
      headline: "Open enrollment",
      body: "Enrolment closes Friday.",
      ctaText: "",
      bgColor: "#23919c",
      data: { popupPages: ["all"], showEveryVisit: true },
    },
  ],
}));

// The real `shouldShowPopUpOnPage` decides targeting; only the fetch is stubbed.
vi.mock("@/hooks/useMarketingAssets", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useMarketingAssets")>();
  return {
    ...actual,
    usePopUpAssets: () => ({ assets: popUps.assets, isLoading: false }),
  };
});

import { PortalPopUpOverlay } from "../portal-popup-overlay";

describe("PortalPopUpOverlay placement", () => {
  it("covers the portal's column only, never the advisor's panels", async () => {
    render(<PortalPopUpOverlay clientId="plan-1" companyName="Acme" />);

    // The overlay waits a beat before showing, so the page has painted.
    const dialog = await screen.findByRole(
      "dialog",
      { name: "Open enrollment" },
      { timeout: 2000 },
    );

    // Confined to the page area between the Editing Panel and the rail.
    expect(dialog.style.left).toBe("var(--portal-editor-inset, 0px)");
    expect(dialog.style.right).toBe(
      "max(var(--comments-inset, 0px), var(--messages-inset, 0px))",
    );

    // Full height, and above the header, the controls and the chat pill.
    expect(dialog.className).toContain("inset-y-0");
    expect(dialog.className).toContain("z-[100]");
  });
});
