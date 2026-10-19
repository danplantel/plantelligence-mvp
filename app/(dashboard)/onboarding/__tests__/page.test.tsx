import React from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OnboardingPage from "../page";

/**
 * Hoisted test doubles. `vi.mock` factories are lifted above imports, so any
 * state they close over must be created with `vi.hoisted`.
 */
const mocks = vi.hoisted(() => {
  const wizardState = {
    currentStep: 1,
    errorFields: [] as string[],
    isCompleted: false,
    stepData: {} as Record<string, unknown>,
    saveSummaryData: vi.fn(async () => undefined),
  };

  return {
    wizardState,
    wizardInit: { isInitialized: true, currentStep: 1 },
    session: { user: { id: "user-1" } } as
      | { user?: { id?: string } }
      | null,
    push: vi.fn(),

    setTitle: vi.fn(),
    sendResumeEmail: vi.fn(),

    hasUnsavedChanges: true,
    guardOptions: null as Record<string, unknown> | null,
    leaveGuard: {
      dialogOpen: false,
      isSaving: false,
      isDiscarding: false,
      stayAndKeepEditing: vi.fn(),
      saveAndExit: vi.fn(),
      discardWithoutSaving: vi.fn(),
      dialogOnOpenChange: vi.fn(),
      suppressStayOnNextClose: vi.fn(),
    },

    fetch: vi.fn(),
  };
});

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mocks.session }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useWizardInit", () => ({
  useWizardInit: () => mocks.wizardInit,
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({
    title: "",
    setTitle: mocks.setTitle,
    subtitle: "",
    setSubtitle: vi.fn(),
  }),
}));

vi.mock("@/hooks/useOnboardingResumeEmail", () => ({
  useOnboardingResumeEmail: () => mocks.sendResumeEmail,
}));

vi.mock("@/hooks/use-navigate-away-guard", () => ({
  useNavigateAwayGuard: (options: Record<string, unknown>) => {
    mocks.guardOptions = options;
    return mocks.leaveGuard;
  },
}));

vi.mock("@/lib/onboarding-wizard-store", () => {
  const useOnboardingWizardStore = (
    selector?: (state: typeof mocks.wizardState) => unknown,
  ) => (selector ? selector(mocks.wizardState) : mocks.wizardState);

  useOnboardingWizardStore.getState = () => mocks.wizardState;

  return { useOnboardingWizardStore };
});

vi.mock("@/lib/onboarding-wizard-dirty", () => ({
  hasUnsavedOnboardingWork: () => mocks.hasUnsavedChanges,
}));

vi.mock("@/components/desktop-only-gate", () => ({
  DesktopOnlyGate: ({
    children,
    onBlocked,
  }: {
    children: React.ReactNode;
    onBlocked?: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onBlocked?.()}>
        simulate-mobile
      </button>
      {children}
    </div>
  ),
}));

