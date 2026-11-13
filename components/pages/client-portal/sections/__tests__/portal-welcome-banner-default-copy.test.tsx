import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PortalWelcomeBanner } from "../portal-welcome-banner";

/**
 * The hub hero's fallback copy.
 *
 * The Intro Headline and Intro Message are the plan's saved `Benefit.title` and
 * `Benefit.shortDescription` (Create/Edit Benefit → Step 1 → Messaging). When a row
 * has neither — a legacy benefit, or one created outside the wizard — the banner has
 * to say something sensible.
 *
 * It used to say something wrong: a hard-coded advisor firm ("Waypoint") and a 401(k)
 * paragraph, on every hub. The fallback now comes from the same module the Messaging
 * step seeds (`lib/benefit-messaging-defaults.ts`), so it names the PLAN SPONSOR and
 * talks about THIS hub's benefit.
 */

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
}));

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: () => ({ url: null }),
}));

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: async () => null,
}));

function banner(props: Record<string, unknown> = {}) {
  return render(
    <PortalWelcomeBanner
      clientData={{ companyName: "Acme Corp", keyContacts: [] }}
      profile={{ name: "Ada Advisor", organizationName: "Acme Advisory" }}
      category="Group Health"
      {...props}
    />,
  );
}

describe("PortalWelcomeBanner default copy", () => {
  it("falls back to the plan sponsor's name and this hub's own benefit", () => {
    banner();

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome to Acme Corp!" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/medical, dental and vision/),
    ).toBeInTheDocument();
    // Neither the old hard-coded firm nor a retirement paragraph belongs on a health hub.
    expect(screen.queryByText(/Waypoint/)).toBeNull();
    expect(screen.queryByText(/retirement/i)).toBeNull();
  });

  it("keeps a saved headline and message exactly as they are", () => {
    banner({
      customHeadline: "Welcome to Acme!",
      customDescription: "Saved message.",
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome to Acme!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Saved message.")).toBeInTheDocument();
    expect(screen.queryByText(/medical, dental and vision/)).toBeNull();
  });
});
