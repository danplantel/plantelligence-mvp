import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetch: vi.fn(),
  persist: vi.fn(),
  saveFn: null as null | (() => Promise<void>),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/benefits-document-persist", () => ({
  persistNewDocumentsToApi: mocks.persist,
}));

vi.mock("@/components/wizard/new-client-steps/sections/documents-upload-section", () => ({
  DocumentsUploadSection: (props: any) => (
    <div
      data-testid="upload-section"
      data-count={props.documents.length}
      data-title={props.title}
      data-pdf-only={String(!!props.pdfOnly)}
    >
      <span>{props.secondaryAction?.disabled ? "secondary-disabled" : "secondary-enabled"}</span>
      <button type="button" onClick={() => props.secondaryAction?.onClick()}>
        secondary
      </button>
      <button
        type="button"
        onClick={() =>
          props.onDocumentsChange?.([
            ...props.documents,
            {
              id: "temp-2",
              name: "New Doc",
              file: "data:application/pdf;base64,abc",
              type: "SPD",
              size: 10,
              status: "success",
              originalFileName: "new.pdf",
              category: "Retirement",
              storageKey: "key-2",
            },
          ])
        }
      >
        add-doc
      </button>
    </div>
  ),
}));

vi.mock("../../views/documents-cards-view", () => ({
  DocumentsCardsView: (props: any) => (
    <div data-testid="cards-view" data-count={props.documents.length} />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      aria-label="category"
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: () => null,
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: () => null,
}));

import { ComplianceDocumentsUpload } from "../compliance-documents-upload";

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "temp-1",
    name: "SPD",
    file: "data:application/pdf;base64,abc",
    type: "SPD",
    size: 100,
    status: "success",
    originalFileName: "spd.pdf",
    shortDescription: "Summary",
    category: "Retirement",
    language: "EN",
    storageKey: "key-1",
    ...overrides,
  };
}

function renderUpload(props: Partial<React.ComponentProps<typeof ComplianceDocumentsUpload>> = {}) {
  const onSave = vi.fn();
  const onDocumentsChange = vi.fn();
  const onDocumentsAdded = vi.fn();
  const onHasUnsavedChangesChange = vi.fn();
  const onSaveFunctionReady = vi.fn((fn: () => Promise<void>) => {
    mocks.saveFn = fn;
  });
  const secondaryAction = { label: "Next", onClick: vi.fn() };
  render(
    <ComplianceDocumentsUpload
      clientId="plan-1"
      initialDocuments={[] as any}
      onSave={onSave}
      onDocumentsChange={onDocumentsChange}
      onDocumentsAdded={onDocumentsAdded}
      onHasUnsavedChangesChange={onHasUnsavedChangesChange}
      onSaveFunctionReady={onSaveFunctionReady}
      secondaryAction={secondaryAction}
      {...props}
    />,
  );
  return {
    onSave,
    onDocumentsChange,
    onDocumentsAdded,
    onHasUnsavedChangesChange,
    onSaveFunctionReady,
    secondaryAction,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveFn = null;
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  });
  mocks.persist.mockImplementation(async (_clientId: string, docs: any[]) => docs);
});

