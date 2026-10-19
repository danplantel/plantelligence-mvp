import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
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
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: () => null,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={() => onCheckedChange?.(!checked)}
    />
  ),
}));

import { DocumentEditModal } from "../document-edit-modal";

const documentFixture = {
  id: "doc-1",
  title: "SPD 2025",
  description: "Summary",
  fileName: "spd.pdf",
  category: "Retirement",
};

function renderModal(overrides: Partial<React.ComponentProps<typeof DocumentEditModal>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const { container } = render(
    <DocumentEditModal
      isOpen
      onClose={onClose}
      document={documentFixture}
      onSave={onSave}
      {...overrides}
    />,
  );
  return { onSave, onClose, container };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DocumentEditModal", () => {
  it("renders nothing when closed", () => {
    render(
      <DocumentEditModal
        isOpen={false}
        onClose={vi.fn()}
        document={documentFixture}
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByText("Edit Document")).not.toBeInTheDocument();
  });

  it("prefills the form from the document", () => {
    renderModal();

    expect(screen.getByText("Edit Document")).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toHaveValue("SPD 2025");
    expect(screen.getByLabelText("Description")).toHaveValue("Summary");
    expect(screen.getByLabelText("category")).toHaveValue("Retirement");
    expect(screen.getByText("Current: spd.pdf")).toBeInTheDocument();
  });

  it("disables Save when the title is blank", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "   " },
    });

    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });

  it("trims fields and closes after a successful save", async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderModal();

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "  New title  " },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "  New description  " },
    });
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        "doc-1",
        "New title",
        "New description",
        undefined,
        "Retirement",
      ),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal open and re-enables Save when saving rejects", async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderModal();
    onSave.mockRejectedValue(new Error("no"));

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the saving state while the save is in flight", async () => {
    const user = userEvent.setup();
    let resolveSave!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const { onSave } = renderModal();
    onSave.mockReturnValue(pending);

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    resolveSave();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled(),
    );
  });

  it("joins the Multiple category selection", async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    fireEvent.change(screen.getByLabelText("category"), {
      target: { value: "Multiple" },
    });
    await user.click(screen.getByLabelText("Group Health"));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        "doc-1",
        "SPD 2025",
        "Summary",
        undefined,
        "Retirement,Group Health",
      ),
    );
  });

  it("rejects an unsupported file type", () => {
    const { container } = renderModal();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(["text"], "notes.txt", { type: "text/plain" })],
      },
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Only PDF and Word documents are allowed",
    );
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  });

  it("passes a valid replacement file to onSave", async () => {
    const user = userEvent.setup();
    const { onSave, container } = renderModal();
    const file = new File(["pdf"], "new.pdf", { type: "application/pdf" });

    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      { target: { files: [file] } },
    );
    expect(screen.getByText("new.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        "doc-1",
        "SPD 2025",
        "Summary",
        file,
        "Retirement",
      ),
    );
  });

  it("removes a selected replacement file", async () => {
    const user = userEvent.setup();
    const { onSave, container } = renderModal();
    const file = new File(["pdf"], "new.pdf", { type: "application/pdf" });

    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      { target: { files: [file] } },
    );
    await user.click(screen.getByRole("button", { name: /Remove/ }));
    expect(screen.queryByText("new.pdf")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        "doc-1",
        "SPD 2025",
        "Summary",
        undefined,
        "Retirement",
      ),
    );
  });

  it("ignores a title over 85 characters", () => {
    renderModal();
    const title = screen.getByLabelText(/Title/);

    fireEvent.change(title, { target: { value: "x".repeat(90) } });

    expect(title).toHaveValue("SPD 2025");
  });

  it("ignores a description over 200 characters", () => {
    renderModal();
    const description = screen.getByLabelText("Description");

    fireEvent.change(description, { target: { value: "x".repeat(250) } });

    expect(description).toHaveValue("Summary");
    expect(screen.getByText("7/200")).toBeInTheDocument();
  });

  it("closes from Cancel", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
