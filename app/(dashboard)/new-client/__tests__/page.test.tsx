import React from "react";

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NewClientPage from "../page";

/**
 * Create Plan (`app/(dashboard)/new-client/page.tsx`).
 *
 * The wizard store, the five step screens, the wizard chrome and the resume
 * dialogs are mocked, so these tests assert the page's own orchestration:
 *
 *  - the ownership / draft verification gate before anything is shown;
 *  - the resume-or-new-plan dialog, including its two exit paths;
 *  - Save Draft and Complete Setup (toasts, navigation, busy states);
 *  - the 3 s server autosave and its skip/baseline rules;
 *  - which step renders and which footer flags the wizard receives.
 *
 * The real `hasUnsavedWizardWork` is used (not mocked) so the leave-guard
 * assertions exercise the same dirty logic the app uses.
 */

const mocks = vi.hoisted(() => {
  const state: any = {};

  const resetState = (overrides: Record<string, unknown> = {}) => {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, {
      currentStep: 1,
      totalSteps: 5,
      steps: [],
      stepData: {},
      nextStep: vi.fn(),
      previousStep: vi.fn(),
      completeStep: vi.fn(),
      completeWizard: vi.fn(async () => {}),
      loadAllWizardData: vi.fn(async () => {}),
      loadDraftById: vi.fn(async () => {
        state.stepData = { companyBasics: { companyName: "Pending Co" } };
        state.draftClientId = "draft-pending";
      }),
      createNewSession: vi.fn(async () => {}),
      seedAdvisorDefaultsFromProfile: vi.fn(async () => {}),
      syncCurrentStepToFirstIncomplete: vi.fn(),
      // Mirrors the real store: a reset drops the draft id, the data and the step.
      resetWizard: vi.fn(() => {
        state.draftClientId = null;
        state.stepData = {};
        state.currentStep = 1;
        state.draftSaveCount = 0;
      }),
      saveAsDraft: vi.fn(async () => {}),
      goToStep: vi.fn(),
      updateCurrentStep: vi.fn(async () => {}),
      errorFields: [] as string[],
      draftClientId: null as string | null,
      draftSaveCount: 0,
      isCompleted: false,
      duplicatePlanNameConflict: null,
      ...overrides,
    });
    return state;
  };

  return {
    state,
    resetState,
    rehydrate: vi.fn(async () => {}),
    setTitle: vi.fn(),
    push: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
    fetch: vi.fn(),
    consumePendingDraftSelection: vi.fn(),
    isDuplicatePlanNameError: vi.fn(() => false),
    clearWizardBrowserState: vi.fn(),
    formatSavedAt: vi.fn((value: string) => `formatted:${value}`),
    hasMeaningfulLocalWork: vi.fn(() => false),
    lookupDraft: vi.fn(async () => "missing" as string),
    peekPendingDraftId: vi.fn(() => null as string | null),
    readLocalSavedAt: vi.fn(() => ""),
    rememberWizardOwner: vi.fn(),
    wizardBlobBelongsTo: vi.fn(() => true),
    session: { user: { id: "user-1" } } as any,
    sessionStatus: "authenticated" as string,
    companyBasicsSubStep: "branding" as string,
    transitionActive: false,
    guardOptions: null as any,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mocks.session, status: mocks.sessionStatus }),
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({ setTitle: mocks.setTitle }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

vi.mock("@/components/wizard/new-client-wizard", () => ({
  NewClientWizard: ({
    children,
    currentStep,
    totalSteps,
    onNext,
    onPrevious,
    onComplete,
    onSaveDraft,
    isSavingDraft,
    canSaveDraft,
    isFirstStep,
    isLastStep,
    isLoading,
  }: any) => (
    <div data-testid="wizard">
      <span data-testid="wizard-step">{currentStep}</span>
      <span data-testid="wizard-total">{totalSteps}</span>
      <span data-testid="is-first-step">{String(isFirstStep)}</span>
      <span data-testid="is-last-step">{String(isLastStep)}</span>
      <span data-testid="can-save-draft">{String(canSaveDraft)}</span>
      <span data-testid="is-saving-draft">{String(isSavingDraft)}</span>
      <span data-testid="is-wizard-loading">{String(isLoading)}</span>
      <button type="button" onClick={() => onNext?.()}>
        Wizard Next
      </button>
      <button type="button" onClick={() => onPrevious?.()}>
        Wizard Previous
      </button>
      <button type="button" onClick={() => onSaveDraft?.()}>
        Wizard Save Draft
      </button>
      <button type="button" onClick={() => void onComplete?.()}>
        Wizard Complete
      </button>
      {children}
    </div>
  ),
}));

vi.mock("@/components/wizard/new-client-steps", () => {
  const makeStep = (n: number) => {
    function MockNewClientStep({ errorFields }: any) {
      return (
        <div data-testid={`step-${n}`}>
          Step {n} ({Array.isArray(errorFields) ? errorFields.join(",") : ""})
        </div>
      );
    }
    MockNewClientStep.displayName = `MockNewClientStep${n}`;
    return MockNewClientStep;
  };
  return {
    NewClientStep1: makeStep(1),
    NewClientStep2: makeStep(2),
    NewClientStep3: makeStep(3),
    NewClientStep4: makeStep(4),
    NewClientStep5: makeStep(5),
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
      persist: { rehydrate: () => mocks.rehydrate() },
    },
  );

  return {
    useNewClientWizardStore,
    newClientWizardSteps: [],
    getCompanyBasicsSubStep: () => mocks.companyBasicsSubStep,
    isWizardTransitionActive: () => mocks.transitionActive,
    enqueueDraftSave: (task: () => Promise<unknown>) => task(),
  };
});

