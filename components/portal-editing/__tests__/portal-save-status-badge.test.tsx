import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The chip that replaced **Unsaved changes**.
 *
 * Portal panels write themselves a beat after the last edit, so the header says
 * what the WRITE is doing — saving, saved a moment ago, or failed — instead of
 * asking the advisor to press something.
 */

const mocks = vi.hoisted(() => ({
  editing: {
    saveState: "idle" as "idle" | "saving" | "saved" | "error",
    saveError: null as string | null,
  },
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => mocks.editing,
}));

import {
  PortalSaveStatusBadge,
  SAVE_STATUS_VISIBLE_MS,
} from "@/components/portal-editing/portal-save-status-badge";

describe("PortalSaveStatusBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.editing.saveState = "idle";
    mocks.editing.saveError = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says nothing while there is nothing to say", () => {
    const { container } = render(<PortalSaveStatusBadge />);

    expect(container).toBeEmptyDOMElement();
  });

  it("reports a write in flight", () => {
    mocks.editing.saveState = "saving";

    render(<PortalSaveStatusBadge />);

    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  it("shows Saved for a moment, then gets out of the header's way", () => {
    mocks.editing.saveState = "saved";
    const { container } = render(<PortalSaveStatusBadge />);

    expect(screen.getByText("Saved")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(SAVE_STATUS_VISIBLE_MS);
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps a failure on screen, with the server's reason", () => {
    mocks.editing.saveState = "error";
    mocks.editing.saveError = "Could not save this page.";

    render(<PortalSaveStatusBadge />);

    expect(screen.getByText("Couldn’t save")).toHaveAttribute(
      "title",
      "Could not save this page.",
    );
  });
});
