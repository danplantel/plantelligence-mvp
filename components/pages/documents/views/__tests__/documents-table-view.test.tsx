import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: any) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <>{children}</>,
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: () => null,
}));

import { DocumentsTableView } from "../documents-table-view";
import { getDocumentCategoryDisplayLabel } from "@/lib/service-categories";
import { scheduleDayKeyToDate, todayScheduleDayKey } from "@/lib/date";

function dayKeyOffset(offset: number): string {
  const base = scheduleDayKeyToDate(todayScheduleDayKey());
  base.setDate(base.getDate() + offset);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    title: "SPD 2025",
    fileName: "spd.pdf",
    type: "SPD",
    uploadedAt: "2026-01-02T15:30:00.000Z",
    client: { id: "plan-1", companyName: "Acme" },
    category: "Retirement",
    language: "EN" as const,
    ...overrides,
  };
}

function renderTable(overrides: Partial<React.ComponentProps<typeof DocumentsTableView>> = {}) {
  const callbacks = {
    onSort: vi.fn(),
    onPreview: vi.fn(),
    onDownload: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
  };
  render(
    <DocumentsTableView
      documents={[makeDoc()] as any}
      sortColumn="uploadedAt"
      sortDirection="desc"
      getDocumentType={() => "SPD"}
      {...callbacks}
      {...overrides}
    />,
  );
  return callbacks;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DocumentsTableView", () => {
  it("fires the sort callbacks from the headers", async () => {
    const user = userEvent.setup();
    const { onSort } = renderTable();

    await user.click(screen.getByRole("button", { name: /Document Title/ }));
    await user.click(screen.getByRole("button", { name: /Uploaded/ }));
    await user.click(screen.getByRole("button", { name: /Review Date/ }));

    expect(onSort).toHaveBeenNthCalledWith(1, "title");
    expect(onSort).toHaveBeenNthCalledWith(2, "uploadedAt");
    expect(onSort).toHaveBeenNthCalledWith(3, "expirationDate");
  });

  it("shows the language badge and upload date/time", () => {
    renderTable();

    expect(screen.getByTitle("English document")).toHaveTextContent("EN");
    expect(screen.getByText("01/02/2026")).toBeInTheDocument();
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it("hides the upload time when requested", () => {
    renderTable({ hideUploadedTime: true });

    expect(screen.getByText("01/02/2026")).toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).not.toBeInTheDocument();
  });

  it("renders a Spanish badge", () => {
    renderTable({ documents: [makeDoc({ language: "ES" })] as any });

    expect(screen.getByTitle("Spanish document")).toHaveTextContent("ES");
  });

  it("lets the category select call onEdit", () => {
    const { onEdit } = renderTable();

    fireEvent.change(screen.getByLabelText("category"), {
      target: { value: "Group Health" },
    });

    expect(onEdit).toHaveBeenCalledWith("doc-1", "SPD 2025", {
      category: "Group Health",
    });
  });

  it("renders a static category badge when editing is disabled", () => {
    renderTable({ disableCategoryEdit: true });

    expect(
      screen.getByText(getDocumentCategoryDisplayLabel("Retirement")),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("category")).not.toBeInTheDocument();
  });

  it("renders an uncategorized badge", () => {
    renderTable({
      documents: [makeDoc({ category: undefined })] as any,
      onEdit: undefined,
    });

    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  it("hides the category column when requested", () => {
    renderTable({ hideCategoryColumn: true, onEdit: undefined });

    const headers = screen.getAllByRole("columnheader");
    expect(headers[1]).toHaveClass("hidden");
    const row = screen.getByText("SPD 2025").closest("tr")!;
    expect(within(row).getAllByRole("cell")[1]).toHaveClass("hidden");
  });

  it("shows the review date, expired badge, and countdown", () => {
    renderTable({
      documents: [
        makeDoc({ id: "expired", title: "Old Doc", expirationDate: dayKeyOffset(-2) }),
        makeDoc({ id: "soon", title: "Soon", expirationDate: dayKeyOffset(5) }),
      ] as any,
    });

    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText("5 days left")).toBeInTheDocument();
  });

  it("shows a dash when there is no review date", () => {
    renderTable();

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("forwards preview, download, and direct edit/delete actions", async () => {
    const user = userEvent.setup();
    const { onPreview, onDownload, onDelete, onEdit } = renderTable({
      showDirectEditDelete: true,
    });

    const row = screen.getByText("SPD 2025").closest("tr")!;
    const buttons = within(row).getAllByRole("button");
    await user.click(buttons[0]);
    await user.click(buttons[1]);
    await user.click(buttons[2]);
    await user.click(buttons[3]);

    expect(onPreview).toHaveBeenCalledWith("doc-1", "SPD 2025");
    expect(onDownload).toHaveBeenCalledWith("doc-1", "spd.pdf");
    expect(onEdit).toHaveBeenCalledWith("doc-1", "SPD 2025");
    expect(onDelete).toHaveBeenCalledWith("doc-1", "SPD 2025");
  });

  it("uses the overflow menu for edit and delete", async () => {
    const user = userEvent.setup();
    const { onDelete, onEdit } = renderTable();

    await user.click(screen.getByText("Edit/Update"));
    await user.click(screen.getByText("Delete"));

    expect(onEdit).toHaveBeenCalledWith("doc-1", "SPD 2025");
    expect(onDelete).toHaveBeenCalledWith("doc-1", "SPD 2025");
  });
});
