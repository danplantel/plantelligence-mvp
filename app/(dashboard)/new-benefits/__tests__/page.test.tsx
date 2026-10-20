import React from "react";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NewBenefitsPage from "../page";

/**
 * Create Benefit (`app/(dashboard)/new-benefits/page.tsx`).
 *
 * The wizard store, the five step screens, the wizard chrome, the three dialogs
 * and the leave guard are mocked, so these tests assert this page's own
 * orchestration: deep-link hydration, step validation, Cancel/discard, publish,
 * the organization-logo sync and the header/comment surface.
 */

const mocks = vi.hoisted(() => {
  const state: any = {};
  const listeners = new Set<() => void>();

  const guard = {
    dialogOpen: false,
    isSaving: false,
    isDiscarding: false,
    stayAndKeepEditing: vi.fn(),
    saveAndExit: vi.fn(),
    discardWithoutSaving: vi.fn(),
    dialogOnOpenChange: vi.fn(),
    suppressStayOnNextClose: vi.fn(),
  };

  const resetState = (overrides: Record<string, unknown> = {}) => {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, {
      currentStep: 1,
      totalSteps: 5,
      steps: [
        { id: 1, title: "One", description: "", completed: false },
        { id: 2, title: "Two", description: "", completed: false },
        { id: 3, title: "Three", description: "", completed: false },
        { id: 4, title: "Four", description: "", completed: false },
        { id: 5, title: "Five", description: "", completed: false },
      ],
      stepData: {},
      nextStep: vi.fn(),
      previousStep: vi.fn(),
      completeStep: vi.fn(),
      goToStep: vi.fn(),
      resetWizard: vi.fn(),
      saveStepData: vi.fn((step: number, data: any) => {
        state.stepData = { ...state.stepData, [`step${step}`]: data };
      }),
      ...overrides,
    });
    return state;
  };

  return {
    state,
    listeners,
    resetState,
    guard,
    rehydrate: vi.fn(async () => {}),
    setTitle: vi.fn(),
    setSubtitle: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    persistPlanSelection: vi.fn(),
    fetchProfileOnce: vi.fn(async (): Promise<any> => null),
    saveBenefit: vi.fn(
      async (): Promise<{ success: boolean; error?: string }> => ({
        success: true,
      }),
    ),
    purgeDraftBenefit: vi.fn(async () => {}),
    sessionCreatedBenefitRow: vi.fn(() => true),
    hasUnsaved: false,
    serializeSnapshot: vi.fn(() => "snapshot"),
    useCommentSurface: vi.fn(),
    searchParams: new URLSearchParams(),
    guardOptions: null as any,
    assign: vi.fn(),
    step1Scroll: vi.fn(),
    step2Scroll: vi.fn(),
    navProps: [] as any[],
    confirmProps: [] as any[],
    attestationProps: [] as any[],
  };
});

vi.mock("@/lib/benefits-wizard-store", () => {
  const store = Object.assign(
    (selector?: (value: any) => unknown) =>
      selector ? selector(mocks.state) : mocks.state,
    {
      getState: () => mocks.state,
      subscribe: (listener: () => void) => {
        mocks.listeners.add(listener);
        return () => mocks.listeners.delete(listener);
      },
      persist: { rehydrate: () => mocks.rehydrate() },
    },
  );

  return {
    useBenefitsWizardStore: store,
    BENEFITS_WIZARD_STORAGE_KEY: "benefits-wizard",
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({
    setTitle: mocks.setTitle,
    setSubtitle: mocks.setSubtitle,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/hooks/use-navigate-away-guard", () => ({
  useNavigateAwayGuard: (options: any) => {
    mocks.guardOptions = options;
    return mocks.guard;
  },
}));

vi.mock("@/components/comments/comment-mode-provider", () => ({
  useCommentSurface: mocks.useCommentSurface,
}));

vi.mock("@/lib/plan-selector-storage", () => ({
  persistPlanSelection: mocks.persistPlanSelection,
}));

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: mocks.fetchProfileOnce,
}));

vi.mock("@/lib/save-benefit", () => ({
  saveBenefit: mocks.saveBenefit,
  normalizeCategory: (value: string | null | undefined) =>
    (value || "").toLowerCase().trim().replace(/\s+/g, " "),
}));

vi.mock("@/lib/benefit-draft", () => ({
  purgeDraftBenefit: mocks.purgeDraftBenefit,
  sessionCreatedBenefitRow: mocks.sessionCreatedBenefitRow,
  toApiBenefitCategory: (value: string) =>
    value === "Custom" ? "Company / Plan Sponsor" : value,
}));

vi.mock("@/lib/benefits-wizard-dirty", () => ({
  hasUnsavedBenefitsWork: () => mocks.hasUnsaved,
  serializeBenefitsSnapshot: mocks.serializeSnapshot,
}));

vi.mock("@/components/wizard/benefits-wizard", () => ({
  BenefitsWizard: (props: any) => (
    <div
      data-testid="wizard"
      data-step={props.currentStep}
      data-total={props.totalSteps}
      data-first={String(props.isFirstStep)}
      data-last={String(props.isLastStep)}
      data-loading={String(props.isLoading)}
      data-cancelling={String(props.isCancelling)}
    >
      <button type="button" onClick={() => void props.onNext()}>
        Wizard Next
      </button>
      <button type="button" onClick={() => props.onPrevious()}>
        Wizard Previous
      </button>
      <button type="button" onClick={() => void props.onComplete()}>
        Wizard Complete
      </button>
      <button type="button" onClick={() => props.onCancel()}>
        Wizard Cancel
      </button>
      {props.children}
    </div>
  ),
}));

