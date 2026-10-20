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

import { BenefitEditPage } from "@/components/pages/benefits/benefit-edit-page";

/**
 * Edit Benefit page.
 *
 * The wizard store, the shared step screens, the preview and the delete dialog
 * are mocked, so these tests assert this page's own orchestration: hydration,
 * tabs, the Custom name, save/delete, the portal link and the preview layout.
 */

const mocks = vi.hoisted(() => {
  const state: any = {};

  const resetState = (overrides: Record<string, unknown> = {}) => {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, {
      stepData: {
        step1: {
          planId: "plan-1",
          benefitCategory: "Retirement",
          benefitTitle: "Retirement Plan Benefits",
          selectedPlan: { companyName: "Acme Corp", slug: "acme" },
        },
      },
      saveStepData: vi.fn((step: number, data: any) => {
        state.stepData = { ...state.stepData, [`step${step}`]: data };
      }),
      goToStep: vi.fn(),
      ...overrides,
    });
    return state;
  };

  return {
    state,
    resetState,
    rehydrate: vi.fn(async () => {}),
    setTitle: vi.fn(),
    setSubtitle: vi.fn(),
    push: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    saveBenefit: vi.fn(
      async (): Promise<{ success: boolean; error?: string }> => ({
        success: true,
      }),
    ),
    purgeDraftBenefit: vi.fn(async () => {}),
    forgetDraftBenefit: vi.fn(),
    invalidateClientCache: vi.fn(),
    invalidateBenefitRowsCache: vi.fn(),
    persistPlanSelection: vi.fn(),
    mutateSwr: vi.fn(),
    useCommentSurface: vi.fn(),
    confirmProps: [] as any[],
    open: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("swr", () => ({
  mutate: mocks.mutateSwr,
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({
    setTitle: mocks.setTitle,
    setSubtitle: mocks.setSubtitle,
  }),
}));

vi.mock("@/lib/benefits-wizard-store", () => {
  const store = Object.assign(
    (selector?: (value: any) => unknown) =>
      selector ? selector(mocks.state) : mocks.state,
    {
      getState: () => mocks.state,
      persist: { rehydrate: () => mocks.rehydrate() },
    },
  );
  return { useBenefitsWizardStore: store };
});

vi.mock("@/lib/save-benefit", () => ({
  saveBenefit: mocks.saveBenefit,
}));

vi.mock("@/lib/benefit-draft", () => ({
  purgeDraftBenefit: mocks.purgeDraftBenefit,
  forgetDraftBenefit: mocks.forgetDraftBenefit,
}));

vi.mock("@/lib/fetch-client", () => ({
  invalidateClientCache: mocks.invalidateClientCache,
  invalidateBenefitRowsCache: mocks.invalidateBenefitRowsCache,
}));

vi.mock("@/lib/plan-selector-storage", () => ({
  persistPlanSelection: mocks.persistPlanSelection,
}));

vi.mock("@/lib/marketing/hub-url", () => ({
  getBenefitsHubOpenPortalUrl: (slug: string) => `https://hub.test/${slug}`,
  getBenefitPortalSegment: (category: string, customName?: string | null) => {
    if (category === "Retirement") return "retirement";
    if (category === "Group Health") return "health-insurance";
    if (category === "Group Life") return "life-insurance";
    if (category === "Company / Plan Sponsor") {
      return customName
        ? customName.toLowerCase().replace(/\s+/g, "-")
        : "wellness-programs";
    }
    return "";
  },
}));

vi.mock("@/lib/comments/portal-surface", () => ({
  withCommentsRail: (url: string) => `${url}?comments=on`,
}));

vi.mock("@/components/comments/comment-mode-provider", () => ({
  useCommentSurface: mocks.useCommentSurface,
}));

vi.mock("@/components/comments/comment-anchor", () => ({
  CommentAnchor: ({ sectionKey, label, children }: any) => (
    <div data-testid={`anchor-${sectionKey}`} data-label={label}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/comments/commentable-field", () => ({
  CommentableField: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/wizard/benefits-steps", () => ({
  BenefitsStep1: ({ mode, onReady }: any) => {
    React.useEffect(() => {
      onReady?.();
    }, []);
    return <div data-testid="step1" data-mode={mode} />;
  },
  BenefitsStep3: ({ section }: any) => (
    <div data-testid={`step3-${section}`} data-section={section} />
  ),
  BenefitsStep4: () => <div data-testid="step4" />,
  BenefitsStep5: () => <div data-testid="step5" />,
}));

vi.mock("@/components/pages/benefits/edit-benefit-preview-section", () => ({
  EditBenefitPreviewSection: () => <div data-testid="preview-section" />,
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: (props: any) => {
    mocks.confirmProps.push(props);
    if (!props.open) return null;
    return (
      <div role="dialog" aria-label={props.title}>
        <p>{props.description}</p>
        {props.children}
        <button
          type="button"
          disabled={props.confirmDisabled}
          onClick={() => void props.onConfirm()}
        >
          Confirm
        </button>
        <button type="button" onClick={() => props.onOpenChange(false)}>
          Cancel
        </button>
      </div>
    );
  },
}));

function renderPage(planId = "plan-1", category = "Retirement") {
  return render(<BenefitEditPage planId={planId} category={category} />);
}

async function renderReady(planId = "plan-1", category = "Retirement") {
  const view = renderPage(planId, category);
  await screen.findByRole("tab", { name: "Branding" });
  return view;
}

function headerPortal() {
  return document.getElementById("header-tabs-portal") as HTMLElement;
}

beforeEach(() => {
  mocks.resetState();
  mocks.rehydrate.mockReset().mockResolvedValue(undefined);
  mocks.setTitle.mockReset();
  mocks.setSubtitle.mockReset();
  mocks.push.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.saveBenefit.mockReset().mockResolvedValue({ success: true });
  mocks.purgeDraftBenefit.mockReset().mockResolvedValue(undefined);
  mocks.forgetDraftBenefit.mockReset();
  mocks.invalidateClientCache.mockReset();
  mocks.invalidateBenefitRowsCache.mockReset();
  mocks.persistPlanSelection.mockReset();
  mocks.mutateSwr.mockReset();
  mocks.useCommentSurface.mockReset();
  mocks.confirmProps.length = 0;
  mocks.open.mockReset();
  window.open = mocks.open as unknown as typeof window.open;

  const portal = document.createElement("div");
  portal.id = "header-tabs-portal";
  document.body.appendChild(portal);
  window.history.replaceState({}, "", "/edit-benefit/plan-1/Retirement");
});

afterEach(() => {
  headerPortal()?.remove();
  vi.useRealTimers();
});

describe("BenefitEditPage hydration and chrome", () => {
  it("rehydrates and points Step 1 at the route's plan and category", async () => {
    await renderReady();

    expect(mocks.rehydrate).toHaveBeenCalledTimes(1);
    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        planId: "plan-1",
        benefitCategory: "Retirement",
      }),
    );
    expect(mocks.persistPlanSelection).toHaveBeenCalledWith(
      "benefits",
      "plan-1",
    );
  });

  it("preserves an existing draft title", async () => {
    mocks.state.stepData.step1.benefitTitle = "My custom headline";
    await renderReady();

    expect(mocks.state.saveStepData).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ benefitTitle: "My custom headline" }),
    );
  });

  it("shows the loading frame until hydration finishes", async () => {
    let resolveHydration!: () => void;
    mocks.rehydrate.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveHydration = resolve;
      }),
    );
    renderPage();

    expect(screen.getByText("Loading benefit...")).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Branding" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveHydration();
    });

    expect(
      await screen.findByRole("tab", { name: "Branding" }),
    ).toBeInTheDocument();
  });

  it("sets the page title and subtitle", async () => {
    await renderReady();

    expect(mocks.setTitle).toHaveBeenCalledWith("Edit Benefit");
    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp - Retirement"),
    );
  });

  it("clears the subtitle on unmount", async () => {
    const view = await renderReady();
    mocks.setSubtitle.mockClear();

    view.unmount();

    expect(mocks.setSubtitle).toHaveBeenCalledWith("");
  });

  it("does not save step data after unmounting before hydration", async () => {
    let resolveHydration!: () => void;
    mocks.rehydrate.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveHydration = resolve;
      }),
    );
    const view = renderPage();
    view.unmount();

    await act(async () => {
      resolveHydration();
    });

    expect(mocks.state.saveStepData).not.toHaveBeenCalled();
  });

  it("portals the tab bar into the header target", async () => {
    await renderReady();

    const tabs = await screen.findByRole("tablist");
    expect(headerPortal().contains(tabs)).toBe(true);
  });

  it("falls back to an inline tab bar without the header target", async () => {
    headerPortal().remove();
    await renderReady();

    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("opens a tab named by ?tab=", async () => {
    window.history.replaceState(
      {},
      "",
      "/edit-benefit/plan-1/Retirement?tab=documents",
    );
    await renderReady();

    expect(screen.getByTestId("step4")).toBeInTheDocument();
  });

  it("ignores an unknown ?tab=", async () => {
    window.history.replaceState(
      {},
      "",
      "/edit-benefit/plan-1/Retirement?tab=not-a-tab",
    );
    await renderReady();

    expect(screen.getByTestId("step1")).toBeInTheDocument();
  });

  it("registers the comment surface", async () => {
    await renderReady();

    expect(mocks.useCommentSurface).toHaveBeenCalledWith({
      clientId: "plan-1",
      targetType: "benefit",
      category: "Retirement",
      persisted: true,
    });
  });
});

