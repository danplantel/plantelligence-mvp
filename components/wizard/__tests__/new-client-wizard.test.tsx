import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewClientWizard } from "../new-client-wizard";

/**
 * Create Plan wizard chrome (`components/wizard/new-client-wizard.tsx`).
 *
 * The page-level suite mocks this component, so these tests cover what it
 * actually owns: the Previous / Save Draft / Next / Complete bar, the step-3
 * contact gates, the validation error UX (toasts + field focus), the
 * duplicate-name dialog, and the comment surface once a draft id exists.
 */

const mocks = vi.hoisted(() => {
  const state: any = {};
  const resetState = (overrides: Record<string, unknown> = {}) => {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, {
      currentStep: 1,
      errorFields: [],
      nextStep: vi.fn(async () => ({ isValid: true, errors: [] })),
      clearErrorFields: vi.fn(),
      saveAsDraft: vi.fn(async () => ({})),
      saveStepDataToServer: vi.fn(async () => {}),
      saveStepDataLocally: vi.fn(async () => {}),
      setErrorFields: vi.fn(),
      stepData: {},
      selectedCategoryStep3a: null,
      step3SlideIndex: undefined,
      duplicatePlanNameConflict: null,
      clearDuplicatePlanNameConflict: vi.fn(),
      resolveDuplicatePlanOverwrite: vi.fn(async () => {}),
      resolveDuplicatePlanSaveAsNew: vi.fn(async () => {}),
      draftClientId: null,
      ...overrides,
    });
    return state;
  };

  return {
    state,
    resetState,
    validate: vi.fn(),
    isDuplicatePlanNameError: vi.fn(() => false),
    focusFirstInvalidField: vi.fn(),
    markStep1NextPreSaved: vi.fn(),
    markStep2NextPreSaved: vi.fn(),
    markStep3dNextPreSaved: vi.fn(),
    markStep4NextPreSaved: vi.fn(),
    setWizardTransitionActive: vi.fn(),
    useCommentSurface: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  };
});

vi.mock("@/lib/new-client-wizard-store", () => {
  const useNewClientWizardStore = Object.assign(
    (selector?: (value: any) => unknown) =>
      selector ? selector(mocks.state) : mocks.state,
    {
      getState: () => mocks.state,
      setState: (patch: any) => {
        const next = typeof patch === "function" ? patch(mocks.state) : patch;
        Object.assign(mocks.state, next);
      },
    },
  );
  return {
    useNewClientWizardStore,
    focusFirstInvalidField: mocks.focusFirstInvalidField,
    markStep1NextPreSaved: mocks.markStep1NextPreSaved,
    markStep2NextPreSaved: mocks.markStep2NextPreSaved,
    markStep3dNextPreSaved: mocks.markStep3dNextPreSaved,
    markStep4NextPreSaved: mocks.markStep4NextPreSaved,
    setWizardTransitionActive: mocks.setWizardTransitionActive,
  };
});

vi.mock("@/lib/new-client-wizard-validation-v2", () => ({
  validateNewClientCurrentStepV2: mocks.validate,
}));

