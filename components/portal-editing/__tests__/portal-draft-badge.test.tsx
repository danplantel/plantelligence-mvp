import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The amber **Unsaved changes** chip in a portal panel's header.
 *
 * Every editor reports its own draft through `usePortalDirtyReport`; the provider
 * holds the flag and this badge renders it right beside the red **Live** tag, so a
 * preview that is not saved yet is obvious without scrolling to the Save bar.
 */

const mocks = vi.hoisted(() => ({
  editing: {
    isDirty: false,
    setDirty: vi.fn(),
  },
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => mocks.editing,
}));

import {
  PortalDraftBadge,
  usePortalDirtyReport,
} from "@/components/portal-editing/portal-draft-badge";

describe("PortalDraftBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.isDirty = false;
  });

  it("shows the chip only while the editor holds a draft", () => {
    mocks.editing.isDirty = true;

    render(<PortalDraftBadge />);

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("renders nothing once the draft is saved", () => {
    const { container } = render(<PortalDraftBadge />);

    expect(container).toBeEmptyDOMElement();
  });

  it("reports an editor's draft to the panel header", () => {
    function Probe({ dirty }: { dirty: boolean }) {
      usePortalDirtyReport(dirty);
      return null;
    }

    const { rerender } = render(<Probe dirty />);
    expect(mocks.editing.setDirty).toHaveBeenLastCalledWith(true);

    rerender(<Probe dirty={false} />);
    expect(mocks.editing.setDirty).toHaveBeenLastCalledWith(false);
  });
});