describe("ComplianceDocumentsUpload", () => {
  it("shows the info card and both surfaces", () => {
    renderUpload();

    expect(screen.getByText("Plan Documents Overview")).toBeInTheDocument();
    expect(screen.getByTestId("upload-section")).toBeInTheDocument();
  });

  it("registers a save handler when a client id is present", () => {
    const { onSaveFunctionReady } = renderUpload();

    expect(onSaveFunctionReady).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not register a save handler without a client id", () => {
    const { onSaveFunctionReady } = renderUpload({ clientId: undefined });

    expect(onSaveFunctionReady).not.toHaveBeenCalled();
  });

  it("shows the uncategorized review unless it is hidden", () => {
    renderUpload({ initialDocuments: [makeDoc({ category: undefined })] as any });

    expect(screen.getByText("Uncategorized Documents")).toBeInTheDocument();
  });

  it("hides the uncategorized review when hideCategoryReview is set", () => {
    renderUpload({
      initialDocuments: [makeDoc({ category: undefined })] as any,
      hideCategoryReview: true,
    });

    expect(screen.queryByText("Uncategorized Documents")).not.toBeInTheDocument();
  });

  it("disables the secondary action while documents are uncategorized", () => {
    renderUpload({ initialDocuments: [makeDoc({ category: undefined })] as any });

    expect(screen.getByText("secondary-disabled")).toBeInTheDocument();
  });

  it("enables the secondary action once every document has a category", () => {
    renderUpload({ initialDocuments: [makeDoc()] as any });

    expect(screen.getByText("secondary-enabled")).toBeInTheDocument();
    expect(screen.queryByText("Uncategorized Documents")).not.toBeInTheDocument();
  });

  it("applies one category to every uncategorized row", async () => {
    renderUpload({
      initialDocuments: [
        makeDoc({ id: "temp-1", category: undefined }),
        makeDoc({ id: "temp-2", name: "SBC", category: "" }),
      ] as any,
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[selects.length - 1], {
      target: { value: "Group Health" },
    });

    await waitFor(() =>
      expect(screen.queryByText("Uncategorized Documents")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("secondary-enabled")).toBeInTheDocument();
  });

  it("updates a single uncategorized row", async () => {
    renderUpload({
      initialDocuments: [makeDoc({ category: undefined })] as any,
    });

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "Group Life" },
    });

    await waitFor(() =>
      expect(screen.queryByText("Uncategorized Documents")).not.toBeInTheDocument(),
    );
  });

  it("saves temp R2 documents through the manual handler", async () => {
    const { onSave, onDocumentsAdded } = renderUpload({
      initialDocuments: [makeDoc()] as any,
    });

    await act(async () => {
      await mocks.saveFn?.();
    });

    expect(onDocumentsAdded).toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/new-client-wizard/optional-documents",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse((mocks.fetch.mock.calls[0][1] as any).body);
    expect(body).toEqual({
      clientId: "plan-1",
      optionalFiles: [
        expect.objectContaining({
          title: "SPD",
          fileName: "spd.pdf",
          fileData: "abc",
          fileType: "pdf",
          language: "EN",
          storageKey: "key-1",
          category: "Retirement",
        }),
      ],
      provideSpanishVersions: false,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Documents saved successfully",
    );
    expect(onSave).toHaveBeenCalled();
  });

  it("blocks manual save until every document is categorized", async () => {
    renderUpload({
      initialDocuments: [makeDoc({ category: undefined })] as any,
    });

    await act(async () => {
      await mocks.saveFn?.();
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Assign a category to every document before saving.",
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does nothing when the manual save has no documents", async () => {
    renderUpload();

    await act(async () => {
      await mocks.saveFn?.();
    });

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("reports an API rejection during save", async () => {
    renderUpload({ initialDocuments: [makeDoc()] as any });
    mocks.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "nope" }),
    });

    await act(async () => {
      await mocks.saveFn?.();
    });

    expect(mocks.toastError).toHaveBeenCalledWith("nope");
  });

  it("reports a thrown save request", async () => {
    const { onSave } = renderUpload({ initialDocuments: [makeDoc()] as any });
    mocks.fetch.mockRejectedValue(new Error("network"));

    await act(async () => {
      await mocks.saveFn?.();
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Error saving documents. Please try again.",
    );
    expect(onSave).toHaveBeenCalled();
  });

  it("renders the preview cards only when there are documents", () => {
    renderUpload({ initialDocuments: [makeDoc()] as any });
    expect(screen.getByTestId("cards-view")).toHaveAttribute("data-count", "1");
  });

  it("omits the preview when disabled", () => {
    renderUpload({
      initialDocuments: [makeDoc()] as any,
      showPreview: false,
    });

    expect(screen.queryByTestId("cards-view")).not.toBeInTheDocument();
  });

  it("passes the compact and PDF-only flags to the upload section", () => {
    renderUpload({ compact: true, strictCategoryEnforcement: true });

    const section = screen.getByTestId("upload-section");
    expect(section).toHaveAttribute("data-pdf-only", "true");
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
  });

  it("lets a non-strict reviewer skip the category review", async () => {
    const user = userEvent.setup();
    renderUpload({
      initialDocuments: [makeDoc({ category: undefined })] as any,
    });

    await user.click(screen.getByRole("button", { name: "Skip" }));

    await waitFor(() =>
      expect(screen.queryByText("Uncategorized Documents")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("secondary-enabled")).toBeInTheDocument();
  });
});
