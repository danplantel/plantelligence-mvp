import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { scheduleDayKeyToDate, todayScheduleDayKey } from "@/lib/date";

const PLAN_ID = "65f1c2a9b3d4e5f6a7b8c9d0";
const PLAN_2_ID = "65f1c2a9b3d4e5f6a7b8c9d1";
const UNKNOWN_PLAN_ID = "65f1c2a9b3d4e5f6a7b8c9ff";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
  setTitle: vi.fn(),
  setSubtitle: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetch: vi.fn(),
  uploadFileToR2: vi.fn(),
  clientsData: { data: [] } as any,
  documents: [] as any[],
  viewBlob: null as Blob | null,
  editFile: null as File | null,
  editCategory: "Retirement",
  uploadSave: vi.fn(),
  guardOptions: null as any,
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
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.searchParams,
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}));

vi.mock("swr", () => ({
  default: () => ({ data: mocks.clientsData }),
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({
    setTitle: mocks.setTitle,
    setSubtitle: mocks.setSubtitle,
  }),
}));

vi.mock("@/hooks/use-navigate-away-guard", () => ({
  useNavigateAwayGuard: (options: any) => {
    mocks.guardOptions = options;
    return mocks.leaveGuard;
  },
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/upload-to-r2", () => ({
  uploadFileToR2: mocks.uploadFileToR2,
}));

vi.mock("@/components/plan-selector/plan-search-bar", () => ({
  PlanSearchBar: ({ plans, onChange, title, module, disabled }: any) => (
    <div
      data-testid="plan-search-bar"
      data-module={module}
      data-disabled={String(!!disabled)}
    >
      <span>{title}</span>
      {plans.map((plan: any) => (
        <button
          key={plan.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(plan.id)}
        >
          select-{plan.companyName}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/pages/documents/tabs/document-upload-tab", () => ({
  DocumentUploadTab: (props: any) => (
    <div data-testid="upload-tab" data-plan={props.selectedPlan}>
      <button type="button" onClick={() => props.onHasUnsavedChangesChange?.(true)}>
        mark-unsaved
      </button>
      <button type="button" onClick={() => props.onHasUnsavedChangesChange?.(false)}>
        mark-clean
      </button>
      <button
        type="button"
        onClick={() => props.onSaveFunctionReady?.(mocks.uploadSave)}
      >
        register-save
      </button>
      <button type="button" onClick={() => props.onDocumentsAdded?.()}>
        simulate-added
      </button>
      <button type="button" onClick={() => props.onDocumentsSaved?.()}>
        simulate-saved
      </button>
    </div>
  ),
}));

vi.mock("@/components/pages/documents/views/documents-calendar-view", () => ({
  DocumentsCalendarView: ({ documents, onPreview, onUpdateReviewDate }: any) => (
    <div data-testid="calendar-view" data-count={documents.length}>
      <button type="button" onClick={() => onPreview?.(documents[0])}>
        calendar-preview
      </button>
      <button
        type="button"
        onClick={() => onUpdateReviewDate?.(documents[0].id, "2030-01-01")}
      >
        calendar-set-date
      </button>
      <button
        type="button"
        onClick={() => onUpdateReviewDate?.(documents[0].id, null)}
      >
        calendar-clear-date
      </button>
    </div>
  ),
}));

vi.mock("@/components/pages/client-portal/sections/benefit-document-section", () => ({
  BenefitDocumentSection: ({
    retirementDocs,
    reorderable,
    onOrderChange,
    brandColor,
    accentColor,
  }: any) => (
    <div
      data-testid="benefit-document-section"
      data-brand={brandColor}
      data-accent={accentColor}
      data-reorderable={String(!!reorderable)}
    >
      {retirementDocs.map((doc: any) => (
        <span key={doc.id} data-testid="preview-doc">
          {doc.title}
        </span>
      ))}
      <button
        type="button"
        onClick={() => onOrderChange?.([...retirementDocs].reverse())}
      >
        reverse-order
      </button>
    </div>
  ),
}));

vi.mock("@/components/pages/documents/components/document-preview-modal", () => ({
  DocumentPreviewModal: ({ isOpen, document, isLoading }: any) =>
    isOpen ? (
      <div data-testid="preview-modal" data-loading={String(isLoading)}>
        {document?.title ?? "none"}
      </div>
    ) : null,
}));

vi.mock("@/components/pages/documents/components/document-edit-modal", () => ({
  DocumentEditModal: ({ isOpen, document, onSave }: any) =>
    isOpen ? (
      <div data-testid="edit-modal">
        <span>{document?.title}</span>
        <button
          type="button"
          onClick={() => {
            void onSave(
              document.id,
              "Updated title",
              "Updated description",
              mocks.editFile ?? undefined,
              mocks.editCategory,
            ).catch(() => {});
          }}
        >
          submit-edit
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    confirmText,
  }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <p>{description}</p>
        <button
          type="button"
          onClick={async () => {
            await onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmText ?? "Confirm"}
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) =>
    open ? <div data-testid="page-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      aria-label="category"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, disabled, children }: any) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  ),
  SelectValue: () => null,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: any) => <>{children}</>,
  Droppable: ({ children }: any) =>
    children({ innerRef: vi.fn(), droppableProps: {}, placeholder: null }),
  Draggable: ({ children }: any) =>
    children(
      { innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} },
      { isDragging: false },
    ),
}));

const CLIENTS = [
  {
    id: PLAN_ID,
    companyName: "Acme Corp",
    slug: "acme",
    status: "Active",
    brandColor: "#123456",
    secondaryColor: "#654321",
  },
  { id: PLAN_2_ID, companyName: "Beta LLC", slug: "beta", status: "Active" },
  { id: "archived-1", companyName: "Old Co", slug: "old", status: "Archived" },
];

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    title: "SPD 2025",
    fileName: "spd.pdf",
    type: "SPD",
    uploadedAt: "2026-02-01T00:00:00.000Z",
    client: { id: PLAN_ID, companyName: "Acme Corp" },
    category: "Retirement",
    language: "EN" as const,
    ...overrides,
  };
}

