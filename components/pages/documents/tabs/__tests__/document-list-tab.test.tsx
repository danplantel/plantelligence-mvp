import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../views/documents-table-view", () => ({
  DocumentsTableView: (props: any) => (
    <div data-testid="table-view" data-count={props.documents.length}>
      <button type="button" onClick={() => props.onSort("title")}>
        sort-title
      </button>
      <button type="button" onClick={() => props.onPreview("doc-1", "SPD")}>
        preview
      </button>
      <button
        type="button"
        onClick={() => props.onDownload("doc-1", "spd.pdf")}
      >
        download
      </button>
      <button type="button" onClick={() => props.onDelete("doc-1", "SPD")}>
        delete
      </button>
      <button
        type="button"
        onClick={() => props.onEdit?.("doc-1", "SPD", { category: "Retirement" })}
      >
        edit
      </button>
      <span>{props.compact ? "compact" : "roomy"}</span>
      <span>{props.hideUploadedTime ? "no-time" : "time"}</span>
      <span>{props.hideCategoryColumn ? "no-category" : "category"}</span>
    </div>
  ),
}));

import { DocumentListTab } from "../document-list-tab";

const documentFixture = {
  id: "doc-1",
  title: "SPD",
  fileName: "spd.pdf",
  type: "SPD",
  uploadedAt: "2026-01-01T00:00:00.000Z",
  client: { id: "plan-1", companyName: "Acme" },
  category: "Retirement",
};

function renderTab(overrides: Partial<React.ComponentProps<typeof DocumentListTab>> = {}) {
  const onSort = vi.fn();
  const onPreview = vi.fn();
  const onDownload = vi.fn();
  const onDelete = vi.fn();
  const onEdit = vi.fn();
  const onGoToUpload = vi.fn();
  render(
    <DocumentListTab
      selectedPlan="plan-1"
      isLoading={false}
      documents={[documentFixture] as any}
      sortColumn="uploadedAt"
      sortDirection="desc"
      onSort={onSort}
      onPreview={onPreview}
      onDownload={onDownload}
      onDelete={onDelete}
      getDocumentType={() => "SPD"}
      onEdit={onEdit}
      onGoToUpload={onGoToUpload}
      {...overrides}
    />,
  );
  return { onSort, onPreview, onDownload, onDelete, onEdit, onGoToUpload };
}

describe("DocumentListTab", () => {
  it("asks for a plan when none is selected", () => {
    renderTab({ selectedPlan: "" });

    expect(
      screen.getByText("Please select a plan to view document list"),
    ).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    renderTab({ isLoading: true });

    expect(screen.getByText("Loading documents...")).toBeInTheDocument();
  });

  it("offers the upload CTA for an empty plan when a handler exists", async () => {
    const user = userEvent.setup();
    const { onGoToUpload } = renderTab({ documents: [] });

    expect(
      screen.getByText("No documents for this plan yet"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Upload documents" }));

    expect(onGoToUpload).toHaveBeenCalledTimes(1);
  });

  it("omits the upload CTA when no handler is supplied", () => {
    renderTab({ documents: [], onGoToUpload: undefined });

    expect(
      screen.queryByRole("button", { name: "Upload documents" }),
    ).not.toBeInTheDocument();
  });

  it("passes every callback and display flag to the table", async () => {
    const user = userEvent.setup();
    const { onSort, onPreview, onDownload, onDelete, onEdit } = renderTab({
      compact: true,
      hideUploadedTime: true,
      hideCategoryColumn: true,
    });

    expect(screen.getByTestId("table-view")).toHaveAttribute("data-count", "1");
    expect(screen.getByText("compact")).toBeInTheDocument();
    expect(screen.getByText("no-time")).toBeInTheDocument();
    expect(screen.getByText("no-category")).toBeInTheDocument();

    await user.click(screen.getByText("sort-title"));
    await user.click(screen.getByText("preview"));
    await user.click(screen.getByText("download"));
    await user.click(screen.getByText("delete"));
    await user.click(screen.getByText("edit"));

    expect(onSort).toHaveBeenCalledWith("title");
    expect(onPreview).toHaveBeenCalledWith("doc-1", "SPD");
    expect(onDownload).toHaveBeenCalledWith("doc-1", "spd.pdf");
    expect(onDelete).toHaveBeenCalledWith("doc-1", "SPD");
    expect(onEdit).toHaveBeenCalledWith("doc-1", "SPD", {
      category: "Retirement",
    });
  });
});
