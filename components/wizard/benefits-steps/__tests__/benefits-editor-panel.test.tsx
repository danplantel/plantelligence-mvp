import React from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsEditorPanel } from "../benefits-editor-panel";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";

/**
 * Section 4 ("How Can We Help You Today?") owns the wide Account Access card's
 * three fields — Plan / Group ID, the required "Register or Login Here" URL and
 * the Provider / Recordkeeper. They are the SAME stored values Section 6
 * ("Benefit Access & Materials") edits, so typing in either place must land on
 * `step1.insurancePlanId` / `insuranceLoginUrl` / `providerContact`.
 */

function seed() {
  useBenefitsWizardStore.getState().saveStepData(1, {
    planId: "plan-1",
    benefitCategory: "Retirement",
    contactId: "",
    benefitTitle: "Retirement Plan Benefits",
  } as any);
}

/** The Section 4 block (the heading's nearest `rounded-xl` wrapper). */
function sectionFour(): HTMLElement {
  const heading = screen.getByText(/Section 4: How Can We Help You Today\?/);
  const section = heading.closest(".rounded-xl");
  if (!section) throw new Error("Section 4 wrapper not found");
  return section as HTMLElement;
}

function step1() {
  return useBenefitsWizardStore.getState().stepData.step1 as any;
}

function renderPanel() {
  return render(
    <BenefitsEditorPanel isOpen isAnimating={false} onClose={vi.fn()} />,
  );
}

describe("BenefitsEditorPanel account access fields", () => {
  beforeEach(() => {
    seed();
  });

  it("puts the Account Access fields in Section 4", () => {
    renderPanel();
    const section = sectionFour();

    expect(
      within(section).getByText("Plan / Group ID"),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/Register or Login Here Button URL/),
    ).toBeInTheDocument();
    expect(
      within(section).getByText("Provider / Recordkeeper"),
    ).toBeInTheDocument();
  });

  it("marks the login URL as required in Section 4", () => {
    renderPanel();

    expect(
      within(sectionFour()).getByText("*", { selector: "span" }),
    ).toBeInTheDocument();
  });

  it("formats the Plan / Group ID as xxxx-xxxx-xxxx", () => {
    renderPanel();

    fireEvent.change(
      within(sectionFour()).getByPlaceholderText("xxxx-xxxx-xxxx"),
      { target: { value: "abcd1234" } },
    );

    expect(step1().insurancePlanId).toBe("ABCD-1234");
  });

  it("saves the login URL the card's button opens", () => {
    renderPanel();

    fireEvent.change(
      within(sectionFour()).getByPlaceholderText(
        "e.g. https://portal.empower.com/auth/login",
      ),
      { target: { value: "https://portal.example.com/login" } },
    );

    expect(step1().insuranceLoginUrl).toBe(
      "https://portal.example.com/login",
    );
  });

  it("saves the provider / recordkeeper from Section 4", () => {
    renderPanel();
    const section = sectionFour();

    fireEvent.change(
      within(section).getByPlaceholderText(
        "e.g. Voya, Empower, Principal, Fidelity",
      ),
      { target: { value: "Empower Retirement" } },
    );
    fireEvent.change(
      within(section).getByPlaceholderText("Provider contact (optional)"),
      { target: { value: "Dana Reed" } },
    );

    expect(step1().providerContact).toMatchObject({
      companyName: "Empower Retirement",
      contactName: "Dana Reed",
    });
  });

  it("has no separate Benefit Access & Materials section any more", () => {
    renderPanel();

    expect(
      screen.queryByText(/Section 6: Benefit Access & Materials/),
    ).not.toBeInTheDocument();
    // One editing surface for each of the card's fields.
    expect(screen.getAllByPlaceholderText("xxxx-xxxx-xxxx")).toHaveLength(1);
    expect(
      screen.getAllByPlaceholderText(
        "e.g. https://portal.empower.com/auth/login",
      ),
    ).toHaveLength(1);
  });
});
