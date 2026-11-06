import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The portal Home panel must preview every keystroke in the live page beside it.
 *
 * The page reads `clientData` from the portal context, so the panel's only way to
 * repaint it before Save is `patchClientData`. This pins that the shared Step 2
 * sections actually route their edits into that patch — the regression that
 * silently turned the panel back into save-only.
 */

const mocks = vi.hoisted(() => ({
  patchClientData: vi.fn(),
  refetchPortal: vi.fn(),
  beginSave: vi.fn(),
  finishSave: vi.fn(),
  failSave: vi.fn(),
  resetSave: vi.fn(),
}));

const clientData = {
  id: "plan-1",
  companyName: "Acme Corp",
  companyWebsite: "",
  companyLogo: "",
  logoFileName: "",
  brandColor: "#1F3A60",
  secondaryColor: "#6B7280",
  typographyTheme: "classic",
  heroTitle: "Hello team",
  heroDescription: "Body copy",
  missionHeadline: "Our mission",
  missionBody: "Mission body",
  keyContacts: [],
};

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({ clientData, patchClientData: mocks.patchClientData }),
}));

const editingValue = {
  target: { page: "home", label: "Landing Page" },
  planId: "plan-1",
  isOpen: true,
  canEdit: true,
  saveState: "idle" as const,
  saveError: null,
  beginSave: mocks.beginSave,
  finishSave: mocks.finishSave,
  failSave: mocks.failSave,
  resetSave: mocks.resetSave,
  patchClientData: mocks.patchClientData,
  refetchPortal: mocks.refetchPortal,
};

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  usePortalEditing: () => editingValue,
  useOptionalPortalEditing: () => editingValue,
}));

import { PortalHomeEditor } from "@/components/portal-editing/editors/portal-home-editor";

describe("PortalHomeEditor live preview", () => {
  beforeEach(() => {
    mocks.patchClientData.mockClear();
  });

  it("patches the portal context when the banner headline changes", async () => {
    const user = userEvent.setup();
    render(<PortalHomeEditor />);

    const headline = screen.getByDisplayValue("Hello team");
    await user.type(headline, "!");

    expect(mocks.patchClientData).toHaveBeenCalled();
    const patches = mocks.patchClientData.mock.calls.map(([patch]) => patch);
    // One patch per keystroke, carrying the live value the portal will render.
    expect(patches.at(-1)).toEqual(
      expect.objectContaining({ heroTitle: "Hello team!" }),
    );
  });

  it("carries the footer disclosure as the panel's own last section", async () => {
    const user = userEvent.setup();
    render(<PortalHomeEditor />);

    // The section is there, numbered by the panel, with the scope notice that says
    // which four footers it paints.
    expect(screen.getByText(/Section \d+: Disclosure/)).toBeInTheDocument();
    expect(
      screen.getByText(/Where this disclosure appears/i),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Footer disclosure"), "T");

    // The edit is a `disclaimers` patch — the value the portal layout resolves the
    // footer from — and it creates the Home Page row the non-hub pages read.
    const patches = mocks.patchClientData.mock.calls.map(([patch]) => patch);
    const last = patches.at(-1) as {
      disclaimers?: { disclaimers?: { locations?: string[] }[] };
    };
    expect(last.disclaimers?.disclaimers).toHaveLength(1);
    expect(last.disclaimers?.disclaimers?.[0].locations).toEqual(["Home Page"]);
  });
});
