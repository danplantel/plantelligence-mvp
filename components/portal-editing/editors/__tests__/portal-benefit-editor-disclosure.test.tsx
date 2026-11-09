import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A benefit hub's Edit Panel ends with **Disclosure**, editing that hub's own
 * `disclaimers.byCategory` row — the one `layout.tsx` reads FIRST on a hub page.
 *
 * Two things have to hold and are pinned here: the section edits THIS benefit's
 * entry (never the portal-wide Home Page row), and Save writes it to the plan,
 * because `saveBenefit()` deliberately drops Step 5 so one hub's save cannot
 * rewrite another benefit's disclosures.
 */

const portal = vi.hoisted(() => ({
  clientData: {
    id: "plan-1",
    companyName: "Acme Corp",
    companyWebsite: "",
    brandColor: "#1F3A60",
    secondaryColor: "#6B7280",
  } as Record<string, any>,
  /** Re-applied per test: a patch mutates `clientData` in place. */
  disclaimers: {
    disclaimers: [
      { id: "home", text: "Portal-wide footer.", locations: ["Home Page"] },
    ],
    byCategory: {
      Retirement: {
        id: "r",
        text: "Retirement footer.",
        locations: ["Retirement"],
      },
      "Group Health": { text: "Health footer." },
    },
  },
}));

const mocks = vi.hoisted(() => ({
  patchClientData: vi.fn(),
  beginSave: vi.fn(),
  finishSave: vi.fn(),
  failSave: vi.fn(),
  resetSave: vi.fn(),
  refetchPortal: vi.fn(async () => portal.clientData),
  mutate: vi.fn(async () => undefined),
  saveBenefit: vi.fn(async () => ({ success: true })),
  saveStepData: vi.fn(),
  fetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true }),
  })),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({ clientData: portal.clientData }),
}));

const editingValue = {
  target: { page: "benefit", category: "Retirement", label: "Retirement" },
  planId: "plan-1",
  isOpen: true,
  canEdit: true,
  canEditFunction: () => true,
  closePanel: () => {},
  saveState: "idle" as const,
  saveError: null,
  beginSave: mocks.beginSave,
  finishSave: mocks.finishSave,
  failSave: mocks.failSave,
  resetSave: mocks.resetSave,
  patchClientData: mocks.patchClientData,
  refetchPortal: mocks.refetchPortal,
};

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  usePortalEditing: () => editingValue,
  useOptionalPortalEditing: () => editingValue,
}));

vi.mock("swr", () => ({
  default: () => ({
    data: { benefit: { title: "Retirement Plan" } },
    error: undefined,
  }),
  useSWRConfig: () => ({ mutate: mocks.mutate }),
}));

const stepData = { step1: { planId: "plan-1" }, step3: {} };

vi.mock("@/lib/benefits-wizard-store", () => {
  const store = (
    selector?: (state: { stepData: typeof stepData }) => unknown,
  ) => (selector ? selector({ stepData }) : { stepData });
  (store as any).getState = () => ({
    stepData,
    saveStepData: mocks.saveStepData,
  });
  return { useBenefitsWizardStore: store };
});

vi.mock("@/lib/save-benefit", () => ({ saveBenefit: mocks.saveBenefit }));

// The real panel is 2,300 lines of wizard UI; this suite is about the section it
// is handed and the write that follows Save.
vi.mock("@/components/wizard/benefits-steps/benefits-editor-panel", () => ({
  BenefitsEditorPanel: ({
    extraSections,
    footer,
  }: {
    extraSections?: { title: string; content: React.ReactNode }[];
    footer?: React.ReactNode;
  }) => (
    <div>
      {extraSections?.map((section) => (
        <section key={section.title}>{section.content}</section>
      ))}
      {footer}
    </div>
  ),
}));

// The Disclosure section is now the same full-width dialog as every other
// portal panel. A plain conditional wrapper keeps this suite about the
// `byCategory` write, not Radix's portal machinery.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock("@/components/portal-editing/portal-editor-action-bar", () => ({
  PortalEditorActionBar: ({
    isDirty,
    onSave,
    onCancel,
  }: {
    isDirty: boolean;
    onSave: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <button type="button" disabled={!isDirty} onClick={onSave}>
        Save
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

import { PortalBenefitEditor } from "@/components/portal-editing/editors/portal-benefit-editor";

describe("PortalBenefitEditor — the hub's own disclosure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portal.clientData.disclaimers = JSON.parse(
      JSON.stringify(portal.disclaimers),
    );
    // A patch updates the plan the editor reads back, so the save payload carries
    // exactly what the advisor typed.
    mocks.patchClientData.mockImplementation((patch: Record<string, any>) => {
      Object.assign(portal.clientData, patch);
    });
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("offers the section, scoped to this hub", async () => {
    const user = userEvent.setup();
    render(<PortalBenefitEditor />);

    // The panel card names THIS page…
    expect(screen.getByText("Retirement Plan page")).toBeInTheDocument();

    // …and the dialog edits this hub's own row.
    await user.click(
      screen.getByRole("button", { name: /Open footer editor/i }),
    );
    // The dialog's "Applies to:" pill names THIS hub, and the editor is scoped to
    // its `byCategory.Retirement` row.
    expect(screen.getByText("Applies to:")).toBeInTheDocument();
    expect(screen.getByLabelText("Disclosure Text")).toHaveValue(
      "Retirement footer.",
    );
  });

  it("edits this benefit's row, not the portal-wide one", async () => {
    const user = userEvent.setup();
    render(<PortalBenefitEditor />);

    await user.click(
      screen.getByRole("button", { name: /Open footer editor/i }),
    );
    await user.type(screen.getByLabelText("Disclosure Text"), "!");

    const patch = mocks.patchClientData.mock.calls.at(-1)?.[0] as {
      disclaimers: { byCategory: Record<string, any>; disclaimers: unknown[] };
    };
    expect(patch.disclaimers.byCategory.Retirement.text).toBe(
      "Retirement footer.!",
    );
    expect(patch.disclaimers.byCategory["Group Health"]).toEqual({
      text: "Health footer.",
    });
    expect(patch.disclaimers.disclaimers).toEqual([
      { id: "home", text: "Portal-wide footer.", locations: ["Home Page"] },
    ]);
  });

  it("writes the disclosure to the plan on Save, alongside the benefit", async () => {
    const user = userEvent.setup();
    render(<PortalBenefitEditor />);

    await user.click(
      screen.getByRole("button", { name: /Open footer editor/i }),
    );
    await user.type(screen.getByLabelText("Disclosure Text"), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.saveBenefit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());

    const [url, init] = mocks.fetch.mock.calls.at(-1) as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/clients/plan-1");
    const body = JSON.parse(String(init.body));
    expect(body.disclaimers.byCategory.Retirement.text).toBe(
      "Retirement footer.!",
    );
    expect(mocks.finishSave).toHaveBeenCalled();
  });
});