/** A `yyyy-MM-dd` key offset from the app's US scheduling day. */
function dayKeyOffset(offset: number): string {
  const base = scheduleDayKeyToDate(todayScheduleDayKey());
  base.setDate(base.getDate() + offset);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function jsonResponse(payload: any, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: async () => payload,
    blob: async () => new Blob(["x".repeat(200)]),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function docListCalls() {
  return mocks.fetch.mock.calls.filter(
    ([url, init]) =>
      String(url).startsWith("/api/documents?") && (!init || !init.method),
  );
}

function deleteCalls() {
  return mocks.fetch.mock.calls.filter(([, init]) => init?.method === "DELETE");
}

function patchCalls() {
  return mocks.fetch.mock.calls.filter(([, init]) => init?.method === "PATCH");
}

async function renderReady(
  documents: any[] = [makeDoc()],
  params: Record<string, string> = { planId: PLAN_ID },
) {
  mocks.documents = documents;
  mocks.searchParams = new URLSearchParams(params);
  window.history.replaceState(
    {},
    "",
    `/documents?${mocks.searchParams.toString()}`,
  );
  const utils = render(<DocumentsPage />);
  await waitFor(() => expect(docListCalls().length).toBeGreaterThan(0));
  return utils;
}

// Imported after the mocks so the page picks up every module mock.
import DocumentsPage from "../page";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/documents");
  mocks.searchParams = new URLSearchParams();
  mocks.clientsData = { data: CLIENTS };
  mocks.documents = [];
  mocks.viewBlob = new Blob(["x".repeat(200)], { type: "application/pdf" });
  mocks.editFile = null;
  mocks.editCategory = "Retirement";
  mocks.uploadSave = vi.fn().mockResolvedValue(undefined);
  mocks.guardOptions = null;
  mocks.leaveGuard = {
    dialogOpen: false,
    isSaving: false,
    isDiscarding: false,
    stayAndKeepEditing: vi.fn(),
    saveAndExit: vi.fn(),
    discardWithoutSaving: vi.fn(),
    dialogOnOpenChange: vi.fn(),
    suppressStayOnNextClose: vi.fn(),
  };

  mocks.replace.mockReset();
  mocks.push.mockReset();
  mocks.setTitle.mockReset();
  mocks.setSubtitle.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.uploadFileToR2.mockReset();
  mocks.uploadFileToR2.mockResolvedValue("uploaded-key");

  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockReset();
  mocks.fetch.mockImplementation(async (url: string, init?: any) => {
    const method = init?.method ?? "GET";
    if (String(url).endsWith("/view")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        blob: async () => mocks.viewBlob,
      };
    }
    if (String(url) === "/api/documents/reorder" && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (method === "DELETE") return jsonResponse({ success: true });
    if (method === "PATCH") return jsonResponse({ success: true });
    return jsonResponse({ data: mocks.documents });
  });

  Object.defineProperty(window.URL, "createObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(() => "blob:mock"),
  });
  Object.defineProperty(window.URL, "revokeObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

describe("Documents page shell", () => {
  it("shows the plan skeleton until the client list arrives", () => {
    mocks.clientsData = null;
    const { container } = render(<DocumentsPage />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("plan-search-bar")).not.toBeInTheDocument();
  });

  it("renders the plan picker title, module, and only non-archived clients", async () => {
    render(<DocumentsPage />);

    const picker = await screen.findByTestId("plan-search-bar");
    expect(picker).toHaveAttribute("data-module", "documents");
    expect(within(picker).getByText("View Documents")).toBeInTheDocument();
    expect(within(picker).getByText("select-Acme Corp")).toBeInTheDocument();
    expect(within(picker).getByText("select-Beta LLC")).toBeInTheDocument();
    expect(within(picker).queryByText("select-Old Co")).not.toBeInTheDocument();
  });

  it("does not auto-select a plan without a URL id or a stored selection", async () => {
    render(<DocumentsPage />);

    await screen.findByTestId("plan-search-bar");
    expect(docListCalls()).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "Upload Documents" }),
    ).not.toBeInTheDocument();
  });

  it("restores the sticky plan selection from localStorage", async () => {
    localStorage.setItem("lastPlanId_documents", PLAN_2_ID);

    render(<DocumentsPage />);

    await waitFor(() =>
      expect(
        docListCalls().some(([url]) =>
          String(url).includes(`clientId=${PLAN_2_ID}`),
        ),
      ).toBe(true),
    );
  });

  it("selects the URL plan and persists the selection", async () => {
    await renderReady([]);

    expect(
      String(docListCalls()[0][0]),
    ).toContain(`clientId=${PLAN_ID}`);
    expect(localStorage.getItem("lastPlanId_documents")).toBe(PLAN_ID);
  });

  it("falls back to the first plan for an unknown URL id without persisting it", async () => {
    await renderReady([], { planId: UNKNOWN_PLAN_ID });

    expect(
      String(docListCalls()[0][0]),
    ).toContain(`clientId=${PLAN_ID}`);
    expect(localStorage.getItem("lastPlanId_documents")).toBeNull();
  });

  it("resolves a company query param case-insensitively", async () => {
    await renderReady([], { company: "acme" });

    expect(
      String(docListCalls()[0][0]),
    ).toContain(`clientId=${PLAN_ID}`);
  });

  it("publishes the page title and the selected plan as the subtitle", async () => {
    await renderReady([]);

    await waitFor(() => expect(mocks.setTitle).toHaveBeenCalledWith("Documents"));
    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp"),
    );
  });

  it("rewrites the URL with the plan id and section", async () => {
    await renderReady([]);

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        expect.stringContaining(`planId=${PLAN_ID}`),
      ),
    );
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.stringContaining("section=documents"),
    );
  });

  it("opens the upload tab from a ?tab=upload deep link", async () => {
    window.history.replaceState(
      {},
      "",
      `/documents?tab=upload&planId=${PLAN_ID}`,
    );
    mocks.searchParams = new URLSearchParams({
      planId: PLAN_ID,
      tab: "upload",
    });

    render(<DocumentsPage />);

    expect(await screen.findByTestId("upload-tab")).toHaveAttribute(
      "data-plan",
      PLAN_ID,
    );
  });

  it("switches between the Upload and View tabs", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");

    await user.click(screen.getByRole("button", { name: "Upload Documents" }));
    expect(screen.getByTestId("upload-tab")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View Documents" }));
    expect(screen.queryByTestId("upload-tab")).not.toBeInTheDocument();
    expect(screen.getByText("SPD 2025")).toBeInTheDocument();
  });
});