vi.mock("@/hooks/use-navigate-away-guard", () => ({
  useNavigateAwayGuard: (options: any) => {
    mocks.guardOptions = options;
    return {
      dialogOpen: false,
      isSaving: false,
      isDiscarding: false,
      stayAndKeepEditing: vi.fn(),
      saveAndExit: vi.fn(),
      discardWithoutSaving: vi.fn(),
      dialogOnOpenChange: vi.fn(),
      suppressStayOnNextClose: vi.fn(),
    };
  },
}));

vi.mock("@/components/ui/navigate-away-warning-dialog", () => ({
  NavigateAwayWarningDialog: () => null,
}));

vi.mock("@/components/ui/resume-or-new-plan-dialog", () => ({
  ResumeOrNewPlanDialog: ({
    open,
    planName,
    savedAt,
    onContinue,
    onCreateNew,
  }: any) =>
    open ? (
      <div role="dialog" aria-label="Resume plan">
        <p data-testid="resume-plan-name">{planName}</p>
        <p data-testid="resume-saved-at">{savedAt}</p>
        <button type="button" onClick={onContinue}>
          Continue this plan
        </button>
        <button type="button" onClick={onCreateNew}>
          Create a new plan
        </button>
      </div>
    ) : null,
}));

vi.mock("@/lib/draft-utils", () => ({
  consumePendingDraftSelection: mocks.consumePendingDraftSelection,
}));

vi.mock("@/lib/duplicate-plan-name-error", () => ({
  isDuplicatePlanNameError: mocks.isDuplicatePlanNameError,
}));

vi.mock("@/lib/new-client-wizard-resume", () => ({
  clearWizardBrowserState: mocks.clearWizardBrowserState,
  formatSavedAt: mocks.formatSavedAt,
  hasMeaningfulLocalWork: mocks.hasMeaningfulLocalWork,
  lookupDraft: mocks.lookupDraft,
  peekPendingDraftId: mocks.peekPendingDraftId,
  readLocalSavedAt: mocks.readLocalSavedAt,
  rememberWizardOwner: mocks.rememberWizardOwner,
  wizardBlobBelongsTo: mocks.wizardBlobBelongsTo,
}));

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  } as any;
}

async function renderReady() {
  const view = render(<NewClientPage />);
  await screen.findByTestId("wizard");
  return view;
}

function setCompanyName(name: string) {
  mocks.state.stepData = { companyBasics: { companyName: name } };
}

