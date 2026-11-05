import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * My Benefits Team's Edit Panel IS Create Plan's Step 3 Edit Panel.
 *
 * The accordions, the contact fields, the designation pills and the CTA picker
 * come from the shared `KeyContactsEditor`; this suite pins the PORTAL HOST's
 * side of that contract — the plan's `keyContacts` blob in, the plan PUT out,
 * and the card repaint on every keystroke.
 */

const mocks = vi.hoisted(() => ({
  patchClientData: vi.fn(),
  refetchPortal: vi.fn(async () => null),
  beginSave: vi.fn(),
  finishSave: vi.fn(),
  failSave: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetch: vi.fn(async (_input: unknown, _init?: RequestInit) => ({
    ok: true,
    json: async () => ({ success: true }),
  })),
}));

// A stable plan object: the editor re-seeds its blob from `clientData`. `original`
// is a pristine copy, re-applied before each test, because one test empties it.
const portal = vi.hoisted(() => ({
  original: {
    id: "plan-1",
    companyName: "Acme Corp",
    keyContacts: {
      contacts: [
        {
          id: 1,
          name: "Dana Reid",
          firstName: "Dana",
          lastName: "Reid",
          title: "Benefits Advisor",
          email: "dana@acme.test",
          phone: "(555) 010-0100",
          benefitsCategory: "Retirement",
          contactType: "individual",
          enableContactButton: true,
          // Stored spelling — the picker's own word for it is "schedule".
          contactButtonTypes: ["calendar"],
          schedulingUrl: "https://calendly.com/dana",
        },
        {
          id: 2,
          name: "Support Line",
          displayName: "Support Line",
          benefitsCategory: "Retirement",
          contactType: "team_support",
        },
      ],
      displayStyle: 0,
      mobileDisplayStyle: 0,
      contactDisplayOrder: [1, 2],
    },
  } as Record<string, unknown>,
  clientData: {} as Record<string, unknown>,
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => portal,
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => {
  const value = {
    target: { page: "team", label: "My Benefits Team" },
    planId: "plan-1",
    canEdit: true,
    isOpen: true,
    closePanel: () => {},
    beginSave: mocks.beginSave,
    finishSave: mocks.finishSave,
    failSave: mocks.failSave,
    saveState: "idle",
    saveError: null,
    patchClientData: mocks.patchClientData,
    refetchPortal: mocks.refetchPortal,
  };
  return {
    usePortalEditing: () => value,
    useOptionalPortalEditing: () => value,
  };
});

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

// The image editor, the pill typeahead, the CTA picker and the duplicate-address
// hint are shared controls covered by their own suites; stubbed so this one covers
// the panel's wiring.
vi.mock("@/components/ui/universal-image-editor-modal", () => ({
  UniversalImageEditorModal: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="image-editor">{placeholder}</div>
  ),
}));

vi.mock("@/components/ui/chip-typeahead", () => ({
  ChipTypeahead: ({ selectedValues }: { selectedValues: string[] }) => (
    <div data-testid="chip-typeahead" data-selected={selectedValues.join(",")} />
  ),
}));

vi.mock("@/components/ui/contact-cta-picker", () => ({
  ContactCtaPicker: ({ value }: { value: unknown[] }) => (
    <div data-testid="cta-picker" data-count={value.length} />
  ),
}));

vi.mock("@/components/ui/contact-email-conflict-notice", () => ({
  ContactEmailConflictHint: () => null,
  ContactEmailConflictNotice: () => null,
}));

import { PortalTeamEditor } from "@/components/portal-editing/editors/portal-team-editor";

/** Every PUT the panel made, with its parsed body. */
function putBodies() {
  return mocks.fetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)));
}