describe("BenefitEditPage tabs", () => {
  it("renders Branding Step 1 visibly", async () => {
    await renderReady();

    const step1 = screen.getByTestId("step1");
    expect(step1).toHaveAttribute("data-mode", "edit");
    expect(step1.closest("[aria-hidden='true']")).toBeNull();
  });

  it("keeps a hidden Step 1 on the other tabs", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("tab", { name: "Contacts" }));

    const step1 = screen.getByTestId("step1");
    expect(step1.closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByTestId("step3-contacts")).toBeInTheDocument();
  });

  it("switches through Contacts, FAQs, Documents, Disclaimers and Preview", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("tab", { name: "FAQs" }));
    expect(screen.getByTestId("step3-faqs")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Documents" }));
    expect(screen.getByTestId("step4")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Disclosures" }));
    expect(screen.getByTestId("step5")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByTestId("preview-section")).toBeInTheDocument();
  });
});

describe("BenefitEditPage Custom name", () => {
  it("shows the name field only for the Custom hub", async () => {
    await renderReady("plan-1", "Company / Plan Sponsor");

    expect(
      await screen.findByLabelText(/Custom Benefit Name/),
    ).toBeInTheDocument();
  });

  it("hides the name field for a standard category", async () => {
    await renderReady();

    expect(
      screen.queryByLabelText(/Custom Benefit Name/),
    ).not.toBeInTheDocument();
  });

  it("prefills the name from the draft", async () => {
    mocks.state.stepData.step1.benefitTitle = "Mindfulness";
    await renderReady("plan-1", "Company / Plan Sponsor");

    expect(await screen.findByLabelText(/Custom Benefit Name/)).toHaveValue(
      "Mindfulness",
    );
  });

  it("falls back to the persisted row's title", async () => {
    mocks.state.stepData.step1.benefitTitle = "Company / Plan Sponsor";
    mocks.state.stepData.step1.categoryBenefitByApi = {
      "company / plan sponsor": { title: "Yoga" },
    };
    await renderReady("plan-1", "Company / Plan Sponsor");

    expect(await screen.findByLabelText(/Custom Benefit Name/)).toHaveValue(
      "Yoga",
    );
  });

  it("treats the storage label as no name", async () => {
    mocks.state.stepData.step1.benefitTitle = "Company / Plan Sponsor";
    await renderReady("plan-1", "Company / Plan Sponsor");

    expect(await screen.findByLabelText(/Custom Benefit Name/)).toHaveValue("");
    expect(screen.getByText("0/35")).toBeInTheDocument();
  });

  it("writes every name edit to the store", async () => {
    const user = userEvent.setup();
    await renderReady("plan-1", "Company / Plan Sponsor");
    const input = await screen.findByLabelText(/Custom Benefit Name/);

    await user.clear(input);
    await user.type(input, "Yoga");

    expect(mocks.state.saveStepData).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({ benefitTitle: "Yoga" }),
    );
    expect(screen.getByText("4/35")).toBeInTheDocument();
  });

  it("caps the name at 35 characters", async () => {
    await renderReady("plan-1", "Company / Plan Sponsor");
    const input = await screen.findByLabelText(/Custom Benefit Name/);

    expect(input).toHaveAttribute("maxLength", "35");
  });
});

