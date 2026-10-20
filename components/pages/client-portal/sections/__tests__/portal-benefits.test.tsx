import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalBenefits } from "../portal-benefits";

/**
 * `PortalBenefits` — the four hub cards on the landing page.
 *
 * This is where a plan's Benefit rows, the Edit Plan category toggles and the
 * Step 5 per-benefit switches meet, so the tests describe the resulting rule
 * rather than any one input:
 *
 *  - exactly four slots exist (Retirement, Health, Life, Custom/Other), filled
 *    by matching the API row's category — a plan with no rows still shows the
 *    four defaults;
 *  - a hidden hub removes its slot, and hiding all four removes the section;
 *  - a visible hub re-enables a row whose `isEnabled` is stale `false`, so the
 *    Step 5 switch only takes effect by hiding the category;
 *  - an incomplete benefit renders a placeholder card and, on the real portal,
 *    opens the "finish this benefit" dialog instead of navigating;
 *  - the card's image, copy and CTA each have a documented fallback chain.
 */

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  completeness: {} as Record<
    string,
    { isComplete: boolean; missingInfo: string[] }
  >,
  merge: vi.fn((benefit: Record<string, unknown>) => benefit),
  defaultBody: vi.fn((_category: string): string => ""),
  defaultImage: vi.fn((_category: string): string => ""),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/hub-benefit-defaults", () => ({
  mergeUserBenefitWithHubDefaults: (benefit: Record<string, unknown>) =>
    mocks.merge(benefit),
}));

vi.mock("@/lib/landing-card-defaults", () => ({
  getDefaultLandingCardBody: (category: string) => mocks.defaultBody(category),
}));

vi.mock("@/lib/portal-category-hero-background", () => ({
  getCategoryDefaultInnerImageUrl: (category: string) =>
    mocks.defaultImage(category),
}));

vi.mock("@/lib/benefit-completeness", () => ({
  getBenefitCompleteness: (category: string) =>
    mocks.completeness[category] ?? { isComplete: true, missingInfo: [] },
}));

type PortalBenefitsProps = React.ComponentProps<typeof PortalBenefits>;

function renderBenefits(overrides: Partial<PortalBenefitsProps> = {}) {
  const props: PortalBenefitsProps = {
    clientId: "plan-1",
    benefits: [],
    keyContacts: [],
    documents: [],
    ...overrides,
  };

  render(<PortalBenefits {...props} />);
  return props;
}

function sectionHeading() {
  return screen.getByRole("heading", { name: "Your Benefits at a Glance" });
}

function cardTitles() {
  return screen
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
}

function benefitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "benefit-retirement",
    category: "Retirement",
    title: "Retirement Plan Benefits",
    description: "Plan for the retirement you want.",
    buttonText: "RETIREMENT BENEFITS>",
    href: "/retirement",
    image: "https://cdn.test/card.png",
    isEnabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completeness = {};
  mocks.merge.mockImplementation((benefit) => benefit);
  mocks.defaultBody.mockReturnValue("");
  mocks.defaultImage.mockReturnValue("");
});

