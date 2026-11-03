import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The portal benefit panel must write each draft keystroke into the cached
 * Benefit row, because the hub page renders from that SWR entry. Without the
 * optimistic write the panel silently becomes save-only again.
 */

const BENEFIT_KEY =
  "/api/clients/plan-1/benefits/Retirement?forPortal=1&withTopics=1";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
  patchClientData: vi.fn(),
  refetchPortal: vi.fn(async () => null),
}));

const clientData = {
  id: "plan-1",
  companyName: "Acme Corp",
  companyWebsite: "",
  keyContacts: [],
};

const editing = {
  target: { page: "benefit", category: "Retirement", label: "Retirement" },
  planId: "plan-1",
  canEditFunction: () => true,
  isOpen: true,
  closePanel: vi.fn(),
  beginSave: vi.fn(),
  finishSave: vi.fn(),
  failSave: vi.fn(),
  resetSave: vi.fn(),
  patchClientData: mocks.patchClientData,
  refetchPortal: mocks.refetchPortal,
};

vi.mock("swr", () => ({
  default: () => ({
    data: {
      benefit: {
        title: "Old title",
        shortDescription: "",
        faqs: [],
        supportContacts: [],
      },
    },
    error: undefined,
  }),
  useSWRConfig: () => ({ mutate: mocks.mutate }),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({ clientData }),
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  usePortalEditing: () => editing,
  useOptionalPortalEditing: () => ({
    ...editing,
    canEdit: true,
    saveState: "idle",
    saveError: null,
  }),
}));

vi.mock("@/lib/save-benefit", () => ({
  saveBenefit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/components/wizard/benefits-steps/benefits-editor-panel", () => ({
  BenefitsEditorPanel: () => <div data-testid="benefit-panel" />,
}));

import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { PortalBenefitEditor } from "@/components/portal-editing/editors/portal-benefit-editor";

describe("PortalBenefitEditor live preview", () => {
  beforeEach(() => {
    mocks.mutate.mockClear();
    mocks.patchClientData.mockClear();
    useBenefitsWizardStore.setState({ stepData: {}, currentStep: 1 });
  });

  it("writes the draft into the cached Benefit row on every edit", () => {
    render(<PortalBenefitEditor />);

    // Hydration seeded the wizard store from the cached row.
    expect(
      useBenefitsWizardStore.getState().stepData.step1?.benefitTitle,
    ).toBe("Old title");

    const step1 = useBenefitsWizardStore.getState().stepData.step1!;
    act(() => {
      useBenefitsWizardStore.getState().saveStepData(1, {
        ...step1,
        benefitTitle: "New title",
      });
    });

    const calls = mocks.mutate.mock.calls.filter(
      ([key]) => key === BENEFIT_KEY,
    );
    expect(calls.length).toBeGreaterThan(0);

    const [key, updater] = calls.at(-1)! as [
      string,
      (current: any) => any,
    ];
    expect(key).toBe(BENEFIT_KEY);

    const next = updater({ benefit: { title: "Old title", faqs: [] } });
    expect(next.benefit.title).toBe("New title");
  });

  it("patches the plan-level typography the hub chrome reads", () => {
    render(<PortalBenefitEditor />);

    const step1 = useBenefitsWizardStore.getState().stepData.step1!;
    act(() => {
      useBenefitsWizardStore.getState().saveStepData(1, {
        ...step1,
        typographyTheme: "modern",
      });
    });

    expect(mocks.patchClientData).toHaveBeenCalledWith(
      expect.objectContaining({ typographyTheme: "modern" }),
    );
  });

  it("patches Section 1's header button onto the plan blob", () => {
    render(<PortalBenefitEditor />);

    const step1 = useBenefitsWizardStore.getState().stepData.step1!;
    act(() => {
      useBenefitsWizardStore.getState().saveStepData(1, {
        ...step1,
        headerCta: { mode: "schedule", url: "https://book.example", label: "Book" },
      });
    });

    expect(mocks.patchClientData).toHaveBeenCalledWith(
      expect.objectContaining({
        employeePortalPreview: expect.objectContaining({
          headerCta: expect.objectContaining({ mode: "schedule" }),
        }),
      }),
    );
  });
});