vi.mock("@/components/wizard/benefits-steps", () => ({
  BenefitsStep1: ({ hideCategoryPicker }: any) => (
    <div
      data-testid="step-1"
      data-hide-category-picker={String(hideCategoryPicker)}
    />
  ),
  BenefitsStep2: () => <div data-testid="step-2" />,
  BenefitsStep3: () => <div data-testid="step-3" />,
  BenefitsStep4: () => <div data-testid="step-4" />,
  BenefitsStep5: () => <div data-testid="step-5" />,
}));

vi.mock("@/components/ui/navigate-away-warning-dialog", () => ({
  NavigateAwayWarningDialog: (props: any) => {
    mocks.navProps.push(props);
    const { open, onStay, onSaveAndExit, onDiscardWithoutSaving } = props;
    return (
      <div data-testid="navigate-away" data-open={String(open)}>
        {open ? (
          <>
            <button type="button" onClick={onStay}>
              Stay and keep editing
            </button>
            <button type="button" onClick={onSaveAndExit}>
              Save and exit
            </button>
            <button type="button" onClick={onDiscardWithoutSaving}>
              Discard without saving
            </button>
          </>
        ) : null}
      </div>
    );
  },
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: (props: any) => {
    mocks.confirmProps.push(props);
    const { open, onConfirm, onOpenChange, title, description } = props;
    return open ? (
      <div role="dialog" aria-label={title}>
        <p>{description}</p>
        <button type="button" onClick={() => void onConfirm()}>
          Yes, discard
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          No, go back
        </button>
      </div>
    ) : null;
  },
}));

vi.mock(
  "@/components/wizard/benefits-steps/publishing-attestation-dialog",
  () => ({
    PublishingAttestationDialog: (props: any) => {
      mocks.attestationProps.push(props);
      const { open, onConfirm, onOpenChange } = props;
      return open ? (
        <div role="dialog" aria-label="Publishing Attestation">
          <button type="button" onClick={() => void onConfirm()}>
            Confirm and Publish
          </button>
          <button type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
        </div>
      ) : null;
    },
  }),
);

function setSearchParams(params: Record<string, string>) {
  mocks.searchParams = new URLSearchParams(params);
}

function setRawSearchParams(raw: string) {
  mocks.searchParams = new URLSearchParams(raw);
}

function setStepData(stepData: Record<string, any>) {
  mocks.state.stepData = stepData;
}

function renderPage() {
  return render(<NewBenefitsPage />);
}

async function renderReady() {
  const view = renderPage();
  await screen.findByTestId("wizard");
  await waitFor(() => expect(mocks.guardOptions?.enabled).toBe(true));
  return view;
}

function openNavigateAways() {
  return screen
    .queryAllByTestId("navigate-away")
    .filter((node) => node.dataset.open === "true");
}

function completeStep1(overrides: Record<string, any> = {}) {
  return {
    planId: "plan-1",
    benefitCategory: "Retirement",
    companyLogo: { url: "https://cdn.test/logo.png" },
    benefitTitle: "Retirement Plan Benefits",
    shortDescription: "Plan for retirement.",
    contactId: "contact-1",
    ...overrides,
  };
}

function completeStep2(overrides: Record<string, any> = {}) {
  return {
    ...completeStep1(),
    companyLogo: { url: "https://cdn.test/logo.png" },
    brandImages: { header: { url: "https://cdn.test/header.png" } },
    insuranceLoginUrl: "https://benefits.test/login",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.resetState();
  mocks.listeners.clear();
  mocks.guardOptions = null;
  Object.assign(mocks.guard, {
    dialogOpen: false,
    isSaving: false,
    isDiscarding: false,
  });
  mocks.rehydrate.mockReset().mockResolvedValue(undefined);
  mocks.setTitle.mockReset();
  mocks.setSubtitle.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.persistPlanSelection.mockReset();
  mocks.fetchProfileOnce.mockReset().mockResolvedValue(null);
  mocks.saveBenefit.mockReset().mockResolvedValue({ success: true });
  mocks.purgeDraftBenefit.mockReset().mockResolvedValue(undefined);
  mocks.sessionCreatedBenefitRow.mockReset().mockReturnValue(true);
  mocks.hasUnsaved = false;
  mocks.serializeSnapshot.mockReset().mockReturnValue("snapshot");
  mocks.useCommentSurface.mockReset();
  mocks.searchParams = new URLSearchParams();
  mocks.step1Scroll.mockReset();
  mocks.step2Scroll.mockReset();
  mocks.navProps.length = 0;
  mocks.confirmProps.length = 0;
  mocks.attestationProps.length = 0;

  (window as any).__benefitsStep1ScrollToFields = mocks.step1Scroll;
  (window as any).__benefitsStep2ScrollToFields = mocks.step2Scroll;
  window.localStorage.clear();
});

afterEach(() => {
  delete (window as any).__benefitsStep1ScrollToFields;
  delete (window as any).__benefitsStep2ScrollToFields;
  vi.useRealTimers();
});