describe("PortalBenefits cards", () => {
  it("renders the four default hubs when the plan has no Benefit rows", () => {
    renderBenefits();

    expect(sectionHeading()).toBeInTheDocument();
    expect(cardTitles()).toEqual([
      "Retirement Plan Benefits",
      "Health Insurance",
      "Life Insurance",
      "Wellness Programs",
    ]);
  });

  it("fills a slot by category, case-insensitively", () => {
    renderBenefits({
      benefits: [
        benefitRow({
          category: "group health",
          title: "Your Health Plan",
          href: "/health-insurance",
        }),
      ] as any,
    });

    expect(cardTitles()).toContain("Your Health Plan");
    expect(cardTitles()).not.toContain("Health Insurance");
    expect(cardTitles()).toHaveLength(4);
  });

  it("removes the slot for a hidden hub", () => {
    renderBenefits({ categoryPortalVisibility: { Other: false } });

    expect(cardTitles()).toEqual([
      "Retirement Plan Benefits",
      "Health Insurance",
      "Life Insurance",
    ]);
  });

  it("removes the whole section when every hub is hidden", () => {
    renderBenefits({
      categoryPortalVisibility: {
        Retirement: false,
        "Group Health": false,
        "Group Life": false,
        Other: false,
      },
    });

    expect(
      screen.queryByRole("heading", { name: "Your Benefits at a Glance" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a row whose isEnabled is stale while its hub is published", () => {
    // Documented behaviour: visibility wins over the Step 5 switch, because a
    // published hub must not be emptied by an old `isEnabled: false` mirror.
    renderBenefits({
      benefits: [benefitRow({ isEnabled: false })] as any,
    });

    expect(cardTitles()).toContain("Retirement Plan Benefits");
  });

  it("sizes the grid for the number of visible cards", () => {
    renderBenefits({ categoryPortalVisibility: { Other: false } });

    const grid = sectionHeading().closest("section")!.querySelector(".grid");
    expect(grid?.className).toContain("lg:grid-cols-3");
  });

  it("links each card to the plan's hub page", () => {
    renderBenefits();

    expect(
      screen.getByRole("link", { name: /RETIREMENT BENEFITS/ }),
    ).toHaveAttribute("href", "/plan-1/retirement");
  });

  it("renders a non-navigating CTA in preview mode", () => {
    renderBenefits({ clientId: undefined });

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("RETIREMENT BENEFITS")).toBeInTheDocument();
  });
});

describe("PortalBenefits partner branding", () => {
  it("uses the partner name from the benefit's assigned contact", () => {
    renderBenefits({
      benefits: [benefitRow({ contactId: "contact-1" })] as any,
      keyContacts: [
        { id: "contact-1", companyName: "Waypoint" },
        { id: "contact-2", companyName: "Someone Else" },
      ] as any,
    });

    expect(screen.getByText("Waypoint")).toBeInTheDocument();
  });

  it("falls back to the category's primary contact", () => {
    renderBenefits({
      benefits: [benefitRow()] as any,
      keyContacts: [
        {
          id: "contact-1",
          companyName: "Secondary Partner",
          benefitsCategories: ["Retirement"],
        },
        {
          id: "contact-2",
          companyName: "Primary Partner",
          benefitsCategories: ["Retirement"],
          isPrimary: true,
        },
      ] as any,
    });

    expect(screen.getByText("Primary Partner")).toBeInTheDocument();
    expect(screen.queryByText("Secondary Partner")).not.toBeInTheDocument();
  });

  it("omits the partner line when no contact supplies a name", () => {
    renderBenefits({ benefits: [benefitRow()] as any, keyContacts: [] });

    // The card itself still renders; only the partner line is absent.
    expect(cardTitles()).toContain("Retirement Plan Benefits");
    expect(screen.queryByText("Primary Partner")).not.toBeInTheDocument();
  });
});

describe("PortalBenefits card content", () => {
  it("prefers the dedicated landing-card image", () => {
    renderBenefits({
      benefits: [
        benefitRow({
          landingCardImage: "https://cdn.test/landing.png",
          innerHeaderImage: "https://cdn.test/inner.png",
        }),
      ] as any,
    });

    expect(screen.getByAltText("Retirement Plan Benefits")).toHaveAttribute(
      "src",
      "https://cdn.test/landing.png",
    );
  });

  it("falls back to the hub's inner header image", () => {
    renderBenefits({
      benefits: [
        benefitRow({ innerHeaderImage: "https://cdn.test/inner.png" }),
      ] as any,
    });

    expect(screen.getByAltText("Retirement Plan Benefits")).toHaveAttribute(
      "src",
      "https://cdn.test/inner.png",
    );
  });

  it("falls back to the category default image", () => {
    mocks.defaultImage.mockReturnValue("https://cdn.test/hub-default.png");
    renderBenefits({ benefits: [benefitRow({ image: "" })] as any });

    expect(screen.getByAltText("Retirement Plan Benefits")).toHaveAttribute(
      "src",
      "https://cdn.test/hub-default.png",
    );
  });

  it("truncates the card copy at 75 characters", () => {
    renderBenefits({
      benefits: [
        benefitRow({
          description: "x".repeat(120),
          landingCardBody: undefined,
        }),
      ] as any,
    });

    const body = screen.getByText(/x+…$/);
    expect(body.textContent).toHaveLength(75);
  });

  it("prefers the category's default card copy over the row description", () => {
    mocks.defaultBody.mockImplementation((category: string) =>
      category === "Retirement" ? "Category default copy" : "",
    );
    renderBenefits({ benefits: [benefitRow()] as any });

    expect(screen.getByText("Category default copy")).toBeInTheDocument();
    expect(
      screen.queryByText("Plan for the retirement you want."),
    ).not.toBeInTheDocument();
  });

  it("strips the trailing chevron from the CTA and re-renders it as an icon", () => {
    renderBenefits({ benefits: [benefitRow()] as any });

    const link = screen.getByRole("link", { name: /RETIREMENT BENEFITS/ });
    expect(link).toHaveTextContent("RETIREMENT BENEFITS>");
    expect(within(link).getByText(">")).toBeInTheDocument();
  });

  it("calls onEdit instead of navigating when the editor passes a handler", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderBenefits({
      benefits: [benefitRow()] as any,
      onEdit,
    });

    await user.click(screen.getByAltText("Retirement Plan Benefits"));

    expect(onEdit).toHaveBeenCalledWith("benefit-retirement");
  });
});

describe("PortalBenefits incomplete benefits", () => {
  it("renders a placeholder card for an incomplete benefit", () => {
    mocks.completeness = {
      Retirement: { isComplete: false, missingInfo: ["Description missing"] },
    };
    renderBenefits();

    expect(screen.getByText("Benefit Incomplete")).toBeInTheDocument();
    expect(
      screen.getByText("This benefit is not yet set up."),
    ).toBeInTheDocument();
  });

  it("explains what is missing and links to the wizard", async () => {
    const user = userEvent.setup();
    mocks.completeness = {
      Retirement: {
        isComplete: false,
        missingInfo: ["Provider logo missing", "Description missing"],
      },
    };
    renderBenefits();

    await user.click(screen.getByText("Benefit Incomplete"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Incomplete Benefit Setup");
    expect(dialog).toHaveTextContent("Provider logo missing");
    expect(dialog).toHaveTextContent("Description missing");

    await user.click(
      within(dialog).getByRole("button", { name: /Finish Setup in Wizard/ }),
    );
    expect(mocks.push).toHaveBeenCalledWith(
      "/new-benefits?planId=plan-1&category=Retirement",
    );
  });

  it("skips the completeness gate entirely in preview mode", async () => {
    const user = userEvent.setup();
    mocks.completeness = {
      Retirement: { isComplete: false, missingInfo: ["Description missing"] },
    };
    renderBenefits({ clientId: undefined });

    // Without a clientId the gate is bypassed, so the card renders live rather
    // than as a placeholder — and there is no dialog to open.
    expect(screen.queryByText("Benefit Incomplete")).not.toBeInTheDocument();
    expect(cardTitles()).toContain("Retirement Plan Benefits");

    await user.click(screen.getByAltText("Retirement Plan Benefits"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