beforeEach(() => {
  mocks.resetState();
  mocks.session = { user: { id: "user-1" } };
  mocks.sessionStatus = "authenticated";
  mocks.companyBasicsSubStep = "branding";
  mocks.transitionActive = false;
  mocks.guardOptions = null;

  mocks.rehydrate.mockReset().mockResolvedValue(undefined);
  mocks.setTitle.mockReset();
  mocks.push.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.toastInfo.mockReset();
  mocks.consumePendingDraftSelection.mockReset();
  mocks.isDuplicatePlanNameError.mockReset().mockReturnValue(false);
  mocks.clearWizardBrowserState.mockReset();
  mocks.formatSavedAt
    .mockReset()
    .mockImplementation((v: string) => `formatted:${v}`);
  // Most tests pre-seed the store (a step, a company name) and must keep it
  // through initialization, which is the "unsaved local work" path. The two
  // fresh-start tests opt out explicitly.
  mocks.hasMeaningfulLocalWork.mockReset().mockReturnValue(true);
  mocks.lookupDraft.mockReset().mockResolvedValue("missing");
  mocks.peekPendingDraftId.mockReset().mockReturnValue(null);
  mocks.readLocalSavedAt.mockReset().mockReturnValue("");
  mocks.rememberWizardOwner.mockReset();
  mocks.wizardBlobBelongsTo.mockReset().mockReturnValue(true);

  mocks.fetch.mockReset().mockResolvedValue(jsonResponse({ success: true }));
  vi.stubGlobal("fetch", mocks.fetch);

  window.history.replaceState({}, "", "/new-client");
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NewClientPage shell and initialization", () => {
  it("sets the page title and shows the loading spinner first", () => {
    render(<NewClientPage />);

    expect(mocks.setTitle).toHaveBeenCalledWith("Create Plan");
    expect(screen.getByText("Loading your plan...")).toBeInTheDocument();
  });

  it("waits for the session before touching the wizard or browser snapshot", () => {
    mocks.sessionStatus = "loading";

    const view = render(<NewClientPage />);

    expect(screen.getByText("Loading your plan...")).toBeInTheDocument();
    expect(mocks.state.resetWizard).not.toHaveBeenCalled();
    expect(mocks.rehydrate).not.toHaveBeenCalled();
    expect(mocks.rememberWizardOwner).not.toHaveBeenCalled();

    mocks.sessionStatus = "authenticated";
    view.rerender(<NewClientPage />);

    return screen.findByTestId("wizard").then(() => {
      expect(mocks.rememberWizardOwner).toHaveBeenCalledWith("user-1");
    });
  });

  it("discards a snapshot that belongs to another browser user", async () => {
    mocks.wizardBlobBelongsTo.mockReturnValue(false);

    await renderReady();

    expect(mocks.clearWizardBrowserState).toHaveBeenCalledTimes(1);
    expect(mocks.rememberWizardOwner).toHaveBeenCalledWith("user-1");
  });

  it("starts a fresh session when there is no draft and no local work", async () => {
    mocks.hasMeaningfulLocalWork.mockReturnValue(false);

    await renderReady();

    expect(mocks.state.resetWizard).toHaveBeenCalledTimes(1);
    expect(mocks.state.createNewSession).toHaveBeenCalledTimes(1);
    expect(mocks.state.seedAdvisorDefaultsFromProfile).toHaveBeenCalledTimes(1);
    expect(mocks.rehydrate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps unsaved local typing without resetting the store", async () => {
    mocks.hasMeaningfulLocalWork.mockReturnValue(true);

    await renderReady();

    expect(mocks.state.resetWizard).not.toHaveBeenCalled();
    expect(mocks.state.createNewSession).not.toHaveBeenCalled();
  });

  it("clears the spinner and logs when initialization throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.hasMeaningfulLocalWork.mockReturnValue(false);
    mocks.state.createNewSession.mockRejectedValue(new Error("session down"));

    await renderReady();

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to initialize wizard:",
      expect.any(Error),
    );
  });

  it("renders the wizard instead of the spinner once initialization settles", async () => {
    await renderReady();

    expect(screen.queryByText("Loading your plan...")).not.toBeInTheDocument();
    expect(screen.getByTestId("wizard-step")).toHaveTextContent("1");
    expect(screen.getByTestId("wizard-total")).toHaveTextContent("5");
  });
});