describe("Document loading", () => {
  it("sends the URL search and type filters with the plan id", async () => {
    await renderReady([], {
      planId: PLAN_ID,
      search: "spd",
      type: "SBC",
    });

    const url = String(docListCalls()[0][0]);
    expect(url).toContain("search=spd");
    expect(url).toContain("type=SBC");
    expect(url).toContain(`clientId=${PLAN_ID}`);
  });

  it("dedupes documents returned by the API", async () => {
    const doc = makeDoc();
    await renderReady([doc, { ...doc }]);

    expect(await screen.findByText("SPD 2025")).toBeInTheDocument();
    expect(screen.getAllByText("SPD 2025")).toHaveLength(1);
  });

  it("toasts and clears rows when the list request fails", async () => {
    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (String(url).startsWith("/api/documents?") && (!init || !init.method)) {
        return jsonResponse({ error: "boom" }, false, 500);
      }
      return jsonResponse({ data: [] });
    });
    mocks.searchParams = new URLSearchParams({ planId: PLAN_ID });

    render(<DocumentsPage />);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to fetch documents"),
    );
    expect(screen.queryByText("No documents for this plan yet")).not.toBeInTheDocument();
  });

  it("shows the loading dialog while switching plans", async () => {
    const user = userEvent.setup();
    const betaDoc = makeDoc({
      id: "doc-beta",
      title: "Beta SPD",
      client: { id: PLAN_2_ID, companyName: "Beta LLC" },
    });
    const pending = deferred<any>();

    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");

    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (String(url).startsWith("/api/documents?") && (!init || !init.method)) {
        const target = new URL(String(url), "http://localhost");
        if (target.searchParams.get("clientId") === PLAN_2_ID) {
          return pending.promise;
        }
        return jsonResponse({ data: [makeDoc()] });
      }
      return jsonResponse({ data: [] });
    });

    await user.click(screen.getByRole("button", { name: "select-Beta LLC" }));

    expect(await screen.findByText("Loading Documents")).toBeInTheDocument();
    expect(screen.queryByText("SPD 2025")).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve(jsonResponse({ data: [betaDoc] }));
    });

    expect(await screen.findByText("Beta SPD")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Loading Documents")).not.toBeInTheDocument(),
    );
  });

  it("does not refetch when the same plan is selected", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");
    const before = docListCalls().length;

    await user.click(screen.getByRole("button", { name: "select-Acme Corp" }));

    expect(docListCalls()).toHaveLength(before);
  });

  it("honors the default category saved on the device", async () => {
    localStorage.setItem("plantelligence:defaultDocCategory", "Group Health");
    await renderReady([
      makeDoc({ id: "ret", title: "Retirement SPD", category: "Retirement" }),
      makeDoc({ id: "health", title: "Health SBC", category: "Group Health", type: "SBC" }),
    ]);

    expect(await screen.findByText("Health SBC")).toBeInTheDocument();
    expect(screen.queryByText("Retirement SPD")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2 documents")).toBeInTheDocument();
  });
});

