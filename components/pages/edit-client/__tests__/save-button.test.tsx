import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SaveButton } from "../save-button";

/**
 * `SaveButton` — the fixed bar at the bottom of Edit Plan.
 *
 * Small surface, but it owns the one rule that decides whether an advisor can
 * persist a plan at all: Draft plans always save, Active plans only save once
 * every required field is filled, and the "Complete all required fields"
 * affordance is the only way to reach the first missing field. Archived is
 * deliberately unsaveable — that is pinned here so changing it is a choice
 * rather than an accident.
 *
 * The busy label is asserted from `loadingText`, because `LoadingButton`
 * replaces its children with that label while `isLoading` — the component used
 * to pass a `"Saving..."` ternary as children, which never rendered.
 */

type SaveButtonProps = React.ComponentProps<typeof SaveButton>;

function renderSaveButton(overrides: Partial<SaveButtonProps> = {}) {
  const props: SaveButtonProps = {
    onSave: vi.fn(),
    saving: false,
    clientStatus: "Active",
    isFormValid: true,
    ...overrides,
  };

  render(<SaveButton {...props} />);
  return props;
}

function saveButton() {
  return screen.getByRole("button", { name: /Save Changes/ });
}

const HINT = "Complete all required fields to activate";

describe("SaveButton", () => {
  it("saves a Draft plan even while the form is incomplete", async () => {
    const user = userEvent.setup();
    const props = renderSaveButton({
      clientStatus: "Draft",
      isFormValid: false,
    });

    expect(saveButton()).toBeEnabled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();

    await user.click(saveButton());
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("blocks an Active plan with missing required fields", () => {
    renderSaveButton({ clientStatus: "Active", isFormValid: false });

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it("turns the hint into a button that jumps to the first missing field", async () => {
    const user = userEvent.setup();
    const onInvalidClick = vi.fn();
    renderSaveButton({
      clientStatus: "Active",
      isFormValid: false,
      onInvalidClick,
    });

    await user.click(screen.getByRole("button", { name: new RegExp(HINT) }));

    expect(onInvalidClick).toHaveBeenCalledTimes(1);
    expect(saveButton()).toBeDisabled();
  });

  it("renders the hint as static text when no jump handler is supplied", () => {
    renderSaveButton({ clientStatus: "Active", isFormValid: false });

    expect(
      screen.queryByRole("button", { name: new RegExp(HINT) }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it("saves a valid Active plan and hides the hint", async () => {
    const user = userEvent.setup();
    const props = renderSaveButton({
      clientStatus: "Active",
      isFormValid: true,
    });

    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    await user.click(saveButton());

    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("shows the busy label and refuses a second save while saving", () => {
    const props = renderSaveButton({
      clientStatus: "Active",
      isFormValid: true,
      saving: true,
    });

    const button = screen.getByRole("button", { name: /Saving\.\.\./ });
    expect(button).toBeDisabled();
    expect(screen.queryByText("Save Changes")).not.toBeInTheDocument();

    // fireEvent bypasses user-event's pointer-events check, proving the button
    // itself swallows the click rather than the test helper doing it.
    fireEvent.click(button);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("never saves an Archived plan, even when the form is valid", () => {
    renderSaveButton({ clientStatus: "Archived", isFormValid: true });

    expect(saveButton()).toBeDisabled();
    // The amber hint is Active-only: Archived plans are parked on purpose.
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("keeps the idle label while not saving", () => {
    renderSaveButton({ clientStatus: "Draft", isFormValid: false });

    expect(saveButton()).toHaveTextContent("Save Changes");
    expect(screen.queryByText(/Saving\.\.\./)).not.toBeInTheDocument();
  });
});