describe("NewBenefitsPage shell", () => {
  it("sets the page title and renders the current step", async () => {
    mocks.state.currentStep = 2;
    await renderReady();

    expect(mocks.setTitle).toHaveBeenCalledWith("Create Benefits");
    expect(screen.getByTestId("wizard")).toHaveAttribute("data-step", "2");
    expect(screen.getByTestId("step-2")).toBeInTheDocument();
    expect(screen.queryByTestId("step-1")).not.toBeInTheDocument();
  });

  it.each([1, 2, 3, 4, 5])("renders step %i", async (step) => {
    mocks.state.currentStep = step;
    await renderReady();

    expect(screen.getByTestId(`step-${step}`)).toBeInTheDocument();
  });

  it("pins the category picker only when the URL names a category", async () => {
    setSearchParams({ planId: "plan-1", category: "Retirement" });
    await renderReady();

    expect(screen.getByTestId("step-1")).toHaveAttribute(
      "data-hide-category-picker",
      "true",
    );
  });

  it("keeps the category picker for a plan-only deep link", async () => {
    setSearchParams({ planId: "plan-1" });
    await renderReady();

    expect(screen.getByTestId("step-1")).toHaveAttribute(
      "data-hide-category-picker",
      "false",
    );
  });

  it("passes the footer flags to the wizard", async () => {
    mocks.state.currentStep = 5;
    await renderReady();

    const wizard = screen.getByTestId("wizard");
    expect(wizard).toHaveAttribute("data-first", "false");
    expect(wizard).toHaveAttribute("data-last", "true");
    expect(wizard).toHaveAttribute("data-loading", "false");
    expect(wizard).toHaveAttribute("data-cancelling", "false");
  });

  it("sets the subtitle to plan and category", async () => {
    mocks.state.stepData = {
      step1: {
        selectedPlan: { companyName: "Acme Corp" },
        benefitCategory: "Retirement",
      },
    };
    await renderReady();

    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp - Retirement"),
    );
  });

  it("uses the custom benefit name in the subtitle", async () => {
    mocks.state.stepData = {
      step1: {
        selectedPlan: { companyName: "Acme Corp" },
        benefitCategory: "Company / Plan Sponsor",
        benefitTitle: "Mindfulness and Me",
      },
    };
    await renderReady();

    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenCalledWith(
        "Acme Corp - Mindfulness and Me",
      ),
    );
  });

  it("does not use the storage label as the Custom benefit name", async () => {
    mocks.state.stepData = {
      step1: {
        selectedPlan: { companyName: "Acme Corp" },
        benefitCategory: "Custom",
        benefitTitle: "Company / Plan Sponsor",
      },
    };
    await renderReady();

    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp"),
    );
  });

  it("clears the subtitle when no plan is selected", async () => {
    await renderReady();

    await waitFor(() => expect(mocks.setSubtitle).toHaveBeenCalledWith(""));
  });

  it("configures the comment surface from the live store", async () => {
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    await renderReady();

    expect(mocks.useCommentSurface).toHaveBeenLastCalledWith({
      clientId: "plan-1",
      targetType: "benefit",
      category: "Retirement",
      persisted: true,
    });
  });

  it("falls back to the URL for the comment surface", async () => {
    setSearchParams({ planId: "plan-url", category: "Custom" });
    mocks.rehydrate.mockResolvedValue(undefined);
    await renderReady();

    expect(mocks.useCommentSurface).toHaveBeenLastCalledWith({
      clientId: "plan-url",
      targetType: "benefit",
      category: "Company / Plan Sponsor",
      persisted: true,
    });
  });

  it("does not register a comment surface without a plan or category", async () => {
    await renderReady();

    expect(mocks.useCommentSurface).toHaveBeenCalledWith(null);
  });

  it("scrolls to the top when the step changes", async () => {
    const view = await renderReady();
    expect(window.scrollTo).toHaveBeenCalled();

    (window.scrollTo as any).mockClear();
    mocks.state.currentStep = 2;
    view.rerender(<NewBenefitsPage />);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });
});

describe("NewBenefitsPage deep-link initialization", () => {
  it("rehydrates before applying a plan and category deep link", async () => {
    setSearchParams({ planId: "plan-1", category: "Retirement" });
    await renderReady();

    expect(mocks.rehydrate).toHaveBeenCalled();
    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        planId: "plan-1",
        benefitCategory: "Retirement",
        benefitTitle: "Retirement",
      }),
    );
    expect(mocks.persistPlanSelection).toHaveBeenCalledWith(
      "benefits",
      "plan-1",
    );
  });

  it("starts a Custom deep link with a blank custom name", async () => {
    setSearchParams({ planId: "plan-1", category: "Custom" });
    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ benefitCategory: "Custom", benefitTitle: "" }),
    );
  });

  it("starts a plan-sponsor deep link with a blank custom name", async () => {
    setSearchParams({
      planId: "plan-1",
      category: "Company / Plan Sponsor",
    });
    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        benefitCategory: "Company / Plan Sponsor",
        benefitTitle: "",
      }),
    );
  });

  it("clears the category for a plan-only deep link", async () => {
    setSearchParams({ planId: "plan-1" });
    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        planId: "plan-1",
        benefitCategory: "",
        benefitTitle: "",
        contactId: "",
        companyLogo: null,
      }),
    );
  });

  it("resumes a matching draft without overwriting its fields", async () => {
    setSearchParams({ planId: "plan-1", category: "Retirement" });
    mocks.rehydrate.mockImplementation(async () => {
      mocks.state.stepData = {
        step1: {
          planId: "plan-1",
          benefitCategory: "Retirement",
          benefitTitle: "My own headline",
          companyLogo: { url: "https://cdn.test/draft.png" },
        },
      };
    });
    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        planId: "plan-1",
        benefitCategory: "Retirement",
        benefitTitle: "My own headline",
        companyLogo: { url: "https://cdn.test/draft.png" },
        benefitFieldsLoadedCategories: ["Retirement"],
      }),
    );
  });

  it("resets an empty wizard when there is no deep link", async () => {
    await renderReady();

    expect(mocks.state.resetWizard).toHaveBeenCalled();
  });

  it("keeps a persisted draft when there is no deep link", async () => {
    mocks.rehydrate.mockImplementation(async () => {
      mocks.state.stepData = {
        step1: { planId: "plan-1", benefitCategory: "Retirement" },
      };
    });
    await renderReady();

    expect(mocks.state.resetWizard).not.toHaveBeenCalled();
  });

  it("keeps the leave guard disabled until hydration finishes", async () => {
    let resolveHydration!: () => void;
    mocks.rehydrate.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveHydration = resolve;
      }),
    );
    renderPage();
    await screen.findByTestId("wizard");

    expect(mocks.guardOptions.enabled).toBe(false);

    await act(async () => {
      resolveHydration();
    });

    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(true));
  });
});