describe("BenefitEditPage save", () => {
  it("requires a plan id", async () => {
    const user = userEvent.setup();
    await renderReady("", "Retirement");

    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Plan ID missing. Cannot save benefit.",
    );
    expect(mocks.saveBenefit).not.toHaveBeenCalled();
  });

  it("saves and shows the Saved label", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    await waitFor(() =>
      expect(mocks.saveBenefit).toHaveBeenCalledWith(mocks.state.stepData),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Benefit saved successfully!",
    );
    expect(screen.getByRole("button", { name: /Saved/ })).toBeInTheDocument();
  });

  it("resets Saved after 2.5s", async () => {
    await renderReady();
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: /Saved/ })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(
      screen.getByRole("button", { name: /Save changes/ }),
    ).toBeInTheDocument();
  });

  it("reports a failed save", async () => {
    const user = userEvent.setup();
    mocks.saveBenefit.mockResolvedValue({ success: false, error: "nope" });
    await renderReady();

    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Cannot save benefit:",
        expect.objectContaining({ description: "nope", duration: 5000 }),
      ),
    );
  });

  it("reports a thrown save request", async () => {
    const user = userEvent.setup();
    mocks.saveBenefit.mockRejectedValue(new Error("network"));
    await renderReady();

    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Cannot save benefit:",
        expect.objectContaining({ description: "network" }),
      ),
    );
  });

  it("disables both footer buttons while saving", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: { success: boolean }) => void;
    mocks.saveBenefit.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    await renderReady();

    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Saving\.\.\./ }),
      ).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    resolveSave({ success: true });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Saved/ })).toBeInTheDocument(),
    );
  });

  it("re-asserts the Custom name and patches the Browse Benefits cache", async () => {
    const user = userEvent.setup();
    mocks.state.stepData.step1.benefitTitle = "Company / Plan Sponsor";
    mocks.state.stepData.step1.categoryBenefitByApi = {
      "company / plan sponsor": { title: "Yoga" },
    };
    await renderReady("plan-1", "Company / Plan Sponsor");

    const input = await screen.findByLabelText(/Custom Benefit Name/);
    await user.clear(input);
    await user.type(input, "Mindfulness");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    await waitFor(() =>
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ benefitTitle: "Mindfulness" }),
      ),
    );
    expect(mocks.mutateSwr).toHaveBeenCalledWith(
      "/api/benefits",
      expect.any(Function),
      { revalidate: false },
    );

    const updater = mocks.mutateSwr.mock.calls[0][1];
    const next = updater({
      benefits: [
        {
          planId: "plan-1",
          category: "Company / Plan Sponsor",
          title: "Old",
        },
        {
          planId: "plan-1",
          category: "Retirement",
          title: "Keep",
        },
        {
          planId: "plan-2",
          category: "Company / Plan Sponsor",
          title: "Other plan",
        },
      ],
    });
    expect(next.benefits[0].title).toBe("Mindfulness");
    expect(next.benefits[1].title).toBe("Keep");
    expect(next.benefits[2].title).toBe("Other plan");
  });

  it("does not write an empty Custom name", async () => {
    const user = userEvent.setup();
    mocks.state.stepData.step1.benefitTitle = "Company / Plan Sponsor";
    await renderReady("plan-1", "Company / Plan Sponsor");
    const input = await screen.findByLabelText(/Custom Benefit Name/);
    await user.clear(input);
    mocks.state.saveStepData.mockClear();

    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(mocks.state.saveStepData).not.toHaveBeenCalledWith(
      1,
      expect.objectContaining({ benefitTitle: "" }),
    );
  });
});

