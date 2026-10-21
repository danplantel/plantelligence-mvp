import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsStep4 } from "@/components/wizard/benefits-steps/step-4";

/**
 * Create Benefit → Step 4 (Documents).
 *
 * The store, the plan-document fetch/persist bridge, the list and preview
 * surfaces, the upload surface and the confirm dialog are mocked so these tests
 * assert Step 4's own orchestration: the mount merge (API rows win over stale
 * real-ID store rows, unpersisted temp rows survive), category/language
 * filtering, delete branches (persisted / temp / 404 / failure), edit
 * persistence, sort toggling and the preview reorder.
 */

const REAL_DOC_ID = "0123456789abcdef01234567";

const mocks = vi.hoisted(() => {
  const state: any = { stepData: { step1: {}, step4: { documents: [] } } };
  const reset = (
    step1: Record<string, unknown> = {},
    step4Docs: any[] = [],
  ) => {
    state.stepData = { step1, step4: { documents: step4Docs } };
    state.saveStepData = vi.fn((step: number, data: any) => {
      state.stepData = { ...state.stepData, [`step${step}`]: data };
    });
  };
  return {
    state,
    reset,
    fetchPlanDocuments: vi.fn(async (): Promise<any[]> => []),
    convertToDocumentFormat: vi.fn(async (row: any) => ({
      id: row.id,
      name: row.name ?? row.title,
      file: row.fileUrl ?? row.file,
      category: row.category,
      language: row.language,
      originalFileName: row.originalFileName,
      shortDescription: row.shortDescription,
      storageKey: row.storageKey,
    })),
    detectDocumentType: vi.fn(() => "PDF"),
    persistNewDocumentsToApi: vi.fn(async (_id: string, docs: any[]) => docs),
    deleteFromR2: vi.fn(async () => undefined),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    dispatchEvent: vi.fn(),
  };
});

vi.mock("@/lib/benefits-wizard-store", () => ({
  useBenefitsWizardStore: () => mocks.state,
}));

vi.mock("@/lib/fetch-plan-documents-client", () => ({
  fetchPlanDocumentsForClient: mocks.fetchPlanDocuments,
}));

vi.mock("@/lib/compliance-document-utils", () => ({
  convertToDocumentFormat: mocks.convertToDocumentFormat,
  detectDocumentType: mocks.detectDocumentType,
}));

vi.mock("@/lib/document-category", () => ({
  resolvePersistedDocumentCategory: (_type: string, category?: string) =>
    category === "Other" ? "Other Benefits" : category || "Other Benefits",
}));

vi.mock("@/lib/benefits-document-persist", () => ({
  persistNewDocumentsToApi: mocks.persistNewDocumentsToApi,
}));

