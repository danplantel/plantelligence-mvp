import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingWizard } from "../wizard";

const h = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const steps = [
    { id: 1, title: "New User Setup", description: "", completed: false },
    { id: 2, title: "Services", description: "", completed: false },
    {
      id: 3,
      title: "Organization Branding Setup",
      description: "",
      completed: false,
    },
    { id: 4, title: "User Setup", description: "", completed: false },
    { id: 5, title: "Summary", description: "", completed: false },
  ];

  const state: any = {
    currentStep: 1,
    totalSteps: 5,
    steps,
    step5SubStep: "review",
    editFromReview: false,
    stepData: {},
    errorFields: [],
    errorFieldsSource: null,
    teamInvites: [],
    autosaveToServer: false,
    nextStep: vi.fn(),
    previousStep: vi.fn(),
    completeStep: vi.fn(),
    completeWizard: vi.fn(),
    saveStepData: vi.fn(async () => undefined),
    saveStepDataToServer: vi.fn(async () => true),
    setErrorFields: vi.fn(),
    clearErrorFields: vi.fn(),
    setStep5SubStep: vi.fn(),
    returnToReview: vi.fn(),
    setAutosaveToServer: vi.fn(),
  };

  state.nextStep.mockImplementation(async () => {
    state.currentStep = Math.min(state.totalSteps, state.currentStep + 1);
    notify();
  });
  state.previousStep.mockImplementation(() => {
    state.currentStep = Math.max(1, state.currentStep - 1);
    notify();
  });
  state.setStep5SubStep.mockImplementation((sub: string) => {
    state.step5SubStep = sub;
    notify();
  });
  state.returnToReview.mockImplementation(() => {
    state.currentStep = 5;
    state.step5SubStep = "review";
    state.editFromReview = false;
    notify();
  });
  state.setErrorFields.mockImplementation((fields: string[], source: string) => {
    state.errorFields = fields;
    state.errorFieldsSource = source;
    notify();
  });
  state.clearErrorFields.mockImplementation(() => {
    state.errorFields = [];
    state.errorFieldsSource = null;
    notify();
  });
  state.setAutosaveToServer.mockImplementation((enabled: boolean) => {
    state.autosaveToServer = enabled;
  });

  const reset = () => {
    Object.assign(state, {
      currentStep: 1,
      totalSteps: 5,
      steps: steps.map((step) => ({ ...step })),
      step5SubStep: "review",
      editFromReview: false,
      stepData: {},
      errorFields: [],
      errorFieldsSource: null,
      teamInvites: [],
      autosaveToServer: false,
    });
    notify();
  };

  const setState = (partial: any) => {
    Object.assign(state, typeof partial === "function" ? partial(state) : partial);
    notify();
  };

  return { state, listeners, notify, reset, setState };
});

vi.mock("@/lib/onboarding-wizard-store", () => {
  const useOnboardingWizardStore = (
    selector: (state: typeof h.state) => unknown = (state) => state,
  ) =>
    React.useSyncExternalStore(
      (onChange) => {
        h.listeners.add(onChange);
        return () => {
          h.listeners.delete(onChange);
        };
      },
      () => selector(h.state),
      () => selector(h.state),
    );

  useOnboardingWizardStore.getState = () => h.state;
  useOnboardingWizardStore.setState = h.setState;

  return { useOnboardingWizardStore };
});

const validateCurrentStep = vi.hoisted(() =>
  vi.fn(
    async (
      _step: number,
      _data: unknown,
    ): Promise<{
      isValid: boolean;
      errors: unknown[];
      errorFields: string[];
    }> => ({ isValid: true, errors: [], errorFields: [] }),
  ),
);
const getSession = vi.hoisted(() => vi.fn(async () => null));
const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  message: vi.fn(),
}));

vi.mock("@/lib/wizard-validation", () => ({ validateCurrentStep }));
vi.mock("next-auth/react", () => ({ getSession }));
vi.mock("sonner", () => ({ toast }));

vi.mock("@/components/wizard/onboarding-wizard-stepper", () => ({
  OnboardingWizardStepper: ({
    currentStepTitle,
    currentStep,
  }: {
    currentStepTitle?: string;
    currentStep?: number;
  }) => (
    <div
      data-testid="stepper"
      data-title={currentStepTitle}
      data-step={currentStep}
    />
  ),
}));

