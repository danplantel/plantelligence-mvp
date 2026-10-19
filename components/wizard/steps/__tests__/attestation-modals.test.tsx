import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AddNowAttestationModal } from "../sections/attestation-modals/add-now-attestation-modal";
import { InviteLaterModal } from "../sections/attestation-modals/invite-later-modal";
import { SkipAttestationModal } from "../sections/attestation-modals/skip-attestation-modal";

describe("AddNowAttestationModal", () => {
  it("gates Continue on accepting the attestation", async () => {
    const onConfirm = vi.fn();
    render(
      <AddNowAttestationModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Confirm Your Disclosures")).toBeInTheDocument();

    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();

    await userEvent.click(
      screen.getByRole("checkbox", {
        name: /I’ve reviewed these disclosures/,
      }),
    );
    expect(continueButton).toBeEnabled();

    await userEvent.click(continueButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Go Back closes the modal", async () => {
    const onClose = vi.fn();
    render(
      <AddNowAttestationModal
        isOpen
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Go Back" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resets the attestation each time it reopens", async () => {
    const { rerender } = render(
      <AddNowAttestationModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: /I’ve reviewed these disclosures/,
      }),
    );
    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeEnabled();

    rerender(
      <AddNowAttestationModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    rerender(
      <AddNowAttestationModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeDisabled();
  });
});

describe("SkipAttestationModal", () => {
  it("confirms the skip", async () => {
    const onConfirm = vi.fn();
    render(
      <SkipAttestationModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Skip Disclosures for now?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("supports going back", async () => {
    const onClose = vi.fn();
    render(
      <SkipAttestationModal
        isOpen
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Go Back" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("InviteLaterModal", () => {
  it("confirms inviting later", async () => {
    const onConfirm = vi.fn();
    render(
      <InviteLaterModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Invite your team later?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("supports going back", async () => {
    const onClose = vi.fn();
    render(
      <InviteLaterModal
        isOpen
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Go Back" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
