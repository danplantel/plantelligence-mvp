import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewClientStep3 } from "../step-3-key-contacts/step-3-key-contacts";

/**
 * Create Plan step 3 (key contacts) routing.
 *
 * The four slides and the container are mocked — each slide has its own form
 * logic — so these tests pin the navigation contract: which slide opens for a
 * new vs existing plan, what each transition persists into the store, and the
 * backward-only dot navigation.
 */

const mocks = vi.hoisted(() => {
  const state: any = {};
  const resetState = (overrides: Record<string, unknown> = {}) => {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, {
      stepData: { keyContacts: { contacts: [] } },
      saveStepDataLocally: vi.fn(),
      saveStepDataToServer: vi.fn(async () => {}),
      saveAsDraft: vi.fn(async () => ({})),
      clearErrorFields: vi.fn(),
      setSelectedCategoryStep3a: vi.fn(),
      currentStep: 3,
      step3SlideIndex: undefined as number | undefined,
      // The real store updates the index; the slide-sync effect reads it back.
      setStep3SlideIndex: vi.fn((value: number) => {
        state.step3SlideIndex = value;
      }),
      advisorProfile: null,
      draftClientId: "plan-1",
      ...overrides,
    });
    return state;
  };
  return {
    state,
    resetState,
    explorerProps: [] as any[],
    fetchProfileOnce: vi.fn(async () => null),
  };
});

vi.mock("@/lib/new-client-wizard-store", () => {
  const useNewClientWizardStore = Object.assign(
    (selector?: (value: any) => unknown) =>
      selector ? selector(mocks.state) : mocks.state,
    { getState: () => mocks.state },
  );
  return { useNewClientWizardStore };
});

vi.mock("../step-3-key-contacts/slides/slide-container", () => ({
  SlideContainer: ({ currentIndex, children, onDotClick }: any) => (
    <div data-testid="slide-container" data-index={currentIndex}>
      <div>
        {[0, 1, 2, 3].map((index) => (
          <button
            key={index}
            type="button"
            data-testid={`dot-${index}`}
            onClick={() => onDotClick(index)}
          >
            Dot {index}
          </button>
        ))}
      </div>
      {children}
    </div>
  ),
}));

vi.mock("../step-3-key-contacts/slides/first-contact-prompt", () => ({
  FirstContactPrompt: ({ onContinue, onSomeoneElseSelect }: any) => (
    <div data-testid="first-contact-prompt">
      <button type="button" onClick={onContinue}>
        I am the main contact
      </button>
      <button type="button" onClick={() => onSomeoneElseSelect("recordkeeper")}>
        Someone else
      </button>
    </div>
  ),
}));

vi.mock("../step-3-key-contacts/slides/contact-form-slide", () => ({
  ContactFormSlide: ({ category, isGuided, onBack, onContinue }: any) => (
    <div
      data-testid="contact-form-slide"
      data-category={category}
      data-guided={String(isGuided)}
    >
      <button type="button" onClick={onBack}>
        Form back
      </button>
      <button type="button" onClick={onContinue}>
        Form continue
      </button>
    </div>
  ),
}));

vi.mock("../step-3-key-contacts/slides/category-explorer", () => ({
  CategoryExplorer: (props: any) => {
    mocks.explorerProps.push(props);
    return (
      <div
        data-testid="category-explorer"
        data-refresh-key={props.collaboratorsRefreshKey}
      >
        <button
          type="button"
          onClick={() => props.onCategorySelect("Group Health")}
        >
          Pick Health
        </button>
        <button type="button" onClick={props.onContinue}>
          Categories continue
        </button>
        <button type="button" onClick={props.onBack}>
          Categories back
        </button>
        <button type="button" onClick={() => props.onInviteCollaborator(null)}>
          Invite collaborator
        </button>
      </div>
    );
  },
}));

