import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

vi.mock("@/components/pages/client-portal/sections/benefit-document-section", () => ({
  BenefitDocumentSection: (props: any) => (
    <div
      data-testid="section"
      data-editing={props.editingDocId ?? ""}
      data-brand={props.brandColor}
      data-accent={props.accentColor}
      data-hide-category={String(!!props.hideCategoryBadge)}
    >
      <span>{props.showMetadata ? "meta" : "no-meta"}</span>
      <span>{props.hideHeader ? "hidden-header" : "header"}</span>
      <button type="button" onClick={() => props.onEdit({ id: "doc-1" })}>
        edit-doc
      </button>
      <button type="button" onClick={() => props.onStartEdit("doc-1")}>
        start-edit
      </button>
      <button
        type="button"
        onClick={() => props.onSaveEdit("doc-1", "New", "Desc")}
      >
        save-edit
      </button>
      <button type="button" onClick={() => props.onCancelEdit()}>
        cancel-edit
      </button>
      <button type="button" onClick={() => props.onOrderChange([])}>
        order-change
      </button>
    </div>
  ),
}));

import { DocumentsCardsView } from "../documents-cards-view";

const documentFixture = {
  id: "doc-1",
  title: "SPD",
  description: "Summary",
  href: "/api/documents/doc-1/view",
  language: "EN" as const,
};

function renderCards(overrides: Partial<React.ComponentProps<typeof DocumentsCardsView>> = {}) {
  const callbacks = {
    onDelete: vi.fn(),
    onDownload: vi.fn(),
    onDocumentsChange: vi.fn(),
  };
  render(
    <DocumentsCardsView
      documents={[documentFixture] as any}
      {...callbacks}
      {...overrides}
    />,
  );
  return callbacks;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  });
});

describe("DocumentsCardsView", () => {
  it("renders the editable section with defaults", () => {
    renderCards();

    const section = screen.getByTestId("section");
    expect(section).toHaveAttribute("data-brand", "#002B5B");
    expect(section).toHaveAttribute("data-accent", "#6B7280");
    expect(screen.getByText("no-meta")).toBeInTheDocument();
    expect(screen.getByText("hidden-header")).toBeInTheDocument();
  });

  it("calls a custom onEdit instead of the info toast", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderCards({ onEdit });

    await user.click(screen.getByText("edit-doc"));

    expect(onEdit).toHaveBeenCalledWith({ id: "doc-1" });
    expect(mocks.toastInfo).not.toHaveBeenCalled();
  });

  it("shows the coming-soon toast when no onEdit is provided", async () => {
    const user = userEvent.setup();
    renderCards();

    await user.click(screen.getByText("edit-doc"));

    expect(mocks.toastInfo).toHaveBeenCalledWith(
      "Edit functionality coming soon",
    );
  });

  it("opens edit mode from the editDocument event", async () => {
    renderCards();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("editDocument", { detail: { documentId: "doc-1" } }),
      );
    });

    expect(screen.getByTestId("section")).toHaveAttribute(
      "data-editing",
      "doc-1",
    );
  });

  it("ignores an editDocument event for an unknown document", () => {
    renderCards();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("editDocument", { detail: { documentId: "missing" } }),
      );
    });

    expect(screen.getByTestId("section")).toHaveAttribute("data-editing", "");
  });

  it("uses a custom onSaveEdit and resets edit mode", async () => {
    const user = userEvent.setup();
    const onSaveEdit = vi.fn().mockResolvedValue(undefined);
    renderCards({ onSaveEdit });

    await user.click(screen.getByText("start-edit"));
    expect(screen.getByTestId("section")).toHaveAttribute(
      "data-editing",
      "doc-1",
    );

    await user.click(screen.getByText("save-edit"));

    await waitFor(() =>
      expect(screen.getByTestId("section")).toHaveAttribute("data-editing", ""),
    );
    expect(onSaveEdit).toHaveBeenCalledWith(
      "doc-1",
      "New",
      "Desc",
      undefined,
      undefined,
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("PATCHes form data by default and notifies after a delay", async () => {
    const user = userEvent.setup();
    const { onDocumentsChange } = renderCards();

    await user.click(screen.getByText("save-edit"));

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith("/api/documents/doc-1", {
        method: "PATCH",
        body: expect.any(FormData),
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Document updated successfully",
    );
    await waitFor(() => expect(onDocumentsChange).toHaveBeenCalled(), {
      timeout: 1000,
    });
  });

  it("reports a rejected default save", async () => {
    const user = userEvent.setup();
    renderCards();
    mocks.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "nope" }),
    });

    await user.click(screen.getByText("save-edit"));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("nope"));
  });

  it("reports a thrown default save", async () => {
    const user = userEvent.setup();
    renderCards();
    mocks.fetch.mockRejectedValue(new Error("network"));

    await user.click(screen.getByText("save-edit"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "An error occurred while updating the document",
      ),
    );
  });

  it("keeps order changes visual only", async () => {
    const user = userEvent.setup();
    renderCards();

    await user.click(screen.getByText("order-change"));

    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