vi.mock("@/components/ui/loading-button", () => ({
  LoadingButton: ({
    children,
    onClick,
    disabled,
    isLoading,
    loadingText,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    isLoading?: boolean;
    loadingText?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? loadingText : children}
    </button>
  ),
}));

vi.mock(
  "@/components/wizard/steps/sections/attestation-modals/add-now-attestation-modal",
  () => ({
    AddNowAttestationModal: ({
      isOpen,
      onConfirm,
    }: {
      isOpen: boolean;
      onConfirm: () => void;
    }) =>
      isOpen ? (
        <button type="button" data-testid="confirm-attestation" onClick={onConfirm}>
          confirm attestation
        </button>
      ) : null,
  }),
);

vi.mock(
  "@/components/wizard/steps/sections/attestation-modals/skip-attestation-modal",
  () => ({
    SkipAttestationModal: ({
      isOpen,
      onConfirm,
    }: {
      isOpen: boolean;
      onConfirm: () => void;
    }) =>
      isOpen ? (
        <button type="button" data-testid="confirm-skip" onClick={onConfirm}>
          confirm skip
        </button>
      ) : null,
  }),
);

vi.mock(
  "@/components/wizard/steps/sections/attestation-modals/invite-later-modal",
  () => ({
    InviteLaterModal: ({
      isOpen,
      onConfirm,
    }: {
      isOpen: boolean;
      onConfirm: () => void;
    }) =>
      isOpen ? (
        <button type="button" data-testid="confirm-invite-later" onClick={onConfirm}>
          confirm invite later
        </button>
      ) : null,
  }),
);

