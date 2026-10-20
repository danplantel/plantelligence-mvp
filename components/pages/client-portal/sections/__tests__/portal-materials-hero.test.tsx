import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalMaterialsHero } from "../portal-materials-hero";

/**
 * `PortalMaterialsHero` is the "account access" band on each hub.
 *
 * It answers three questions in one card — *who administers this benefit*, *what
 * is my plan id*, and *where do I log in* — and each answer has a precedence
 * worth pinning:
 *
 *  - the plan id comes from the prop, then `employeePortalPreview.insurancePlanId`,
 *    and is hidden entirely for the `[Not Set]` placeholder;
 *  - the administrator is the category's own provider, with the legacy
 *    plan-level `recordkeeper` used **only** for Retirement;
 *  - the login uses the prop handler, else `insuranceLoginUrl` in a new tab;
 *  - the background is the prop, then the plan's saved image, then the
 *    category's stock image.
 */

const mocks = vi.hoisted(() => ({
  clientData: null as Record<string, unknown> | null,
  open: vi.fn(),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({ clientData: mocks.clientData }),
}));

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: (raw: string | null) => ({ url: raw, loading: false }),
}));

vi.mock("@/lib/branding-image-url", () => ({
  isR2BrandingKey: () => false,
}));

vi.mock("@/lib/phone-utils", () => ({
  formatPhoneWithExtension: (phone: string) => `formatted:${phone}`,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

function plan(overrides: Record<string, unknown> = {}) {
  return {
    companyName: "Acme",
    employeePortalPreview: {},
    ...overrides,
  };
}

function heroImage() {
  return screen.getByAltText("Professional team in office environment");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clientData = plan();
  vi.spyOn(window, "open").mockImplementation(() => null);
});

describe("PortalMaterialsHero card", () => {
  it("renders the heading, CTA and default bullets", () => {
    render(<PortalMaterialsHero />);

    expect(
      screen.getByRole("heading", {
        name: "Group Health Insurance Account Access",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /REGISTER OR LOGIN HERE/ }),
    ).toBeInTheDocument();
    for (const bullet of [
      "See coverage",
      "Get ID cards",
      "Make changes",
      "Update dependents",
    ]) {
      expect(screen.getByText(bullet)).toBeInTheDocument();
    }
  });

  it("uses the card heading it was given", () => {
    render(
      <PortalMaterialsHero cardHeading="Retirement Plan Account Access" />,
    );

    expect(
      screen.getByRole("heading", { name: "Retirement Plan Account Access" }),
    ).toBeInTheDocument();
  });
});

describe("PortalMaterialsHero plan id", () => {
  it("shows the prop override", () => {
    render(<PortalMaterialsHero planIdLabel="PLAN / GROUP ID: 12345" />);

    expect(screen.getByText("PLAN / GROUP ID: 12345")).toBeInTheDocument();
  });

  it("falls back to the plan's saved insurance plan id", () => {
    mocks.clientData = plan({
      employeePortalPreview: { insurancePlanId: "ACME-001" },
    });
    render(<PortalMaterialsHero />);

    expect(screen.getByText("PLAN / GROUP ID: ACME-001")).toBeInTheDocument();
  });

  it("hides the placeholder and the empty case", () => {
    mocks.clientData = plan({
      employeePortalPreview: { insurancePlanId: "[Not Set]" },
    });
    render(<PortalMaterialsHero category="Retirement" />);
    expect(screen.queryByText(/PLAN \/ GROUP ID/)).not.toBeInTheDocument();

    render(<PortalMaterialsHero />);
    expect(screen.queryByText(/PLAN \/ GROUP ID/)).not.toBeInTheDocument();
  });
});

describe("PortalMaterialsHero administrator", () => {
  it("shows the category's provider and its contact line", () => {
    render(
      <PortalMaterialsHero
        category="Group Health"
        provider={{
          companyName: "Integrity",
          contactName: "Sam Service",
          phone: "8005551212",
        }}
      />,
    );

    expect(screen.getByText("Administered by")).toBeInTheDocument();
    expect(screen.getByText("Integrity")).toBeInTheDocument();
    expect(
      screen.getByText("Sam Service · formatted:8005551212"),
    ).toBeInTheDocument();
  });

  it("uses the legacy recordkeeper for Retirement only", () => {
    mocks.clientData = plan({ recordkeeper: "Waypoint" });

    const { unmount } = render(<PortalMaterialsHero category="Retirement" />);
    expect(screen.getByText("Waypoint")).toBeInTheDocument();
    unmount();

    render(<PortalMaterialsHero category="Group Life" />);
    expect(screen.queryByText("Waypoint")).not.toBeInTheDocument();
  });

  it("shows no administrator block when there is no provider", () => {
    render(<PortalMaterialsHero category="Group Health" />);

    expect(screen.queryByText("Administered by")).not.toBeInTheDocument();
  });
});

describe("PortalMaterialsHero login", () => {
  it("prefers the handler it was given", async () => {
    const user = userEvent.setup();
    const onButtonClick = vi.fn();
    render(<PortalMaterialsHero onButtonClick={onButtonClick} />);

    await user.click(screen.getByRole("button", { name: /REGISTER OR LOGIN/ }));

    expect(onButtonClick).toHaveBeenCalledTimes(1);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("opens the plan's login URL in a new tab", async () => {
    const user = userEvent.setup();
    mocks.clientData = plan({
      employeePortalPreview: { insuranceLoginUrl: "https://login.test" },
    });
    render(<PortalMaterialsHero />);

    await user.click(screen.getByRole("button", { name: /REGISTER OR LOGIN/ }));

    expect(window.open).toHaveBeenCalledWith(
      "https://login.test",
      "_blank",
      "noopener,noreferrer",
    );
  });
});

describe("PortalMaterialsHero background", () => {
  it("prefers the explicit background", () => {
    render(<PortalMaterialsHero backgroundImage="https://cdn.test/bg.png" />);

    expect(heroImage()).toHaveAttribute("src", "https://cdn.test/bg.png");
  });

  it("falls back to the plan's saved image", () => {
    mocks.clientData = plan({
      employeePortalPreview: {
        insuranceBackgroundImage: "https://cdn.test/saved.png",
      },
    });
    render(<PortalMaterialsHero />);

    expect(heroImage()).toHaveAttribute("src", "https://cdn.test/saved.png");
  });

  it("falls back to the category's stock image", () => {
    render(<PortalMaterialsHero category="Group Life" />);

    expect(heroImage().getAttribute("src")).toMatch(/unsplash/);
  });

  it("applies the overlay opacity it was given", () => {
    const { container } = render(
      <PortalMaterialsHero containerBlockOpacity={0.4} />,
    );

    const overlay = container.querySelector('div[style*="rgba(0, 0, 0, 0.4)"]');
    expect(overlay).not.toBeNull();
  });
});