describe("BenefitEditPage delete", () => {
  it("is disabled until hydration", async () => {
    mocks.rehydrate.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(
      screen.getByRole("button", { name: /Delete Benefit/ }),
    ).toBeDisabled();
  });

  it("opens the type-to-confirm dialog", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: /Delete Benefit/ }));

    const dialog = screen.getByRole("dialog", {
      name: "Delete the Retirement benefit?",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Confirm" }),
    ).toBeDisabled();
  });

  it("unlocks after the phrase is typed and deletes", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: /Delete Benefit/ }));
    await user.type(
      screen.getByPlaceholderText("delete benefit"),
      "delete benefit",
    );
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(mocks.purgeDraftBenefit).toHaveBeenCalledWith(
        "plan-1",
        "Retirement",
      ),
    );
    expect(mocks.forgetDraftBenefit).toHaveBeenCalledWith(
      "plan-1",
      "Retirement",
    );
    expect(mocks.invalidateClientCache).toHaveBeenCalledWith("plan-1");
    expect(mocks.invalidateBenefitRowsCache).toHaveBeenCalledWith("plan-1");
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Retirement benefit deleted",
    );
    expect(mocks.push).toHaveBeenCalledWith("/benefits");
  });

  it("reports a failed delete and keeps the editor", async () => {
    const user = userEvent.setup();
    mocks.purgeDraftBenefit.mockRejectedValue(new Error("delete failed"));
    await renderReady();

    await user.click(screen.getByRole("button", { name: /Delete Benefit/ }));
    await user.type(
      screen.getByPlaceholderText("delete benefit"),
      "delete benefit",
    );
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Could not delete the benefit",
        expect.objectContaining({ description: "delete failed" }),
      ),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("clears the typed phrase when the dialog closes", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: /Delete Benefit/ }));
    await user.type(
      screen.getByPlaceholderText("delete benefit"),
      "delete benefit",
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    await user.click(screen.getByRole("button", { name: /Delete Benefit/ }));

    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirm",
      }),
    ).toBeDisabled();
  });

  it("names the Custom benefit with the advisor's name", async () => {
    const user = userEvent.setup();
    mocks.state.stepData.step1.benefitTitle = "Mindfulness";
    await renderReady("plan-1", "Company / Plan Sponsor");

    await user.click(screen.getByRole("button", { name: /Delete Benefit/ }));

    expect(
      screen.getByRole("dialog", {
        name: "Delete the Mindfulness benefit?",
      }),
    ).toBeInTheDocument();
  });

  it("returns early when there is no plan id", async () => {
    const user = userEvent.setup();
    await renderReady("", "Retirement");

    await user.click(screen.getByRole("button", { name: /Delete Benefit/ }));
    await user.type(
      screen.getByPlaceholderText("delete benefit"),
      "delete benefit",
    );
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(mocks.purgeDraftBenefit).not.toHaveBeenCalled();
  });
});