describe("Review-date alerts", () => {
  it("summarizes expired and expiring documents and caps each list at five", async () => {
    const expired = Array.from({ length: 6 }, (_, index) =>
      makeDoc({
        id: `expired-${index}`,
        title: `Expired ${index + 1}`,
        expirationDate: dayKeyOffset(-5 - index),
      }),
    );
    const expiring = [
      makeDoc({ id: "soon-1", title: "Due Soon 1", expirationDate: dayKeyOffset(5) }),
      makeDoc({ id: "soon-2", title: "Due Soon 2", expirationDate: dayKeyOffset(20) }),
    ];

    await renderReady([...expired, ...expiring]);

    expect(await screen.findByText("Documents Past Review Date")).toBeInTheDocument();
    expect(screen.getByText(/6 documents have passed their review date/)).toBeInTheDocument();
    expect(screen.getByText("...and 1 more")).toBeInTheDocument();
    expect(screen.getByText("Documents Due for Review")).toBeInTheDocument();
    expect(screen.getByText(/2 documents are due for review/)).toBeInTheDocument();
  });

  it("persists the dismissal of the due-for-review alert", async () => {
    const user = userEvent.setup();
    const doc = makeDoc({ expirationDate: dayKeyOffset(5) });

    const { unmount } = await renderReady([doc]);
    expect(await screen.findByText("Documents Due for Review")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Documents Due for Review")).not.toBeInTheDocument();
    expect(
      localStorage.getItem(
        "plantelligence:dismissed-alert:documents-due-for-review:doc-1",
      ),
    ).toBe("1");

    unmount();
    render(<DocumentsPage />);

    await waitFor(() =>
      expect(screen.queryByText("Documents Due for Review")).not.toBeInTheDocument(),
    );
  });
});

describe("Document views", () => {
  const listDocs = () => [
    makeDoc({
      id: "spd",
      title: "Zeta SPD",
      type: "SPD",
      category: "Retirement, Group Health",
      expirationDate: dayKeyOffset(45),
    }),
    makeDoc({
      id: "sbc",
      title: "Alpha SBC",
      type: "SBC",
      language: "ES",
      expirationDate: dayKeyOffset(10),
    }),
    makeDoc({ id: "generic", title: "Newsletter", type: undefined }),
  ];

  it("renders rows with category, language, and review date", async () => {
    await renderReady(listDocs());
    await screen.findByText("Zeta SPD");

    // `retirementDocs` re-sorts English before Spanish for the portal preview,
    // and the list renders that same array, so the ES document lands last.
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zeta SPD");
    expect(rows[1]).toHaveTextContent("Newsletter");
    expect(rows[2]).toHaveTextContent("Alpha SBC");

    expect(within(rows[0]).getByText("Multiple")).toBeInTheDocument();
    expect(within(rows[2]).getByText("ES")).toBeInTheDocument();
    expect(
      within(rows[2]).getByText(
        `${dayKeyOffset(10).slice(5, 7)}/${dayKeyOffset(10).slice(8, 10)}/${dayKeyOffset(10).slice(0, 4)}`,
      ),
    ).toBeInTheDocument();
  });

  it("sorts by filename ascending and descending", async () => {
    const user = userEvent.setup();
    await renderReady([
      makeDoc({ id: "z", title: "Zeta SPD", type: "SPD" }),
      makeDoc({ id: "a", title: "Alpha SPD", type: "SPD" }),
    ]);
    await screen.findByText("Zeta SPD");

    const titles = () =>
      within(screen.getByRole("table"))
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[1].textContent);

    await user.click(screen.getByText("Filename"));
    await waitFor(() => expect(titles()[0]).toContain("Alpha SPD"));

    await user.click(screen.getByText("Filename"));
    await waitFor(() => expect(titles()[0]).toContain("Zeta SPD"));
  });

  it("filters by category", async () => {
    await renderReady([
      makeDoc({ id: "ret", title: "Retirement SPD", category: "Retirement" }),
      makeDoc({
        id: "health",
        title: "Health SBC",
        category: "Group Health",
        type: "SBC",
      }),
    ]);
    await screen.findByText("Retirement SPD");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Group Health" },
    });

    await waitFor(() => expect(screen.queryByText("Retirement SPD")).not.toBeInTheDocument());
    expect(screen.getByText("Health SBC")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 documents")).toBeInTheDocument();
  });

  it("filters by language and shows the filtered count", async () => {
    const user = userEvent.setup();
    await renderReady([
      makeDoc({ id: "en", title: "English SPD" }),
      makeDoc({ id: "es", title: "Spanish SPD", language: "ES" }),
    ]);
    await screen.findByText("English SPD");

    expect(screen.getByText("ENGLISH (1)")).toBeInTheDocument();
    expect(screen.getByText("ESPANOL (1)")).toBeInTheDocument();

    await user.click(screen.getByText("ESPANOL (1)"));

    await waitFor(() => expect(screen.queryByText("English SPD")).not.toBeInTheDocument());
    expect(screen.getByText("Spanish SPD")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 documents")).toBeInTheDocument();

    await user.click(screen.getByText("ESPANOL (1)"));
    await waitFor(() => expect(screen.getByText("English SPD")).toBeInTheDocument());
  });

  it("offers an upload CTA when the plan has no documents", async () => {
    const user = userEvent.setup();
    await renderReady([]);

    expect(
      await screen.findByText("No documents for this plan yet"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Upload documents" }));

    expect(screen.getByTestId("upload-tab")).toBeInTheDocument();
  });

  it("explains when filters hide every document and clears them", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ title: "Only SPD", type: "SPD" })], {
      planId: PLAN_ID,
      type: "SBC",
    });

    expect(
      await screen.findByText("No documents match the current filters"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear Filters" }));

    expect(await screen.findByText("Only SPD")).toBeInTheDocument();
  });

  it("renders the cards view", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");

    await user.click(screen.getByRole("button", { name: "Cards" }));

    expect(screen.getByText("Drag cards to reorder")).toBeInTheDocument();
    expect(screen.getByText("SPD 2025")).toBeInTheDocument();
  });

  it("forwards the documents and callbacks to the calendar view", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");

    await user.click(screen.getByRole("button", { name: "Calendar" }));

    const calendar = screen.getByTestId("calendar-view");
    expect(calendar).toHaveAttribute("data-count", "1");

    await user.click(within(calendar).getByText("calendar-preview"));
    expect(await screen.findByTestId("preview-modal")).toHaveTextContent("SPD 2025");
  });

  it("updates and clears the review date from the calendar", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");
    await user.click(screen.getByRole("button", { name: "Calendar" }));

    await user.click(screen.getByText("calendar-set-date"));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Review date updated"),
    );
    const setCall = patchCalls().find(
      ([url]) => String(url) === "/api/documents/doc-1",
    );
    expect(JSON.parse((setCall![1] as any).body)).toEqual({
      expirationDate: "2030-01-01",
    });

    await user.click(screen.getByText("calendar-clear-date"));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Review date cleared"),
    );
    const clearCall = patchCalls().find(
      ([url, init]) =>
        String(url) === "/api/documents/doc-1" &&
        JSON.parse((init as any).body).expirationDate === null,
    );
    expect(clearCall).toBeTruthy();
  });

  it("reports a rejected review-date update", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");
    await user.click(screen.getByRole("button", { name: "Calendar" }));

    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (init?.method === "PATCH") return jsonResponse({ error: "nope" }, false);
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(screen.getByText("calendar-set-date"));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("nope"));
  });

  it("reports a thrown review-date request", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");
    await user.click(screen.getByRole("button", { name: "Calendar" }));

    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (init?.method === "PATCH") throw new Error("network");
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(screen.getByText("calendar-set-date"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "An error occurred while updating the review date",
      ),
    );
  });
});