describe("NewBenefitsPage step validation", () => {
  it("blocks Step 1 and points at every missing field", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = { step1: { planId: "plan-1" } };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.step1Scroll).toHaveBeenCalledWith([
      "benefitCategory",
      "companyLogo",
      "benefitTitle",
      "shortDescription",
      "contactId",
    ]);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please fill in all required fields",
      expect.objectContaining({
        description: expect.stringContaining("Select a plan"),
      }),
    );
    expect(mocks.state.nextStep).not.toHaveBeenCalled();
  });

  it("advances from a complete Step 1", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = { step1: completeStep1() };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.state.completeStep).toHaveBeenCalledWith(1);
    expect(mocks.state.nextStep).toHaveBeenCalled();
  });

  it("blocks Step 2 with the editor fields and opens the editor", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 2;
    mocks.state.stepData = {
      step1: completeStep1({ companyLogo: null, insuranceLoginUrl: "" }),
    };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.step2Scroll).toHaveBeenCalledWith([
      "companyLogo",
      "brandImages.header",
      "insuranceLoginUrl",
    ]);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please complete the required fields",
      expect.objectContaining({
        description: expect.stringContaining("Register/Login Button URL"),
      }),
    );
    expect(mocks.state.nextStep).not.toHaveBeenCalled();
  });

  it("advances from a complete Step 2", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 2;
    mocks.state.stepData = { step1: completeStep2() };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.state.completeStep).toHaveBeenCalledWith(2);
    expect(mocks.state.nextStep).toHaveBeenCalled();
  });

  it("requires an enabled support contact on Step 3", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 3;
    mocks.state.stepData = {
      step3: { supportContacts: [{ contactId: "c1", enabled: false }] },
    };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please select at least one support contact",
      expect.objectContaining({
        description: "Employees need someone to reach out to for questions.",
      }),
    );
    expect(mocks.state.nextStep).not.toHaveBeenCalled();
  });

  it("advances from Step 3 with an enabled contact", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 3;
    mocks.state.stepData = {
      step3: { supportContacts: [{ contactId: "c1", enabled: true }] },
    };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.state.completeStep).toHaveBeenCalledWith(3);
    expect(mocks.state.nextStep).toHaveBeenCalled();
  });

  it.each([4, 5])("advances unconditionally from Step %i", async (step) => {
    const user = userEvent.setup();
    mocks.state.currentStep = step;
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.state.completeStep).toHaveBeenCalledWith(step);
    expect(mocks.state.nextStep).toHaveBeenCalled();
  });
});

describe("NewBenefitsPage Previous and leave prompt", () => {
  it("steps back inside the wizard", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 3;
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Previous" }));

    expect(mocks.state.previousStep).toHaveBeenCalled();
    expect(mocks.guardOptions.enabled).toBe(true);
  });

  it("leaves for Benefits from a clean Step 1", async () => {
    const user = userEvent.setup();
    mocks.hasUnsaved = false;
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Previous" }));

    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
  });

  it("asks before leaving a dirty Step 1", async () => {
    const user = userEvent.setup();
    mocks.hasUnsaved = true;
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Previous" }));

    expect(openNavigateAways()).toHaveLength(1);
    expect(mocks.guardOptions.enabled).toBe(true);
  });

  it("saves and exits from the Step 1 prompt", async () => {
    const user = userEvent.setup();
    mocks.hasUnsaved = true;
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Previous" }));
    await user.click(screen.getByRole("button", { name: "Save and exit" }));

    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
  });

  it("discards the persisted draft from the Step 1 prompt", async () => {
    const user = userEvent.setup();
    mocks.hasUnsaved = true;
    window.localStorage.setItem("benefits-wizard", "{}");
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Previous" }));
    await user.click(
      screen.getByRole("button", { name: "Discard without saving" }),
    );

    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
    expect(window.localStorage.getItem("benefits-wizard")).toBeNull();
  });
});

describe("NewBenefitsPage Cancel", () => {
  it("asks before discarding", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Cancel" }));

    expect(
      screen.getByRole("dialog", { name: "Discard this benefit?" }),
    ).toBeInTheDocument();
    expect(mocks.purgeDraftBenefit).not.toHaveBeenCalled();
  });

  it("purges a row this session created and clears the draft", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.sessionCreatedBenefitRow.mockReturnValue(true);
    window.localStorage.setItem("benefits-wizard", "{}");
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Cancel" }));
    await user.click(screen.getByRole("button", { name: "Yes, discard" }));

    await waitFor(() =>
      expect(mocks.purgeDraftBenefit).toHaveBeenCalledWith(
        "plan-1",
        "Retirement",
      ),
    );
    expect(window.localStorage.getItem("benefits-wizard")).toBeNull();
    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
  });

  it("never purges a benefit that pre-existed the session", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.sessionCreatedBenefitRow.mockReturnValue(false);
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Cancel" }));
    await user.click(screen.getByRole("button", { name: "Yes, discard" }));

    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
    expect(mocks.purgeDraftBenefit).not.toHaveBeenCalled();
  });

  it("reports a failed purge but still lets the advisor leave", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.sessionCreatedBenefitRow.mockReturnValue(true);
    mocks.purgeDraftBenefit.mockRejectedValue(new Error("purge failed"));
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Cancel" }));
    await user.click(screen.getByRole("button", { name: "Yes, discard" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Could not fully discard the benefit",
        expect.objectContaining({ description: "purge failed" }),
      ),
    );
    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
  });

  it("skips the purge when the draft names no plan or category", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Cancel" }));
    await user.click(screen.getByRole("button", { name: "Yes, discard" }));

    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
    expect(mocks.sessionCreatedBenefitRow).not.toHaveBeenCalled();
  });
});