describe("PortalTeamEditor — the Create Plan contact panel, hosted on the portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portal.clientData = JSON.parse(JSON.stringify(portal.original));
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("lists one collapsed accordion per contact", () => {
    render(<PortalTeamEditor />);

    expect(screen.getByText("Dana Reid")).toBeInTheDocument();
    expect(screen.getByText("Support Line")).toBeInTheDocument();
    expect(screen.getByText(/Contact Details/)).toBeInTheDocument();
    // Collapsed: no contact fields until a row is opened.
    expect(screen.queryByText("Contact Type")).not.toBeInTheDocument();
  });

  it("draws each contact on ONE square-edged frame", () => {
    render(<PortalTeamEditor />);

    const rows = screen.getAllByTestId("key-contact-row");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // One border, and no radius: the row used to be a `Card` (rounded-xl)
      // with a ring on top when open, which read as two borders.
      expect(row.className).toContain("rounded-none");
      expect(row.className).toContain("border");
      expect(row.className).not.toContain("rounded-xl");
      expect(row.className).not.toContain("ring-2");
    }
  });

  it("numbers the panel's two sections, the style first", () => {
    render(<PortalTeamEditor />);

    expect(
      screen.getByText(/Section 1: Main Contact Highlight Style/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Section 2: Contact Details/)).toBeInTheDocument();
  });

  it("offers the main contact's two styles, default selected", () => {
    render(<PortalTeamEditor />);

    expect(screen.getByRole("button", { name: /Default style/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Highlighted/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reads the plan's stored highlight style", () => {
    portal.clientData = {
      id: "plan-1",
      keyContacts: {
        contacts: [{ id: 1, name: "Dana Reid", benefitsCategory: "Retirement" }],
        mainContactStyle: "highlighted",
      },
    };
    render(<PortalTeamEditor />);

    expect(screen.getByRole("button", { name: /Highlighted/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("previews and saves the highlight style with the contacts", async () => {
    const user = userEvent.setup();
    render(<PortalTeamEditor />);

    await user.click(screen.getByRole("button", { name: /Highlighted/ }));

    expect(mocks.patchClientData).toHaveBeenCalled();
    const lastCall =
      mocks.patchClientData.mock.calls[
        mocks.patchClientData.mock.calls.length - 1
      ][0] as { keyContacts: { mainContactStyle?: string } };
    expect(lastCall.keyContacts.mainContactStyle).toBe("highlighted");

    await waitFor(() => expect(putBodies()).toHaveLength(1), { timeout: 3000 });
    expect(putBodies()[0].keyContacts.mainContactStyle).toBe("highlighted");
  });

  it("opens a contact's card with the wizard's own fields", async () => {
    const user = userEvent.setup();
    render(<PortalTeamEditor />);

    await user.click(screen.getByText("Dana Reid"));

    expect(screen.getByText("Contact Type")).toBeInTheDocument();
    expect(screen.getByText("Designations (optional)")).toBeInTheDocument();
    expect(screen.getByText("Contact Info")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Mark as primary contact/),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("email@example.com")).toHaveValue(
      "dana@acme.test",
    );
    expect(screen.getByTestId("cta-picker")).toHaveAttribute("data-count", "1");
  });

  it("repaints the portal card as a field changes", async () => {
    const user = userEvent.setup();
    render(<PortalTeamEditor />);

    await user.click(screen.getByText("Dana Reid"));
    await user.type(screen.getByPlaceholderText("email@example.com"), "2");

    expect(mocks.patchClientData).toHaveBeenCalled();
    const lastCall =
      mocks.patchClientData.mock.calls[
        mocks.patchClientData.mock.calls.length - 1
      ][0] as { keyContacts: { contacts: { email?: string }[] } };
    expect(lastCall.keyContacts.contacts[0].email).toBe("dana@acme.test2");
  });

  it("writes the blob once the typing settles", async () => {
    const user = userEvent.setup();
    render(<PortalTeamEditor />);

    await user.click(screen.getByText("Dana Reid"));
    await user.type(screen.getByPlaceholderText("email@example.com"), "2");

    await waitFor(() => expect(putBodies()).toHaveLength(1), { timeout: 3000 });
    expect(mocks.fetch.mock.calls[0][0]).toBe("/api/clients/plan-1");
    expect(putBodies()[0].keyContacts.contacts[0].email).toBe(
      "dana@acme.test2",
    );
    expect(mocks.finishSave).toHaveBeenCalled();
  });

  it("saves at once when the row's Save Changes is pressed", async () => {
    const user = userEvent.setup();
    render(<PortalTeamEditor />);

    await user.click(screen.getByText("Dana Reid"));
    await user.type(screen.getByPlaceholderText("email@example.com"), "2");
    await user.click(screen.getByRole("button", { name: /Save Changes/ }));

    await waitFor(() => expect(putBodies().length).toBeGreaterThanOrEqual(1));
    expect(putBodies()[0].keyContacts.contacts).toHaveLength(2);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Contact saved");
  });

  it("removes a contact and its place in the display order", async () => {
    const user = userEvent.setup();
    render(<PortalTeamEditor />);

    await user.click(screen.getByText("Support Line"));
    await user.click(
      screen.getByRole("button", { name: /Delete contact/ }),
    );

    await waitFor(() => expect(putBodies()).toHaveLength(1));
    const blob = putBodies()[0].keyContacts;
    expect(blob.contacts).toHaveLength(1);
    expect(blob.contacts[0].id).toBe(1);
    expect(blob.contactDisplayOrder).toEqual([1]);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Contact removed");
  });

  it("says when the plan has no contacts", () => {
    portal.clientData = {
      id: "plan-1",
      keyContacts: { contacts: [] },
    };
    render(<PortalTeamEditor />);

    expect(
      screen.getByText(/This plan has no contacts yet/),
    ).toBeInTheDocument();
  });
});