vi.mock("@/components/wizard/wizard", () => ({
  OnboardingWizard: ({
    children,
    isStep5Valid,
  }: {
    children: React.ReactNode;
    isStep5Valid?: boolean;
  }) => (
    <div
      data-testid="onboarding-wizard"
      data-step5-valid={String(isStep5Valid)}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/wizard/steps", () => ({
  Step1UserProfile: () => <div>Step 1 content</div>,
  Step2Services: () => <div>Step 2 content</div>,
  Step3Branding: () => <div>Step 3 content</div>,
  Step4UserSetup: () => <div>Step 4 content</div>,
  Step5Onboarding: ({
    onValidationChange,
  }: {
    onValidationChange?: (isValid: boolean) => void;
  }) => (
    <div>
      Step 5 content
      <button
        type="button"
        onClick={() => onValidationChange?.(true)}
      >
        mark-step-5-valid
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/navigate-away-warning-dialog", () => ({
  NavigateAwayWarningDialog: ({ open }: { open: boolean }) => (
    <div
      data-testid="navigate-away-dialog"
      data-open={String(open)}
    />
  ),
}));

function statusResponse(
  body: unknown,
  { ok = true }: { ok?: boolean } = {},
): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    mocks.wizardInit.isInitialized = true;
    mocks.wizardInit.currentStep = 1;
    mocks.session = { user: { id: "user-1" } };

    mocks.wizardState.currentStep = 1;
    mocks.wizardState.errorFields = [];
    mocks.wizardState.isCompleted = false;
    mocks.wizardState.stepData = { clientProfile: { name: "Ada Lovelace" } };
    mocks.wizardState.saveSummaryData.mockResolvedValue(undefined);

    mocks.hasUnsavedChanges = true;
    mocks.guardOptions = null;
    mocks.leaveGuard.dialogOpen = false;
    mocks.leaveGuard.isSaving = false;
    mocks.leaveGuard.isDiscarding = false;

    mocks.fetch.mockReset();
    mocks.fetch.mockResolvedValue(statusResponse({ completed: false }));
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("shows the loading screen before the wizard initializes", async () => {
    mocks.wizardInit.isInitialized = false;

    render(<OnboardingPage />);

    expect(screen.getByText("Loading wizard...")).toBeInTheDocument();
    expect(screen.queryByTestId("onboarding-wizard")).not.toBeInTheDocument();

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
  });

  it("shows the loading screen while the onboarding status is being checked", async () => {
    let resolveStatus: (value: Response) => void = () => {};
    mocks.fetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveStatus = resolve;
      }),
    );

    render(<OnboardingPage />);

    expect(screen.getByText("Loading wizard...")).toBeInTheDocument();
    expect(screen.queryByTestId("onboarding-wizard")).not.toBeInTheDocument();

    await act(async () => {
      resolveStatus(statusResponse({ completed: false }));
    });

    expect(await screen.findByTestId("onboarding-wizard")).toBeInTheDocument();
  });

  it("redirects to the dashboard when onboarding is already complete", async () => {
    mocks.fetch.mockResolvedValue(statusResponse({ completed: true }));

    render(<OnboardingPage />);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByTestId("onboarding-wizard")).not.toBeInTheDocument();
  });

  it("renders the wizard after initialization and an incomplete status check", async () => {
    render(<OnboardingPage />);

    expect(await screen.findByTestId("onboarding-wizard")).toBeInTheDocument();
    expect(screen.getByText("Step 1 content")).toBeInTheDocument();
    expect(mocks.setTitle).toHaveBeenCalledWith("New User Onboarding");
  });

  it("skips the status request and still renders when there is no signed-in user", async () => {
    mocks.session = null;

    render(<OnboardingPage />);

    expect(await screen.findByTestId("onboarding-wizard")).toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [1, "Step 1 content"],
    [2, "Step 2 content"],
    [3, "Step 3 content"],
    [4, "Step 4 content"],
    [5, "Step 5 content"],
  ])("renders step %i of the wizard", async (step, expectedContent) => {
    mocks.wizardInit.currentStep = step;
    mocks.wizardState.currentStep = step;

    render(<OnboardingPage />);

    expect(await screen.findByText(expectedContent)).toBeInTheDocument();
  });

  it("falls back to step 1 for an unknown step number", async () => {
    mocks.wizardState.currentStep = 99;

    render(<OnboardingPage />);

    expect(await screen.findByText("Step 1 content")).toBeInTheDocument();
  });

  it("passes the Step 5 validation result up to the wizard", async () => {
    mocks.wizardInit.currentStep = 5;
    mocks.wizardState.currentStep = 5;

    render(<OnboardingPage />);

    const wizard = await screen.findByTestId("onboarding-wizard");
    expect(wizard).toHaveAttribute("data-step5-valid", "false");

    await userEvent.click(
      screen.getByRole("button", { name: "mark-step-5-valid" }),
    );

    expect(wizard).toHaveAttribute("data-step5-valid", "true");
  });

  it("enables the leave guard and saves summary data on save-and-exit", async () => {
    render(<OnboardingPage />);

    await screen.findByTestId("onboarding-wizard");

    expect(mocks.guardOptions).toMatchObject({
      enabled: true,
      hasUnsavedChanges: true,
    });

    const onSaveAndExit = mocks.guardOptions?.onSaveAndExit as () =>
      | Promise<void>
      | void;

    await act(async () => {
      await onSaveAndExit();
    });

    expect(mocks.wizardState.saveSummaryData).toHaveBeenCalledWith(
      mocks.wizardState.stepData,
    );
  });

  it("requests a resume email when the desktop gate blocks small screens", async () => {
    render(<OnboardingPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "simulate-mobile" }),
    );

    expect(mocks.sendResumeEmail).toHaveBeenCalledTimes(1);
  });

  it("reflects the leave-guard dialog state in the warning dialog", async () => {
    mocks.leaveGuard.dialogOpen = true;

    render(<OnboardingPage />);

    const dialog = await screen.findByTestId("navigate-away-dialog");
    expect(dialog).toHaveAttribute("data-open", "true");
  });

  it("renders the wizard when the status request fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.fetch.mockResolvedValue(statusResponse({}, { ok: false }));

    render(<OnboardingPage />);

    expect(await screen.findByTestId("onboarding-wizard")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to fetch onboarding status",
    );
  });

  it("renders the wizard when the status request throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.fetch.mockRejectedValue(new Error("network down"));

    render(<OnboardingPage />);

    expect(await screen.findByTestId("onboarding-wizard")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Error checking onboarding status:",
      expect.any(Error),
    );
  });
});
