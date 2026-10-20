import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ClientViewLayout from "../layout";

/**
 * The portal chrome: header, banner, footer, comment surface and the
 * back-to-dashboard overlay.
 *
 * The layout is mostly composition, so the suite asserts **what it passes on**
 * — the header's visibility and hub list, the footer's resolved disclosures and
 * colour, the comment surface — plus the three behaviours it owns outright:
 *
 *  - the published notice banner (first asset only, countdown or headline,
 *    dismissible for this mount);
 *  - the back-to-dashboard buttons, which depend on a one-shot
 *    `sessionStorage` flag;
 *  - light-mode enforcement, which strips `html.dark` while a portal route is
 *    mounted and restores it afterwards.
 *
 * `ClientPortalProvider` and the heavy chrome pieces are stubbed so a failure
 * points at the layout rather than at the header's or footer's internals.
 */

const mocks = vi.hoisted(() => ({
  clientData: null as Record<string, unknown> | null,
  session: null as Record<string, unknown> | null,
  pathname: "/plan-1",
  fetch: vi.fn(),
  surfaces: [] as unknown[],
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
  usePathname: () => mocks.pathname,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mocks.session }),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  ClientPortalProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="portal-provider">{children}</div>
  ),
  useClientPortal: () => ({ clientData: mocks.clientData }),
}));

vi.mock("@/components/comments/portal-comments-rail", () => ({
  PortalCommentsRail: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="comments-rail-wrapper">{children}</div>
  ),
}));

vi.mock("@/components/comments/portal-comments-zoom", () => ({
  PortalCommentsZoom: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="comments-zoom-wrapper">{children}</div>
  ),
}));

vi.mock("@/components/pages/client-portal/sections/portal-install-app", () => ({
  PortalInstallApp: () => <div data-testid="install-app" />,
}));

vi.mock("@/components/comments/comment-mode-provider", () => ({
  useCommentSurface: (surface: unknown) => {
    mocks.surfaces.push(surface);
  },
}));

vi.mock("@/components/pages/client-portal/sections/portal-header", () => ({
  PortalHeader: (props: Record<string, unknown>) => (
    <pre data-testid="header-props">{JSON.stringify(props)}</pre>
  ),
}));

vi.mock(
  "@/components/pages/client-portal/sections/portal-popup-overlay",
  () => ({
    PortalPopUpOverlay: (props: Record<string, unknown>) => (
      <pre data-testid="popup-props">{JSON.stringify(props)}</pre>
    ),
  }),
);

vi.mock("@/components/layout/footer", () => ({
  Footer: (props: Record<string, unknown>) => (
    <pre data-testid="footer-props">{JSON.stringify(props)}</pre>
  ),
}));

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    companyName: "Acme",
    companyLogo: "https://cdn.test/logo.png",
    brandColor: "#123456",
    secondaryColor: "#654321",
    disclaimers: "Plan disclaimer",
    keyContacts: [],
    benefitHubs: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown) {
  return { json: async () => body, ok: true, status: 200 };
}

function renderLayout(children: React.ReactNode = <p>page content</p>) {
  return render(<ClientViewLayout>{children}</ClientViewLayout>);
}

function headerProps() {
  return JSON.parse(screen.getByTestId("header-props").textContent || "{}");
}

function footerProps() {
  return JSON.parse(screen.getByTestId("footer-props").textContent || "{}");
}

function popupProps() {
  return JSON.parse(screen.getByTestId("popup-props").textContent || "{}");
}

