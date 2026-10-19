import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

import { DocumentPreviewModal } from "../document-preview-modal";

const documentFixture = {
  id: "doc-1",
  title: "SPD 2025",
  blobUrl: "blob:preview",
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window.URL, "createObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(() => "blob:preview"),
  });
  Object.defineProperty(window.URL, "revokeObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

describe("DocumentPreviewModal", () => {
  it("renders nothing when closed", () => {
    render(
      <DocumentPreviewModal
        isOpen={false}
        onClose={vi.fn()}
        document={documentFixture}
        isLoading={false}
      />,
    );

    expect(screen.queryByText("SPD 2025")).not.toBeInTheDocument();
  });

  it("shows the loading state", () => {
    render(
      <DocumentPreviewModal
        isOpen
        onClose={vi.fn()}
        document={null}
        isLoading
      />,
    );

    expect(screen.getByText("Loading document preview...")).toBeInTheDocument();
  });

  it("shows the error state when there is no blob URL", () => {
    render(
      <DocumentPreviewModal
        isOpen
        onClose={vi.fn()}
        document={{ id: "doc-1", title: "SPD 2025" }}
        isLoading={false}
      />,
    );

    expect(
      screen.getByText("Failed to load document preview"),
    ).toBeInTheDocument();
  });

  it("renders the blob in an iframe", () => {
    render(
      <DocumentPreviewModal
        isOpen
        onClose={vi.fn()}
        document={documentFixture}
        isLoading={false}
      />,
    );

    const frame = screen.getByTitle("SPD 2025");
    expect(frame).toHaveAttribute("src", "blob:preview#view=FitH");
  });

  it("downloads the blob through an anchor", async () => {
    const user = userEvent.setup();
    render(
      <DocumentPreviewModal
        isOpen
        onClose={vi.fn()}
        document={documentFixture}
        isLoading={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Document downloaded");
  });

  it("revokes the blob URL and closes from the X button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DocumentPreviewModal
        isOpen
        onClose={onClose}
        document={documentFixture}
        isLoading={false}
      />,
    );

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("revokes the blob URL when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <DocumentPreviewModal
        isOpen
        onClose={onClose}
        document={documentFixture}
        isLoading={false}
      />,
    );

    await user.click(container.firstElementChild as HTMLElement);

    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