describe("Document preview mode", () => {
  it("shows the empty state when there is nothing to preview", async () => {
    const user = userEvent.setup();
    await renderReady([]);

    await screen.findByText("No documents for this plan yet");
    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByText("No documents available for preview.")).toBeInTheDocument();
  });

  it("renders the portal section with the plan brand colors", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");

    await user.click(screen.getByRole("button", { name: "Preview" }));

    const section = screen.getByTestId("benefit-document-section");
    expect(section).toHaveAttribute("data-brand", "#123456");
    expect(section).toHaveAttribute("data-accent", "#654321");
    expect(section).toHaveAttribute("data-reorderable", "true");
    expect(within(section).getByTestId("preview-doc")).toHaveTextContent("SPD 2025");
  });

  it("falls back to the default brand colors when the plan has none", async () => {
    const user = userEvent.setup();
    mocks.clientsData = {
      data: [
        { id: PLAN_ID, companyName: "Acme Corp", status: "Active" },
        { id: PLAN_2_ID, companyName: "Beta LLC", status: "Active" },
      ],
    };
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");

    await user.click(screen.getByRole("button", { name: "Preview" }));

    const section = screen.getByTestId("benefit-document-section");
    expect(section).toHaveAttribute("data-brand", "#1F3A60");
    expect(section).toHaveAttribute("data-accent", "#6B7280");
  });

  it("saves a reordered preview and refetches the plan", async () => {
    const user = userEvent.setup();
    const docs = [makeDoc({ id: "a", title: "Alpha" }), makeDoc({ id: "b", title: "Beta" })];
    await renderReady(docs);
    await screen.findByText("Alpha");
    await user.click(screen.getByRole("button", { name: "Preview" }));

    await user.click(screen.getByText("reverse-order"));
    expect(screen.getByRole("button", { name: "Revert" })).toBeInTheDocument();

    const before = docListCalls().length;
    await user.click(screen.getByRole("button", { name: /Save order/ }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Document order saved"),
    );
    const reorder = mocks.fetch.mock.calls.find(
      ([url]) => String(url) === "/api/documents/reorder",
    );
    expect(JSON.parse((reorder![1] as any).body).orderedIds).toEqual(["b", "a"]);
    await waitFor(() => expect(docListCalls().length).toBeGreaterThan(before));
    expect(screen.queryByRole("button", { name: "Revert" })).not.toBeInTheDocument();
  });

  it("reverts a pending preview order", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" }), makeDoc({ id: "b", title: "Beta" })]);
    await screen.findByText("Alpha");
    await user.click(screen.getByRole("button", { name: "Preview" }));

    await user.click(screen.getByText("reverse-order"));
    await user.click(screen.getByRole("button", { name: "Revert" }));

    expect(screen.queryByRole("button", { name: "Revert" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save order/ })).toBeDisabled();
  });

  it("reports a rejected order save and keeps the pending order", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" }), makeDoc({ id: "b", title: "Beta" })]);
    await screen.findByText("Alpha");
    await user.click(screen.getByRole("button", { name: "Preview" }));
    await user.click(screen.getByText("reverse-order"));

    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (String(url) === "/api/documents/reorder") {
        return jsonResponse({ error: "bad order" }, false);
      }
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(screen.getByRole("button", { name: /Save order/ }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("bad order"),
    );
    expect(screen.getByRole("button", { name: "Revert" })).toBeInTheDocument();
  });

  it("reports a thrown order save", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" }), makeDoc({ id: "b", title: "Beta" })]);
    await screen.findByText("Alpha");
    await user.click(screen.getByRole("button", { name: "Preview" }));
    await user.click(screen.getByText("reverse-order"));

    mocks.fetch.mockImplementation(async (url: string) => {
      if (String(url) === "/api/documents/reorder") throw new Error("network");
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(screen.getByRole("button", { name: /Save order/ }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "An error occurred while saving the document order",
      ),
    );
  });
});