describe("NewBenefitsPage publish", () => {
  it("opens the attestation before saving anything", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: completeStep2() };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));

    expect(
      screen.getByRole("dialog", { name: "Publishing Attestation" }),
    ).toBeInTheDocument();
    expect(mocks.saveBenefit).not.toHaveBeenCalled();
  });

  it("saves, reports success and leaves for Benefits", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: completeStep2() };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm and Publish" }),
    );

    await waitFor(() =>
      expect(mocks.saveBenefit).toHaveBeenCalledWith(mocks.state.stepData),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Retirement benefits created successfully!",
    );
    expect(mocks.state.completeStep).toHaveBeenCalledWith(5);
    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false), {
      timeout: 3000,
    });
    expect(mocks.state.goToStep).toHaveBeenCalledWith(1);
  });

  it("reports a save failure and stays put", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: completeStep2() };
    mocks.saveBenefit.mockResolvedValue({ success: false, error: "nope" });
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm and Publish" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Cannot complete benefits creation:",
        expect.objectContaining({ description: "nope" }),
      ),
    );
    expect(mocks.state.completeStep).not.toHaveBeenCalled();
    expect(mocks.guardOptions.enabled).toBe(true);
  });

  it("reports a thrown save request", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: completeStep2() };
    mocks.saveBenefit.mockRejectedValue(new Error("network"));
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm and Publish" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Cannot complete benefits creation:",
        expect.objectContaining({ description: "network" }),
      ),
    );
    expect(mocks.guardOptions.enabled).toBe(true);
  });

  it("refuses to save without a plan id", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: { benefitCategory: "Retirement" } };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm and Publish" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Plan ID missing. Cannot complete setup.",
      ),
    );
    expect(mocks.saveBenefit).not.toHaveBeenCalled();
  });
});

describe("NewBenefitsPage organization-logo sync", () => {
  it("copies a changed organization logo into the benefit draft", async () => {
    mocks.state.stepData = {
      step1: {
        planId: "plan-1",
        benefitCategory: "Retirement",
        orgLogoSnapshot: "https://cdn.test/old.png",
        categoryBenefitByApi: {
          retirement: { partnerLogo: "https://cdn.test/old.png" },
        },
      },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogoUrl: "https://cdn.test/new.png",
      primaryServiceCategories: ["Retirement"],
    });
    await renderReady();

    await waitFor(() =>
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          companyLogo: expect.objectContaining({
            url: "https://cdn.test/new.png",
          }),
          orgLogoSnapshot: "https://cdn.test/new.png",
          categoryBenefitByApi: {
            retirement: { partnerLogo: "https://cdn.test/new.png" },
          },
        }),
      ),
    );
  });

  it("treats Other as the Custom hub's primary category", async () => {
    mocks.state.stepData = {
      step1: {
        planId: "plan-1",
        benefitCategory: "Custom",
        orgLogoSnapshot: "",
      },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogoUrl: "https://cdn.test/new.png",
      primaryServiceCategories: ["Other"],
    });
    await renderReady();

    await waitFor(() =>
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          orgLogoSnapshot: "https://cdn.test/new.png",
        }),
      ),
    );
  });

  it("leaves a non-primary category alone", async () => {
    mocks.state.stepData = {
      step1: {
        planId: "plan-1",
        benefitCategory: "Retirement",
        orgLogoSnapshot: "",
      },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogoUrl: "https://cdn.test/new.png",
      primaryServiceCategories: ["Group Health"],
    });
    await renderReady();
    await act(async () => {});

    expect(mocks.state.saveStepData).not.toHaveBeenCalled();
  });

  it("does nothing when the logo has not changed", async () => {
    mocks.state.stepData = {
      step1: {
        planId: "plan-1",
        benefitCategory: "Retirement",
        orgLogoSnapshot: "https://cdn.test/same.png",
      },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogoUrl: "https://cdn.test/same.png",
      primaryServiceCategories: ["Retirement"],
    });
    await renderReady();
    await act(async () => {});

    expect(mocks.state.saveStepData).not.toHaveBeenCalled();
  });

  it("does nothing without a selected plan or category", async () => {
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogoUrl: "https://cdn.test/new.png",
      primaryServiceCategories: ["Retirement"],
    });
    await renderReady();
    await act(async () => {});

    expect(mocks.state.saveStepData).not.toHaveBeenCalled();
  });

  it("ignores a profile request failure", async () => {
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.fetchProfileOnce.mockRejectedValue(new Error("profile offline"));
    await renderReady();
    await act(async () => {});

    expect(mocks.state.saveStepData).not.toHaveBeenCalled();
  });
});

describe("NewBenefitsPage leave guard", () => {
  it("passes dirty state and a no-op save handler to the guard", async () => {
    mocks.hasUnsaved = true;
    await renderReady();

    expect(mocks.guardOptions.hasUnsavedChanges).toBe(true);
    await expect(mocks.guardOptions.onSaveAndExit()).resolves.toBeUndefined();
  });
});

describe("NewBenefitsPage rehydration failures", () => {
  it("starts the page when persisted hydration rejects", async () => {
    const error = new Error("storage unavailable");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rehydrate.mockRejectedValue(error);

    await renderReady();

    expect(mocks.state.resetWizard).toHaveBeenCalled();
    expect(mocks.guardOptions.enabled).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(
      "[new-benefits] rehydrate failed",
      error,
    );
  });

  it("still applies a deep link when hydration rejects", async () => {
    setSearchParams({ planId: "plan-1", category: "Retirement" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rehydrate.mockRejectedValue(new Error("storage unavailable"));

    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        planId: "plan-1",
        benefitCategory: "Retirement",
      }),
    );
    expect(mocks.guardOptions.enabled).toBe(true);
  });
});

