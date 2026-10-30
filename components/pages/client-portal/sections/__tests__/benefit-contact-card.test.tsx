import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitContactCard } from "../benefit-contact-card";

/**
 * `BenefitContactCard` is the one card entry point shared by the My Benefits
 * Team page and the benefit hub pages.
 *
 * Its whole job is the prop mapping:
 *
 *  - `asPrimary` → the wide `PrimaryContactCard`, otherwise `SmallVerticalCard`;
 *  - `compact` wins over `placement`, and `placement="category"` is compact by
 *    default because those pages are content-dense;
 *  - the benefit-category tag is only produced for `placement="team"` — on a
 *    category page it would just repeat the page you are already on.
 *
 * Both leaf cards are stubbed to JSON dumps, so the assertions are about what
 * the wrapper passed down.
 */

vi.mock("@/components/pages/my-benefits-team/primary-contact-card", () => ({
  PrimaryContactCard: (props: Record<string, unknown>) => (
    <pre data-testid="primary-card">{JSON.stringify(props)}</pre>
  ),
}));

vi.mock("@/components/pages/my-benefits-team/small-vertical-card", () => ({
  SmallVerticalCard: (props: Record<string, unknown>) => (
    <pre data-testid="small-card">{JSON.stringify(props)}</pre>
  ),
}));

const BASE_PROPS = {
  brandColor: "#123456",
  secondaryColor: "#654321",
  appointmentLink: "https://book.test",
  companyName: "Acme",
  baselineBackgroundColor: "#eeeeee",
};

function renderCard(
  props: Partial<React.ComponentProps<typeof BenefitContactCard>> = {},
) {
  render(
    <BenefitContactCard
      contact={{ id: "c1", name: "Ada" }}
      {...BASE_PROPS}
      {...props}
    />,
  );
}

function primaryProps() {
  return JSON.parse(screen.getByTestId("primary-card").textContent || "{}");
}

function smallProps() {
  return JSON.parse(screen.getByTestId("small-card").textContent || "{}");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BenefitContactCard variant selection", () => {
  it("renders the compact card for the team page by default", () => {
    renderCard();

    expect(screen.queryByTestId("primary-card")).not.toBeInTheDocument();
    expect(smallProps()).toMatchObject({ compact: false });
  });

  it("renders the primary card when asked", () => {
    renderCard({ asPrimary: true });

    expect(screen.queryByTestId("small-card")).not.toBeInTheDocument();
    expect(primaryProps()).toMatchObject({ compact: false });
  });

  it("is compact on a category page", () => {
    renderCard({ placement: "category" });

    expect(smallProps()).toMatchObject({ compact: true });
  });

  it("honours an explicit compact override on a category page", () => {
    renderCard({ placement: "category", compact: false });

    expect(smallProps()).toMatchObject({ compact: false });
  });

  it("honours an explicit compact override on the primary card", () => {
    renderCard({ asPrimary: true, placement: "category", compact: false });

    expect(primaryProps()).toMatchObject({ compact: false });
  });
});