describe("Selection and deletion", () => {
  it("selects every visible document, shows the bulk bar, and clears it", async () => {
    const user = userEvent.setup();
    await renderReady([
      makeDoc({ id: "a", title: "Alpha" }),
      makeDoc({ id: "b", title: "Beta" }),
    ]);
    await screen.findByText("Alpha");

    await user.click(screen.getAllByRole("checkbox")[0]);

    expect(screen.getByText("2 documents selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByText("2 documents selected")).not.toBeInTheDocument();
  });

  it("bulk-deletes every selected document and refetches", async () => {
    const user = userEvent.setup();
    await renderReady([
      makeDoc({ id: "a", title: "Alpha" }),
      makeDoc({ id: "b", title: "Beta" }),
    ]);
    await screen.findByText("Alpha");
    await user.click(screen.getAllByRole("checkbox")[0]);

    const before = docListCalls().length;
    await user.click(screen.getByRole("button", { name: "Delete selected" }));

    const dialog = screen.getByTestId("confirm-dialog");
    expect(within(dialog).getByText(/2 documents/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteCalls()).toHaveLength(2));
    await waitFor(() => expect(docListCalls().length).toBeGreaterThan(before));
    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
  });

  it("reports a bulk delete where every request fails", async () => {
    const user = userEvent.setup();
    await renderReady([
      makeDoc({ id: "a", title: "Alpha" }),
      makeDoc({ id: "b", title: "Beta" }),
    ]);
    await screen.findByText("Alpha");
    await user.click(screen.getAllByRole("checkbox")[0]);

    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (init?.method === "DELETE") {
        return jsonResponse({ error: "nope" }, false, 500);
      }
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(screen.getByRole("button", { name: "Delete selected" }));
    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to delete documents"),
    );
    expect(screen.getByText("2 documents selected")).toBeInTheDocument();
  });

  it("deletes a single document after confirmation", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    await user.click(within(row).getByTitle("Delete"));

    const dialog = screen.getByTestId("confirm-dialog");
    expect(
      within(dialog).getByText(/Are you sure you want to delete "Alpha"/),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Document deleted successfully!",
      ),
    );
    expect(deleteCalls()[0][0]).toBe("/api/documents/a");
  });

  it("reports a failed single delete", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (init?.method === "DELETE") return jsonResponse({ error: "no" }, false);
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(within(row).getByTitle("Delete"));
    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to delete document"),
    );
  });
});

