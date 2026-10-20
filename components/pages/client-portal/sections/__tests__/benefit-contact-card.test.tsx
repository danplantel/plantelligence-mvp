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
      contact: { id: "c1", name: "Ada", benefitsCategory: "Other" },
    });

    expect(smallProps().categoryList).toEqual(["Other Benefits"]);
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