describe("NewBenefitsPage deep-link edge cases", () => {
  it("decodes + and %20 in the category", async () => {
    setRawSearchParams("planId=plan-1&category=Company+%2F+Plan+Sponsor");
    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        benefitCategory: "Company / Plan Sponsor",
        benefitTitle: "",
      }),
    );
  });

  it("ignores a category without a plan", async () => {
    setSearchParams({ category: "Retirement" });
    await renderReady();

    expect(mocks.state.resetWizard).toHaveBeenCalled();
    expect(mocks.persistPlanSelection).not.toHaveBeenCalled();
  });

  it("treats an empty planId as no deep link", async () => {
    setRawSearchParams("planId=&category=Retirement");
    await renderReady();

    expect(mocks.state.resetWizard).toHaveBeenCalled();
    expect(mocks.persistPlanSelection).not.toHaveBeenCalled();
  });

  it("resumes a matching draft with case and whitespace differences", async () => {
    setSearchParams({ planId: "plan-1", category: "Retirement" });
    mocks.rehydrate.mockImplementation(async () => {
      mocks.state.stepData = {
        step1: {
          planId: "plan-1",
          benefitCategory: " retirement ",
          benefitTitle: "Keep me",
        },
      };
    });
    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        benefitCategory: "Retirement",
        benefitTitle: "Keep me",
      }),
    );
  });

  it("does not resume a draft for another plan", async () => {
    setSearchParams({ planId: "plan-1", category: "Retirement" });
    mocks.rehydrate.mockImplementation(async () => {
      mocks.state.stepData = {
        step1: {
          planId: "plan-2",
          benefitCategory: "Retirement",
          benefitTitle: "Other plan",
        },
      };
    });
    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        planId: "plan-1",
        benefitTitle: "Retirement",
      }),
    );
  });

  it("does not resume a draft for another category", async () => {
    setSearchParams({ planId: "plan-1", category: "Retirement" });
    mocks.rehydrate.mockImplementation(async () => {
      mocks.state.stepData = {
        step1: {
          planId: "plan-1",
          benefitCategory: "Group Health",
          benefitTitle: "Other category",
        },
      };
    });
    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        benefitCategory: "Retirement",
        benefitTitle: "Retirement",
      }),
    );
  });

  it("de-duplicates the loaded-category marker on resume", async () => {
    setSearchParams({ planId: "plan-1", category: "Retirement" });
    mocks.rehydrate.mockImplementation(async () => {
      mocks.state.stepData = {
        step1: {
          planId: "plan-1",
          benefitCategory: "Retirement",
          benefitFieldsLoadedCategories: ["Retirement", "Group Health"],
        },
      };
    });
    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        benefitFieldsLoadedCategories: ["Retirement", "Group Health"],
      }),
    );
  });

  it("re-applies the URL after a late store write", async () => {
    vi.useFakeTimers();
    setSearchParams({ planId: "plan-1", category: "Retirement" });
    renderPage();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    mocks.state.saveStepData.mockClear();
    mocks.state.stepData = {
      step1: { planId: "late-plan", benefitCategory: "Group Health" },
    };
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        planId: "plan-1",
        benefitCategory: "Retirement",
      }),
    );
  });

  it("clears the re-apply timers on unmount", async () => {
    vi.useFakeTimers();
    setSearchParams({ planId: "plan-1", category: "Retirement" });
    const view = renderPage();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    mocks.state.saveStepData.mockClear();
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(mocks.state.saveStepData).not.toHaveBeenCalled();
  });
});

describe("NewBenefitsPage header and comment edge cases", () => {
  it("uses the custom name for a lowercase custom category", async () => {
    mocks.state.stepData = {
      step1: {
        selectedPlan: { companyName: "Acme Corp" },
        benefitCategory: "custom",
        benefitTitle: "Mindfulness",
      },
    };
    await renderReady();

    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp - Mindfulness"),
    );
  });

  it("treats a whitespace custom name as empty", async () => {
    mocks.state.stepData = {
      step1: {
        selectedPlan: { companyName: "Acme Corp" },
        benefitCategory: "custom",
        benefitTitle: "   ",
      },
    };
    await renderReady();

    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp"),
    );
  });

  it("treats the literal Custom label as a placeholder", async () => {
    mocks.state.stepData = {
      step1: {
        selectedPlan: { companyName: "Acme Corp" },
        benefitCategory: "Company / Plan Sponsor",
        benefitTitle: "Custom",
      },
    };
    await renderReady();

    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp"),
    );
  });

  it("lets a later store selection win over the entry URL", async () => {
    setSearchParams({ planId: "plan-url", category: "Group Health" });
    const view = await renderReady();

    mocks.state.stepData = {
      step1: { planId: "plan-store", benefitCategory: "Retirement" },
    };
    view.rerender(<NewBenefitsPage />);

    expect(mocks.useCommentSurface).toHaveBeenLastCalledWith({
      clientId: "plan-store",
      targetType: "benefit",
      category: "Retirement",
      persisted: true,
    });
  });

  it("uses the URL category when the store has only a plan", async () => {
    setSearchParams({ category: "Group Health" });
    mocks.state.stepData = {
      step1: { planId: "plan-store", benefitCategory: "" },
    };
    await renderReady();

    expect(mocks.useCommentSurface).toHaveBeenLastCalledWith({
      clientId: "plan-store",
      targetType: "benefit",
      category: "Group Health",
      persisted: true,
    });
  });

  it("canonicalizes an uppercase CUSTOM for comments", async () => {
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "CUSTOM" },
    };
    await renderReady();

    expect(mocks.useCommentSurface).toHaveBeenLastCalledWith({
      clientId: "plan-1",
      targetType: "benefit",
      category: "Company / Plan Sponsor",
      persisted: true,
    });
  });
});