describe("Preview, download, and edit", () => {
  it("opens the preview modal for a document blob", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    await user.click(within(row).getByTitle("View"));

    expect(await screen.findByTestId("preview-modal")).toHaveTextContent("Alpha");
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it("reports a preview request that fails", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    mocks.fetch.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/view")) {
        return { ok: false, status: 404, json: async () => ({}), blob: async () => new Blob() };
      }
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(within(row).getByTitle("View"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to load document preview: 404",
      ),
    );
    expect(screen.queryByTestId("preview-modal")).not.toBeInTheDocument();
  });

  it("reports a blob that is too small to be a document", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;
    mocks.viewBlob = new Blob(["x"]);

    await user.click(within(row).getByTitle("View"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Document appears to be corrupted or empty",
      ),
    );
  });

  it("reports a thrown preview request", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    mocks.fetch.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/view")) throw new Error("network");
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(within(row).getByTitle("View"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to load document preview",
      ),
    );
  });

  it("downloads a document through an object URL", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    await user.click(within(row).getByTitle("Download"));

    await waitFor(() => expect(window.URL.createObjectURL).toHaveBeenCalled());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("reports a failed download request", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    mocks.fetch.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/view")) {
        return { ok: false, status: 500, json: async () => ({}), blob: async () => new Blob() };
      }
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(within(row).getByTitle("Download"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to download document"),
    );
  });

  it("opens the edit modal from a row", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    await user.click(within(row).getByTitle("Edit"));

    expect(screen.getByTestId("edit-modal")).toHaveTextContent("Alpha");
  });

  it("patches a document with form data when no file is chosen", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    await user.click(within(row).getByTitle("Edit"));
    await user.click(screen.getByRole("button", { name: "submit-edit" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Document updated successfully",
      ),
    );
    const patch = patchCalls()[0];
    expect(patch[0]).toBe("/api/documents/a");
    expect((patch[1] as any).body).toBeInstanceOf(FormData);
  });

  it("uploads a replacement file to R2 before patching metadata", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;
    mocks.editFile = new File(["pdf"], "new.pdf", { type: "application/pdf" });

    await user.click(within(row).getByTitle("Edit"));
    await user.click(screen.getByRole("button", { name: "submit-edit" }));

    await waitFor(() => expect(mocks.uploadFileToR2).toHaveBeenCalled());
    expect(mocks.uploadFileToR2).toHaveBeenCalledWith(
      expect.objectContaining({
        file: mocks.editFile,
        clientId: PLAN_ID,
        purpose: "document",
        fileName: "new.pdf",
      }),
    );
    const patch = patchCalls()[0];
    expect(JSON.parse((patch[1] as any).body).storageKey).toBe("uploaded-key");
  });

  it("falls back to form data when the R2 upload fails", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;
    mocks.editFile = new File(["pdf"], "new.pdf", { type: "application/pdf" });
    mocks.uploadFileToR2.mockRejectedValue(new Error("r2 down"));

    await user.click(within(row).getByTitle("Edit"));
    await user.click(screen.getByRole("button", { name: "submit-edit" }));

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect((patchCalls()[0][1] as any).body).toBeInstanceOf(FormData);
  });

  it("reports a rejected metadata patch", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (init?.method === "PATCH") return jsonResponse({ error: "nope" }, false);
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(within(row).getByTitle("Edit"));
    await user.click(screen.getByRole("button", { name: "submit-edit" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("nope"));
    expect(mocks.toastError).toHaveBeenCalledWith(
      "An error occurred while updating the document",
    );
  });
});

describe("Upload tab and leave guard", () => {
  it("reports unsaved upload changes only while the Upload tab is active", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");

    await user.click(screen.getByRole("button", { name: "Upload Documents" }));
    expect(mocks.guardOptions.hasUnsavedChanges).toBe(false);

    await user.click(screen.getByText("mark-unsaved"));
    await waitFor(() => expect(mocks.guardOptions.hasUnsavedChanges).toBe(true));

    await user.click(screen.getByRole("button", { name: "View Documents" }));
    await waitFor(() => expect(mocks.guardOptions.hasUnsavedChanges).toBe(false));
  });

  it("refuses to save and exit until the upload tab registers a save handler", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");
    await user.click(screen.getByRole("button", { name: "Upload Documents" }));

    await expect(mocks.guardOptions.onSaveAndExit()).rejects.toThrow(
      "No save action is available yet",
    );
  });

  it("runs the registered save handler and clears the dirty flag", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");
    await user.click(screen.getByRole("button", { name: "Upload Documents" }));
    await user.click(screen.getByText("register-save"));
    await user.click(screen.getByText("mark-unsaved"));

    const before = docListCalls().length;
    await act(async () => {
      await mocks.guardOptions.onSaveAndExit();
    });

    expect(mocks.uploadSave).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.guardOptions.hasUnsavedChanges).toBe(false));
    await waitFor(() => expect(docListCalls().length).toBeGreaterThan(before));
  });

  it("switches to the documents section and shows the transition dialog after an upload", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");
    await user.click(screen.getByRole("button", { name: "Upload Documents" }));

    await user.click(screen.getByText("simulate-added"));

    expect(screen.getByText("Adding Documents")).toBeInTheDocument();
    expect(screen.getByText("Saving and loading your documents…")).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("section")).toBe(
      "documents",
    );
    expect(screen.queryByTestId("upload-tab")).not.toBeInTheDocument();
  });

  it("toasts and refetches when the upload tab reports saved documents", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");
    await user.click(screen.getByRole("button", { name: "Upload Documents" }));
    const before = docListCalls().length;

    await user.click(screen.getByText("simulate-saved"));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Documents added successfully",
      ),
    );
    await waitFor(() => expect(docListCalls().length).toBeGreaterThan(before));
  });
});

