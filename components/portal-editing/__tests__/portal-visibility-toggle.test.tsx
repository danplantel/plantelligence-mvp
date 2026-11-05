import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The floating "eye" beside the Edit and Comments buttons.
 *
 * One click hides BOTH advisor surfaces so the page can be reviewed the way an
 * employee sees it, and one click brings both back. It must never drive a
 * surface the viewer cannot use: no edit panel for a view-only collaborator, no
 * comments while there is an unsaved draft (that is what blocks commenting), and
 * a disabled button — not a silent no-op — when neither is available.
 */

const mocks = vi.hoisted(() => ({
  editing: {
    target: { page: "home", label: "Home" } as {
      page: string;
      label: string;
    } | null,
    canEdit: true,
    isOpen: false,
    openPanel: vi.fn(),
    closePanel: vi.fn(),
  },
  comments: {
    canComment: true,
    mode: "off" as "on" | "off",
    needsDraft: false,
    setMode: vi.fn(),
  },
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  usePortalEditing: () => mocks.editing,
}));

vi.mock("@/components/comments/comment-mode-provider", () => ({
  useCommentMode: () => mocks.comments,
}));

import { PortalVisibilityToggle } from "@/components/portal-editing/portal-visibility-toggle";

describe("PortalVisibilityToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.target = { page: "home", label: "Home" };
    mocks.editing.canEdit = true;
    mocks.editing.isOpen = false;
    mocks.comments.canComment = true;
    mocks.comments.mode = "off";
    mocks.comments.needsDraft = false;
  });

  it("opens both surfaces from a closed page", async () => {
    const user = userEvent.setup();
    render(<PortalVisibilityToggle />);

    const eye = screen.getByRole("button", {
      name: "Show the editor and comments",
    });
    // Light colours: the button sits outside `.portal-root`.
    expect(eye.className).toContain("bg-white");
    expect(eye.className).toContain("border-gray-200");

    await user.click(eye);

    expect(mocks.editing.openPanel).toHaveBeenCalledTimes(1);
    expect(mocks.comments.setMode).toHaveBeenCalledWith("on");
  });

  it("hides both when both are open", async () => {
    mocks.editing.isOpen = true;
    mocks.comments.mode = "on";
    const user = userEvent.setup();
    render(<PortalVisibilityToggle />);

    await user.click(
      screen.getByRole("button", { name: "Hide the editor and comments" }),
    );

    expect(mocks.editing.closePanel).toHaveBeenCalledTimes(1);
    expect(mocks.comments.setMode).toHaveBeenCalledWith("off");
  });

  it("closes only the surface that was open", async () => {
    mocks.comments.mode = "on";
    const user = userEvent.setup();
    render(<PortalVisibilityToggle />);

    await user.click(
      screen.getByRole("button", { name: "Hide the editor and comments" }),
    );

    expect(mocks.comments.setMode).toHaveBeenCalledWith("off");
    expect(mocks.editing.closePanel).not.toHaveBeenCalled();
  });

  it("never opens an edit panel for a view-only viewer", async () => {
    mocks.editing.canEdit = false;
    const user = userEvent.setup();
    render(<PortalVisibilityToggle />);

    await user.click(
      screen.getByRole("button", { name: "Show the editor and comments" }),
    );

    expect(mocks.editing.openPanel).not.toHaveBeenCalled();
    expect(mocks.comments.setMode).toHaveBeenCalledWith("on");
  });

  it("leaves commenting alone while a draft is unsaved", async () => {
    mocks.comments.needsDraft = true;
    const user = userEvent.setup();
    render(<PortalVisibilityToggle />);

    await user.click(
      screen.getByRole("button", { name: "Show the editor and comments" }),
    );

    expect(mocks.editing.openPanel).toHaveBeenCalledTimes(1);
    expect(mocks.comments.setMode).not.toHaveBeenCalled();
  });

  it("is disabled when the viewer can use neither surface", () => {
    mocks.editing.canEdit = false;
    mocks.comments.canComment = false;
    render(<PortalVisibilityToggle />);

    expect(
      screen.getByRole("button", {
        name: "You have view-only access to this page",
      }),
    ).toBeDisabled();
  });

  it("renders nothing on a page without an editing surface", () => {
    mocks.editing.target = null;
    const { container } = render(<PortalVisibilityToggle />);

    expect(container).toBeEmptyDOMElement();
  });
});