function lastSurface() {
  return mocks.surfaces[mocks.surfaces.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.clientData = plan();
  mocks.session = { user: { organizationName: "Acme Advisory" } };
  mocks.pathname = "/plan-1";
  mocks.surfaces = [];
  mocks.fetch.mockResolvedValue(jsonResponse({ success: true, data: [] }));
  vi.stubGlobal("fetch", mocks.fetch);
  sessionStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("portal layout composition", () => {
  it("renders the page inside the provider, the rail and the zoom", () => {
    renderLayout();

    expect(screen.getByTestId("portal-provider")).toBeInTheDocument();
    expect(screen.getByTestId("comments-rail-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("comments-zoom-wrapper")).toBeInTheDocument();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByTestId("install-app")).toBeInTheDocument();
  });

  it("passes the plan's identity and hub set to the header", () => {
    mocks.clientData = plan({
      categoryPortalVisibility: { Other: false },
      benefitHubs: [{ category: "Retirement", isEnabled: true }],
    });
    renderLayout();

    expect(headerProps()).toMatchObject({
      clientId: "plan-1",
      brandColor: "#123456",
      secondaryColor: "#654321",
      companyData: { companyLogo: "https://cdn.test/logo.png" },
      categoryPortalVisibility: { Other: false },
      benefitHubs: [{ category: "Retirement", isEnabled: true }],
    });
  });

  it("publishes the brand colours as CSS variables for the content", () => {
    const { container } = renderLayout();

    const content = container.querySelector(
      'div[style*="--brand-color"]',
    ) as HTMLElement;
    expect(content.style.getPropertyValue("--brand-color")).toBe("#123456");
    expect(content.style.getPropertyValue("--secondary-color")).toBe("#654321");
  });
});

describe("portal layout banner", () => {
  it("fetches the plan's published notices", async () => {
    renderLayout();

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/marketing/assets/public?clientId=plan-1&type=portal-notice",
      ),
    );
  });

  it("renders the first notice's headline", async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "a1",
            headline: "Open enrollment is live",
            bgColor: "#111",
            createdAt: "",
          },
          {
            id: "a2",
            headline: "Second notice",
            bgColor: "#222",
            createdAt: "",
          },
        ],
      }),
    );
    renderLayout();

    expect(
      await screen.findByText("Open enrollment is live"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Second notice")).not.toBeInTheDocument();
  });

  it("shows nothing when the API returns no notices", async () => {
    renderLayout();
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());

    expect(screen.queryByLabelText("Dismiss banner")).not.toBeInTheDocument();
  });

  it("dismisses the banner for this mount", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          { id: "a1", headline: "Notice", bgColor: "#111", createdAt: "" },
        ],
      }),
    );
    renderLayout();

    await user.click(await screen.findByLabelText("Dismiss banner"));

    expect(screen.queryByText("Notice")).not.toBeInTheDocument();
  });

  it("links a CTA with a URL and keeps its scheme", async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "a1",
            headline: "Questions?",
            bgColor: "#111",
            ctaText: "Email us",
            createdAt: "",
            data: { portalCtaUrl: "mailto:advice@acme.com" },
          },
        ],
      }),
    );
    renderLayout();

    expect(
      await screen.findByRole("link", { name: "Email us" }),
    ).toHaveAttribute("href", "mailto:advice@acme.com");
  });

  it("renders a CTA without a URL as inert text", async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "a1",
            headline: "Notice",
            bgColor: "#111",
            ctaText: "Learn more",
            createdAt: "",
          },
        ],
      }),
    );
    renderLayout();

    expect(await screen.findByText("Learn more")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Learn more" }),
    ).not.toBeInTheDocument();
  });

  it("counts down to the target and then reports it expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const target = new Date(
      Date.parse("2026-01-01T00:00:00.000Z") +
        ((3 * 24 + 4) * 3_600 + 5 * 60 + 6) * 1_000,
    ).toISOString();

    mocks.fetch.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "a1",
            headline: "Countdown",
            bgColor: "#111",
            createdAt: "",
            data: { noticeType: "countdown", countdownTarget: target },
          },
        ],
      }),
    );
    renderLayout();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("04")).toBeInTheDocument();
    expect(screen.getByText("05")).toBeInTheDocument();
    expect(screen.getByText("06")).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date(target));
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText("Expired")).toBeInTheDocument();
  });
});

