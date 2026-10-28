import React from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsEditorPanel } from "../benefits-editor-panel";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";

/**
 * Section 5 ("How Can We Help You Today?") owns the wide Account Access card's
 * three fields — Plan / Group ID, the required "Register or Login Here" URL and
 * the Provider / Recordkeeper. They are the SAME stored values Section 6
 * ("Benefit Access & Materials") edits, so typing in either place must land on
 * `step1.insurancePlanId` / `insuranceLoginUrl` / `providerContact`.
 *
 * The panel's numbering starts with the plan-level Portal Header Button (Section
 * 1), so every earlier section moved down by one.
 */

function seed() {
  useBenefitsWizardStore.getState().saveStepData(1, {
    planId: "plan-1",
    benefitCategory: "Retirement",
    contactId: "",
    benefitTitle: "Retirement Plan Benefits",
  } as any);
}

/** The Section 5 block (the heading's nearest `rounded-xl` wrapper). */
function sectionFive(): HTMLElement {
  const heading = screen.getByText(/Section 5: How Can We Help You Today\?/);
  const section = heading.closest(".rounded-xl");
  if (!section) throw new Error("Section 5 wrapper not found");
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

  it("puts the Account Access fields in Section 5", () => {
    renderPanel();
    const section = sectionFive();

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

  it("marks the login URL as required in Section 5", () => {
    renderPanel();

    expect(
      within(sectionFive()).getByText("*", { selector: "span" }),
    ).toBeInTheDocument();
  });

  it("formats the Plan / Group ID as xxxx-xxxx-xxxx", () => {
    renderPanel();

    fireEvent.change(
      within(sectionFive()).getByPlaceholderText("xxxx-xxxx-xxxx"),
      { target: { value: "abcd1234" } },
    );

    expect(step1().insurancePlanId).toBe("ABCD-1234");
  });

  it("saves the login URL the card's button opens", () => {
    renderPanel();

    fireEvent.change(
      within(sectionFive()).getByPlaceholderText(
        "e.g. https://portal.empower.com/auth/login",
      ),
      { target: { value: "https://portal.example.com/login" } },
    );

    expect(step1().insuranceLoginUrl).toBe(
      "https://portal.example.com/login",
    );
  });

  it("saves the provider / recordkeeper from Section 5", () => {
    renderPanel();
    const section = sectionFive();

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

/**
 * Section 1 is the panel's only PLAN-level section: the portal header's call to
 * action (Login / Schedule a Call / None). It leads the panel, and every other
 * section moved down one number to make room for it.
 */
describe("BenefitsEditorPanel portal header button", () => {
  const SCHEDULE_URL_PLACEHOLDER =
    "https://calendly.com/your-team/benefits-review";

  beforeEach(() => {
    seed();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) } as any)),
    );
  });

  it("leads the panel with Section 1", () => {
    renderPanel();

    expect(
      screen.getByText(/Section 1: Portal Header Button/),
    ).toBeInTheDocument();
  });

  it("defaults to Login for a plan that stores nothing", () => {
    renderPanel();

    expect(screen.getByRole("radio", { name: /Login/ })).toBeChecked();
    // The live summary pill spells out what the header will show.
    expect(screen.getByText("Header shows")).toBeInTheDocument();
  });

  it("shows the plan's stored booking choice without touching the store", () => {
    useBenefitsWizardStore.getState().saveStepData(1, {
      ...(useBenefitsWizardStore.getState().stepData.step1 as any),
      selectedPlan: {
        employeePortalPreview: {
          headerCta: {
            mode: "schedule",
            url: "https://cal.com/team",
            label: "Book a review",
          },
        },
      },
    } as any);

    renderPanel();

    expect(
      screen.getByRole("radio", { name: /Schedule a Call/ }),
    ).toBeChecked();
    expect(
      screen.getByDisplayValue("https://cal.com/team"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Book a review")).toBeInTheDocument();
    // Reading the plan's value must not count as an edit.
    expect(step1().headerCta).toBeUndefined();
  });

  it("writes the choice into the wizard store", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("radio", { name: /None/ }));

    expect(step1().headerCta).toMatchObject({ mode: "none" });
  });

  it("keeps the booking link when the advisor switches away and back", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("radio", { name: /Schedule a Call/ }));
    fireEvent.change(screen.getByPlaceholderText(SCHEDULE_URL_PLACEHOLDER), {
      target: { value: "https://cal.com/team" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Login/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Schedule a Call/ }));

    expect(screen.getByDisplayValue("https://cal.com/team")).toBeInTheDocument();
  });
});