vi.mock("@/lib/upload-to-r2", () => ({
  deleteFromR2: mocks.deleteFromR2,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/components/ui/tabs", async () => {
  const { createContext, useContext } = await import("react");
  const TabsContext = createContext<{
    value: string;
    onValueChange: (v: string) => void;
  }>({
    value: "",
    onValueChange: () => {},
  });

  return {
    Tabs: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (v: string) => void;
      children?: React.ReactNode;
    }) => (
      <TabsContext.Provider value={{ value, onValueChange }}>
        {children}
      </TabsContext.Provider>
    ),
    TabsList: ({ children }: { children?: React.ReactNode }) => (
      <div role="tablist">{children}</div>
    ),
    TabsTrigger: ({
      value,
      children,
    }: {
      value: string;
      children?: React.ReactNode;
    }) => {
      const ctx = useContext(TabsContext);
      return (
        <button
          type="button"
          role="tab"
          aria-selected={ctx.value === value}
          onClick={() => ctx.onValueChange(value)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({
      value,
      children,
    }: {
      value: string;
      children?: React.ReactNode;
    }) => {
      const ctx = useContext(TabsContext);
      return ctx.value === value ? <div>{children}</div> : null;
    },
  };
});

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onOpenChange,
    title,
    description,
    confirmText,
  }: any) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <p>{description}</p>
        <button type="button" onClick={() => onConfirm()}>
          {confirmText}
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/pages/documents/tabs/document-list-tab", () => ({
  DocumentListTab: (props: any) => (
    <div data-testid="list-tab">
      <span data-testid="sort">{`${props.sortColumn}:${props.sortDirection}`}</span>
      <button type="button" onClick={() => props.onPreview()}>
        open-preview
      </button>
      <ul>
        {props.documents.map((doc: any) => (
          <li key={doc.id}>
            <span>{doc.title}</span>
            <button type="button" onClick={() => props.onSort("title")}>
              sort-title
            </button>
            <button
              type="button"
              onClick={() => props.onDelete(doc.id, doc.title)}
            >
              delete-{doc.title}
            </button>
            <button
              type="button"
              onClick={() =>
                props.onEdit(doc.id, doc.title, { category: "Group Life" })
              }
            >
              reclassify-{doc.title}
            </button>
            <button
              type="button"
              onClick={() => props.onEdit(doc.id, doc.title)}
            >
              edit-{doc.title}
            </button>
            <button
              type="button"
              onClick={() => props.onDownload(doc.id, doc.title)}
            >
              download-{doc.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  ),
}));

vi.mock(
  "@/components/pages/client-portal/sections/benefit-document-section",
  () => ({
    BenefitDocumentSection: (props: any) => (
      <div data-testid="preview-section">
        <span data-testid="preview-title">{props.title}</span>
        <span data-testid="preview-description">{props.description}</span>
        <span data-testid="preview-header">{props.accordionHeaderTitle}</span>
        <span data-testid="preview-editing">
          {props.editingDocId ?? "none"}
        </span>
        <ul>
          {props.retirementDocs.map((doc: any) => (
            <li key={doc.id}>
              <span>{doc.title}</span>
              <button type="button" onClick={() => props.onStartEdit(doc.id)}>
                start-edit-{doc.title}
              </button>
              <button
                type="button"
                onClick={() =>
                  props.onSaveEdit(doc.id, "Edited Title", "Edited description")
                }
              >
                save-edit-{doc.title}
              </button>
              <button type="button" onClick={() => props.onCancelEdit()}>
                cancel-edit
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            props.onOrderChange([...props.retirementDocs].reverse())
          }
        >
          reverse-order
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "@/components/pages/documents/components/compliance-documents-upload",
  () => ({
    ComplianceDocumentsUpload: (props: any) => (
      <div data-testid="upload">
        <span data-testid="upload-language">{props.language}</span>
        <span data-testid="fixed-category">
          {props.fixedCategory ?? "none"}
        </span>
        <span data-testid="filtered">
          {props.initialDocuments
            .filter(
              (doc: any) =>
                !props.filterDocuments || props.filterDocuments(doc),
            )
            .map((doc: any) => doc.name)
            .join(",")}
        </span>
        <button
          type="button"
          onClick={() =>
            props.onDocumentsChange([
              ...props.initialDocuments,
              {
                id: "temp-new",
                name: "New upload",
                file: "http://files/new.pdf",
                category: "Retirement",
                language: "EN",
              },
            ])
          }
        >
          add-doc
        </button>
        <button type="button" onClick={() => props.onLanguageChange("ES")}>
          set-spanish
        </button>
      </div>
    ),
  }),
);

const retirementDoc = {
  id: REAL_DOC_ID,
  title: "Retirement Summary",
  fileUrl: "http://files/summary.pdf",
  category: "Retirement",
  language: "EN",
  storageKey: "docs/summary.pdf",
};
const healthDoc = {
  id: "health-1",
  title: "Health Summary",
  fileUrl: "http://files/health.pdf",
  category: "Group Health",
  language: "EN",
};

function renderStep() {
  return render(<BenefitsStep4 />);
}

async function openListTab() {
  fireEvent.click(screen.getByRole("tab", { name: "List" }));
  return screen.findByTestId("list-tab");
}

async function openPreviewTab() {
  fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
  return screen.findByTestId("preview-section");
}

describe("BenefitsStep4", () => {
  beforeEach(() => {
    mocks.reset(
      {
        planId: "plan-1",
        benefitCategory: "Retirement",
        selectedPlan: {
          name: "Acme Corp",
          brandColor: "#111111",
          secondaryColor: "#222222",
        },
      },
      [],
    );
    mocks.fetchPlanDocuments.mockResolvedValue([]);
    mocks.persistNewDocumentsToApi.mockImplementation(
      async (_id: string, docs: any[]) => docs,
    );
    mocks.deleteFromR2.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
    );
    vi.spyOn(window, "dispatchEvent").mockImplementation(mocks.dispatchEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("asks for a plan in Step 1 when none is selected", () => {
    mocks.reset({}, []);
    renderStep();

    expect(
      screen.getByText("Please select a plan in Step 1 first."),
    ).toBeInTheDocument();
    expect(mocks.fetchPlanDocuments).not.toHaveBeenCalled();
  });

  describe("loading from the plan", () => {
    it("fetches the plan's documents and saves the converted rows", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      renderStep();

      await waitFor(() =>
        expect(mocks.fetchPlanDocuments).toHaveBeenCalledWith("plan-1"),
      );
      await waitFor(() =>
        expect(mocks.state.saveStepData).toHaveBeenCalledWith(4, {
          documents: [
            expect.objectContaining({
              id: REAL_DOC_ID,
              name: "Retirement Summary",
            }),
          ],
        }),
      );
    });

    it("keeps unpersisted temp rows and drops stale real-ID rows", async () => {
      mocks.reset(
        {
          planId: "plan-1",
          benefitCategory: "Retirement",
          selectedPlan: { name: "Acme Corp" },
        },
        [
          {
            id: "temp-1",
            name: "Pending upload",
            file: "http://files/p.pdf",
            category: "Retirement",
          },
          { id: REAL_DOC_ID, name: "Stale copy", category: "Retirement" },
        ],
      );
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      renderStep();

      await openListTab();

      await waitFor(() =>
        expect(screen.getByText("Retirement Summary")).toBeInTheDocument(),
      );
      expect(screen.getByText("Pending upload")).toBeInTheDocument();
      expect(screen.queryByText("Stale copy")).not.toBeInTheDocument();
    });

    it("reports a failed load and stops the spinner", async () => {
      mocks.fetchPlanDocuments.mockRejectedValue(new Error("offline"));
      renderStep();

      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Failed to load existing documents",
        ),
      );
    });
  });

  describe("category and language filtering", () => {
    beforeEach(() => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc, healthDoc]);
    });

    it("lists only the current benefit category", async () => {
      renderStep();
      await openListTab();

      await waitFor(() =>
        expect(screen.getByText("Retirement Summary")).toBeInTheDocument(),
      );
      expect(screen.queryByText("Health Summary")).not.toBeInTheDocument();
    });

    it("passes the category filter and fixed category to the uploader", async () => {
      renderStep();

      expect(screen.getByTestId("fixed-category")).toHaveTextContent(
        "Retirement",
      );
      await waitFor(() =>
        expect(screen.getByTestId("filtered")).toHaveTextContent(
          "Retirement Summary",
        ),
      );
      expect(screen.getByTestId("filtered")).not.toHaveTextContent(
        "Health Summary",
      );
    });

    it("shows a language switcher only when both languages exist", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([
        retirementDoc,
        { ...retirementDoc, id: "es-1", title: "Resumen", language: "ES" },
      ]);
      renderStep();
      await openPreviewTab();

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /English/ }),
        ).toBeInTheDocument(),
      );
      const spanish = screen.getByRole("button", { name: /Español/ });
      expect(spanish).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(spanish);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Español/ })).toHaveAttribute(
          "aria-pressed",
          "true",
        ),
      );
      expect(screen.getByText("Resumen")).toBeInTheDocument();
      expect(screen.queryByText("Retirement Summary")).not.toBeInTheDocument();
    });
  });

  describe("uploading", () => {
    it("adds a document, jumps to the list and persists the new row", async () => {
      renderStep();

      // Let the mount load settle first; its `setDocuments` must not race the add.
      await waitFor(() =>
        expect(mocks.state.saveStepData).toHaveBeenCalledWith(4, {
          documents: [],
        }),
      );

      fireEvent.click(screen.getByRole("button", { name: "add-doc" }));

      expect(mocks.toastSuccess).toHaveBeenCalledWith("Document added");
      await waitFor(() =>
        expect(mocks.persistNewDocumentsToApi).toHaveBeenCalledWith(
          "plan-1",
          expect.arrayContaining([expect.objectContaining({ id: "temp-new" })]),
        ),
      );
      await openListTab();
      expect(screen.getByText("New upload")).toBeInTheDocument();
    });

    it("refetches the plan after persisting and stores the server copy", async () => {
      mocks.fetchPlanDocuments
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([retirementDoc]);
      renderStep();

      await waitFor(() =>
        expect(mocks.fetchPlanDocuments).toHaveBeenCalledTimes(1),
      );
      fireEvent.click(screen.getByRole("button", { name: "add-doc" }));

      await waitFor(() =>
        expect(mocks.fetchPlanDocuments).toHaveBeenCalledTimes(2),
      );
      await waitFor(() =>
        expect(mocks.state.saveStepData).toHaveBeenCalledWith(4, {
          documents: [expect.objectContaining({ id: REAL_DOC_ID })],
        }),
      );
    });

    it("forwards the uploader's language change", () => {
      renderStep();

      expect(screen.getByTestId("upload-language")).toHaveTextContent("EN");
      fireEvent.click(screen.getByRole("button", { name: "set-spanish" }));
      expect(screen.getByTestId("upload-language")).toHaveTextContent("ES");
    });
  });

  describe("deleting", () => {
    it("asks before deleting and does nothing when cancelled", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      renderStep();
      await openListTab();

      fireEvent.click(
        await screen.findByRole("button", {
          name: `delete-Retirement Summary`,
        }),
      );
      const dialog = screen.getByRole("dialog", { name: "Delete Document" });
      expect(dialog).toHaveTextContent(
        'Are you sure you want to delete "Retirement Summary"?',
      );

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
      expect(screen.getByText("Retirement Summary")).toBeInTheDocument();
    });

    it("deletes a persisted row from the API and its stored file", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      renderStep();
      await openListTab();

      fireEvent.click(
        await screen.findByRole("button", {
          name: "delete-Retirement Summary",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(`/api/documents/${REAL_DOC_ID}`, {
          method: "DELETE",
        }),
      );
      expect(mocks.deleteFromR2).toHaveBeenCalledWith("docs/summary.pdf");
      await waitFor(() =>
        expect(
          screen.queryByText("Retirement Summary"),
        ).not.toBeInTheDocument(),
      );
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        '"Retirement Summary" deleted',
      );
      expect(mocks.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-documents-persisted" }),
      );
    });

    it("treats a 404 as already deleted and removes the row", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
      );
      renderStep();
      await openListTab();

      fireEvent.click(
        await screen.findByRole("button", {
          name: "delete-Retirement Summary",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(
          screen.queryByText("Retirement Summary"),
        ).not.toBeInTheDocument(),
      );
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        '"Retirement Summary" deleted',
      );
    });

    it("keeps the row and reports a failed API delete", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
      );
      renderStep();
      await openListTab();

      fireEvent.click(
        await screen.findByRole("button", {
          name: "delete-Retirement Summary",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          'Failed to delete "Retirement Summary"',
        ),
      );
      expect(mocks.deleteFromR2).not.toHaveBeenCalled();
      expect(screen.getByText("Retirement Summary")).toBeInTheDocument();
    });

    it("cleans up a temp upload without calling the documents API", async () => {
      mocks.reset(
        {
          planId: "plan-1",
          benefitCategory: "Retirement",
          selectedPlan: { name: "Acme Corp" },
        },
        [
          {
            id: "temp-1",
            name: "Pending upload",
            file: "http://files/p.pdf",
            category: "Retirement",
            language: "EN",
            storageKey: "docs/pending.pdf",
          },
        ],
      );
      renderStep();
      await openListTab();

      fireEvent.click(
        await screen.findByRole("button", { name: "delete-Pending upload" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          '"Pending upload" deleted',
        ),
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(mocks.deleteFromR2).toHaveBeenCalledWith("docs/pending.pdf");
    });
  });

  describe("preview and editing", () => {
    it("reclassifies a document from the list without leaving the tab", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      renderStep();
      await openListTab();

      fireEvent.click(
        await screen.findByRole("button", {
          name: "reclassify-Retirement Summary",
        }),
      );

      expect(mocks.toastSuccess).toHaveBeenCalledWith("Category updated");
      expect(screen.getByTestId("list-tab")).toBeInTheDocument();
    });

    it("opens the preview tab when the list's edit action has no category", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      renderStep();
      await openListTab();

      fireEvent.click(
        await screen.findByRole("button", { name: "edit-Retirement Summary" }),
      );

      expect(screen.getByTestId("preview-section")).toBeInTheDocument();
    });

    it("builds the preview title, description and accordion header from the category", async () => {
      mocks.reset(
        {
          planId: "plan-1",
          benefitCategory: "Group Health",
          selectedPlan: { name: "Acme Corp" },
        },
        [],
      );
      mocks.fetchPlanDocuments.mockResolvedValue([{ ...healthDoc }]);
      renderStep();
      await openPreviewTab();

      expect(screen.getByTestId("preview-title")).toHaveTextContent(
        "Group Health Documents & Forms",
      );
      expect(screen.getByTestId("preview-description")).toHaveTextContent(
        "Access all your important group health plan documents",
      );
      expect(screen.getByTestId("preview-header")).toHaveTextContent(
        "Health Plan Documents",
      );
    });

    it("tracks the document being edited and cancels it", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      renderStep();
      await openPreviewTab();

      fireEvent.click(
        await screen.findByRole("button", {
          name: "start-edit-Retirement Summary",
        }),
      );
      expect(screen.getByTestId("preview-editing")).toHaveTextContent(
        REAL_DOC_ID,
      );

      fireEvent.click(screen.getByRole("button", { name: "cancel-edit" }));
      expect(screen.getByTestId("preview-editing")).toHaveTextContent("none");
    });

    it("persists an inline preview edit for a stored document", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      renderStep();
      await openPreviewTab();

      fireEvent.click(
        await screen.findByRole("button", {
          name: "save-edit-Retirement Summary",
        }),
      );

      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(`/api/documents/${REAL_DOC_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Edited Title",
            shortDescription: "Edited description",
          }),
        }),
      );
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Document updated");
      await waitFor(() =>
        expect(screen.getByText("Edited Title")).toBeInTheDocument(),
      );
    });

    it("updates a temp document without calling the API", async () => {
      mocks.reset(
        {
          planId: "plan-1",
          benefitCategory: "Retirement",
          selectedPlan: { name: "Acme Corp" },
        },
        [
          {
            id: "temp-1",
            name: "Pending upload",
            file: "http://files/p.pdf",
            category: "Retirement",
            language: "EN",
          },
        ],
      );
      renderStep();
      await openPreviewTab();

      fireEvent.click(
        await screen.findByRole("button", { name: "save-edit-Pending upload" }),
      );

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Document updated"),
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("reorders only the visible documents in place", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([
        { ...retirementDoc, id: "doc-a", title: "First" },
        { ...retirementDoc, id: "doc-b", title: "Second" },
      ]);
      renderStep();
      await openPreviewTab();

      fireEvent.click(
        await screen.findByRole("button", { name: "reverse-order" }),
      );

      await waitFor(() => {
        const lastSave = mocks.state.saveStepData.mock.calls.at(-1);
        expect(lastSave?.[0]).toBe(4);
        expect(lastSave?.[1].documents.map((d: any) => d.id)).toEqual([
          "doc-b",
          "doc-a",
        ]);
      });
    });
  });

  describe("list sort", () => {
    it("toggles the sort direction on the same column", async () => {
      mocks.fetchPlanDocuments.mockResolvedValue([retirementDoc]);
      renderStep();
      await openListTab();

      expect(screen.getByTestId("sort")).toHaveTextContent("uploadedAt:desc");
      fireEvent.click(
        await screen.findByRole("button", { name: "sort-title" }),
      );
      expect(screen.getByTestId("sort")).toHaveTextContent("title:asc");
      fireEvent.click(screen.getByRole("button", { name: "sort-title" }));
      expect(screen.getByTestId("sort")).toHaveTextContent("title:desc");
    });
  });
});