describe("portal layout back-to-dashboard overlay", () => {
  it("stays hidden on a direct visit", async () => {
    renderLayout();

    await waitFor(() =>
      expect(
        screen.queryByText("← Go back to dashboard"),
      ).not.toBeInTheDocument(),
    );
  });

  it("appears when the advisor arrived from the dashboard, then consumes the flag", async () => {
    sessionStorage.setItem("previousPage", "1");
    renderLayout();

    expect(
      screen.getByRole("button", { name: "← Go back to dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "← Go back to editing" }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("previousPage")).toBeNull();
  });
});

describe("portal layout light mode", () => {
  it("strips dark mode for the portal and restores it afterwards", () => {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";

    const { unmount } = renderLayout();

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");

    unmount();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});

describe("portal layout comment surface", () => {
  it("registers the plan surface on the landing page", () => {
    renderLayout();

    expect(lastSurface()).toEqual({
      clientId: "plan-1",
      targetType: "plan",
      category: null,
    });
  });

  it("registers the hub's category on a benefit page", () => {
    mocks.pathname = "/plan-1/retirement";
    renderLayout();

    expect(lastSurface()).toMatchObject({
      targetType: "benefit",
      category: "Retirement",
    });
  });

  it("registers the custom hub by its own slug", () => {
    mocks.pathname = "/plan-1/mindfulness-and-me";
    mocks.clientData = plan({
      benefitHubs: [
        { category: "Company / Plan Sponsor", title: "Mindfulness and Me" },
      ],
    });
    renderLayout();

    expect(lastSurface()).toMatchObject({
      targetType: "benefit",
      category: "Other",
    });
    expect(popupProps().benefitPagePaths).toEqual(["/mindfulness-and-me"]);
  });

  it("registers nothing for a page it does not own", () => {
    mocks.pathname = "/plan-1/news-events";
    renderLayout();

    expect(lastSurface()).toBeNull();
  });
});

describe("portal layout footer", () => {
  it("passes the resolved names, colour and disclaimer to the footer", () => {
    renderLayout();

    expect(footerProps()).toMatchObject({
      brandColor: "#123456",
      organizationName: "Acme Advisory",
      companyName: "Acme",
      disclosuresText: "Plan disclaimer",
    });
  });

  it("uses a custom footer colour when the plan saved one", () => {
    mocks.clientData = plan({
      disclaimers: JSON.stringify({
        footerBackground: { mode: "custom", customColor: "#abcdef" },
      }),
    });
    renderLayout();

    expect(footerProps().brandColor).toBe("#abcdef");
  });

  it("uses the advisor's disclaimer when the plan has none", () => {
    mocks.clientData = plan({
      disclaimers: undefined,
      advisorDisclaimer: "Advisor disclaimer [Organization Name]",
    });
    renderLayout();

    expect(footerProps().disclosuresText).toContain(
      "Advisor disclaimer Acme Advisory",
    );
  });

  it("renders a plain-text disclaimer verbatim", () => {
    mocks.clientData = plan({ disclaimers: "Just words" });
    renderLayout();

    expect(footerProps().disclosuresText).toBe("Just words");
  });

  it("applies the plan's typography theme to the portal root", () => {
    mocks.clientData = plan({ typographyTheme: "classic" });
    const { container } = renderLayout();

    const root = container.querySelector(".portal-root") as HTMLElement;
    expect(root.style.getPropertyValue("--font-headline")).not.toBe("");
    expect(root.style.fontFamily).toBe("var(--font-ui)");
  });
});

describe("portal layout disclosure precedence", () => {
  function disclosures(overrides: Record<string, unknown>) {
    return JSON.stringify(overrides);
  }

  it("prefers the per-category disclaimer on that hub", () => {
    mocks.pathname = "/plan-1/retirement";
    mocks.clientData = plan({
      disclaimers: disclosures({
        byCategory: { Retirement: { text: "Retirement disclaimer" } },
      }),
    });
    renderLayout();

    expect(footerProps().disclosuresText).toBe("Retirement disclaimer");
  });

  it("uses the Home Page disclaimer on the landing page", () => {
    mocks.clientData = plan({
      disclaimers: disclosures({
        disclaimers: [
          { text: "Home Page disclaimer", locations: ["Home Page"] },
        ],
      }),
    });
    renderLayout();

    expect(footerProps().disclosuresText).toBe("Home Page disclaimer");
  });

  it("falls back to a category-specific row", () => {
    mocks.pathname = "/plan-1/health-insurance";
    mocks.clientData = plan({
      disclaimers: disclosures({
        disclaimers: [
          {
            text: "Health disclaimer",
            locations: ["Group Health / Dental / Vision"],
          },
        ],
      }),
    });
    renderLayout();

    expect(footerProps().disclosuresText).toBe("Health disclaimer");
  });

  it("includes apply-all rows alongside the category row", () => {
    mocks.pathname = "/plan-1/life-insurance";
    mocks.clientData = plan({
      disclaimers: disclosures({
        disclaimers: [
          { text: "Life disclaimer", locations: ["Group Life / Disability"] },
          { text: "Everywhere", apply_all_benefits_categories: true },
        ],
      }),
    });
    renderLayout();

    expect(footerProps().disclosuresText).toBe("Life disclaimer\n\nEverywhere");
  });

  it("lets the Home Page row short-circuit the universal text", () => {
    // The Home Page branch returns before the rows are combined, so
    // `useDefaultDisclosures` has no effect once that row exists. Pinned as it
    // is rather than "fixed": the landing page is meant to carry one text.
    mocks.clientData = plan({
      disclaimers: disclosures({
        useDefaultDisclosures: true,
        disclaimers: [
          { text: "Home Page disclaimer", locations: ["Home Page"] },
        ],
      }),
    });
    renderLayout();

    expect(footerProps().disclosuresText).toBe("Home Page disclaimer");
  });

  it("appends the universal text when the plan asked for it", () => {
    // On a hub page the rows are combined rather than short-circuited, so
    // `useDefaultDisclosures` applies here (the landing page returns early for
    // any Home Page / Global / apply-all row).
    mocks.pathname = "/plan-1/retirement";
    mocks.clientData = plan({
      disclaimers: disclosures({
        useDefaultDisclosures: true,
        disclaimers: [
          { text: "Retirement row", locations: ["Retirement Plan"] },
        ],
      }),
    });
    renderLayout();

    expect(footerProps().disclosuresText).toContain("Retirement row");
    expect(footerProps().disclosuresText).toContain("PlanTelligence");
  });

  it("drops duplicate row texts", () => {
    mocks.clientData = plan({
      disclaimers: disclosures({
        disclaimers: [
          { text: "Same text", apply_all_benefits_categories: true },
          { text: " same text ", apply_all_benefits_categories: true },
        ],
      }),
    });
    renderLayout();

    expect(footerProps().disclosuresText).toBe("Same text");
  });

  it("falls back to the universal text for an empty envelope", () => {
    mocks.clientData = plan({ disclaimers: disclosures({}) });
    renderLayout();

    expect(footerProps().disclosuresText).toContain("PlanTelligence");
  });
});