describe("NewClientPage draft detection", () => {
  it("drops a View Plans hand-off whose draft no longer exists", async () => {
    mocks.peekPendingDraftId.mockReturnValue("draft-gone");
    mocks.lookupDraft.mockResolvedValue("missing");

    await renderReady();

    expect(mocks.lookupDraft).toHaveBeenCalledWith("draft-gone");
    expect(mocks.consumePendingDraftSelection).toHaveBeenCalledTimes(1);
    expect(mocks.clearWizardBrowserState).toHaveBeenCalledTimes(1);
    expect(mocks.state.resetWizard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers to resume the draft named in the hand-off", async () => {
    mocks.peekPendingDraftId.mockReturnValue("draft-1");
    mocks.lookupDraft.mockResolvedValue("exists");
    mocks.fetch.mockResolvedValue(
      jsonResponse({ data: { updatedAt: "2026-03-01T10:00:00.000Z" } }),
    );

    render(<NewClientPage />);

    const dialog = await screen.findByRole("dialog");
    expect(mocks.state.loadDraftById).toHaveBeenCalledWith("draft-1");
    expect(within(dialog).getByTestId("resume-plan-name")).toHaveTextContent(
      "Pending Co",
    );
    expect(
      mocks.fetch.mock.calls.some(([url]) => url === "/api/clients/draft-1"),
    ).toBe(true);
    expect(within(dialog).getByTestId("resume-saved-at")).toHaveTextContent(
      "formatted:2026-03-01T10:00:00.000Z",
    );
    expect(screen.queryByTestId("wizard")).not.toBeInTheDocument();
  });

  it("keeps a hand-off pointer it could not verify", async () => {
    mocks.peekPendingDraftId.mockReturnValue("draft-1");
    mocks.lookupDraft.mockResolvedValue("unknown");
    mocks.hasMeaningfulLocalWork.mockReturnValue(true);

    await renderReady();

    expect(mocks.consumePendingDraftSelection).not.toHaveBeenCalled();
    expect(mocks.clearWizardBrowserState).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers to resume a snapshot draft that still exists", async () => {
    mocks.resetState({
      draftClientId: "draft-2",
      stepData: { companyBasics: { companyName: "Snapshot Co" } },
    });
    mocks.lookupDraft.mockResolvedValue("exists");
    mocks.readLocalSavedAt.mockReturnValue("local-saved");

    render(<NewClientPage />);

    const dialog = await screen.findByRole("dialog");
    expect(mocks.lookupDraft).toHaveBeenCalledWith("draft-2");
    expect(within(dialog).getByTestId("resume-plan-name")).toHaveTextContent(
      "Snapshot Co",
    );
    expect(within(dialog).getByTestId("resume-saved-at")).toHaveTextContent(
      "local-saved",
    );
  });

  it("clears a snapshot draft that the server says is gone", async () => {
    mocks.resetState({ draftClientId: "draft-3" });
    mocks.lookupDraft.mockResolvedValue("missing");

    await renderReady();

    expect(mocks.clearWizardBrowserState).toHaveBeenCalledTimes(1);
    expect(mocks.state.resetWizard).toHaveBeenCalledTimes(1);
    expect(mocks.state.createNewSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts fresh when an unverifiable snapshot has no local work", async () => {
    mocks.resetState({ draftClientId: "draft-4" });
    mocks.lookupDraft.mockResolvedValue("unknown");
    mocks.hasMeaningfulLocalWork.mockReturnValue(false);

    await renderReady();

    expect(mocks.state.resetWizard).toHaveBeenCalledTimes(1);
    expect(mocks.state.createNewSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("NewClientPage resume actions", () => {
  async function openResumeDialog(companyName = "Snapshot Co") {
    mocks.resetState({
      draftClientId: "draft-2",
      currentStep: 2,
      stepData: { companyBasics: { companyName } },
    });
    mocks.lookupDraft.mockResolvedValue("exists");
    mocks.readLocalSavedAt.mockReturnValue("local-saved");
    render(<NewClientPage />);
    return screen.findByRole("dialog");
  }

  it("continues at the step named in the URL and hides the dialog", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/new-client?step=3");
    sessionStorage.setItem("plantelligence:selectedDraftId", "draft-2");
    const dialog = await openResumeDialog();

    await user.click(
      within(dialog).getByRole("button", { name: "Continue this plan" }),
    );

    await waitFor(() => expect(mocks.state.goToStep).toHaveBeenCalledWith(3));
    expect(mocks.state.updateCurrentStep).toHaveBeenCalledWith(3);
    expect(mocks.consumePendingDraftSelection).toHaveBeenCalledTimes(1);
    expect(mocks.state.seedAdvisorDefaultsFromProfile).toHaveBeenCalled();
    await screen.findByTestId("wizard");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("resumes at the store's saved step when the URL has none", async () => {
    const user = userEvent.setup();
    const dialog = await openResumeDialog();

    await user.click(
      within(dialog).getByRole("button", { name: "Continue this plan" }),
    );

    await waitFor(() => expect(mocks.state.goToStep).toHaveBeenCalledWith(2));
    expect(mocks.state.updateCurrentStep).toHaveBeenCalledWith(2);
  });

  it("recovers a missing draftClientId by company name before continuing", async () => {
    const user = userEvent.setup();
    mocks.resetState({
      draftClientId: "draft-2",
      currentStep: 1,
      stepData: { companyBasics: { companyName: "Snapshot Co" } },
    });
    mocks.lookupDraft.mockResolvedValue("exists");
    mocks.readLocalSavedAt.mockReturnValue("local-saved");
    mocks.fetch.mockResolvedValue(
      jsonResponse({
        data: [{ id: "draft-found", companyName: "Snapshot Co" }],
      }),
    );
    render(<NewClientPage />);
    const dialog = await screen.findByRole("dialog");
    // Simulate a snapshot that lost its draft id mid-flight.
    mocks.state.draftClientId = null;

    await user.click(
      within(dialog).getByRole("button", { name: "Continue this plan" }),
    );

    await waitFor(() => expect(mocks.state.draftClientId).toBe("draft-found"));
    expect(
      mocks.fetch.mock.calls.some(
        ([url]) =>
          typeof url === "string" &&
          url.startsWith("/api/clients?status=Draft&search=") &&
          url.includes(encodeURIComponent("Snapshot Co")),
      ),
    ).toBe(true);
  });

  it("starts a new plan without deleting the server draft", async () => {
    const user = userEvent.setup();
    const dialog = await openResumeDialog();

    await user.click(
      within(dialog).getByRole("button", { name: "Create a new plan" }),
    );

    await waitFor(() => expect(mocks.state.resetWizard).toHaveBeenCalled());
    expect(mocks.state.createNewSession).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).not.toHaveBeenCalledWith(
      "/api/clients/draft-2",
      expect.objectContaining({ method: "DELETE" }),
    );
    await screen.findByTestId("wizard");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("NewClientPage Save Draft", () => {
  it("refuses to save before there is a name or plan type", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Save Draft" }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Add a company name to save a draft",
    );
    expect(mocks.state.saveAsDraft).not.toHaveBeenCalled();
  });

  it("saves, toasts and returns to All Plans", async () => {
    const user = userEvent.setup();
    setCompanyName("Acme");
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Save Draft" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Draft saved", {
        description: "Your draft is listed under All Plans.",
      }),
    );
    expect(mocks.state.saveAsDraft).toHaveBeenCalledWith({
      showDuplicatePlanDialog: true,
    });
    expect(mocks.push).toHaveBeenCalledWith("/clients");
  });

  it("disables the button while the save is in flight", async () => {
    const user = userEvent.setup();
    setCompanyName("Acme");
    await renderReady();
    let resolveSave: () => void = () => {};
    mocks.state.saveAsDraft.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    await user.click(screen.getByRole("button", { name: "Wizard Save Draft" }));

    expect(screen.getByTestId("is-saving-draft")).toHaveTextContent("true");
    expect(mocks.push).not.toHaveBeenCalled();

    resolveSave();
    await waitFor(() =>
      expect(screen.getByTestId("is-saving-draft")).toHaveTextContent("false"),
    );
    expect(mocks.push).toHaveBeenCalledWith("/clients");
  });

  it("stays silent when the failure is a duplicate plan name", async () => {
    const user = userEvent.setup();
    setCompanyName("Acme");
    mocks.isDuplicatePlanNameError.mockReturnValue(true);
    mocks.state.saveAsDraft.mockRejectedValue(new Error("duplicate"));
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Save Draft" }));

    await waitFor(() =>
      expect(mocks.state.saveAsDraft).toHaveBeenCalledTimes(1),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("reports a non-duplicate save failure with the API message", async () => {
    const user = userEvent.setup();
    setCompanyName("Acme");
    mocks.state.saveAsDraft.mockRejectedValue(new Error("Save exploded"));
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Save Draft" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Could not save draft", {
        description: "Save exploded",
      }),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("NewClientPage Complete Setup", () => {
  it("publishes, toasts and lands on All Plans", async () => {
    const user = userEvent.setup();
    setCompanyName("Acme");
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Plan published", {
        description: "It's listed under All Plans.",
      }),
    );
    expect(mocks.state.completeStep).toHaveBeenCalledWith(1);
    expect(mocks.state.completeWizard).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith("/clients");
    expect(screen.queryByText("Saving Your Plan")).not.toBeInTheDocument();
  });

  it("shows the publishing overlay and disables the leave guard while saving", async () => {
    const user = userEvent.setup();
    setCompanyName("Acme");
    await renderReady();
    let resolveComplete: () => void = () => {};
    mocks.state.completeWizard.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveComplete = resolve;
        }),
    );

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));

    expect(screen.getByText("Saving Your Plan")).toBeInTheDocument();
    expect(mocks.guardOptions.enabled).toBe(false);
    expect(screen.getByTestId("is-wizard-loading")).toHaveTextContent("true");

    resolveComplete();
    await waitFor(() =>
      expect(screen.queryByText("Saving Your Plan")).not.toBeInTheDocument(),
    );
  });

  it("reports a failure and stays on the wizard", async () => {
    const user = userEvent.setup();
    setCompanyName("Acme");
    mocks.state.completeWizard.mockRejectedValue(
      new Error("missing documents"),
    );
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Cannot complete wizard:", {
        description: "missing documents",
        duration: 5000,
        dismissible: true,
      }),
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByTestId("wizard")).toBeInTheDocument();
  });
});

describe("NewClientPage wizard wiring", () => {
  it("advances and rewinds through the store", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));
    expect(mocks.state.completeStep).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole("button", { name: "Wizard Previous" }));
    expect(mocks.state.previousStep).toHaveBeenCalledTimes(1);
  });

  it.each([
    [1, "Step 1"],
    [2, "Step 2"],
    [3, "Step 3"],
    [4, "Step 4"],
    [5, "Step 5"],
  ])("renders step %i", async (step, label) => {
    mocks.state.currentStep = step;
    await renderReady();

    expect(screen.getByTestId(`step-${step}`)).toHaveTextContent(label);
  });

  it("falls back to step 1 for an unknown step number", async () => {
    mocks.state.currentStep = 9;
    await renderReady();

    expect(screen.getByTestId("step-1")).toBeInTheDocument();
  });

  it("passes the validation error fields to the active step", async () => {
    mocks.state.currentStep = 3;
    mocks.state.errorFields = ["companyName", "planType"];
    await renderReady();

    expect(screen.getByTestId("step-3")).toHaveTextContent(
      "companyName,planType",
    );
  });

  it("only treats step 1's branding sub-step as the first step", async () => {
    await renderReady();
    expect(screen.getByTestId("is-first-step")).toHaveTextContent("true");

    mocks.companyBasicsSubStep = "welcomeMission";
    const view = render(<NewClientPage />);
    await screen.findAllByTestId("wizard");
    view.unmount();
  });

  it("treats the final portal sub-steps as the last step", async () => {
    mocks.state.currentStep = 5;
    mocks.state.stepData = {
      employeePortalPreview: { step5SubStep: "disclaimers" },
    };
    await renderReady();

    expect(screen.getByTestId("is-last-step")).toHaveTextContent("true");
  });

  it("does not mark the last step before the final sub-step", async () => {
    mocks.state.currentStep = 5;
    mocks.state.stepData = {
      employeePortalPreview: { step5SubStep: "benefits" },
    };
    await renderReady();

    expect(screen.getByTestId("is-last-step")).toHaveTextContent("false");
  });

  it("enables Save Draft once a name or plan type exists", async () => {
    await renderReady();
    expect(screen.getByTestId("can-save-draft")).toHaveTextContent("false");

    mocks.resetState({ stepData: { companyBasics: { planType: "group" } } });
    await renderReady();
    expect(screen.getAllByTestId("can-save-draft").at(-1)).toHaveTextContent(
      "true",
    );
  });
});