describe("NewBenefitsPage validation edge cases", () => {
  it("reports only the missing short description", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = {
      step1: completeStep1({ shortDescription: "  " }),
    };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.step1Scroll).toHaveBeenCalledWith(["shortDescription"]);
  });

  it("treats a whitespace benefit title as missing", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = {
      step1: completeStep1({ benefitTitle: "   " }),
    };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.step1Scroll).toHaveBeenCalledWith(["benefitTitle"]);
  });

  it("falls back to the Step 1 validation event", async () => {
    const user = userEvent.setup();
    delete (window as any).__benefitsStep1ScrollToFields;
    const listener = vi.fn();
    window.addEventListener("benefitsStep1ValidationError", listener);
    mocks.state.stepData = { step1: { planId: "plan-1" } };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls[0][0].detail.fields).toEqual([
      "benefitCategory",
      "companyLogo",
      "benefitTitle",
      "shortDescription",
      "contactId",
    ]);
    window.removeEventListener("benefitsStep1ValidationError", listener);
  });

  it("reports only the missing insurance login URL on Step 2", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 2;
    mocks.state.stepData = {
      step1: completeStep2({ insuranceLoginUrl: "   " }),
    };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.step2Scroll).toHaveBeenCalledWith(["insuranceLoginUrl"]);
  });

  it("falls back to the Step 2 editor event", async () => {
    const user = userEvent.setup();
    delete (window as any).__benefitsStep2ScrollToFields;
    const listener = vi.fn();
    window.addEventListener("openBenefitsEditor", listener);
    mocks.state.currentStep = 2;
    mocks.state.stepData = {
      step1: completeStep2({ insuranceLoginUrl: "" }),
    };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls[0][0].detail).toEqual({
      sectionId: "insurance",
      fieldId: "insuranceLoginUrl",
    });
    window.removeEventListener("openBenefitsEditor", listener);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty", []],
  ])("blocks Step 3 when supportContacts is %s", async (_label, contacts) => {
    const user = userEvent.setup();
    mocks.state.currentStep = 3;
    mocks.state.stepData = { step3: { supportContacts: contacts as any } };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.state.nextStep).not.toHaveBeenCalled();
  });

  it("advances when one of several contacts is enabled", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 3;
    mocks.state.stepData = {
      step3: {
        supportContacts: [
          { contactId: "c1", enabled: false },
          { contactId: "c2", enabled: true },
          { contactId: "c3", enabled: false },
        ],
      },
    };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Next" }));

    expect(mocks.state.completeStep).toHaveBeenCalledWith(3);
    expect(mocks.state.nextStep).toHaveBeenCalled();
  });
});

describe("NewBenefitsPage leave and cancel edge cases", () => {
  it("leaves a clean Step 1 without clearing a persisted draft", async () => {
    const user = userEvent.setup();
    mocks.hasUnsaved = false;
    window.localStorage.setItem("benefits-wizard", "{}");
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Previous" }));

    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
    expect(window.localStorage.getItem("benefits-wizard")).toBe("{}");
  });

  it("does not purge a row when Step 1 Previous discards", async () => {
    const user = userEvent.setup();
    mocks.hasUnsaved = true;
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    window.localStorage.setItem("benefits-wizard", "{}");
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Previous" }));
    await user.click(
      screen.getByRole("button", { name: "Discard without saving" }),
    );

    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
    expect(mocks.purgeDraftBenefit).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("benefits-wizard")).toBeNull();
  });

  it("Stay and keep editing closes the Step 1 prompt", async () => {
    const user = userEvent.setup();
    mocks.hasUnsaved = true;
    window.localStorage.setItem("benefits-wizard", "{}");
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Previous" }));
    await user.click(
      screen.getByRole("button", { name: "Stay and keep editing" }),
    );

    expect(openNavigateAways()).toHaveLength(0);
    expect(mocks.guardOptions.enabled).toBe(true);
    expect(window.localStorage.getItem("benefits-wizard")).toBe("{}");
  });

  it("wires the leave guard's dialog callbacks", async () => {
    await renderReady();

    const dialog = mocks.navProps[0];
    expect(dialog.onStay).toBe(mocks.guard.stayAndKeepEditing);
    expect(dialog.onSaveAndExit).toBe(mocks.guard.saveAndExit);
    expect(dialog.onDiscardWithoutSaving).toBe(
      mocks.guard.discardWithoutSaving,
    );
    expect(dialog.onDialogOpenChange).toBe(mocks.guard.dialogOnOpenChange);
    expect(dialog.onDiscardPointerDownCapture).toBe(
      mocks.guard.suppressStayOnNextClose,
    );
  });

  it("passes the destructive Cancel dialog contract", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Cancel" }));

    const dialog = mocks.confirmProps[mocks.confirmProps.length - 1];
    expect(dialog).toMatchObject({
      open: true,
      title: "Discard this benefit?",
      description:
        "Changes you haven't saved will be lost. If you created this benefit in this session, it will also be removed.",
      confirmText: "Yes, discard",
      cancelText: "No, go back",
      variant: "destructive",
      loadingText: "Discarding...",
    });
  });

  it("shows the cancelling state while the purge is in flight", async () => {
    const user = userEvent.setup();
    let resolvePurge!: () => void;
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.sessionCreatedBenefitRow.mockReturnValue(true);
    mocks.purgeDraftBenefit.mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePurge = resolve;
      }),
    );
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Cancel" }));
    await user.click(screen.getByRole("button", { name: "Yes, discard" }));

    await waitFor(() =>
      expect(screen.getByTestId("wizard")).toHaveAttribute(
        "data-cancelling",
        "true",
      ),
    );

    resolvePurge();
    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
  });

  it("reports a thrown session-created check and still leaves", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.sessionCreatedBenefitRow.mockImplementation(() => {
      throw new Error("snapshot failed");
    });
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Cancel" }));
    await user.click(screen.getByRole("button", { name: "Yes, discard" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Could not fully discard the benefit",
        expect.objectContaining({ description: "snapshot failed" }),
      ),
    );
    await waitFor(() => expect(mocks.guardOptions.enabled).toBe(false));
  });
});

