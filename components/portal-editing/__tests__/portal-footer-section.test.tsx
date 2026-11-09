import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalFooterSection } from "@/components/portal-editing/portal-footer-section";

/**
 * The Disclosure section the News & Events, My Benefits Team and Employee
 * Resources panels now carry.
 *
 * Those pages' own functions are `marketing`, `key_contacts` and `documents`, so
 * a page-scoped `canEditFunction("plan_details_branding")` answered false and the
 * section vanished — even for the owner. The provider exposes `canEditBranding`
 * for exactly this check; these tests pin that it is what gates the section.
 */

const editing = vi.hoisted(() => ({
  canEdit: true,
  canEditBranding: true as boolean | undefined,
  canEditFunction: vi.fn(() => false),
  planId: "plan-1",
  patchClientData: vi.fn(),
  beginSave: vi.fn(),
  finishSave: vi.fn(),
  failSave: vi.fn(),
  resetSave: vi.fn(),
  refetchPortal: vi.fn(async () => null),
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => editing,
}));

// The dialog is covered by its own suite; this one is about the gate.
vi.mock("@/components/portal-editing/portal-footer-dialog", () => ({
  PortalFooterDialog: () => <div data-testid="portal-footer-dialog" />,
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({
    clientData: { id: "plan-1", companyName: "Acme Corp" },
  }),
}));

describe("PortalFooterSection — branding gate", () => {
  beforeEach(() => {
    editing.canEditBranding = true;
    editing.canEditFunction.mockClear();
  });

  it("renders the footer editor when the viewer can edit branding", () => {
    render(<PortalFooterSection />);

    expect(screen.getByTestId("portal-footer-dialog")).toBeInTheDocument();
    // The direct branding check is used, not the page-scoped function (which
    // News & Events, My Benefits Team and Employee Resources do not list).
    expect(editing.canEditFunction).not.toHaveBeenCalled();
  });

  it("renders nothing when the viewer cannot edit branding", () => {
    editing.canEditBranding = false;
    render(<PortalFooterSection />);

    expect(
      screen.queryByTestId("portal-footer-dialog"),
    ).not.toBeInTheDocument();
  });
});