vi.mock("@/lib/duplicate-plan-name-error", () => ({
  isDuplicatePlanNameError: mocks.isDuplicatePlanNameError,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock("@/components/wizard/duplicate-plan-name-dialog", () => ({
  DuplicatePlanNameDialog: ({
    open,
    companyName,
    onCancel,
    onOverwrite,
    onSaveAsNew,
  }: any) =>
    open ? (
      <div role="dialog" aria-label="Duplicate plan">
        <p>{companyName}</p>
        <button type="button" onClick={onCancel}>
          Cancel duplicate
        </button>
        <button type="button" onClick={() => void onOverwrite()}>
          Overwrite
        </button>
        <button type="button" onClick={() => void onSaveAsNew("New Name")}>
          Save as new
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/comments/comment-anchor", () => ({
  CommentAnchor: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/comments/comment-mode-provider", () => ({
  useCommentSurface: (surface: unknown) => mocks.useCommentSurface(surface),
}));

const steps = [{ id: 1 }] as any;

function renderWizard(overrides: Record<string, unknown> = {}) {
  const props = {
    steps,
    currentStep: 1,
    totalSteps: 5,
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onComplete: vi.fn(),
    isFirstStep: false,
    isLastStep: false,
    children: <div data-testid="step-content">Step content</div>,
    ...overrides,
  };
  const view = render(<NewClientWizard {...(props as any)} />);
  return { ...view, props };
}

function validValidation() {
  return { isValid: true, errors: [], errorFields: [] };
}

beforeEach(() => {
  mocks.resetState();
  mocks.validate.mockReset().mockResolvedValue(validValidation());
  mocks.isDuplicatePlanNameError.mockReset().mockReturnValue(false);
  mocks.focusFirstInvalidField.mockReset();
  mocks.markStep1NextPreSaved.mockReset();
  mocks.markStep2NextPreSaved.mockReset();
  mocks.markStep3dNextPreSaved.mockReset();
  mocks.markStep4NextPreSaved.mockReset();
  mocks.setWizardTransitionActive.mockReset();
  mocks.useCommentSurface.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
});

describe("NewClientWizard chrome", () => {
  it("renders its children and disables Previous on the first step", () => {
    renderWizard({ isFirstStep: true });

    expect(screen.getByTestId("step-content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Save Draft/ }),
    ).not.toBeInTheDocument();
  });

  it("delegates Previous", async () => {
    const user = userEvent.setup();
    const { props } = renderWizard({ currentStep: 3 });

    await user.click(screen.getByRole("button", { name: /Previous/ }));

    expect(props.onPrevious).toHaveBeenCalledTimes(1);
  });

  it("gates Save Draft on canSaveDraft and explains why", async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn();
    const { props, rerender } = renderWizard({
      onSaveDraft,
      canSaveDraft: false,
    });

    const button = screen.getByRole("button", { name: /Save Draft/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "Add a company name to save a draft",
    );

    rerender(
      <NewClientWizard
        {...(props as any)}
        onSaveDraft={onSaveDraft}
        canSaveDraft={true}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Save Draft/ }));

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
  });

  it("shows the Save Draft loading label while saving", () => {
    renderWizard({ onSaveDraft: vi.fn(), isSavingDraft: true });

    expect(
      screen.getByRole("button", { name: /Saving draft\.\.\./ }),
    ).toBeDisabled();
  });

  it("runs validation then advances through nextStep and onNext", async () => {
    const user = userEvent.setup();
    const { props } = renderWizard({ currentStep: 1 });
    mocks.validate.mockResolvedValue(validValidation());

    await user.click(screen.getByRole("button", { name: /Next/ }));

    expect(mocks.validate).toHaveBeenCalledWith(1, mocks.state.stepData);
    expect(mocks.state.nextStep).toHaveBeenCalledTimes(1);
    expect(mocks.state.clearErrorFields).toHaveBeenCalledTimes(1);
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(mocks.markStep1NextPreSaved).toHaveBeenCalledTimes(1);
    expect(mocks.state.saveAsDraft).toHaveBeenCalled();
    expect(mocks.setWizardTransitionActive).toHaveBeenCalledWith(true);
    expect(mocks.setWizardTransitionActive).toHaveBeenLastCalledWith(false);
  });

  it("blocks the transition, focuses the field and names it in a toast when invalid", async () => {
    const user = userEvent.setup();
    const { props } = renderWizard({ currentStep: 1 });
    mocks.validate.mockResolvedValue({
      isValid: false,
      errors: [{ field: "companyName", message: "Company name is required" }],
      errorFields: ["companyName"],
    });

    await user.click(screen.getByRole("button", { name: /Next/ }));

    expect(mocks.state.setErrorFields).toHaveBeenCalledWith(["companyName"]);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please complete the following fields:",
      expect.objectContaining({ description: "Company Name", duration: 6000 }),
    );
    expect(mocks.state.nextStep).not.toHaveBeenCalled();
    expect(props.onNext).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mocks.focusFirstInvalidField).toHaveBeenCalledWith([
        "companyName",
      ]),
    );
  });

  it("raises a dedicated toast for a missing primary contact", async () => {
    const user = userEvent.setup();
    renderWizard({ currentStep: 3 });
    mocks.state.stepData = { keyContacts: { contacts: [{ id: "c1" }] } };
    mocks.validate.mockResolvedValue({
      isValid: false,
      errors: [
        {
          field: "primaryContact_Retirement",
          message: '"Retirement" must have at least one Primary contact.',
        },
      ],
      errorFields: ["primaryContact_Retirement"],
    });

    await user.click(screen.getByRole("button", { name: /Next/ }));

    expect(mocks.toastError).toHaveBeenCalledWith("Primary contact required", {
      description: '"Retirement" must have at least one Primary contact.',
      duration: 6000,
    });
    expect(mocks.focusFirstInvalidField).not.toHaveBeenCalled();
  });

  it("raises a dedicated toast when the Contact Form CTA has no email", async () => {
    const user = userEvent.setup();
    renderWizard({ currentStep: 3 });
    mocks.state.stepData = { keyContacts: { contacts: [{ id: "c1" }] } };
    mocks.validate.mockResolvedValue({
      isValid: false,
      errors: [
        {
          field: "contactFormCtaEmail",
          message: '"Ada": The "Contact Form" CTA requires an email.',
        },
      ],
      errorFields: ["contactFormCtaEmail"],
    });

    await user.click(screen.getByRole("button", { name: /Next/ }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Contact Form CTA requires an email",
      {
        description: '"Ada": The "Contact Form" CTA requires an email.',
        duration: 6000,
      },
    );
  });

  it("groups step-3b errors by contact", async () => {
    const user = userEvent.setup();
    renderWizard({ currentStep: 3 });
    mocks.state.currentStep = 3;
    mocks.state.stepData = {
      step3SubStep: "step3b",
      keyContacts: { contacts: [{ id: "c1" }] },
    };
    mocks.validate.mockResolvedValue({
      isValid: false,
      errors: [
        {
          field: "contact_c1_firstName",
          message: "x",
          contactName: "Ada Lovelace",
        },
        {
          field: "contact_c1_lastName",
          message: "x",
          contactName: "Ada Lovelace",
        },
      ],
      errorFields: [
        "contact_c1_firstName",
        "contact_c1_lastName",
        "firstName",
        "lastName",
      ],
    });

    await user.click(screen.getByRole("button", { name: /Next/ }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please complete the following fields:",
      expect.objectContaining({
        description: "Ada Lovelace: First Name, Last Name",
        duration: 6000,
      }),
    );
  });

  it("keeps Next enabled on step 3 slides so the slide flow can delegate", async () => {
    const user = userEvent.setup();
    // Step 3's per-slide validation runs in handleNextWithScroll, so the footer
    // button itself stays enabled (the contact-form slide is the exception,
    // covered by the Save Contact tests).
    renderWizard({ currentStep: 3 });
    mocks.state.currentStep = 3;

    const next = screen.getByRole("button", { name: /Next/ });
    expect(next).not.toBeDisabled();

    await user.click(next);
    expect(mocks.validate).toHaveBeenCalledWith(3, {});
  });

  it("labels the contact-form slide Save Contact and gates it on a reachable method", () => {
    mocks.state.step3SlideIndex = 1;
    mocks.state.stepData = {
      step3b: {
        displayEmail: false,
        displayPhone: false,
        enableContactButton: false,
      },
    };
    renderWizard({ currentStep: 3 });

    const button = screen.getByRole("button", { name: /Save Contact/ });
    expect(button).toBeDisabled();
  });

  it("enables Save Contact once a phone is shown", async () => {
    const user = userEvent.setup();
    mocks.state.step3SlideIndex = 1;
    mocks.state.stepData = {
      step3b: {
        displayPhone: true,
        displayEmail: false,
        enableContactButton: false,
      },
    };
    renderWizard({ currentStep: 3 });

    const button = screen.getByRole("button", { name: /Save Contact/ });
    expect(button).not.toBeDisabled();

    await user.click(button);
    expect(mocks.validate).toHaveBeenCalledTimes(1);
  });

  it("renders Complete Setup on the last step and delegates it", async () => {
    const user = userEvent.setup();
    const { props } = renderWizard({ currentStep: 5, isLastStep: true });

    expect(
      screen.queryByRole("button", { name: /Next/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Complete Setup/ }));

    expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(mocks.setWizardTransitionActive).toHaveBeenCalledWith(true);
    expect(mocks.setWizardTransitionActive).toHaveBeenLastCalledWith(false);
  });

  it("does not complete twice while a transition is already loading", async () => {
    const user = userEvent.setup();
    const { props } = renderWizard({
      currentStep: 5,
      isLastStep: true,
      isLoading: true,
    });

    await user.click(
      screen.getByRole("button", { name: /Completing client setup/ }),
    );

    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it("shows the duplicate-name dialog and wires its three actions", async () => {
    const user = userEvent.setup();
    mocks.state.duplicatePlanNameConflict = {
      existingClientId: "plan-live",
      companyName: "Acme",
    };
    renderWizard();

    const dialog = screen.getByRole("dialog", { name: "Duplicate plan" });
    expect(dialog).toHaveTextContent("Acme");

    await user.click(screen.getByRole("button", { name: "Cancel duplicate" }));
    expect(mocks.state.clearDuplicatePlanNameConflict).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Overwrite" }));
    expect(mocks.state.resolveDuplicatePlanOverwrite).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Save as new" }));
    expect(mocks.state.resolveDuplicatePlanSaveAsNew).toHaveBeenCalledWith(
      "New Name",
    );
  });

  it("swallows a duplicate-name rejection from nextStep", async () => {
    const user = userEvent.setup();
    const { props } = renderWizard({ currentStep: 1 });
    mocks.isDuplicatePlanNameError.mockReturnValue(true);
    mocks.state.nextStep.mockRejectedValue(new Error("duplicate"));

    await user.click(screen.getByRole("button", { name: /Next/ }));

    expect(props.onNext).not.toHaveBeenCalled();
    expect(mocks.state.clearErrorFields).not.toHaveBeenCalled();
  });

  it("saves compliance documents and the draft in the background when leaving step 4", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 4;
    mocks.state.stepData = {
      complianceDocuments: { spdFile: { name: "SPD" } },
    };
    renderWizard({ currentStep: 4 });

    await user.click(screen.getByRole("button", { name: /Next/ }));

    await waitFor(() =>
      expect(mocks.state.saveStepDataToServer).toHaveBeenCalledWith(
        "complianceDocuments",
        { spdFile: { name: "SPD" } },
      ),
    );
    expect(mocks.markStep4NextPreSaved).toHaveBeenCalledTimes(1);
    expect(mocks.state.saveAsDraft).toHaveBeenCalled();
  });

  it("publishes the comment surface only once a draft id exists", () => {
    renderWizard();

    expect(mocks.useCommentSurface).toHaveBeenCalledWith(null);
  });

  it("publishes a plan comment surface for a saved draft", () => {
    mocks.state.draftClientId = "draft-1";
    renderWizard();

    expect(mocks.useCommentSurface).toHaveBeenCalledWith({
      clientId: "draft-1",
      targetType: "plan",
      persisted: true,
    });
  });
});