describe("NewBenefitsPage publish edge cases", () => {
  it("closes the attestation without saving", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: completeStep2() };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));
    const dialog = screen.getByRole("dialog", {
      name: "Publishing Attestation",
    });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("dialog", { name: "Publishing Attestation" }),
    ).not.toBeInTheDocument();
    expect(mocks.saveBenefit).not.toHaveBeenCalled();
  });

  it("does not leave before the success delay elapses", async () => {
    vi.useFakeTimers();
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: completeStep2() };
    renderPage();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Wizard Complete" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and Publish" }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.state.goToStep).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(mocks.state.goToStep).toHaveBeenCalledWith(1);
  });

  it("clears the success delay on unmount", async () => {
    vi.useFakeTimers();
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: completeStep2() };
    const view = renderPage();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Wizard Complete" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and Publish" }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    view.unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mocks.state.goToStep).not.toHaveBeenCalled();
  });

  it("falls back to Benefit in the success toast", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 5;
    mocks.state.stepData = {
      step1: completeStep2({ benefitCategory: "" }),
    };
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm and Publish" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Benefit benefits created successfully!",
      ),
    );
  });

  it("uses a 5s error toast", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: completeStep2() };
    mocks.saveBenefit.mockResolvedValue({ success: false, error: "nope" });
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm and Publish" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Cannot complete benefits creation:",
        expect.objectContaining({ description: "nope", duration: 5000 }),
      ),
    );
  });

  it("treats an undefined save result as a failure", async () => {
    const user = userEvent.setup();
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: completeStep2() };
    mocks.saveBenefit.mockResolvedValue(undefined as any);
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm and Publish" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Cannot complete benefits creation:",
        expect.anything(),
      ),
    );
  });

  it("disables the leave guard while the publish is in flight", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: { success: boolean }) => void;
    mocks.state.currentStep = 5;
    mocks.state.stepData = { step1: completeStep2() };
    mocks.saveBenefit.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Wizard Complete" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm and Publish" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("wizard")).toHaveAttribute(
        "data-loading",
        "true",
      ),
    );
    expect(mocks.guardOptions.enabled).toBe(false);

    resolveSave({ success: true });
    await waitFor(() =>
      expect(screen.getByTestId("wizard")).toHaveAttribute(
        "data-loading",
        "false",
      ),
    );
  });
});

describe("NewBenefitsPage organization-logo edge cases", () => {
  it("uses advisorLogo when advisorLogoUrl is absent", async () => {
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogo: "https://cdn.test/advisor.png",
      primaryServiceCategories: ["Retirement"],
    });
    await renderReady();

    await waitFor(() =>
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          orgLogoSnapshot: "https://cdn.test/advisor.png",
        }),
      ),
    );
  });

  it("falls back to the wizard session branding logo", async () => {
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      wizardSessions: [{ branding: { logo: "https://cdn.test/session.png" } }],
      primaryServiceCategories: ["Retirement"],
    });
    await renderReady();

    await waitFor(() =>
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          orgLogoSnapshot: "https://cdn.test/session.png",
        }),
      ),
    );
  });

  it("ignores a whitespace logo", async () => {
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogoUrl: "   ",
      primaryServiceCategories: ["Retirement"],
    });
    await renderReady();
    await act(async () => {});

    expect(mocks.state.saveStepData).not.toHaveBeenCalled();
  });

  it("ignores a non-array primary category list", async () => {
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogoUrl: "https://cdn.test/new.png",
      primaryServiceCategories: "Retirement",
    });
    await renderReady();
    await act(async () => {});

    expect(mocks.state.saveStepData).not.toHaveBeenCalled();
  });

  it("matches primary categories case- and whitespace-insensitively", async () => {
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogoUrl: "https://cdn.test/new.png",
      primaryServiceCategories: [" retirement "],
    });
    await renderReady();

    await waitFor(() =>
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          orgLogoSnapshot: "https://cdn.test/new.png",
        }),
      ),
    );
  });

  it("keeps an absent row snapshot absent", async () => {
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogoUrl: "https://cdn.test/new.png",
      primaryServiceCategories: ["Retirement"],
    });
    await renderReady();

    await waitFor(() =>
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ categoryBenefitByApi: undefined }),
      ),
    );
  });

  it("only rewrites partnerLogo on an existing row", async () => {
    mocks.state.stepData = {
      step1: {
        planId: "plan-1",
        benefitCategory: "Retirement",
        categoryBenefitByApi: {
          retirement: { partnerLogo: "old", title: "Keep" },
        },
      },
    };
    mocks.fetchProfileOnce.mockResolvedValue({
      advisorLogoUrl: "https://cdn.test/new.png",
      primaryServiceCategories: ["Retirement"],
    });
    await renderReady();

    await waitFor(() =>
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          categoryBenefitByApi: {
            retirement: {
              partnerLogo: "https://cdn.test/new.png",
              title: "Keep",
            },
          },
        }),
      ),
    );
  });

  it("does not write after unmounting before the profile resolves", async () => {
    let resolveProfile!: (value: any) => void;
    mocks.state.stepData = {
      step1: { planId: "plan-1", benefitCategory: "Retirement" },
    };
    mocks.fetchProfileOnce.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    const view = await renderReady();

    view.unmount();
    await act(async () => {
      resolveProfile({
        advisorLogoUrl: "https://cdn.test/new.png",
        primaryServiceCategories: ["Retirement"],
      });
      await Promise.resolve();
    });

    expect(mocks.state.saveStepData).not.toHaveBeenCalled();
  });
});