vi.mock("../step-3-key-contacts/step-3-contact-preview", () => ({
  NewClientStep3d: ({ onBack }: any) => (
    <div data-testid="contact-preview">
      <button type="button" onClick={onBack}>
        Preview back
      </button>
    </div>
  ),
}));

vi.mock("@/components/teammates/invite-collaborator-dialog", () => ({
  InviteCollaboratorDialog: ({ open, onInvited }: any) =>
    open ? (
      <div role="dialog" aria-label="Invite collaborator">
        <button type="button" onClick={() => onInvited?.()}>
          Send invite
        </button>
      </div>
    ) : null,
}));

vi.mock("@/lib/seed-onboarding-advisor-contacts", () => ({
  mergeOnboardingAdvisorContactsIntoKeyContacts: (contacts: any[]) => contacts,
}));

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: mocks.fetchProfileOnce,
}));

vi.mock("@/lib/benefit-contacts", () => ({
  // The component destructures `{ contacts, idMap, mergedCount }`; a mergedCount
  // of 0 means "nothing to heal", which keeps mount side effects out of the way.
  coalesceKeyContactsByPerson: (contacts: any[]) => ({
    contacts,
    idMap: {},
    mergedCount: 0,
  }),
  resolveMergedContactId: (id: string) => id,
}));

function mainContact(overrides: Record<string, unknown> = {}) {
  return {
    id: "main-1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@acme.test",
    benefitsCategories: ["Company / Plan Sponsor"],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.resetState();
  mocks.explorerProps.length = 0;
  mocks.fetchProfileOnce.mockReset().mockResolvedValue(null);
});