describe("Documents page edge cases", () => {
  function rowTitles() {
    return within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[1].textContent ?? "");
  }

  it("treats ?tab=preview and ?tab=list as the documents section", async () => {
    await renderReady([makeDoc()], { planId: PLAN_ID, tab: "preview" });
    await screen.findByText("SPD 2025");

    expect(screen.queryByTestId("upload-tab")).not.toBeInTheDocument();
  });

  it("sorts by review date in both directions", async () => {
    const user = userEvent.setup();
    await renderReady([
      makeDoc({ id: "soon", title: "Soon SPD", expirationDate: dayKeyOffset(5) }),
      makeDoc({ id: "later", title: "Later SPD", expirationDate: dayKeyOffset(10) }),
    ]);
    await screen.findByText("Soon SPD");

    await user.click(screen.getByText("Review Date"));
    await waitFor(() => expect(rowTitles()[0]).toContain("Soon SPD"));

    await user.click(screen.getByText("Review Date"));
    await waitFor(() => expect(rowTitles()[0]).toContain("Later SPD"));
  });

  it("infers SPD and SBC types from titles when type is missing", async () => {
    await renderReady([
      makeDoc({ id: "generic", title: "Guidance", type: undefined }),
      makeDoc({ id: "sbc", title: "Alpha SBC", type: undefined }),
      makeDoc({ id: "spd", title: "Zeta SPD", type: undefined }),
    ]);
    await screen.findByText("Guidance");

    const titles = rowTitles();
    expect(titles[0]).toContain("Zeta SPD");
    expect(titles[1]).toContain("Alpha SBC");
    expect(titles[2]).toContain("Guidance");
  });

  it("alerts at exactly 30 days but not at 31", async () => {
    const { unmount } = await renderReady([
      makeDoc({ expirationDate: dayKeyOffset(30) }),
    ]);
    expect(await screen.findByText("Documents Due for Review")).toBeInTheDocument();
    unmount();

    await renderReady([makeDoc({ expirationDate: dayKeyOffset(31) })]);
    await screen.findByText("SPD 2025");
    expect(screen.queryByText("Documents Due for Review")).not.toBeInTheDocument();
  });

  it("supports individual selection and select-all", async () => {
    const user = userEvent.setup();
    await renderReady([
      makeDoc({ id: "a", title: "Alpha" }),
      makeDoc({ id: "b", title: "Beta" }),
    ]);
    await screen.findByText("Alpha");

    const checkboxes = () => screen.getAllByRole("checkbox");
    await user.click(checkboxes()[1]);
    expect(screen.getByText("1 document selected")).toBeInTheDocument();

    await user.click(checkboxes()[0]);
    expect(screen.getByText("2 documents selected")).toBeInTheDocument();

    await user.click(checkboxes()[0]);
    expect(screen.queryByText("2 documents selected")).not.toBeInTheDocument();
  });

  it("clears the selection on a partial bulk delete without a failure toast", async () => {
    const user = userEvent.setup();
    await renderReady([
      makeDoc({ id: "a", title: "Alpha" }),
      makeDoc({ id: "b", title: "Beta" }),
    ]);
    await screen.findByText("Alpha");

    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (init?.method === "DELETE") {
        return String(url).endsWith("/a")
          ? jsonResponse({ success: true })
          : jsonResponse({ error: "no" }, false, 500);
      }
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Delete selected" }));
    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() => expect(deleteCalls()).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByText("2 documents selected")).not.toBeInTheDocument(),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("reports a thrown download", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc({ id: "a", title: "Alpha" })]);
    const row = (await screen.findByText("Alpha")).closest("tr")!;

    mocks.fetch.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/view")) throw new Error("network");
      return jsonResponse({ data: mocks.documents });
    });

    await user.click(within(row).getByTitle("Download"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "An error occurred while downloading the document",
      ),
    );
  });

  it("keeps the dirty flag when save-and-exit rejects", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");
    await user.click(screen.getByRole("button", { name: "Upload Documents" }));

    mocks.uploadSave = vi.fn().mockRejectedValue(new Error("save failed"));
    await user.click(screen.getByText("register-save"));
    await user.click(screen.getByText("mark-unsaved"));

    await expect(mocks.guardOptions.onSaveAndExit()).rejects.toThrow(
      "save failed",
    );
    await waitFor(() => expect(mocks.guardOptions.hasUnsavedChanges).toBe(true));
  });

  it("rewrites the URL when the plan changes", async () => {
    const user = userEvent.setup();
    await renderReady([makeDoc()]);
    await screen.findByText("SPD 2025");

    await user.click(screen.getByRole("button", { name: "select-Beta LLC" }));

    expect(mocks.replace).toHaveBeenCalledWith(
      `/documents?planId=${PLAN_2_ID}`,
    );
  });

  it("does not select a plan when the company param matches nothing", async () => {
    mocks.searchParams = new URLSearchParams({ company: "zzz" });

    render(<DocumentsPage />);

    await screen.findByTestId("plan-search-bar");
    expect(docListCalls()).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "Upload Documents" }),
    ).not.toBeInTheDocument();
  });
});
