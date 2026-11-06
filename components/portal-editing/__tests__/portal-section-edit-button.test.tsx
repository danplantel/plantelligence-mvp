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
 *
 * When the section is edited on ANOTHER page (the footer disclosure), the button
 * navigates there and carries the request in the URL.
 */

const mocks = vi.hoisted(() => ({
  editing: { value: null as null | Record<string, unknown> },
  focusSection: vi.fn(),
  pathname: "/plan-1/news-events",
  search: "?comments=on",
  assign: vi.fn(),
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => mocks.editing.value,
}));

describe("PortalSectionEditButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.value = { canEdit: true, focusSection: mocks.focusSection };
    // The button reads the URL (not the Next router): it must work in the shared
    // sections that also render inside wizard previews.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        // Getters, so a test can move the "current page" after this runs.
        get pathname() {
          return mocks.pathname;
        },
        get search() {
          return mocks.search;
        },
        origin: "http://localhost",
        href: "",
        assign: mocks.assign,
      },
    });
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

  it("navigates to the page that owns the section, carrying the request", async () => {
    const user = userEvent.setup();
    render(
      <PortalSectionEditButton
        sectionId="disclosure"
        label="Edit footer"
        editPath="/plan-1"
        editHref="/plan-1#portal-footer"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit footer" }));

    // The section and the page it came from ride the URL; the footer's anchor is
    // kept so the browser lands on the footer itself. `comments=on` stays because
    // it is what mounts the editing chrome at all — the rail opens closed instead.
    expect(mocks.assign).toHaveBeenCalledWith(
      "/plan-1?comments=on&editSection=disclosure&editFrom=News+%26+Events#portal-footer",
    );
    // Nothing to open here: this page has no Disclosure section.
    expect(mocks.focusSection).not.toHaveBeenCalled();
  });

  it("opens in place when it is already on the owning page", async () => {
    mocks.pathname = "/plan-1";
    const user = userEvent.setup();
    render(
      <PortalSectionEditButton
        sectionId="disclosure"
        label="Edit footer"
        editPath="/plan-1"
        editHref="/plan-1#portal-footer"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit footer" }));

    expect(mocks.focusSection).toHaveBeenCalledWith("disclosure");
    expect(mocks.assign).not.toHaveBeenCalled();
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

  it("paints its label and uses it as the tooltip", async () => {
    // The hero photograph's button names the card it opens in words, because
    // "the photograph" is not guessable from a bare pencil on a large surface.
    const user = userEvent.setup();
    render(
      <PortalSectionEditButton
        sectionId="hero-background"
        label="Edit Hero Banner Image"
      />,
    );

    const button = screen.getByRole("button", {
      name: "Edit Hero Banner Image",
    });
    expect(button).toHaveTextContent("Edit Hero Banner Image");
    expect(button).toHaveAttribute("title", "Edit Hero Banner Image");

    await user.click(button);
    expect(mocks.focusSection).toHaveBeenCalledWith("hero-background");
  });
});