describe("BenefitEditPage portal link", () => {
  it("opens the category's portal page with the Comments rail", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: /Open Portal/ }));

    expect(mocks.open).toHaveBeenCalledWith(
      "https://hub.test/acme/retirement?comments=on",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("uses the Custom name's slug", async () => {
    const user = userEvent.setup();
    mocks.state.stepData.step1.benefitTitle = "Mindfulness and Me";
    await renderReady("plan-1", "Company / Plan Sponsor");

    await user.click(screen.getByRole("button", { name: /Open Portal/ }));

    expect(mocks.open).toHaveBeenCalledWith(
      "https://hub.test/acme/mindfulness-and-me?comments=on",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("uses the legacy segment for an unnamed Custom hub", async () => {
    const user = userEvent.setup();
    mocks.state.stepData.step1.benefitTitle = "Company / Plan Sponsor";
    await renderReady("plan-1", "Company / Plan Sponsor");

    await user.click(screen.getByRole("button", { name: /Open Portal/ }));

    expect(mocks.open).toHaveBeenCalledWith(
      "https://hub.test/acme/wellness-programs?comments=on",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("falls back to the plan id when the plan has no slug", async () => {
    const user = userEvent.setup();
    mocks.state.stepData.step1.selectedPlan = { companyName: "Acme Corp" };
    await renderReady();

    await user.click(screen.getByRole("button", { name: /Open Portal/ }));

    expect(mocks.open).toHaveBeenCalledWith(
      "https://hub.test/plan-1/retirement?comments=on",
      "_blank",
      "noopener,noreferrer",
    );
  });
});

describe("BenefitEditPage preview layout", () => {
  it("aligns the tab strip to the editor when the panel opens", async () => {
    await renderReady();
    const tabs = screen.getByRole("tablist");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("step5EditorStateChange", {
          detail: { isOpen: true },
        }),
      );
    });

    expect(tabs.className).toContain("justify-start");
  });

  it("restores the centered strip when the panel closes", async () => {
    await renderReady();
    const tabs = screen.getByRole("tablist");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("step5EditorStateChange", {
          detail: { isOpen: true },
        }),
      );
    });
    act(() => {
      window.dispatchEvent(
        new CustomEvent("step5EditorStateChange", {
          detail: { isOpen: false },
        }),
      );
    });

    expect(tabs.className).not.toContain("justify-start");
  });
});