describe("NewClientPage autosave", () => {
  async function advanceAutosave(ms = 3_000) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it("does nothing while there is no company name or plan type", async () => {
    const view = await renderReady();
    vi.useFakeTimers();

    view.rerender(<NewClientPage />);
    await advanceAutosave();

    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("posts the draft after the 3 s debounce and remembers the client id", async () => {
    const view = await renderReady();
    mocks.fetch.mockResolvedValue(
      jsonResponse({ success: true, clientId: "draft-9" }),
    );
    vi.useFakeTimers();
    setCompanyName("Acme");

    view.rerender(<NewClientPage />);
    await advanceAutosave();

    const draftCall = mocks.fetch.mock.calls.find(
      ([url]) => url === "/api/new-client-wizard/save-draft",
    );
    expect(draftCall).toBeTruthy();
    expect(draftCall![1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(draftCall![1].body)).toEqual({
      stepData: { companyBasics: { companyName: "Acme" } },
      currentStep: 1,
    });
    expect(mocks.state.draftClientId).toBe("draft-9");
    expect(mocks.state.draftSaveCount).toBe(1);
  });

  it("skips autosave while a Next/Complete transition is running", async () => {
    const view = await renderReady();
    mocks.transitionActive = true;
    vi.useFakeTimers();
    setCompanyName("Acme");

    view.rerender(<NewClientPage />);
    await advanceAutosave();

    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("ignores a duplicate-name response without warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = await renderReady();
    mocks.fetch.mockResolvedValue(
      jsonResponse({ success: false, code: "DUPLICATE_PLAN_NAME" }),
    );
    vi.useFakeTimers();
    setCompanyName("Acme");

    view.rerender(<NewClientPage />);
    await advanceAutosave();

    expect(mocks.state.draftClientId).toBeNull();
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("[Autosave]"),
      expect.anything(),
    );
  });

  it("warns on a failed autosave without clearing the draft id", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.resetState({ draftClientId: "draft-keep" });
    mocks.lookupDraft.mockResolvedValue("unknown");
    mocks.hasMeaningfulLocalWork.mockReturnValue(true);
    const view = await renderReady();
    mocks.fetch.mockResolvedValue(
      jsonResponse({ success: false, error: "quota exceeded" }),
    );
    vi.useFakeTimers();
    setCompanyName("Acme");

    view.rerender(<NewClientPage />);
    await advanceAutosave();

    expect(warnSpy).toHaveBeenCalledWith(
      "[Autosave] Failed to save draft:",
      "quota exceeded",
    );
    expect(mocks.state.draftClientId).toBe("draft-keep");
  });

  it("warns when the autosave request throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = await renderReady();
    mocks.fetch.mockRejectedValue(new Error("offline"));
    vi.useFakeTimers();
    setCompanyName("Acme");

    view.rerender(<NewClientPage />);
    await advanceAutosave();

    expect(warnSpy).toHaveBeenCalledWith(
      "[Autosave] Error saving draft:",
      expect.any(Error),
    );
  });

  it("does not re-save a resumed draft until the data changes", async () => {
    mocks.resetState({
      draftClientId: "draft-2",
      stepData: { companyBasics: { companyName: "Resumed Co" } },
    });
    mocks.lookupDraft.mockResolvedValue("unknown");
    mocks.hasMeaningfulLocalWork.mockReturnValue(true);

    const view = await renderReady();
    vi.useFakeTimers();

    view.rerender(<NewClientPage />);
    await advanceAutosave();
    expect(mocks.fetch).not.toHaveBeenCalled();

    setCompanyName("Resumed Co Edited");
    view.rerender(<NewClientPage />);
    await advanceAutosave();

    expect(
      mocks.fetch.mock.calls.some(
        ([url]) => url === "/api/new-client-wizard/save-draft",
      ),
    ).toBe(true);
  });
});

describe("NewClientPage leave guard", () => {
  it("is enabled once loading finishes and clean for a fresh plan", async () => {
    await renderReady();

    expect(mocks.guardOptions.enabled).toBe(true);
    expect(mocks.guardOptions.hasUnsavedChanges).toBe(false);
  });

  it("does not prompt for a draft that matches the last saved snapshot", async () => {
    mocks.resetState({
      draftClientId: "draft-5",
      stepData: { companyBasics: { companyName: "Saved Co" } },
    });
    mocks.lookupDraft.mockResolvedValue("unknown");
    mocks.hasMeaningfulLocalWork.mockReturnValue(true);

    const view = await renderReady();
    expect(mocks.guardOptions.hasUnsavedChanges).toBe(false);

    setCompanyName("Saved Co Edited");
    view.rerender(<NewClientPage />);

    expect(mocks.guardOptions.hasUnsavedChanges).toBe(true);
  });

  it("saves and exits with the duplicate dialog disabled", async () => {
    setCompanyName("Acme");
    await renderReady();

    await act(async () => {
      await mocks.guardOptions.onSaveAndExit();
    });

    expect(mocks.state.saveAsDraft).toHaveBeenCalledWith({
      showDuplicatePlanDialog: false,
    });
  });

  it("discards by deleting the draft row and resetting both stores", async () => {
    mocks.resetState({
      draftClientId: "draft-7",
      stepData: { companyBasics: { companyName: "Discard Co" } },
    });
    mocks.lookupDraft.mockResolvedValue("unknown");
    mocks.hasMeaningfulLocalWork.mockReturnValue(true);
    sessionStorage.setItem("plantelligence:selectedDraftId", "draft-7");
    await renderReady();

    await act(async () => {
      await mocks.guardOptions.onDiscard();
    });

    expect(mocks.fetch).toHaveBeenCalledWith("/api/clients/draft-7", {
      method: "DELETE",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Draft plan deleted");
    expect(mocks.state.resetWizard).toHaveBeenCalledTimes(1);
    expect(mocks.state.createNewSession).toHaveBeenCalledTimes(1);
    expect(mocks.state.seedAdvisorDefaultsFromProfile).toHaveBeenCalled();
    expect(sessionStorage.getItem("plantelligence:selectedDraftId")).toBeNull();
  });

  it("still resets locally when the discard request fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.resetState({
      draftClientId: "draft-8",
      stepData: { companyBasics: { companyName: "Discard Co" } },
    });
    mocks.lookupDraft.mockResolvedValue("unknown");
    mocks.hasMeaningfulLocalWork.mockReturnValue(true);
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "boom" }, false, 500));
    await renderReady();

    await act(async () => {
      await mocks.guardOptions.onDiscard();
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to delete draft client:",
      "boom",
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.state.resetWizard).toHaveBeenCalledTimes(1);
  });

  it("ignores a 404 when the draft was already deleted", async () => {
    mocks.resetState({
      draftClientId: "draft-9",
      stepData: { companyBasics: { companyName: "Discard Co" } },
    });
    mocks.lookupDraft.mockResolvedValue("unknown");
    mocks.hasMeaningfulLocalWork.mockReturnValue(true);
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "gone" }, false, 404));
    await renderReady();

    await act(async () => {
      await mocks.guardOptions.onDiscard();
    });

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.state.resetWizard).toHaveBeenCalledTimes(1);
  });
});
