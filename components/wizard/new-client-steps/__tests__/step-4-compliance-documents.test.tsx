import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewClientStep4 } from "../step-4-compliance-documents";

/**
 * Create Plan step 4 (compliance documents).
 *
 * The uploader, the list/preview tabs and the dialogs are mocked, so the tests
 * focus on what this screen owns: when it loads server documents (only for an
 * existing plan), the "Skip for now" transition, document deletion through R2,
 * and persisting a category change made from the list.
 */

const mocks = vi.hoisted(() => {
  const state: any = {};
  const resetState = (overrides: Record<string, unknown> = {}) => {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, {
      stepData: {},
      saveStepDataLocally: vi.fn(),
      nextStep: vi.fn(async () => ({ isValid: true, errors: [] })),
      clearErrorFields: vi.fn(),
      completeStep: vi.fn(),
      currentStep: 4,
      draftClientId: "plan-1",
      ...overrides,
    });
    return state;
  };
  return {
    state,
    resetState,
    focusFirstInvalidField: vi.fn(),
    deleteFromR2: vi.fn(async () => {}),
    convertToDocumentFormat: vi.fn(),
    fetch: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("@/lib/new-client-wizard-store", () => {
  const useNewClientWizardStore = Object.assign(
    (selector?: (value: any) => unknown) =>
      selector ? selector(mocks.state) : mocks.state,
    { getState: () => mocks.state },
  );
  return {
    useNewClientWizardStore,
    focusFirstInvalidField: mocks.focusFirstInvalidField,
  };
});

vi.mock(
  "@/components/pages/documents/components/compliance-documents-upload",
  () => ({
    ComplianceDocumentsUpload: ({
      initialDocuments,
      onDocumentsChange,
      secondaryAction,
    }: any) => (
      <div data-testid="uploader">
        <span data-testid="uploader-count">{initialDocuments.length}</span>
        <button
          type="button"
          onClick={() =>
            onDocumentsChange([
              ...initialDocuments,
              {
                id: "temp-new",
                name: "New Upload",
                file: "data:application/pdf;base64,AA",
                fileSize: 1,
                type: "other",
                status: "success",
                uploadedAt: "2026-01-01T00:00:00.000Z",
                language: "EN",
              },
            ])
          }
        >
          Mock upload
        </button>
        <button
          type="button"
          onClick={secondaryAction.onClick}
          disabled={secondaryAction.disabled}
        >
          {secondaryAction.label}
        </button>
      </div>
    ),
  }),
);

vi.mock("@/components/pages/documents/tabs/document-list-tab", () => ({
  DocumentListTab: ({ documents, onDelete, onEdit, onDownload }: any) => (
    <ul data-testid="document-list">
      {documents.map((doc: any) => (
        <li key={doc.id}>
          <span>{doc.title}</span>
          <button type="button" onClick={() => onDelete(doc.id, doc.title)}>
            Delete {doc.title}
          </button>
          <button
            type="button"
            onClick={() =>
              onEdit(doc.id, doc.title, { category: "Group Health" })
            }
          >
            Categorize {doc.title}
          </button>
          <button type="button" onClick={() => onDownload(doc.id, doc.title)}>
            Download {doc.title}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

vi.mock("@/components/pages/documents/tabs/document-preview-tab", () => ({
  DocumentPreviewTab: () => <div data-testid="preview-tab" />,
}));

vi.mock(
  "@/components/pages/client-portal/sections/benefit-document-section",
  () => ({}),
);

vi.mock(
  "@/components/pages/documents/components/document-preview-modal",
  () => ({
    DocumentPreviewModal: ({ isOpen }: any) =>
      isOpen ? <div role="dialog" aria-label="Document preview" /> : null,
  }),
);

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmText,
    onConfirm,
    onOpenChange,
  }: any) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <p>{description}</p>
        <button type="button" onClick={() => void onConfirm()}>
          {confirmText}
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Cancel delete
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/alert", () => ({
  AlertTitle: ({ children }: any) => <div>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dismissible-alert", () => ({
  DismissibleAlert: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ value, children }: any) => (
    <div data-testid="tabs" data-value={value}>
      {children}
    </div>
  ),
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ value, children }: any) => (
    <button type="button" data-tab={value}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/lib/upload-to-r2", () => ({
  deleteFromR2: mocks.deleteFromR2,
}));

vi.mock("@/lib/compliance-document-utils", () => ({
  convertToDocumentFormat: mocks.convertToDocumentFormat,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const MONGO_ID = "64b7f0c2a1b2c3d4e5f60718";

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as any;
}

function storedDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    name: "SPD",
    file: "data:application/pdf;base64,AAAA",
    fileSize: 10,
    type: "other",
    status: "success",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    language: "EN",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.resetState();
  mocks.focusFirstInvalidField.mockReset();
  mocks.deleteFromR2.mockReset().mockResolvedValue(undefined);
  mocks.convertToDocumentFormat
    .mockReset()
    .mockImplementation(async (doc: any, index: number) => ({
      id: doc.id || `converted-${index}`,
      name: doc.name || doc.title || `Document ${index}`,
      file: doc.fileUrl || doc.file || "",
      fileSize: doc.fileSize || 0,
      type: doc.type || "other",
      status: "success",
      uploadedAt: doc.uploadedAt || "2026-01-01T00:00:00.000Z",
      language: doc.language || "EN",
      ...(doc.storageKey ? { storageKey: doc.storageKey } : {}),
    }));
  mocks.fetch.mockReset().mockResolvedValue(jsonResponse({}));
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
});

describe("NewClientStep4", () => {
  it("renders the three tabs without loading the server for a new plan", () => {
    render(<NewClientStep4 />);

    expect(screen.getByRole("button", { name: /Upload/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /List/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preview/ })).toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId("uploader-count")).toHaveTextContent("0");
  });

  it("loads both document APIs when the plan already has documents", async () => {
    mocks.resetState({
      stepData: {
        complianceDocuments: { spdFile: storedDoc({ id: "spd-1" }) },
      },
    });
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url === "/api/new-client-wizard/compliance-documents") {
        return jsonResponse({
          data: {
            spdFile: { id: "spd-1", name: "Server SPD" },
            otherDocuments: [{ id: "other-1", name: "Old SBC" }],
          },
        });
      }
      return jsonResponse({
        optionalDocuments: {
          retirementPlanDocuments: [{ id: "opt-1", name: "Server Plan Doc" }],
        },
      });
    });

    render(<NewClientStep4 />);

    await waitFor(() =>
      expect(screen.getByText("Server SPD")).toBeInTheDocument(),
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/new-client-wizard/compliance-documents",
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/new-client-wizard/optional-documents",
    );
    expect(screen.getByText("Server Plan Doc")).toBeInTheDocument();
    expect(mocks.convertToDocumentFormat).toHaveBeenCalled();
  });

  it("advances and marks the step complete on Skip for now", async () => {
    const user = userEvent.setup();
    render(<NewClientStep4 />);

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() =>
      expect(mocks.state.completeStep).toHaveBeenCalledWith(4),
    );
    expect(mocks.state.nextStep).toHaveBeenCalledTimes(1);
    expect(mocks.state.clearErrorFields).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "You can return to Plan Documents anytime.",
    );
  });

  it("reports invalid skip validation and focuses the highlighted fields", async () => {
    const user = userEvent.setup();
    mocks.state.nextStep.mockResolvedValue({
      isValid: false,
      errors: [{ field: "complianceDocuments" }],
    });
    render(<NewClientStep4 errorFields={["complianceDocuments"]} />);

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please review the highlighted fields before continuing.",
    );
    expect(mocks.state.completeStep).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mocks.focusFirstInvalidField).toHaveBeenCalledWith([
        "complianceDocuments",
      ]),
    );
  });

  it("reports a thrown skip and re-enables the button", async () => {
    const user = userEvent.setup();
    mocks.state.nextStep.mockRejectedValue(new Error("offline"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<NewClientStep4 />);

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Unable to continue right now. Please try again.",
      ),
    );
    expect(errorSpy).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Skip for now" }),
    ).not.toBeDisabled();
  });

  it("switches to the list tab when an upload adds a document", async () => {
    const user = userEvent.setup();
    render(<NewClientStep4 />);

    expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "upload");

    await user.click(screen.getByRole("button", { name: "Mock upload" }));

    await waitFor(() =>
      expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "list"),
    );
    expect(screen.getByText("New Upload")).toBeInTheDocument();
  });

  it("asks before deleting and removes the R2 object only after confirmation", async () => {
    const user = userEvent.setup();
    mocks.resetState({
      stepData: {
        complianceDocuments: {
          retirementPlanDocuments: [
            storedDoc({
              id: "doc-9",
              name: "Delete Me",
              storageKey: "org/x/doc.pdf",
            }),
          ],
        },
      },
    });
    mocks.fetch.mockImplementation(async () =>
      jsonResponse({
        data: null,
        optionalDocuments: { retirementPlanDocuments: [] },
      }),
    );
    render(<NewClientStep4 />);
    await screen.findByText("Delete Me");

    await user.click(screen.getByRole("button", { name: "Delete Delete Me" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Delete document?",
    });
    expect(dialog).toHaveTextContent(
      'Are you sure you want to delete "Delete Me"?',
    );
    expect(mocks.deleteFromR2).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(mocks.deleteFromR2).toHaveBeenCalledWith("org/x/doc.pdf"),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('"Delete Me" deleted');
    await waitFor(() =>
      expect(screen.queryByText("Delete Me")).not.toBeInTheDocument(),
    );
  });

  it("persists a category change from the list for a saved document", async () => {
    const user = userEvent.setup();
    mocks.resetState({
      stepData: {
        complianceDocuments: {
          retirementPlanDocuments: [
            storedDoc({ id: MONGO_ID, name: "Saved Doc" }),
          ],
        },
      },
    });
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url === `/api/documents/${MONGO_ID}`)
        return jsonResponse({ ok: true });
      return jsonResponse({
        data: null,
        optionalDocuments: { retirementPlanDocuments: [] },
      });
    });
    render(<NewClientStep4 />);
    await screen.findByText("Saved Doc");

    await user.click(
      screen.getByRole("button", { name: "Categorize Saved Doc" }),
    );

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(`/api/documents/${MONGO_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "Group Health" }),
      }),
    );
    expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
      "complianceDocuments",
      expect.objectContaining({
        retirementPlanDocuments: [
          expect.objectContaining({ id: MONGO_ID, category: "Group Health" }),
        ],
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Category updated");
  });

  it("does not PATCH a document that has not been saved yet", async () => {
    const user = userEvent.setup();
    mocks.resetState({
      stepData: {
        complianceDocuments: {
          retirementPlanDocuments: [
            storedDoc({ id: "temp-1", name: "Temp Doc" }),
          ],
        },
      },
    });
    mocks.fetch.mockImplementation(async () =>
      jsonResponse({
        data: null,
        optionalDocuments: { retirementPlanDocuments: [] },
      }),
    );
    render(<NewClientStep4 />);
    await screen.findByText("Temp Doc");

    await user.click(
      screen.getByRole("button", { name: "Categorize Temp Doc" }),
    );

    expect(
      mocks.fetch.mock.calls.some(
        ([url, init]) =>
          typeof url === "string" &&
          url.startsWith("/api/documents/") &&
          init?.method === "PATCH",
      ),
    ).toBe(false);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Category updated");
  });
});