describe("BenefitContactCard category tag", () => {
  it("tags a team card with its benefit category", () => {
    renderCard({
      contact: { id: "c1", name: "Ada", benefitsCategories: ["Retirement"] },
    });

    expect(smallProps()).toMatchObject({
      categoryLabel: "Retirement",
      categoryList: ["Retirement"],
    });
  });

  it("joins several categories and keeps the list for the tooltip", () => {
    renderCard({
      contact: {
        id: "c1",
        name: "Ada",
        benefitsCategories: ["Retirement", "Group Health"],
      },
    });

    expect(smallProps().categoryLabel).toBe("Retirement · Group Health");
    expect(smallProps().categoryList).toEqual(["Retirement", "Group Health"]);
  });

  it("folds stored spellings onto the contact-facing label", () => {
    renderCard({
      contact: { id: "c1", name: "Ada", benefitsCategory: "Health Insurance" },
    });

    expect(smallProps().categoryList).toEqual(["Group Health"]);
  });

  it("names the plan's custom benefit instead of 'Other Benefits'", () => {
    renderCard({
      contact: { id: "c1", name: "Ada", benefitsCategories: ["Other"] },
      customBenefitName: "Mindfulness and Me",
    });

    expect(smallProps()).toMatchObject({
      categoryLabel: "Mindfulness and Me",
      categoryList: ["Mindfulness and Me"],
    });
  });

  it("drops the 'Other Benefits' pill when the plan has no custom benefit", () => {
    renderCard({
      contact: { id: "c1", name: "Ada", benefitsCategories: ["Other"] },
    });

    expect(smallProps()).toMatchObject({ categoryLabel: "", categoryList: [] });
  });

  it("collapses a contact who covers every plan benefit to 'All Benefits'", () => {
    renderCard({
      contact: {
        id: "c1",
        name: "Ada",
        benefitsCategories: ["Retirement", "Group Health", "Group Life"],
      },
      planBenefitLabels: ["Retirement", "Group Health", "Group Life"],
    });

    expect(smallProps()).toMatchObject({
      categoryLabel: "All Benefits",
      categoryList: ["All Benefits"],
    });
  });

  it("counts the plan's custom benefit when deciding 'All Benefits'", () => {
    renderCard({
      contact: {
        id: "c1",
        name: "Ada",
        benefitsCategories: ["Other", "Retirement"],
      },
      customBenefitName: "Mindfulness and Me",
      planBenefitLabels: ["Retirement", "Mindfulness and Me"],
    });

    expect(smallProps().categoryList).toEqual(["All Benefits"]);
  });

  it("keeps the pills when one plan benefit is left uncovered", () => {
    renderCard({
      contact: {
        id: "c1",
        name: "Ada",
        benefitsCategories: ["Retirement", "Group Health"],
      },
      planBenefitLabels: ["Retirement", "Group Health", "Group Life"],
    });

    expect(smallProps().categoryList).toEqual(["Retirement", "Group Health"]);
  });

  it("keeps a single-benefit plan's own name instead of saying 'All'", () => {
    renderCard({
      contact: { id: "c1", name: "Ada", benefitsCategories: ["Retirement"] },
      planBenefitLabels: ["Retirement"],
    });

    expect(smallProps().categoryList).toEqual(["Retirement"]);
  });

  it("leaves a contact ROLE off the pills", () => {
    // "Company / Plan Sponsor" says what the person is, not which benefit they
    // cover — the card already carries the plan's own company name and logo.
    renderCard({
      contact: {
        id: "c1",
        name: "Ada",
        benefitsCategories: ["Company / Plan Sponsor"],
      },
    });

    expect(smallProps()).toMatchObject({ categoryLabel: "", categoryList: [] });
  });

  it("still names the benefits a plan-sponsor contact also covers", () => {
    renderCard({
      contact: {
        id: "c1",
        name: "Ada",
        benefitsCategories: ["Company / Plan Sponsor", "Retirement"],
      },
    });

    expect(smallProps().categoryList).toEqual(["Retirement"]);
  });

  it("does not tag a category-page card", () => {
    renderCard({
      placement: "category",
      contact: { id: "c1", name: "Ada", benefitsCategories: ["Retirement"] },
    });

    expect(smallProps()).toMatchObject({ categoryLabel: "", categoryList: [] });
  });
});

describe("BenefitContactCard pass-through", () => {
  it("forwards the colours, links and baseline to the compact card", () => {
    renderCard({ index: 3, disableAnimation: true });

    expect(smallProps()).toMatchObject({
      brandColor: "#123456",
      secondaryColor: "#654321",
      appointmentLink: "https://book.test",
      companyName: "Acme",
      baselineBackgroundColor: "#eeeeee",
      index: 3,
      disableAnimation: true,
    });
  });

  it("forwards the same identity fields to the primary card", () => {
    renderCard({ asPrimary: true });

    expect(primaryProps()).toMatchObject({
      brandColor: "#123456",
      secondaryColor: "#654321",
      appointmentLink: "https://book.test",
      companyName: "Acme",
      baselineBackgroundColor: "#eeeeee",
    });
  });
});