describe("NewClientStep3 routing", () => {
  it("starts on the first-contact prompt for a brand-new plan", async () => {
    render(<NewClientStep3 />);

    await screen.findByTestId("first-contact-prompt");
    expect(screen.getByTestId("slide-container")).toHaveAttribute(
      "data-index",
      "0",
    );
    await waitFor(() =>
      expect(mocks.state.setStep3SlideIndex).toHaveBeenCalledWith(0),
    );
  });

  it("continuing as the main contact seeds the form and moves to slide 1", async () => {
    const user = userEvent.setup();
    render(<NewClientStep3 />);
    await screen.findByTestId("first-contact-prompt");

    await user.click(
      screen.getByRole("button", { name: "I am the main contact" }),
    );

    // A brand-new plan has no existing contact to edit, so the form starts empty.
    expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith("step3b", {});
    const form = await screen.findByTestId("contact-form-slide");
    expect(form).toHaveAttribute("data-category", "Company / Plan Sponsor");
    expect(form).toHaveAttribute("data-guided", "true");
    expect(screen.getByTestId("slide-container")).toHaveAttribute(
      "data-index",
      "1",
    );
  });

  it("someone else starts a free (non-guided) form on slide 1", async () => {
    const user = userEvent.setup();
    render(<NewClientStep3 />);
    await screen.findByTestId("first-contact-prompt");

    await user.click(screen.getByRole("button", { name: "Someone else" }));

    expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
      "step3b",
      expect.objectContaining({ isFromSomeoneElse: true }),
    );
    const form = await screen.findByTestId("contact-form-slide");
    expect(form).toHaveAttribute("data-guided", "false");
  });

  it("moving past the saved contact clears the legacy step3a category and opens the explorer", async () => {
    const user = userEvent.setup();
    mocks.resetState({
      step3SlideIndex: 1,
      stepData: { keyContacts: { contacts: [mainContact()] } },
    });
    render(<NewClientStep3 />);
    await screen.findByTestId("contact-form-slide");

    await user.click(screen.getByRole("button", { name: "Form continue" }));

    expect(mocks.state.setSelectedCategoryStep3a).toHaveBeenCalledWith(null);
    expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith("step3a", {
      benefitsCategory: null,
      otherBenefitsText: "",
    });
    await screen.findByTestId("category-explorer");
  });

  it("choosing a category resets the form data and returns to slide 1", async () => {
    const user = userEvent.setup();
    mocks.resetState({
      step3SlideIndex: 2,
      stepData: { keyContacts: { contacts: [mainContact()] } },
    });
    render(<NewClientStep3 />);
    await screen.findByTestId("category-explorer");

    await user.click(screen.getByRole("button", { name: "Pick Health" }));

    expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith("step3b", {});
    const form = await screen.findByTestId("contact-form-slide");
    expect(form).toHaveAttribute("data-category", "Group Health");
  });

  it("continues from the explorer to the preview and back", async () => {
    const user = userEvent.setup();
    mocks.resetState({
      step3SlideIndex: 2,
      stepData: { keyContacts: { contacts: [mainContact()] } },
    });
    render(<NewClientStep3 />);
    await screen.findByTestId("category-explorer");

    await user.click(
      screen.getByRole("button", { name: "Categories continue" }),
    );
    await screen.findByTestId("contact-preview");

    await user.click(screen.getByRole("button", { name: "Preview back" }));
    await screen.findByTestId("category-explorer");
  });

  it("goes back to the explorer when a main contact exists", async () => {
    const user = userEvent.setup();
    mocks.resetState({
      step3SlideIndex: 2,
      stepData: { keyContacts: { contacts: [mainContact()] } },
    });
    render(<NewClientStep3 />);
    await screen.findByTestId("category-explorer");

    await user.click(screen.getByRole("button", { name: "Categories back" }));

    expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
      "step3b",
      expect.objectContaining({ editingContactId: "main-1" }),
    );
    const form = await screen.findByTestId("contact-form-slide");
    expect(form).toHaveAttribute("data-category", "Company / Plan Sponsor");
  });

  it("goes back to the prompt when there is no main contact", async () => {
    const user = userEvent.setup();
    render(<NewClientStep3 />);
    await screen.findByTestId("first-contact-prompt");

    // Walk forward without saving anything: the store still has no contacts, so
    // Back from the explorer has nowhere to edit and returns to the prompt.
    await user.click(
      screen.getByRole("button", { name: "I am the main contact" }),
    );
    await user.click(screen.getByRole("button", { name: "Form continue" }));
    await screen.findByTestId("category-explorer");

    await user.click(screen.getByRole("button", { name: "Categories back" }));

    await screen.findByTestId("first-contact-prompt");
  });

  it("resumes on the explorer when the plan already has a main contact", async () => {
    mocks.resetState({
      stepData: { keyContacts: { contacts: [mainContact()] } },
    });

    render(<NewClientStep3 />);

    await screen.findByTestId("category-explorer");
    expect(screen.getByTestId("slide-container")).toHaveAttribute(
      "data-index",
      "2",
    );
  });

  it("only allows dot navigation to earlier slides", async () => {
    const user = userEvent.setup();
    mocks.resetState({
      step3SlideIndex: 2,
      stepData: { keyContacts: { contacts: [mainContact()] } },
    });
    render(<NewClientStep3 />);
    await screen.findByTestId("category-explorer");

    await user.click(screen.getByTestId("dot-3"));
    expect(screen.getByTestId("slide-container")).toHaveAttribute(
      "data-index",
      "2",
    );

    await user.click(screen.getByTestId("dot-0"));
    await screen.findByTestId("first-contact-prompt");
  });

  it("opens the collaborator invite and refreshes the explorer after it is sent", async () => {
    const user = userEvent.setup();
    mocks.resetState({
      step3SlideIndex: 2,
      stepData: { keyContacts: { contacts: [mainContact()] } },
    });
    render(<NewClientStep3 />);
    await screen.findByTestId("category-explorer");

    await user.click(
      screen.getByRole("button", { name: "Invite collaborator" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Invite collaborator",
    });
    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(dialog).toBeInTheDocument();
    await waitFor(() => {
      const latest = mocks.explorerProps.at(-1);
      expect(latest?.collaboratorsRefreshKey).toBe(1);
    });
  });
});
