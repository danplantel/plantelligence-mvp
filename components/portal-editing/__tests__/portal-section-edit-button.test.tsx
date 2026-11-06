import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalSectionEditButton } from "@/components/portal-editing/portal-section-edit-button";

/**
 * The blue Edit button that points the panel at the region it sits on.
 *
 * It lives inside shared sections (the mission's featured image, the footer), so
 * it has to disappear for a participant and inside wizard previews — the two
 * places those sections render with no portal editing provider.
 */

const mocks = vi.hoisted(() => ({
  editing: { value: null as null | Record<string, unknown> },
  focusSection: vi.fn(),
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => mocks.editing.value,
}));

describe("PortalSectionEditButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.value = { canEdit: true, focusSection: mocks.focusSection };
  });

  it("renders nothing where no portal panel exists", () => {
    mocks.editing.value = null;
    render(<PortalSectionEditButton sectionId="images" label="Edit image" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing for a viewer who may not edit", () => {
    mocks.editing.value = { canEdit: false, focusSection: mocks.focusSection };
    render(<PortalSectionEditButton sectionId="images" label="Edit image" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the panel on the section it names", async () => {
    const user = userEvent.setup();
    render(<PortalSectionEditButton sectionId="disclosure" label="Edit footer" />);

    await user.click(screen.getByRole("button", { name: "Edit footer" }));

    expect(mocks.focusSection).toHaveBeenCalledWith("disclosure");
  });

  it("never triggers the region underneath it", async () => {
    const user = userEvent.setup();
    const onRegionClick = vi.fn();
    render(
      <div onClick={onRegionClick}>
        <PortalSectionEditButton sectionId="images" label="Edit image" />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Edit image" }));

    expect(mocks.focusSection).toHaveBeenCalledWith("images");
    expect(onRegionClick).not.toHaveBeenCalled();
  });
});
