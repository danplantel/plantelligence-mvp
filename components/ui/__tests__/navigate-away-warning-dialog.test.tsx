import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NavigateAwayWarningDialog } from "../navigate-away-warning-dialog";

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof NavigateAwayWarningDialog>> = {},
) {
  const props = {
    open: true,
    onStay: vi.fn(),
    onSaveAndExit: vi.fn(),
    onDiscardWithoutSaving: vi.fn(),
    onDialogOpenChange: vi.fn(),
    ...overrides,
  };

  return { props, ...render(<NavigateAwayWarningDialog {...props} />) };
}

describe("NavigateAwayWarningDialog", () => {
  it("renders nothing while closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByText("Leave this setup?")).not.toBeInTheDocument();
  });

  it("renders the warning and its actions", () => {
    renderDialog();

    expect(screen.getByText("Leave this setup?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You have unsaved changes. If you leave now, your updates may be lost.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save and exit" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stay and keep editing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Discard without saving" }),
    ).toBeInTheDocument();
  });

  it("calls onSaveAndExit", async () => {
    const { props } = renderDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "Save and exit" }),
    );

    expect(props.onSaveAndExit).toHaveBeenCalledTimes(1);
  });

  it("calls onStay", async () => {
    const { props } = renderDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "Stay and keep editing" }),
    );

    expect(props.onStay).toHaveBeenCalledTimes(1);
  });

  it("requires a second click before discarding", async () => {
    const { props } = renderDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "Discard without saving" }),
    );

    expect(props.onDiscardWithoutSaving).not.toHaveBeenCalled();
    expect(
      screen.getByText("Are you sure you want to discard?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This action cannot be undone. All unsaved changes will be lost.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Click again to confirm" }),
    );

    expect(props.onDiscardWithoutSaving).toHaveBeenCalledTimes(1);
  });

  it("cancel returns to the first step of the discard confirmation", async () => {
    const { props } = renderDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "Discard without saving" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(props.onDiscardWithoutSaving).not.toHaveBeenCalled();
    expect(screen.getByText("Leave this setup?")).toBeInTheDocument();
  });

  it("runs the discard pointer-down hook", () => {
    const onDiscardPointerDownCapture = vi.fn();
    renderDialog({ onDiscardPointerDownCapture });

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Discard without saving" }),
    );

    expect(onDiscardPointerDownCapture).toHaveBeenCalledTimes(1);
  });

  it("shows the saving state and disables every action", () => {
    renderDialog({ isSaving: true });

    expect(screen.getByText("Saving...")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("shows the discarding state and disables every action", () => {
    renderDialog({ isDiscarding: true });

    expect(screen.getByText("Discarding...")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("reports Escape closes through onDialogOpenChange", async () => {
    const { props } = renderDialog();

    await userEvent.keyboard("{Escape}");

    expect(props.onDialogOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets the discard confirmation when the dialog closes", async () => {
    const { props } = renderDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "Discard without saving" }),
    );
    expect(
      screen.getByText("Are you sure you want to discard?"),
    ).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(props.onDialogOpenChange).toHaveBeenCalledWith(false);
  });
});
