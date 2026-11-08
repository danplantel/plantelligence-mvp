import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PortalBenefitEditHint } from "@/components/portal-editing/portal-benefit-edit-hint";

/**
 * The hover note on a "Your Benefits at a Glance" card.
 *
 * Those cards belong to Benefit rows, not to the Landing Page's panel, so the
 * note has to tell the advisor where they ARE edited. It is guidance for the
 * advisor only: a participant must never see it.
 */

const mocks = vi.hoisted(() => ({
  editing: { value: null as null | Record<string, unknown> },
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => mocks.editing.value,
}));

describe("PortalBenefitEditHint", () => {
  it("renders nothing where no portal panel exists", () => {
    mocks.editing.value = null;
    render(<PortalBenefitEditHint benefitName="Retirement" />);

    expect(screen.queryByTestId("benefit-edit-hint")).not.toBeInTheDocument();
  });

  it("renders nothing for a viewer who may not edit", () => {
    mocks.editing.value = { canEdit: false };
    render(<PortalBenefitEditHint benefitName="Retirement" />);

    expect(screen.queryByTestId("benefit-edit-hint")).not.toBeInTheDocument();
  });

  it("says where the card IS edited, for an advisor", () => {
    mocks.editing.value = { canEdit: true };
    render(<PortalBenefitEditHint benefitName="Retirement" />);

    const hint = screen.getByTestId("benefit-edit-hint");
    expect(hint).toHaveTextContent("Retirement");
    expect(hint).toHaveTextContent(/edited on the dashboard/i);
    expect(hint).toHaveTextContent(/Create Benefit or Edit Benefit/i);
    // The exact place the card's properties live — named the way the Create/Edit
    // Benefit flow now labels that accordion.
    expect(hint).toHaveTextContent(/Branding → Your Benefits at a Glance Card/i);
    expect(hint).toHaveTextContent(/Your Benefits at a Glance/i);
    // A hover note must never swallow the click that opens the hub.
    expect(hint).toHaveClass("pointer-events-none");
  });

  it("still reads sensibly without a benefit name", () => {
    mocks.editing.value = { canEdit: true };
    render(<PortalBenefitEditHint />);

    expect(screen.getByTestId("benefit-edit-hint")).toHaveTextContent(
      /This card is edited on the dashboard/i,
    );
  });
});
