import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Landing Page's blue edit affordances.
 *
 * Hovering the hero or the mission and clicking the pencil must open the Edit
 * Panel at the section that owns that copy — the portal's version of what
 * Create/Edit Client and Benefits Step 2 do. `ClientPortal` is stubbed with
 * buttons that call the handlers it is given, so the assertions are about the
 * wiring: which section id each region asks for, and that a participant (no
 * provider) gets no affordances at all.
 */

const mocks = vi.hoisted(() => ({
  portal: {
    clientData: {
      id: "plan-1",
      companyName: "Acme",
      brandColor: "#123456",
      secondaryColor: "#654321",
      heroTitle: "Welcome",
      heroDescription: "Glad you are here",
      missionHeadline: "Our mission",
      missionBody: "Do good",
      keyContacts: [],
    } as Record<string, any>,
    loading: false,
  },
  editing: {
    value: null as null | { canEdit: boolean; focusSection: (id: string) => void },
  },
  focusSection: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => mocks.portal,
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => mocks.editing.value,
}));

vi.mock("@/components/pages/client-portal/client-portal", () => ({
  ClientPortal: (props: any) => (
    <div>
      <span data-testid="edit-indicators">{String(props.showEditIndicators)}</span>
      <button type="button" onClick={props.onHeroTitleClick}>
        Edit hero title
      </button>
      <button type="button" onClick={props.onHeroDescriptionClick}>
        Edit hero description
      </button>
      <button type="button" onClick={props.onHeroBackgroundClick}>
        Edit hero background
      </button>
      <button type="button" onClick={props.onMissionHeadlineClick}>
        Edit mission headline
      </button>
      <button type="button" onClick={props.onMissionBodyClick}>
        Edit mission body
      </button>
    </div>
  ),
}));

import ViewClientPage from "../page";

describe("ViewClientPage — blue edit affordances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.value = {
      canEdit: true,
      focusSection: mocks.focusSection,
    };
  });

  it("asks for the hero section when the hero copy is clicked", async () => {
    const user = userEvent.setup();
    render(<ViewClientPage />);

    await user.click(screen.getByRole("button", { name: "Edit hero title" }));
    await user.click(
      screen.getByRole("button", { name: "Edit hero description" }),
    );

    expect(mocks.focusSection.mock.calls).toEqual([
      ["hero-content"],
      ["hero-content"],
    ]);
  });

  it("asks for the Hero Banner Image card when the photograph is clicked", async () => {
    // The photograph is not in "Hero Content" — that section holds the welcome
    // statement and the banner overlay. It is the "Hero Banner Image" card, the
    // second one in "Images", so it is addressed by its own anchor.
    const user = userEvent.setup();
    render(<ViewClientPage />);

    await user.click(
      screen.getByRole("button", { name: "Edit hero background" }),
    );

    expect(mocks.focusSection.mock.calls).toEqual([["hero-background"]]);
  });

  it("asks for the mission section when the mission copy is clicked", async () => {
    const user = userEvent.setup();
    render(<ViewClientPage />);

    await user.click(
      screen.getByRole("button", { name: "Edit mission headline" }),
    );
    await user.click(screen.getByRole("button", { name: "Edit mission body" }));

    expect(mocks.focusSection.mock.calls).toEqual([
      ["mission-statement"],
      ["mission-statement"],
    ]);
  });

  it("shows the affordances only to a viewer who may edit", () => {
    mocks.editing.value = null;
    render(<ViewClientPage />);

    // No provider → nothing to edit → no hover rings, no pencils.
    expect(screen.getByTestId("edit-indicators")).toHaveTextContent("false");
  });
});