function StepChild({ onStep5Skip }: { onStep5Skip?: () => void }) {
  return (
    <div data-testid="step-content">
      Step content
      <button type="button" onClick={() => onStep5Skip?.()}>
        child-skip
      </button>
      <input name="name" defaultValue="Ada" />
      <input name="phone" defaultValue="(213) 588-8888" />
      <input name="title" defaultValue="Advisor" />
      <input name="organizationEmail" defaultValue="org@example.com" />
    </div>
  );
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

const fetchMock = vi.fn();

function renderWizard(props: Record<string, unknown> = {}) {
  return render(
    <OnboardingWizard {...props}>
      <StepChild />
    </OnboardingWizard>,
  );
}

function primaryButton() {
  return screen.getByRole("button", {
    name: /Next|Looks Good|Confirm Disclosures|Send \d+ Invite|Finish|Save & Return/,
  });
}

async function clickConfirm(testId: string) {
  await userEvent.click(screen.getByTestId(testId));
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    h.reset();
    validateCurrentStep.mockReset();
    validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
      errorFields: [],
    });
    getSession.mockClear();
    toast.error.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    // The completion path redirects after 3s. Skip that timer so tests never
    // attempt a jsdom navigation; keep the short scroll/validation timers.
    const realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (delay === 3000) return 0 as unknown as ReturnType<typeof setTimeout>;
      return realSetTimeout(callback, delay, ...args);
    }) as typeof setTimeout);

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("rendering and step labels", () => {
    it("renders the current step, title, and disables Previous on step 1", () => {
      renderWizard();

      expect(screen.getByTestId("stepper")).toHaveAttribute(
        "data-title",
        "New User Setup",
      );
      expect(screen.getByTestId("step-content")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
      expect(primaryButton()).toHaveTextContent("Next");
    });

    it("uses the Step 5 sub-step title", () => {
      h.setState({ currentStep: 5, step5SubStep: "disclosures" });

      renderWizard();

      expect(screen.getByTestId("stepper")).toHaveAttribute(
        "data-title",
        "Review & Finish",
      );
    });

    it("labels 5a as review", () => {
      h.setState({ currentStep: 5, step5SubStep: "review" });

      renderWizard();

      expect(screen.getByTestId("stepper")).toHaveAttribute(
        "data-title",
        "Review Your Information",
      );
      expect(primaryButton()).toHaveTextContent("Looks Good, Continue");
    });

    it("labels 5b with confirm and skip actions", () => {
      h.setState({ currentStep: 5, step5SubStep: "disclosures" });

      renderWizard();

      expect(primaryButton()).toHaveTextContent("Confirm Disclosures");
      expect(
        screen.getByRole("button", { name: "Skip for Now" }),
      ).toBeInTheDocument();
    });

    it("labels 5c with the number of filled invites", () => {
      h.setState({
        currentStep: 5,
        step5SubStep: "team",
        stepData: { teamSize: { teamSize: "2_5" } },
        teamInvites: [
          {
            id: "1",
            fullName: "Bob",
            email: "bob@example.com",
            role: "viewer",
            status: "pending",
          },
          {
            id: "2",
            fullName: "Sue",
            email: "sue@example.com",
            role: "viewer",
            status: "pending",
          },
          {
            id: "3",
            fullName: "",
            email: "",
            role: "viewer",
            status: "pending",
          },
        ],
      });

      renderWizard();

      expect(primaryButton()).toHaveTextContent("Send 2 Invites & Finish");
      expect(
        screen.getByRole("button", { name: "Invite Later" }),
      ).toBeInTheDocument();
    });

    it("labels 5c as Finish when no invites are staged", () => {
      h.setState({
        currentStep: 5,
        step5SubStep: "team",
        stepData: { teamSize: { teamSize: "2_5" } },
      });

      renderWizard();

      expect(primaryButton()).toHaveTextContent("Finish");
    });
  });

  describe("steps 1-4 navigation", () => {
    it("blocks advancement and reports the named fields when validation fails", async () => {
      h.setState({ currentStep: 2 });
      validateCurrentStep.mockResolvedValue({
        isValid: false,
        errors: [],
        errorFields: ["services"],
      });

      renderWizard();

      await userEvent.click(primaryButton());

      await waitFor(() =>
        expect(h.state.setErrorFields).toHaveBeenCalledWith(
          ["services"],
          "next",
        ),
      );
      expect(toast.error).toHaveBeenCalledWith("Please complete: Services");
      expect(h.state.nextStep).not.toHaveBeenCalled();
      expect(h.state.saveStepDataToServer).not.toHaveBeenCalled();
    });

    it("saves Step 1 client profile before team size, then advances", async () => {
      h.setState({
        currentStep: 1,
        stepData: {
          clientProfile: { organizationType: "financial_advisor_ria" },
          teamSize: { teamSize: "solo" },
        },
      });

      renderWizard();

      await userEvent.click(primaryButton());

      await waitFor(() => expect(h.state.nextStep).toHaveBeenCalled());

      expect(
        h.state.saveStepDataToServer.mock.calls.map(
          (call: unknown[]) => call[0],
        ),
      ).toEqual(["clientProfile", "teamSize"]);
      expect(h.state.completeStep).toHaveBeenCalledWith(1);
      expect(h.state.setAutosaveToServer).toHaveBeenNthCalledWith(1, true);
      expect(h.state.setAutosaveToServer).toHaveBeenLastCalledWith(false);
    });

    it("aborts Step 1 when the client profile save fails", async () => {
      h.setState({
        currentStep: 1,
        stepData: {
          clientProfile: { organizationType: "financial_advisor_ria" },
          teamSize: { teamSize: "solo" },
        },
      });
      h.state.saveStepDataToServer.mockResolvedValueOnce(false);

      renderWizard();

      await userEvent.click(primaryButton());

      await waitFor(() =>
        expect(h.state.setAutosaveToServer).toHaveBeenLastCalledWith(false),
      );
      expect(h.state.saveStepDataToServer).toHaveBeenCalledTimes(1);
      expect(h.state.nextStep).not.toHaveBeenCalled();
    });

    it("saves Step 2 services and insurance together", async () => {
      h.setState({
        currentStep: 2,
        stepData: {
          services: { services: ["retirement"] },
          insuranceLicensing: { offersInsurance: false },
        },
      });

      renderWizard();

      await userEvent.click(primaryButton());

      await waitFor(() => expect(h.state.nextStep).toHaveBeenCalled());

      const savedTypes = h.state.saveStepDataToServer.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(savedTypes).toContain("services");
      expect(savedTypes).toContain("insuranceLicensing");
    });

    it("normalizes Step 4 DOM values before validating and saving", async () => {
      h.setState({
        currentStep: 4,
        stepData: {
          userSetup: {
            name: "",
            email: "ada@example.com",
            organizationEmail: "",
            phone: "",
            title: "",
            designations: [],
          },
        },
      });

      renderWizard();

      await userEvent.click(primaryButton());

      await waitFor(() =>
        expect(h.state.nextStep).toHaveBeenCalled(),
      );

      const validatedData = validateCurrentStep.mock.calls.at(-1)?.[1] as any;
      expect(validatedData.userSetup).toMatchObject({
        name: "Ada",
        email: "ada@example.com",
        organizationEmail: "org@example.com",
        phone: "2135888888",
        title: "Advisor",
      });

      expect(h.state.saveStepDataToServer).toHaveBeenCalledWith(
        "userSetup",
        expect.objectContaining({ phone: "2135888888" }),
      );
      expect(h.state.saveStepData).toHaveBeenCalledWith(
        "userSetup",
        expect.objectContaining({ phone: "2135888888" }),
        false,
      );
    });

    it("saves and returns to Review when editing from Step 5a", async () => {
      h.setState({
        currentStep: 2,
        editFromReview: true,
        stepData: { services: { services: ["retirement"] } },
      });

      renderWizard();

      expect(primaryButton()).toHaveTextContent("Save & Return to Review");

      await userEvent.click(primaryButton());

      await waitFor(() =>
        expect(h.state.returnToReview).toHaveBeenCalled(),
      );
      expect(h.state.nextStep).not.toHaveBeenCalled();
    });

    it("Previous in edit-from-review returns to Review without saving", async () => {
      h.setState({ currentStep: 2, editFromReview: true });

      renderWizard();

      await userEvent.click(screen.getByRole("button", { name: /Previous/ }));

      expect(h.state.returnToReview).toHaveBeenCalled();
      expect(h.state.previousStep).not.toHaveBeenCalled();
    });

    it("Previous on a normal step walks back", async () => {
      h.setState({ currentStep: 3 });

      renderWizard();

      await userEvent.click(screen.getByRole("button", { name: /Previous/ }));

      expect(h.state.previousStep).toHaveBeenCalled();
    });
  });

  describe("Step 5 routing", () => {
    it("moves from 5a to 5b", async () => {
      h.setState({ currentStep: 5, step5SubStep: "review" });

      renderWizard();

      await userEvent.click(primaryButton());

      expect(h.state.setStep5SubStep).toHaveBeenCalledWith("disclosures");
    });

    it("blocks 5b when the step is not valid", async () => {
      h.setState({ currentStep: 5, step5SubStep: "disclosures" });

      renderWizard({ isStep5Valid: false });

      // The primary action is disabled while 5b is invalid.
      expect(primaryButton()).toBeDisabled();
      expect(screen.queryByTestId("confirm-attestation")).not.toBeInTheDocument();
    });

    it("opens the confirm attestation on a valid 5b and advances to 5c", async () => {
      h.setState({
        currentStep: 5,
        step5SubStep: "disclosures",
        stepData: {
          teamSize: { teamSize: "2_5" },
          disclaimers: { disclaimers: [{ id: "1", text: "copy" }] },
        },
      });

      renderWizard();

      await userEvent.click(primaryButton());
      await clickConfirm("confirm-attestation");

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/organization/disclosures-reviewed",
          expect.objectContaining({ method: "POST" }),
        ),
      );
      expect(h.state.setStep5SubStep).toHaveBeenCalledWith("team");
    });

    it("skipping 5b deletes the reviewed flag and advances to 5c", async () => {
      h.setState({
        currentStep: 5,
        step5SubStep: "disclosures",
        stepData: { teamSize: { teamSize: "2_5" } },
      });

      renderWizard();

      await userEvent.click(
        screen.getByRole("button", { name: "Skip for Now" }),
      );
      await clickConfirm("confirm-skip");

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/organization/disclosures-reviewed",
          expect.objectContaining({ method: "DELETE" }),
        ),
      );
      expect(h.state.setStep5SubStep).toHaveBeenCalledWith("team");
    });

    it("the in-step skip action uses the same flow", async () => {
      h.setState({
        currentStep: 5,
        step5SubStep: "disclosures",
        stepData: { teamSize: { teamSize: "2_5" } },
      });

      renderWizard();

      await userEvent.click(
        screen.getByRole("button", { name: "child-skip" }),
      );

      expect(screen.getByTestId("confirm-skip")).toBeInTheDocument();
    });

    it("completes onboarding after a solo organization skips 5b", async () => {
      h.setState({
        currentStep: 5,
        step5SubStep: "disclosures",
        stepData: { teamSize: { teamSize: "solo" } },
      });

      renderWizard();

      await userEvent.click(
        screen.getByRole("button", { name: "Skip for Now" }),
      );
      await clickConfirm("confirm-skip");

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/onboarding-wizard/complete",
          expect.objectContaining({ method: "POST" }),
        ),
      );
      expect(await screen.findByText("Setup Complete!")).toBeInTheDocument();
    });
  });

  describe("Step 5c invites", () => {
    it("sends each filled invite, ignores blank rows, then completes", async () => {
      h.setState({
        currentStep: 5,
        step5SubStep: "team",
        stepData: { teamSize: { teamSize: "2_5" } },
        teamInvites: [
          {
            id: "1",
            fullName: "Bob Stone",
            email: "bob@example.com",
            role: "editor",
            status: "pending",
          },
          {
            id: "2",
            fullName: "Sue Smith",
            email: "sue@example.com",
            role: "viewer",
            status: "pending",
          },
          {
            id: "3",
            fullName: " ",
            email: " ",
            role: "viewer",
            status: "pending",
          },
        ],
      });

      renderWizard();

      await userEvent.click(primaryButton());

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/onboarding-wizard/complete",
          expect.objectContaining({ method: "POST" }),
        ),
      );

      const inviteCalls = fetchMock.mock.calls.filter(
        ([url]) => url === "/api/teammates/team",
      );
      expect(inviteCalls).toHaveLength(2);
      expect(JSON.parse(inviteCalls[0][1].body)).toEqual({
        type: "team_member",
        role: "editor",
        name: "Bob Stone",
        email: "bob@example.com",
      });
      expect(JSON.parse(inviteCalls[1][1].body)).toMatchObject({
        role: "viewer",
        name: "Sue Smith",
        email: "sue@example.com",
      });
      expect(h.state.completeStep).toHaveBeenCalledWith(5);
    });

    it("aborts completion when an invite fails", async () => {
      h.setState({
        currentStep: 5,
        step5SubStep: "team",
        stepData: { teamSize: { teamSize: "2_5" } },
        teamInvites: [
          {
            id: "1",
            fullName: "Bob Stone",
            email: "bob@example.com",
            role: "viewer",
            status: "pending",
          },
          {
            id: "2",
            fullName: "Sue Smith",
            email: "sue@example.com",
            role: "viewer",
            status: "pending",
          },
        ],
      });
      fetchMock.mockImplementation(async (url: string) =>
        url === "/api/teammates/team"
          ? jsonResponse({ error: "Already invited" }, false)
          : jsonResponse({}),
      );

      renderWizard();

      await userEvent.click(primaryButton());

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Already invited"),
      );
      expect(
        fetchMock.mock.calls.filter(
          ([url]) => url === "/api/teammates/team",
        ),
      ).toHaveLength(1);
      expect(fetchMock).not.toHaveBeenCalledWith(
        "/api/onboarding-wizard/complete",
        expect.anything(),
      );
    });

    it("Invite Later confirms and completes without sending invites", async () => {
      h.setState({
        currentStep: 5,
        step5SubStep: "team",
        stepData: { teamSize: { teamSize: "2_5" } },
      });

      renderWizard();

      await userEvent.click(
        screen.getByRole("button", { name: "Invite Later" }),
      );
      await clickConfirm("confirm-invite-later");

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/onboarding-wizard/complete",
          expect.objectContaining({ method: "POST" }),
        ),
      );
      expect(fetchMock).not.toHaveBeenCalledWith(
        "/api/teammates/team",
        expect.anything(),
      );
    });

    it("finishes immediately when there are no filled invites", async () => {
      h.setState({
        currentStep: 5,
        step5SubStep: "team",
        stepData: { teamSize: { teamSize: "2_5" } },
      });

      renderWizard();

      await userEvent.click(primaryButton());

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/onboarding-wizard/complete",
          expect.objectContaining({ method: "POST" }),
        ),
      );
      expect(fetchMock).not.toHaveBeenCalledWith(
        "/api/teammates/team",
        expect.anything(),
      );
    });
  });

  describe("external handlers", () => {
    it("prefers externally supplied navigation handlers", async () => {
      h.setState({ currentStep: 2 });
      const onNext = vi.fn();
      const onPrevious = vi.fn();

      renderWizard({ onNext, onPrevious });

      await userEvent.click(primaryButton());
      await userEvent.click(screen.getByRole("button", { name: /Previous/ }));

      expect(onNext).toHaveBeenCalledTimes(1);
      expect(onPrevious).toHaveBeenCalledTimes(1);
      expect(h.state.nextStep).not.toHaveBeenCalled();
      expect(h.state.previousStep).not.toHaveBeenCalled();
    });
  });
});
