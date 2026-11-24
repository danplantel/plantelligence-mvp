import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The "the panel is showing something the server does not have yet" flag.
 *
 * Every editor reports its own draft through `usePortalDirtyReport`; the provider
 * holds it so the autosave loop (and anything else that asks) knows there is work
 * left. The panel header itself no longer carries an "Unsaved changes" chip —
 * `PortalSaveStatusBadge` reports the write instead.
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

import { usePortalDirtyReport } from "@/components/portal-editing/portal-draft-badge";

describe("usePortalDirtyReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.isDirty = false;
  });

  it("reports an editor's draft to the panel", () => {
    function Probe({ dirty }: { dirty: boolean }) {
      usePortalDirtyReport(dirty);
      return null;
    }

    const { rerender } = render(<Probe dirty />);
    expect(mocks.editing.setDirty).toHaveBeenLastCalledWith(true);

    rerender(<Probe dirty={false} />);
    expect(mocks.editing.setDirty).toHaveBeenLastCalledWith(false);
  });

  it("clears the flag when the editor goes away", () => {
    function Probe() {
      usePortalDirtyReport(true);
      return null;
    }

    const { unmount } = render(<Probe />);
    mocks.editing.setDirty.mockClear();

    unmount();

    expect(mocks.editing.setDirty).toHaveBeenCalledWith(false);
  });
});
