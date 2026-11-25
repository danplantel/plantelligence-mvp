import React from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsEditorPanel } from "../benefits-editor-panel";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";

/**
 * Section 6 ("How Can We Help You Today?") owns the wide Account Access card's
 * three fields — Plan / Group ID, the required "Register or Log In" URL and
 * the Provider / Recordkeeper. They are the SAME stored values Benefit Access &
 * Materials edits, so typing in either place must land on
 * `step1.insurancePlanId` / `insuranceLoginUrl` / `providerContact`.
 *
 * The panel's order is: 1 Portal Header Button, 2 Typography, 3 Branding,
 * 4 Benefit Messaging, 5 Video Source, 6 How Can We Help You Today?,
 * 7 Get Quick Answers.
 */

function seed() {
  useBenefitsWizardStore.getState().saveStepData(1, {
    planId: "plan-1",
    benefitCategory: "Retirement",
    contactId: "",
    benefitTitle: "Retirement Plan Benefits",
  } as any);
}

/** The Section 6 block (the heading's nearest `rounded-xl` wrapper). */
function sectionSix(): HTMLElement {
  const heading = screen.getByText(/Section 6: How Can We Help You Today\?/);
  const section = heading.closest(".rounded-xl");
  if (!section) throw new Error("Section 6 wrapper not found");
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

/**
 * The Card Layout section's own controls: the show/hide checkbox (it writes the
 * layout's `enabled` flag, which the portal section reads) and, when the plan is
 * driven by Featured placements, "Move to Quick Answers" on each card.
 */
describe("BenefitsEditorPanel card layout", () => {
  beforeEach(() => {
    seed();
  });

  it("offers the show/hide checkbox on each card again", () => {
    renderPanel();

    expect(
      within(sectionSix()).getByTestId("help-card-enabled-account-access"),
    ).toBeInTheDocument();
  });

  it("hides a card through the checkbox, keeping its slot", () => {
    renderPanel();

    fireEvent.click(
      within(sectionSix()).getByTestId("help-card-enabled-account-access"),
    );

    const layout = (step1()?.helpCards ?? []) as { id: string; enabled?: boolean }[];
    const hidden = layout.find((entry) => entry.id === "account-access");
    expect(hidden?.enabled).toBe(false);
    // The card keeps its place: only the flag changed.
    expect(layout.length).toBeGreaterThan(1);
    expect(layout[0].id).toBe("account-access");
  });

  it("sets the card's own fields before the layout that arranges them", () => {
    renderPanel();

    const section = sectionSix();
    // Plan / Group ID, the Register or Log In URL and the Provider /
    // Recordkeeper describe what the Account Access card SAYS, so they lead the
    // section and the Card Layout follows them.
    const fieldsLabel = within(section).getByText("Plan / Group ID");
    const layoutLabel = within(section).getByText("Card Layout");

    expect(
      fieldsLabel.compareDocumentPosition(layoutLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("offers a visibility checkbox beside the card's own fields", () => {
    renderPanel();

    // On by default: a plan that stores no layout still shows the card.
    expect(
      within(sectionSix()).getByTestId("account-access-visible"),
    ).toBeChecked();
  });

  it("hides the Account Access card from beside its own fields, keeping its slot", () => {
    renderPanel();

    fireEvent.click(within(sectionSix()).getByTestId("account-access-visible"));

    const layout = (step1()?.helpCards ?? []) as {
      id: string;
      primary?: boolean;
      enabled?: boolean;
    }[];
    const hidden = layout.find((entry) => entry.id === "account-access");
    // The same `enabled` flag the Card Layout checkbox writes, so the two
    // controls read back each other's state.
    expect(hidden?.enabled).toBe(false);
    // Hiding is not deleting: the card keeps its slot and its Primary flag.
    expect(layout[0]?.id).toBe("account-access");
    expect(layout[0]?.primary).toBe(true);
  });
});

describe("BenefitsEditorPanel account access fields", () => {
  beforeEach(() => {
    seed();
  });

  it("puts the Account Access fields in Section 6", () => {
    renderPanel();
    const section = sectionSix();

    expect(within(section).getByText("Plan / Group ID")).toBeInTheDocument();
    expect(
      within(section).getByText(/Register or Log In Button URL/),
    ).toBeInTheDocument();
    expect(
      within(section).getByText("Provider / Recordkeeper"),
    ).toBeInTheDocument();
  });

  it("marks the login URL as required in Section 6", () => {
    renderPanel();

    expect(
      within(sectionSix()).getByText("*", { selector: "span" }),
    ).toBeInTheDocument();
  });

  it("formats the Plan / Group ID as xxxx-xxxx-xxxx", () => {
    renderPanel();

    fireEvent.change(
      within(sectionSix()).getByPlaceholderText("xxxx-xxxx-xxxx"),
      { target: { value: "abcd1234" } },
    );

    expect(step1().insurancePlanId).toBe("ABCD-1234");
  });

  it("saves the login URL the card's button opens", () => {
    renderPanel();

    fireEvent.change(
      within(sectionSix()).getByPlaceholderText(
        "e.g. https://portal.empower.com/auth/login",
      ),
      { target: { value: "https://portal.example.com/login" } },
    );

    expect(step1().insuranceLoginUrl).toBe("https://portal.example.com/login");
  });

  it("saves the provider / recordkeeper from Section 6", () => {
    renderPanel();
    const section = sectionSix();

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
      screen.queryByText(/Benefit Access & Materials/),
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

    expect(
      screen.getByDisplayValue("https://cal.com/team"),
    ).toBeInTheDocument();
  });
});

describe("BenefitsEditorPanel section order", () => {
  beforeEach(() => {
    seed();
  });

  it("runs Portal Header Button, Typography, Branding, Messaging, Video, Help, Quick Answers", () => {
    renderPanel();

    const labels = screen
      .getAllByText(/^Section \d+:/)
      .map((element) => element.textContent);

    // Video Source precedes How Can We Help You Today? — that is the order the
    // portal reads in, and the panel must match it.
    expect(labels.slice(0, 5)).toEqual([
      "Section 1: Portal Header Button",
      "Section 2: Typography",
      "Section 3: Branding",
      "Section 4: Benefit Messaging",
      "Section 5: Video Source",
    ]);

    const helpCardsAt = labels.indexOf("Section 6: How Can We Help You Today?");
    expect(helpCardsAt).toBe(5);

    // Quick Answers renders only once a location resolves, so it is asserted by
    // position when present rather than required.
    const quickAnswersAt = labels.indexOf(
      "Section 7: Get Quick Answers to Common Benefits Questions",
    );
    if (quickAnswersAt !== -1)
      expect(quickAnswersAt).toBeGreaterThan(helpCardsAt);
  });

  it("puts the portal's Benefit Documents between Quick Answers and Have Questions", () => {
    render(
      <BenefitsEditorPanel
        isOpen
        isAnimating={false}
        onClose={vi.fn()}
        benefitDocumentsSection={<p>documents editor</p>}
        extraSections={[{ title: "Disclosure", content: <p>disclosure</p> }]}
      />,
    );

    const labels = screen
      .getAllByText(/^Section \d+:/)
      .map((element) => element.textContent);
    const at = (label: string) => labels.indexOf(label);

    expect(at("Section 8: Benefit Documents")).toBeGreaterThan(-1);
    expect(at("Section 9: Have Questions?")).toBeGreaterThan(
      at("Section 8: Benefit Documents"),
    );
    // Everything appended after the real sections moves along with them.
    expect(at("Section 10: Disclosure")).toBeGreaterThan(
      at("Section 9: Have Questions?"),
    );
    // …and the documents editor is the section's content.
    expect(screen.getByText("documents editor")).toBeInTheDocument();
  });

  it("closes the numbering up when the documents section is not provided", () => {
    renderPanel();

    // The dashboard wizard and Edit Benefit keep their own documents step, so
    // "Have Questions?" stays Section 8 there.
    expect(screen.getByText("Section 8: Have Questions?")).toBeInTheDocument();
  });
});

describe("BenefitsEditorPanel header badge", () => {
  beforeEach(() => {
    seed();
  });

  it("renders a host-provided prefix alongside the plan badge", () => {
    render(
      <BenefitsEditorPanel
        isOpen
        isAnimating={false}
        onClose={vi.fn()}
        headerBadgePrefix={<span>Live</span>}
      />,
    );

    // This is how the portal adds its red Live tag without the dashboard
    // wizard/Edit Benefit gaining one.
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
